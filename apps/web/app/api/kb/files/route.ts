import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CURRENT_TEAM_COOKIE } from "@repo/auth";
import { createKbFile, getMembership, listKbFiles, type KbScope } from "@repo/data";
import { validateKbUpload, extOf, buildKbObjectKey, putObject, ensureBucket } from "@repo/storage";
import { makeQueue, QUEUE_NAMES } from "@repo/queue";
import { ApiError, withAuth } from "@/lib/api/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// uc-kb-001-upload-file — 知识库文件上传（p10-F01 地基）。
// POST /api/kb/files（multipart/form-data）：前端已做客户端预校验，这里做服务端二次校验
// （不可信前端），校验通过后：先写对象存储 → 成功后才落 kb_files 记录（避免半条记录）→
// 入队解析/切分/向量化（异步，worker 回写 processing→ready/error）。
// GET /api/kb/files?scope=&q=&limit=&offset=：按 scope + 权限过滤列出当前用户可见文件，并返回分页信息。

const SCOPES: KbScope[] = ["personal", "team", "agent", "tool"];

function parseScope(v: string | null): KbScope {
  return v && (SCOPES as string[]).includes(v) ? (v as KbScope) : "personal";
}

function parseBoundedInt(v: string | null, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(Math.floor(n), max));
}

export const GET = withAuth(async (req, { user }) => {
  const url = new URL(req.url);
  const scope = parseScope(url.searchParams.get("scope"));
  const q = url.searchParams.get("q") ?? undefined;
  const limit = parseBoundedInt(url.searchParams.get("limit"), 20, 1, 50);
  const offset = parseBoundedInt(url.searchParams.get("offset"), 0, 0, 100000);

  let teamId: number | null = null;
  if (scope === "team") {
    const raw = cookies().get(CURRENT_TEAM_COOKIE)?.value;
    teamId = raw ? Number(raw) : null;
    if (teamId != null && !(await getMembership(teamId, user.id))) {
      return NextResponse.json({ error: "你不是该团队成员" }, { status: 403 });
    }
  }

  const { files, total } = await listKbFiles({ ownerUserId: user.id, scope, teamId, q, limit, offset });
  return NextResponse.json({
    files,
    page: {
      limit,
      offset,
      total,
      hasMore: offset + files.length < total,
    },
  });
});

// multipart 上传：withValidation 走 JSON 不适用，但 withAuth + ApiError 照样把
// 鉴权与错误边界收敛（ADR-015：分层可组合，非 JSON 路由同样受保护）。
export const POST = withAuth(async (req, { user }) => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ errors: { file: "缺少文件" } }, { status: 400 });
    }

    const scope = parseScope(form.get("scope") as string | null);

    let teamId: number | null = null;
    if (scope === "team") {
      const raw = form.get("teamId") as string | null;
      teamId = raw ? Number(raw) : (cookies().get(CURRENT_TEAM_COOKIE)?.value ? Number(cookies().get(CURRENT_TEAM_COOKIE)!.value) : null);
      if (!teamId || !(await getMembership(teamId, user.id))) {
        return NextResponse.json({ error: "你不是该团队成员" }, { status: 403 });
      }
    }

    // 服务端二次校验（前端预检不可信，防绕过）——不合法就直接拒绝，不写任何存储/DB。
    const validation = validateKbUpload(file.name, file.size);
    if (!validation.ok) {
      const field = validation.reason === "unsupported_type" ? "type" : "size";
      return NextResponse.json({ errors: { [field]: validation.message } }, { status: 400 });
    }

    const fileId = `kbf_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const objectKey = buildKbObjectKey({ scope, ownerId: user.id, fileId, fileName: file.name });

    // 先写对象存储；失败则直接报错，不产生半条 kb_files 记录。
    try {
      await ensureBucket();
      const buffer = Buffer.from(await file.arrayBuffer());
      await putObject(objectKey, buffer, file.type || "application/octet-stream");
    } catch (err) {
      // 内部细节（endpoint/凭据/网络栈）只进日志，不出网——#539 教训
      throw new ApiError(502, "storage_write_failed", err);
    }

    // 对象存储写入成功后才落库（status=processing）。
    const kbFile = await createKbFile({
      id: fileId,
      scope,
      ownerUserId: user.id,
      teamId,
      name: file.name,
      ext: extOf(file.name),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      objectKey,
    });

    // 异步入队解析/切分/向量化；入队失败不影响已落地的记录可见，但状态会停在 processing——
    // 记录警告，不阻塞响应（上传本身已成功）。
    try {
      const queue = makeQueue(QUEUE_NAMES.kbFileProcessing);
      await queue.add("process", { fileId, objectKey });
    } catch (err) {
      console.error(`kb-file-processing 入队失败（file=${fileId}）：`, err);
    }

    return NextResponse.json({ file: kbFile }, { status: 201 });
});
