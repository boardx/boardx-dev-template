// 反向投影 cron 编排（F06）：逐仓拉事件 → 纯函数引擎 → 应用 GitHub 调用 → 推进游标。
// 引擎与认证全在 @repo/coord-projection；本文件只做 DO/GitHub 之间的搬运，
// 单仓失败只记日志不影响其他仓，游标仅在 apply 之后推进（at-least-once，
// GitHub status/check 按 context/name 幂等覆盖，重投无害）。
import {
  applyCalls,
  createGitHubAppAuth,
  project,
  type ActiveLease,
  type AndonState,
  type GitHubAppAuth,
  type OpenPr,
  type ProjectionEvent,
} from "@repo/coord-projection";
import type { Env } from "./index";

const DEFAULT_REPOS = "boardx/boardx-dev-template";
const EVENTS_BATCH = 500;
// event_id 下界哨兵（26 个 ULID 字母表最小字符 "0"）：cursor 为 null（首次投影/新仓
// 冷启动）时显式传 since=MIN_EVENT_ID，走 /events 的 since 分支（WHERE event_id > ?
// ORDER BY event_id LIMIT ?，真正的"从头分页"语义），而不是省略 since 依赖其默认行为
// ——#814 起默认行为是"最近 N 条"（修复 #813 的冻结缺陷），如果仍然省略 since，
// 冷启动会跳过 EVENTS_BATCH 条之前的所有历史事件（#815 review 要求：给 bootstrap
// 一个显式入口，不能靠"cursor 实践中不会晚于 500 条事件才建立"这种论证代替代码保证）。
const MIN_EVENT_ID = "evt_00000000000000000000000000";

async function doJson<T>(stub: DurableObjectStub, path: string, init?: RequestInit): Promise<T> {
  const res = await stub.fetch(`https://repohub${path}`, init);
  if (!res.ok) throw new Error(`repohub_${res.status}: ${path}`);
  return res.json<T>();
}

async function projectRepo(env: Env, auth: GitHubAppAuth, repo: string): Promise<void> {
  const [owner, name] = repo.split("/") as [string, string];
  const stub = env.REPOHUB.get(env.REPOHUB.idFromName(repo));

  const { cursor } = await doJson<{ cursor: string | null }>(stub, "/projector/cursor");
  const { events } = await doJson<{ events: ProjectionEvent[] }>(
    stub, `/events?limit=${EVENTS_BATCH}&since=${cursor ?? MIN_EVENT_ID}`,
  );
  const andon = await doJson<AndonState>(stub, "/andon");
  // 活跃租约快照必须在 events 之后取：快照时点 ≥ 批内事件时点，引擎里
  // 快照覆盖批内 stale 事件才是安全的（#723-2 对账路径）
  const { leases } = await doJson<{ leases: ActiveLease[] }>(stub, "/claims");
  // 无新事件、未停线、无活跃租约：无事可投也无可对账，游标也无可推
  if (events.length === 0 && !andon.active && leases.length === 0) return;

  const { items } = await doJson<{ items: OpenPr[] }>(stub, "/realtime/prs?state=open");
  const calls = project({ events, openPrs: items, andon, leases, now: Date.now() });
  if (calls.length > 0) {
    const token = await auth.installationToken(owner, name);
    const r = await applyCalls({ owner, repo: name, token, calls });
    // 漏投自愈口径：andon status 与 claimed lease check 均为状态驱动、下 tick
    // 对账补投；lease 结束态（released/expired）仅事件驱动，失败即残留（见 engine.ts）
    if (r.failed > 0) console.error(`[projection] ${repo}: ${r.failed}/${calls.length} 条投影失败（状态驱动部分下 tick 对账补投）`);
  }
  if (events.length > 0) {
    const last = events[events.length - 1]!.event_id;
    await doJson(stub, "/projector/cursor", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cursor: last }),
    });
  }
}

export async function runProjectionTick(env: Env): Promise<void> {
  // 缺 GitHub App 配置 fail-closed：只告警不投影，绝不半配置乱打 API
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    console.error("[projection] GITHUB_APP_ID/GITHUB_APP_PRIVATE_KEY 未配置，跳过本 tick");
    return;
  }
  const auth = createGitHubAppAuth({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY });
  const repos = (env.PROJECTION_REPOS ?? DEFAULT_REPOS)
    .split(",").map((r) => r.trim()).filter(Boolean);
  for (const repo of repos) {
    try {
      await projectRepo(env, auth, repo);
    } catch (e) {
      console.error(`[projection] ${repo} 本 tick 失败（游标未推进，下 tick 重试）`, e);
    }
  }
}
