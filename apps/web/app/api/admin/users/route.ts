import { NextResponse } from "next/server";
import { isValidEmail, isPlatformRole } from "@repo/auth";
import { createUser, findUserByEmail, listAdminUsers, setPlatformRole } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-001 — 后台用户管理列表/创建 API（F02，真实 DB，CAP-DATA）。
// GET /api/admin/users?q=&page=&pageSize= 分页/按邮箱或姓名搜索；每行含邮箱/姓名/平台角色/团队数/个人 Credit 余额
// （真实聚合，个人 Credit 来自该用户的 credit_wallets，无钱包则 0）。
// POST 创建用户（后台直接建号，无密码——比照 F01 门控 + F03 团队管理同一套判定复用）。
// 越权（未登录/非 SysAdmin）分别 401/403。
export async function GET(req: Request) {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(params.get("pageSize") ?? "10") || 10;
  const pageSize = Math.min(50, Math.max(1, pageSizeRaw));

  const { users, total } = await listAdminUsers({ q, page, pageSize });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      platformRole: u.platform_role,
      teamCount: Number(u.team_count),
      creditBalance: Number(u.credit_balance),
      createdAt: u.created_at,
    })),
    total,
    page,
    pageSize,
  });
}

export async function POST(req: Request) {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    firstName?: unknown;
    lastName?: unknown;
    email?: unknown;
    platformRole?: unknown;
  };
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();

  const errors: Record<string, string> = {};
  if (!firstName) errors.firstName = "名不能为空";
  if (!lastName) errors.lastName = "姓不能为空";
  if (!email || !isValidEmail(email)) errors.email = "邮箱格式不正确";
  else if (await findUserByEmail(email)) errors.email = "邮箱已存在";
  if (Object.keys(errors).length) return NextResponse.json({ errors }, { status: 400 });

  const platformRole = isPlatformRole(String(body.platformRole ?? "")) ? String(body.platformRole) : "user";

  const created = await createUser({
    email,
    passwordHash: null, // 后台创建的账号无初始密码；需走"忘记密码"设置后才能邮箱密码登录
    firstName,
    lastName,
    provider: "admin",
  });
  if (platformRole !== "user") {
    await setPlatformRole(created.id, platformRole);
  }

  return NextResponse.json(
    {
      user: {
        id: created.id,
        email: created.email,
        firstName: created.first_name,
        lastName: created.last_name,
        platformRole,
        teamCount: 0,
        creditBalance: 0,
        createdAt: created.created_at,
      },
    },
    { status: 201 }
  );
}
