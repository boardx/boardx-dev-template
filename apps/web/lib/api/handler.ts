// lib/api/handler.ts — API 路由的三层中间件（ADR-015）。
//
// 背景：人类问"后台是否该换 NestJS"。实测痛点真实存在——117 个路由各写一遍
// currentUser()、211 处手写 401、**0 个路由有输入校验**、83 处 catch 可能把内部
// 错误细节回传给客户端（#539 的 String(err) 泄漏不是孤例）。但根因不是 Next.js
// 弱，是这三层根本没人建；而 NestJS 跑不了 Cloudflare Workers（devportal 有 10 个
// edge 路由），换过去会造成两套后端范式。
//
// 于是：用 ~200 行拿 NestJS 90% 的收益，零重写、零运行时分裂——
//   withAuth        ≈ Guard（干掉重复鉴权与 401 分支）
//   withValidation  ≈ Pipe + class-validator（zod DTO，从 0 建起校验层）
//   withErrorBoundary ≈ ExceptionFilter（统一错误码；内部细节只进日志，永不回传）
// 这套 wrapper 是纯函数 + Web 标准 Request/Response，Node 与 Workers 都能跑
// （devportal 也能直接用）。
import { NextResponse } from "next/server";
import type { z } from "zod";
import { currentUser } from "@/lib/session";
import type { User } from "@repo/data";

/** 路由可抛出它来表达"预期内的失败"——状态码与 code 会原样回给客户端。 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    /** 仅进日志，永不回传给客户端 */
    readonly detail?: unknown
  ) {
    super(code);
    this.name = "ApiError";
  }
}

export type RouteCtx<P = Record<string, string>> = { params: P };
export type Handler<P = Record<string, string>> = (req: Request, ctx: RouteCtx<P>) => Promise<Response>;
export type AuthedHandler<P = Record<string, string>> = (
  req: Request,
  ctx: RouteCtx<P> & { user: User }
) => Promise<Response>;
export type ValidatedHandler<T, P = Record<string, string>> = (
  req: Request,
  ctx: RouteCtx<P> & { user: User; body: T }
) => Promise<Response>;

/** 统一错误边界（≈ ExceptionFilter）：预期内错误回稳定 code；意外错误只回
 *  internal_error，细节进服务端日志——**内部错误细节永不出网**（#539 教训）。 */
export function withErrorBoundary<P>(handler: Handler<P>): Handler<P> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status >= 500) console.error(`[api] ${err.code}`, err.detail ?? err);
        return NextResponse.json({ error: err.code }, { status: err.status });
      }
      // 意外错误：日志留全貌，响应只给稳定标识（不含 message/stack/SQL/路径）
      console.error(`[api] unhandled ${req.method} ${new URL(req.url).pathname}`, err);
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  };
}

/** 登录门（≈ Guard）：未登录直接 401，handler 拿到非空 user——
 *  取代 117 处重复的 currentUser() + 211 处手写 401 分支。 */
export function withAuth<P>(handler: AuthedHandler<P>): Handler<P> {
  return withErrorBoundary<P>(async (req, ctx) => {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    return handler(req, { ...ctx, user });
  });
}

/** 登录 + 入参校验（≈ Guard + Pipe）：zod 解析失败 → 400 + 字段级问题清单
 *  （问题描述来自 schema 自身，不含用户输入回显，避免反射型注入面）。 */
export function withValidation<S extends z.ZodTypeAny, P = Record<string, string>>(
  schema: S,
  handler: ValidatedHandler<z.infer<S>, P>
): Handler<P> {
  return withAuth<P>(async (req, ctx) => {
    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      throw new ApiError(400, "invalid_json_body");
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "validation_failed",
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), code: i.code })),
        },
        { status: 400 }
      );
    }
    return handler(req, { ...ctx, body: parsed.data });
  });
}

/** 公开路由（无登录门）但仍要错误边界——如未登录可读的分享页/公开白板。 */
export const withPublic = withErrorBoundary;
