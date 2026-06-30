import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-kb-001-upload-file — 知识库文件元数据存储。
// 注意：文件上传被「桩化」——这里只保存元数据（名称/大小/类型/状态/范围），
// 不实现真实 blob 存储（按 UC「不包含文件存储实现」）。
// 存储为进程内内存，按 userId 隔离；进程重启即清空（最小实现，不建 DB 表）。

export type KbStatus = "uploading" | "processing" | "completed" | "error";
export type KbScope = "personal" | "team" | "agent";

const ALLOWED_EXT = ["pdf", "txt", "md", "doc", "docx", "json", "csv", "xlsx", "xls"];
const MAX_BYTES = 50 * 1024 * 1024; // 50MB

export interface KbFile {
  id: string;
  name: string;
  ext: string;
  size: number;
  status: KbStatus;
  scope: KbScope;
  createdAt: number;
}

// userId -> files
const store = new Map<number, KbFile[]>();

function listFor(userId: number, q?: string): KbFile[] {
  const all = store.get(userId) ?? [];
  const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt);
  if (!q) return sorted;
  const needle = q.toLowerCase();
  return sorted.filter((f) => f.name.toLowerCase().includes(needle));
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  return NextResponse.json({ files: listFor(user.id, q) });
}

export async function POST(req: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

    const body = (await req.json()) as { name?: unknown; size?: unknown; scope?: unknown };
    const name = String(body.name ?? "").trim();
    if (!name) return NextResponse.json({ errors: { name: "文件名不能为空" } }, { status: 400 });

    const ext = extOf(name);
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { errors: { name: `不支持的文件类型 .${ext || "?"}（仅 ${ALLOWED_EXT.join("/")}）` } },
        { status: 400 },
      );
    }

    const size = Number(body.size ?? 0);
    if (!Number.isFinite(size) || size < 0) {
      return NextResponse.json({ errors: { size: "文件大小无效" } }, { status: 400 });
    }
    if (size > MAX_BYTES) {
      return NextResponse.json({ errors: { size: "文件过大（上限 50MB）" } }, { status: 400 });
    }

    const scope: KbScope =
      body.scope === "team" || body.scope === "agent" ? body.scope : "personal";

    // 桩化：上传即视为完成（无真实 blob / 知识处理）。
    const file: KbFile = {
      id: `kb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      name,
      ext,
      size,
      status: "completed",
      scope,
      createdAt: Date.now(),
    };
    const list = store.get(user.id) ?? [];
    list.push(file);
    store.set(user.id, list);

    return NextResponse.json({ file }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
