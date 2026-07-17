// tick.ts — 每个 agent 每个 loop 跑的**唯一一条命令**（ADR-014 统一时钟 + loop 纪律）。
//
// 背景（真实事故）：coord-architecture 自己的协调租约在集成 p23 期间静默过期 8 小时
// ——因为"续约"全靠会话想起来做；同期 cycle-report 用本地时钟算周期，机器时钟一漂
// 各算各的。教训与 ADR-012 同款：**能机械化的纪律，绝不交给记性**。
//
// 一条命令做完一个 loop 该做的四件事，任何 runtime 都能在自己的循环里调它：
//   1. 读权威时钟（coord-service GET /time）——现在几点、当前哪个周期、还剩多久
//   2. 报本地时钟漂移（>60s 告警：你按错误时间协调会误判租约新鲜度/周期边界）
//   3. 续自己的租约（acquire-or-renew，避免静默过期）
//   4. 拉任务收件箱（有 pending 就提示 ack）
// 输出是给人/agent 读的行动清单，退出码 0（tick 本身不是门控）；--json 供脚本消费。
import { req } from "./lib/args";
import { log } from "./lib/log";
import type { Args } from "./lib/args";

const DRIFT_WARN_SECONDS = 60;

interface TimePayload {
  now: string;
  epoch_ms: number;
  cycle: { id: string; started_at: string; ends_at: string; remaining_seconds: number; elapsed_seconds: number };
}

function env(name: string): string | undefined {
  return process.env[name];
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function fmtRemaining(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m}m` : `${m}m`;
}

export async function tick(args: Args): Promise<void> {
  const sessionId = args.opts["session"] ?? env("COORD_AGENT_ID");
  const asJson = args.flags["json"] === true;
  const baseUrl = env("COORD_SERVICE_URL");
  const token = env("COORD_SERVICE_TOKEN");

  if (!baseUrl) {
    log.err("COORD_SERVICE_URL 未配置——tick 需要权威时钟（ADR-014）。见 agent-bootstrap.md 第 3 步。");
    process.exitCode = 1;
    return;
  }

  // ── 1. 权威时钟 ────────────────────────────────────────────────────────────
  const localBefore = Date.now();
  const time = await fetchJson<TimePayload>(`${baseUrl}/time`);
  if (!time) {
    log.err(`[clock] 读不到权威时钟（${baseUrl}/time）——协调权威联系不上时不要按本地时钟硬猜，先排查网络/服务。`);
    process.exitCode = 1;
    return;
  }
  // 往返一半近似单程延迟，剩下的差值即本地时钟漂移
  const rttHalf = (Date.now() - localBefore) / 2;
  const driftSeconds = Math.round(((localBefore + rttHalf) - time.epoch_ms) / 1000);

  const out: Record<string, unknown> = {
    now: time.now,
    cycle: time.cycle,
    drift_seconds: driftSeconds,
  };

  if (!asJson) {
    log.info(`[clock] 权威时刻 ${time.now}`);
    log.info(`[cycle] ${time.cycle.id}（本周期剩 ${fmtRemaining(time.cycle.remaining_seconds)}；结束前必须发 cycle-result）`);
  }

  // ── 2. 时钟漂移告警 ────────────────────────────────────────────────────────
  if (Math.abs(driftSeconds) > DRIFT_WARN_SECONDS) {
    log.err(
      `[clock] 本地时钟与权威时钟相差 ${driftSeconds}s（阈值 ${DRIFT_WARN_SECONDS}s）——` +
        `你对租约新鲜度/周期边界的判断会出错。一律以 GET /time 为准，并修本机时钟（NTP）。`
    );
    out["drift_warning"] = true;
  }

  if (!token || !sessionId) {
    if (!asJson) {
      log.info("[lease/inbox] 跳过：未配置 COORD_SERVICE_TOKEN 或未给 --session/COORD_AGENT_ID（只读时钟模式）。");
    }
    if (asJson) console.log(JSON.stringify(out, null, 2));
    return;
  }

  const authHeaders = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ── 3. 续租约（acquire-or-renew，防静默过期）─────────────────────────────
  const roleResource = `role:${sessionId}`;
  const claims = await fetchJson<{ claims: Array<{ id: number; resource_id: string; agent_id: string; last_heartbeat_at: string; ttl_seconds: number }> }>(
    `${baseUrl}/claims?resource_id=${encodeURIComponent(roleResource)}&status=in_progress`,
    { headers: authHeaders }
  );
  const mine = claims?.claims?.[0];
  if (mine) {
    const hb = await fetchJson<unknown>(`${baseUrl}/claims/${mine.id}/heartbeat`, { method: "POST", headers: authHeaders, body: "{}" });
    const ageMin = (Date.parse(time.now) - Date.parse(mine.last_heartbeat_at)) / 60000;
    if (hb) {
      if (!asJson) log.ok(`[lease] 已续约 ${roleResource}（续约前心跳 ${ageMin.toFixed(1)} 分钟前，ttl ${mine.ttl_seconds}s）`);
      out["lease"] = { resource_id: roleResource, renewed: true };
    } else {
      log.err(`[lease] 续约失败（claim ${mine.id}）——可能已被 sweeper 回收或不是你的 token。重新 acquire。`);
      out["lease"] = { resource_id: roleResource, renewed: false };
    }
  } else {
    if (!asJson) log.info(`[lease] ${roleResource} 无活跃租约——如你正在履职，跑 lock-acquire / module-lock-acquire 认领。`);
    out["lease"] = { resource_id: roleResource, renewed: false, absent: true };
  }

  // ── 4. 任务收件箱（#594 平台中立派工）────────────────────────────────────
  const inbox = await fetchJson<{ tasks: Array<{ id: number; issue: number; priority: string; note: string | null }> }>(
    `${baseUrl}/tasks?status=pending`,
    { headers: authHeaders }
  );
  const pending = inbox?.tasks ?? [];
  out["pending_tasks"] = pending;
  if (!asJson) {
    if (pending.length === 0) {
      log.info("[inbox] 无待接任务。");
    } else {
      log.info(`[inbox] ${pending.length} 个待接任务——ack 后开工：`);
      for (const t of pending) {
        log.info(`  · task ${t.id} → issue #${t.issue}（${t.priority}）${t.note ? ` — ${t.note}` : ""}`);
        log.info(`    ack: curl -s -X POST -H "Authorization: Bearer $COORD_SERVICE_TOKEN" "$COORD_SERVICE_URL/tasks/${t.id}/ack"`);
      }
    }
  }

  if (asJson) console.log(JSON.stringify(out, null, 2));
}
