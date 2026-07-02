import { NextResponse } from "next/server";
import { isPlatformRole, isSysAdmin } from "@repo/auth";
import { countOwnedTeams, countSysAdmins, deleteUser, getUserById, updateAdminUser } from "@repo/data";
import { requireSysAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-001 — 后台用户编辑/删除 API（F02，真实 DB，CAP-DATA）。
// PATCH /api/admin/users/:id { firstName?, lastName?, platformRole? } —— 编辑资料 + 平台角色。
// DELETE /api/admin/users/:id —— 删除用户（前端弹确认框；级联由外键 ON DELETE CASCADE 处理）。
//
// review 加固（PR #171 review，2 项 high + 1 项 medium）：
// 1. 禁止自我删除：DELETE 不允许目标是当前操作者自己（会话失效/账号消失，且绕过下面第 2 点
//    的"最后一个 SysAdmin"防线——自删不经过 platformRole 校验）。
// 2. 禁止删除拥有团队的用户：teams.owner_user_id 是 ON DELETE CASCADE（既有 schema，非本次
//    引入），删除一个拥有团队的用户会级联删掉整个团队（其他成员的 team_members/invites/
//    rooms/boards 等），不只是被删用户自己的数据。删除前查 countOwnedTeams，>0 就拒绝，要求
//    先转移团队所有权（团队自身设置里的操作，不在本 feature 范围）。
// 3. 禁止自我降级 + 禁止清零最后一个 SysAdmin：PATCH 把 platformRole 改成 "user" 时，若目标
//    是操作者自己，或该用户是平台上仅剩的一个 SysAdmin，均拒绝——避免出现零 SysAdmin、只能靠
//    dev-only 的 grant-sysadmin 端点恢复的锁死场景。
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
    if (!isPlatformRole(platformRole)) {
      errors.platformRole = "平台角色必须是 user 或 sysadmin";
    } else if (platformRole === "user" && isSysAdmin(user.platform_role)) {
      // 只在"当前是 sysadmin、要降级成 user"这个方向上校验；sysadmin -> sysadmin 或
      // user -> sysadmin（提升）不受影响。
      // 注意：users.id 是 Postgres bigint，node-postgres 默认把 bigint 列反序列化成字符串
      // （避免精度丢失），即便 User.id 类型标注是 number，gate.user.id 运行时实际是字符串
      // （如 "180"）。userId 来自 Number(params.id) 是真正的 number，两边类型不一致时
      // `===` 会静默恒为 false（曾在此踩坑：自我降级/自我删除的比较全部失效）。统一转
      // Number() 再比较。
      if (userId === Number(gate.user.id)) {
        errors.platformRole = "不能把自己的平台角色降级";
      } else {
        const sysAdminCount = await countSysAdmins();
        if (sysAdminCount <= 1) errors.platformRole = "不能降级平台上最后一个系统管理员";
        else fields.platformRole = platformRole;
      }
    } else {
      fields.platformRole = platformRole;
    }
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
  // 见上方 PATCH 里的注释：gate.user.id 运行时是字符串（bigint 列），须 Number() 后再比较。
  if (userId === Number(gate.user.id)) {
    return NextResponse.json({ error: "不能删除自己的账号" }, { status: 400 });
  }
  const user = await getUserById(userId);
  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

  const ownedTeamCount = await countOwnedTeams(userId);
  if (ownedTeamCount > 0) {
    return NextResponse.json(
      { error: "该用户拥有团队，删除会级联影响团队内其他成员的数据；请先转移团队所有权后再删除" },
      { status: 409 }
    );
  }

  await deleteUser(userId);
  return NextResponse.json({ ok: true });
}
