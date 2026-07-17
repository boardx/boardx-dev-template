// lib/api/handler 单测（ADR-015）：三层中间件的行为契约。
// 核心断言：**内部错误细节永不出网**（#539 String(err) 泄漏的回归守卫）。
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { ApiError, withAuth, withErrorBoundary, withValidation, withPublic } from "./handler";

vi.mock("@/lib/session", () => ({ currentUser: vi.fn() }));
const { currentUser } = await import("@/lib/session");
const mockUser = (u: unknown) => vi.mocked(currentUser).mockResolvedValue(u as never);

function req(body?: unknown): Request {
  return new Request("http://x.test/api/thing", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const ctx = { params: {} };

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("withErrorBoundary（≈ ExceptionFilter）", () => {
  it("意外错误只回 internal_error——不泄漏 message/stack（#539 回归守卫）", async () => {
    const leaky = withPublic(async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2");
    });
    const res = await leaky(req(), ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });

  it("ApiError 回稳定 code，detail 不出网", async () => {
    const h = withPublic(async () => {
      throw new ApiError(404, "board_not_found", { sql: "SELECT * FROM boards WHERE id=42" });
    });
    const res = await h(req(), ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "board_not_found" });
    expect(JSON.stringify(body)).not.toContain("SELECT");
  });

  it("正常返回原样透传", async () => {
    const h = withPublic(async () => Response.json({ ok: true }));
    expect(await (await h(req(), ctx)).json()).toEqual({ ok: true });
  });
});

describe("withAuth（≈ Guard）", () => {
  it("未登录 → 401 unauthenticated，handler 不执行", async () => {
    mockUser(undefined);
    const inner = vi.fn();
    const res = await withAuth(inner)(req(), ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthenticated" });
    expect(inner).not.toHaveBeenCalled();
  });

  it("已登录 → handler 拿到非空 user", async () => {
    mockUser({ id: 7, email: "a@b.c" });
    const res = await withAuth(async (_r, c) => Response.json({ uid: c.user.id }))(req(), ctx);
    expect(await res.json()).toEqual({ uid: 7 });
  });

  it("自带错误边界：handler 抛错也不泄漏", async () => {
    mockUser({ id: 1 });
    const res = await withAuth(async () => {
      throw new Error("internal detail leak");
    })(req(), ctx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal_error" });
  });
});

describe("withValidation（≈ Pipe + class-validator）", () => {
  const schema = z.object({ name: z.string().min(1), count: z.number().int().positive() });

  it("校验通过 → handler 拿到类型安全的 body", async () => {
    mockUser({ id: 1 });
    const res = await withValidation(schema, async (_r, c) => Response.json({ got: c.body.name }))(
      req({ name: "board", count: 3 }),
      ctx
    );
    expect(await res.json()).toEqual({ got: "board" });
  });

  it("校验失败 → 400 + 字段级 issues（不回显用户输入）", async () => {
    mockUser({ id: 1 });
    const res = await withValidation(schema, async () => Response.json({}))(
      req({ name: "", count: -1, evil: "<script>alert(1)</script>" }),
      ctx
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_failed");
    expect(body.issues.map((i: { path: string }) => i.path).sort()).toEqual(["count", "name"]);
    expect(JSON.stringify(body)).not.toContain("<script>");
  });

  it("非法 JSON → 400 invalid_json_body", async () => {
    mockUser({ id: 1 });
    const bad = new Request("http://x.test/api/thing", { method: "POST", body: "{not json" });
    const res = await withValidation(schema, async () => Response.json({}))(bad, ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_json_body" });
  });

  it("未登录时校验前就 401（Guard 在 Pipe 之前）", async () => {
    mockUser(undefined);
    const inner = vi.fn();
    const res = await withValidation(schema, inner)(req({ name: "x", count: 1 }), ctx);
    expect(res.status).toBe(401);
    expect(inner).not.toHaveBeenCalled();
  });
});
