import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-admin-001-manage-users — 后台用户管理 API。
// 范围：内存样例用户（GET 列表 + POST 创建），不接 DB（packages/data 未含 admin 角色/credits 列）。
//
// ── 管理员判定（STUB）─────────────────────────────────────────────────────
// 真实实现应读用户的 admin 角色（如 users.role / 专门的 admin 表）。当前 data 层
// 无此字段，故用占位策略：默认把任意已登录用户当作管理员（ADMIN_GATE_OPEN=true），
// 这样主流程（管理员看列表 + 创建）端到端可跑；把环境变量设为 "false" 可触发 403
// 非管理员分支。未登录恒为 401。后续接入角色字段后替换 isAdmin() 即可。
function isAdmin(_userId: number): boolean {
  return process.env.ADMIN_GATE_OPEN !== "false";
}

export type AdminUserRole = "admin" | "user";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminUserRole;
  credits: number;
  joined: string; // YYYY-MM-DD
  disabled: boolean;
}

// 内存样例数据（进程级；重启即重置）。
const sampleUsers: AdminUser[] = [
  { id: "usr_4821", name: "Alex Lee", email: "alex@boardx.io", role: "admin", credits: 12400, joined: "2024-01-12", disabled: false },
  { id: "usr_2207", name: "Sara Kim", email: "sara@boardx.io", role: "user", credits: 3200, joined: "2024-06-03", disabled: false },
  { id: "usr_9930", name: "Mia Park", email: "mia@acme.co", role: "user", credits: 980, joined: "2025-01-22", disabled: false },
  { id: "usr_7088", name: "Tom Boyd", email: "tom@acme.co", role: "admin", credits: 6720, joined: "2025-02-15", disabled: false },
];

function nextId(): string {
  return `usr_${Math.floor(1000 + Math.random() * 8999)}`;
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!isAdmin(user.id)) return NextResponse.json({ error: "无权限" }, { status: 403 });

  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const role = params.get("role"); // "admin" | "user" | null（全部）
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const pageSizeRaw = Number(params.get("pageSize") ?? "10") || 10;
  const pageSize = Math.min(50, Math.max(1, pageSizeRaw)); // 业务规则：分页上限 50

  let rows = sampleUsers.filter((u) => !u.disabled);
  if (q) rows = rows.filter((u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
  if (role === "admin" || role === "user") rows = rows.filter((u) => u.role === role);

  const total = rows.length;
  const start = (page - 1) * pageSize;
  const users = rows.slice(start, start + pageSize);

  return NextResponse.json({ users, total, page, pageSize });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
    if (!isAdmin(user.id)) return NextResponse.json({ error: "无权限" }, { status: 403 });

    const body = (await req.json()) as { name?: unknown; email?: unknown; role?: unknown };
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const errors: Record<string, string> = {};
    if (!name) errors.name = "姓名不能为空";
    if (!email) errors.email = "邮箱不能为空";
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = "邮箱格式不正确";
    else if (sampleUsers.some((u) => u.email.toLowerCase() === email.toLowerCase())) errors.email = "邮箱已存在";
    if (Object.keys(errors).length) return NextResponse.json({ errors }, { status: 400 });

    const role: AdminUserRole = body.role === "admin" ? "admin" : "user";
    const created: AdminUser = {
      id: nextId(),
      name,
      email,
      role,
      credits: 0,
      joined: new Date().toISOString().slice(0, 10),
      disabled: false,
    };
    sampleUsers.unshift(created);
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
