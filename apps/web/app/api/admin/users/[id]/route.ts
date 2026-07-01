import { NextResponse } from "next/server";
import { isPlatformRole } from "@repo/auth";
import { deleteUser, getUserById, updateAdminUser } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-001 — 后台用户编辑/删除 API（F02，真实 DB，CAP-DATA）。
// PATCH /api/admin/users/:id { firstName?, lastName?, platformRole? } —— 编辑资料 + 平台角色。
// DELETE /api/admin/users/:id —— 删除用户（前端弹确认框；级联由外键 ON DELETE CASCADE 处理）。
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const userId = Number(params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "无效的用户 ID" }, { status: 400 });
  }
  const user = await getUserById(userId);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    firstName?: unknown;
    lastName?: unknown;
    platformRole?: unknown;
  };

  const errors: Record<string, string> = {};
  const fields: { firstName?: string; lastName?: string; platformRole?: string } = {};

  if (body.firstName !== undefined) {
    const firstName = String(body.firstName).trim();
    if (!firstName) errors.firstName = "名不能为空";
    else fields.firstName = firstName;
  }
  if (body.lastName !== undefined) {
    const lastName = String(body.lastName).trim();
    if (!lastName) errors.lastName = "姓不能为空";
    else fields.lastName = lastName;
  }
  if (body.platformRole !== undefined) {
    const platformRole = String(body.platformRole);
    if (!isPlatformRole(platformRole)) errors.platformRole = "平台角色必须是 user 或 sysadmin";
    else fields.platformRole = platformRole;
  }
  if (Object.keys(errors).length) return NextResponse.json({ errors }, { status: 400 });

  await updateAdminUser(userId, fields);
  const updated = await getUserById(userId);
  return NextResponse.json({
    user: {
      id: updated!.id,
      email: updated!.email,
      firstName: updated!.first_name,
      lastName: updated!.last_name,
      platformRole: updated!.platform_role,
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const gate = await requireSysAdmin();
  if (!gate.ok) {
    const status = gate.reason === "unauthenticated" ? 401 : 403;
    return NextResponse.json({ error: gate.reason === "unauthenticated" ? "未登录" : "无权限" }, { status });
  }

  const userId = Number(params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: "无效的用户 ID" }, { status: 400 });
  }
  const user = await getUserById(userId);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  await deleteUser(userId);
  return NextResponse.json({ ok: true });
}
