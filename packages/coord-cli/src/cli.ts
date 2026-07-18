// coord CLI 核心（F07）。约束：
// ① 零运行时依赖——只用 Node 22 内置 fetch / fs / path / os；
// ② 全部副作用（fetch/文件/输出）经 Deps 注入，单测不打真网、不碰真家目录；
// ③ 出错必须人类可读：尤其 409 撞车要打印当前持有者与租约新鲜度（撞车防护的 UX 落点）。
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROTOCOL = "coord/0.1";

export interface CoordConfig {
  gateway_url: string; // 如 https://coord-gateway.boardx.workers.dev
  repo: string; // owner/name
  token: string;
}

export interface Deps {
  fetchImpl: typeof fetch;
  env: Record<string, string | undefined>;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  configPath: string;
  readConfigFile: () => string | null; // 不存在返回 null
  writeConfigFile: (content: string) => void;
  now: () => number;
}

export function defaultDeps(): Deps {
  const configPath = join(homedir(), ".coord", "config.json");
  return {
    fetchImpl: fetch,
    env: process.env,
    stdout: (l) => console.log(l),
    stderr: (l) => console.error(l),
    configPath,
    readConfigFile: () => {
      try {
        return readFileSync(configPath, "utf8");
      } catch {
        return null;
      }
    },
    writeConfigFile: (content) => {
      mkdirSync(join(homedir(), ".coord"), { recursive: true });
      writeFileSync(configPath, content, { mode: 0o600 }); // 含 token，只给本人读写
    },
    now: () => Date.now(),
  };
}

// ---------- 参数解析（够用即可，不引 yargs） ----------

export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = "true";
      }
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

// resource_id 前缀 → resource_type（lease.md 资源命名）
export function inferResourceType(resourceId: string): string | null {
  const prefix = resourceId.split(":")[0];
  const map: Record<string, string> = {
    issue: "issue",
    feature: "feature",
    module: "module",
    role: "coordinator-role",
    custom: "custom",
  };
  return (prefix && map[prefix]) ?? null;
}

// 租约新鲜度的人话表述（409 提示用）
export function freshness(nowMs: number, isoTs: string): string {
  const ageSec = Math.max(0, Math.round((nowMs - Date.parse(isoTs)) / 1000));
  if (ageSec < 60) return `${ageSec} 秒前`;
  if (ageSec < 3600) return `${Math.round(ageSec / 60)} 分钟前`;
  return `${(ageSec / 3600).toFixed(1)} 小时前`;
}

// ---------- HTTP ----------

function loadConfig(deps: Deps): CoordConfig | null {
  const raw = deps.readConfigFile();
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as CoordConfig;
    if (!c.gateway_url || !c.repo || !c.token) return null;
    return c;
  } catch {
    return null;
  }
}

async function api(
  deps: Deps,
  cfg: CoordConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const url = `${cfg.gateway_url.replace(/\/$/, "")}/api/coord/repos/${cfg.repo}${path}`;
  const res = await deps.fetchImpl(url, {
    method,
    headers: {
      authorization: `Bearer ${cfg.token}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let parsed: Record<string, unknown> = {};
  try {
    parsed = (await res.json()) as Record<string, unknown>;
  } catch {
    // 非 JSON 响应（网关 5xx 等），status 足够定位
  }
  return { status: res.status, body: parsed };
}

// ---------- 命令 ----------

const USAGE = `用法：
  coord connect <gateway-url> <owner/repo>   接入网关（token 读 env COORD_API_TOKEN，配置写 ~/.coord/config.json）
  coord claim <resource_id> --agent <id> [--ttl <秒>]   原子认领资源（issue:698 / feature:p29/F07 / module:x / role:x）
  coord status                               活跃租约 + 可认领工作摘要
  coord release <lease_id> --agent <id> --note "交接说明（≥10 字符）"
  coord events [--since <event_id>]          协调事件流（since 断点续传）`;

async function cmdConnect(args: ParsedArgs, deps: Deps): Promise<number> {
  const [gatewayUrl, repo] = args.positional;
  if (!gatewayUrl || !repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    deps.stderr("用法：coord connect <gateway-url> <owner/repo>");
    return 1;
  }
  const token = deps.env["COORD_API_TOKEN"];
  if (!token) {
    deps.stderr("缺少 COORD_API_TOKEN 环境变量。先 export COORD_API_TOKEN=<你的 token> 再 connect。");
    return 1;
  }
  const cfg: CoordConfig = { gateway_url: gatewayUrl, repo, token };
  // 连通性冒烟：healthz 通了才落盘，避免把坏配置写进家目录
  try {
    const res = await deps.fetchImpl(`${gatewayUrl.replace(/\/$/, "")}/api/coord/healthz`);
    if (!res.ok) {
      deps.stderr(`网关 healthz 返回 ${res.status}——检查 gateway-url 是否正确。`);
      return 1;
    }
  } catch (e) {
    deps.stderr(`连不上网关：${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  deps.writeConfigFile(JSON.stringify(cfg, null, 2) + "\n");
  deps.stdout(`已接入 ${repo} @ ${gatewayUrl}`);
  deps.stdout(`配置已写入 ${deps.configPath}。下一步：coord claim <resource_id> --agent <你的 agent id>`);
  return 0;
}

async function cmdClaim(args: ParsedArgs, deps: Deps, cfg: CoordConfig): Promise<number> {
  const resourceId = args.positional[0];
  const agent = args.flags["agent"];
  if (!resourceId || !agent) {
    deps.stderr("用法：coord claim <resource_id> --agent <id> [--ttl <秒>]");
    return 1;
  }
  const resourceType = inferResourceType(resourceId);
  if (!resourceType) {
    deps.stderr(`resource_id 前缀无法识别：${resourceId}（合法前缀 issue:/feature:/module:/role:/custom:）`);
    return 1;
  }
  const ttl = args.flags["ttl"] ? Number(args.flags["ttl"]) : undefined;
  const r = await api(deps, cfg, "POST", "/claims", {
    protocol: PROTOCOL,
    resource_id: resourceId,
    resource_type: resourceType,
    agent_id: agent,
    ...(ttl !== undefined ? { ttl_seconds: ttl } : {}),
  });
  if (r.status === 201 || r.status === 200) {
    const idempotent = r.status === 200 ? "（幂等：你已持有该租约）" : "";
    deps.stdout(`认领成功${idempotent}：${resourceId}`);
    deps.stdout(`  lease_id:   ${String(r.body["lease_id"])}`);
    deps.stdout(`  expires_at: ${String(r.body["expires_at"])}（记得心跳续期）`);
    return 0;
  }
  if (r.status === 409) {
    // 撞车防护的用户体验点：把"谁在做、还活着吗"直接说人话
    const holder = (r.body["holder"] ?? {}) as Record<string, unknown>;
    const hb = String(holder["last_heartbeat_at"] ?? "");
    deps.stderr(`认领失败（409）：${resourceId} 已被 ${String(holder["agent_id"])} 持有`);
    deps.stderr(`  认领于:    ${String(holder["claimed_at"])}`);
    deps.stderr(`  最近心跳:  ${hb}${hb ? `（${freshness(deps.now(), hb)}）` : ""}`);
    deps.stderr(`  过期时间:  ${String(holder["expires_at"])}（届时未续期会被机械回收）`);
    deps.stderr("  别硬抢：找 coordinator 协调，或等租约过期/对方 release。");
    return 1;
  }
  if (r.status === 422) {
    deps.stderr(`请求非法（422）：${JSON.stringify(r.body["details"] ?? r.body)}`);
    return 1;
  }
  deps.stderr(`认领失败（HTTP ${r.status}）：${JSON.stringify(r.body)}`);
  return 1;
}

async function cmdStatus(deps: Deps, cfg: CoordConfig): Promise<number> {
  const [claims, issues] = await Promise.all([
    api(deps, cfg, "GET", "/claims"),
    api(deps, cfg, "GET", "/realtime/issues?state=open"),
  ]);
  if (claims.status !== 200) {
    deps.stderr(`获取状态失败（HTTP ${claims.status}）：${JSON.stringify(claims.body)}`);
    return 1;
  }
  const leases = (claims.body["leases"] ?? []) as Array<Record<string, unknown>>;
  deps.stdout(`活跃租约（${leases.length}）：`);
  for (const l of leases) {
    deps.stdout(
      `  ${String(l["resource_id"])}  ← ${String(l["agent_id"])}  （心跳 ${freshness(deps.now(), String(l["last_heartbeat_at"]))}，过期 ${String(l["expires_at"])}）`,
    );
  }
  const held = new Set(leases.map((l) => String(l["resource_id"])));
  const items = (issues.body["items"] ?? []) as Array<Record<string, unknown>>;
  const ready = items.filter(
    (i) =>
      Array.isArray(i["labels"]) &&
      (i["labels"] as unknown[]).includes("status:ready-for-dev") &&
      !held.has(`issue:${i["number"]}`),
  );
  deps.stdout(`可认领工作（open + status:ready-for-dev，排除已被认领，共 ${ready.length}）：`);
  for (const i of ready) {
    deps.stdout(`  issue:${String(i["number"])}  ${String(i["title"])}`);
  }
  return 0;
}

async function cmdRelease(args: ParsedArgs, deps: Deps, cfg: CoordConfig): Promise<number> {
  const leaseId = args.positional[0];
  const agent = args.flags["agent"];
  const note = args.flags["note"];
  if (!leaseId || !agent || !note) {
    deps.stderr('用法：coord release <lease_id> --agent <id> --note "交接说明（≥10 字符）"');
    return 1;
  }
  const r = await api(deps, cfg, "POST", `/claims/${leaseId}/release`, {
    protocol: PROTOCOL,
    agent_id: agent,
    handoff_note: note,
  });
  if (r.status === 200) {
    deps.stdout(`已释放 ${String(r.body["resource_id"])}（lease ${leaseId}）。交接说明已入事件流。`);
    return 0;
  }
  if (r.status === 422) {
    deps.stderr(`释放被拒（422）：交接说明不合规——${JSON.stringify(r.body["details"] ?? r.body)}`);
    deps.stderr("  没有交接就不能放手：写清楚做到哪、剩什么、下一个人从哪继续（≥10 字符）。");
    return 1;
  }
  if (r.status === 403) {
    deps.stderr("释放被拒（403）：你不是该租约的持有者。");
    return 1;
  }
  deps.stderr(`释放失败（HTTP ${r.status}）：${JSON.stringify(r.body)}`);
  return 1;
}

async function cmdEvents(args: ParsedArgs, deps: Deps, cfg: CoordConfig): Promise<number> {
  const since = args.flags["since"];
  const r = await api(deps, cfg, "GET", `/events?limit=100${since ? `&since=${since}` : ""}`);
  if (r.status !== 200) {
    deps.stderr(`获取事件失败（HTTP ${r.status}）：${JSON.stringify(r.body)}`);
    return 1;
  }
  const events = (r.body["events"] ?? []) as Array<Record<string, unknown>>;
  if (events.length === 0) {
    deps.stdout(since ? `没有 ${since} 之后的新事件。` : "事件流为空。");
    return 0;
  }
  for (const e of events) {
    deps.stdout(
      `${String(e["at"])}  ${String(e["type"]).padEnd(18)}  ${String(e["resource_id"])}  by ${String(e["agent_id"])}  [${String(e["event_id"])}]`,
    );
  }
  deps.stdout(`—— 续传：coord events --since ${String(events.at(-1)!["event_id"])}`);
  return 0;
}

// ---------- 入口 ----------

export async function main(argv: string[], deps: Deps = defaultDeps()): Promise<number> {
  const [command, ...rest] = argv;
  const args = parseArgs(rest);

  if (!command || command === "help" || command === "--help") {
    deps.stdout(USAGE);
    return command ? 0 : 1;
  }
  if (command === "connect") return cmdConnect(args, deps);

  const cfg = loadConfig(deps);
  if (!cfg) {
    deps.stderr(`未接入网关（${deps.configPath} 不存在或不完整）。先跑：coord connect <gateway-url> <owner/repo>`);
    return 1;
  }
  switch (command) {
    case "claim":
      return cmdClaim(args, deps, cfg);
    case "status":
      return cmdStatus(deps, cfg);
    case "release":
      return cmdRelease(args, deps, cfg);
    case "events":
      return cmdEvents(args, deps, cfg);
    default:
      deps.stderr(`未知命令：${command}\n${USAGE}`);
      return 1;
  }
}
