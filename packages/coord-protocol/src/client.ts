// coord/0.1 协议参考客户端（官方参考实现）。
//
// 定位：这是开放协议（docs/coord-platform/protocol/lease.md）的**官方参考客户端**——
// 任何 agent（含非 Claude、社区贡献的 agent）都可以照它接入 coord-gateway
// （RepoHub DO，ADR-017）。因此它保持零依赖，只使用全局 `fetch`：
// Node ≥18 与 Cloudflare Workers 通吃，无任何 Workers-only / Node-only API。
//
// 三态纪律（继承 packages/coord-service/src/client.ts 的 ADR-006 判例）：
// fail-open ≠ fail-silent。历史 bug：queryActiveClaim 把 401/403/429/5xx 静默塌缩
// 成 `null`，调用方把「问不到」当成「问过了、是空闲」，零日志放行——这是 coord-service
// 被判死刑的结构性缺陷之一（ADR-017 背景 §1）。本客户端的每一个方法都返回**带标签
// 的三态/多态结果**，每一个 catch 都显式产出 `{ kind: "error" }`，绝不抛异常、绝不
// 把错误映射成任何「成功形状」的值。调用方想 fail-open 可以，但必须是**看见 error
// 之后自己决定放行**，而不是被这里骗成 free。
import {
  PROTOCOL,
  type Lease,
  type LeaseConflict,
  type ResourceType,
} from "./types";

// ---------- 结果类型（全部带标签，禁止塌缩） ----------

/** 网络异常（fetch reject）或响应形状异常时的统一错误臂。
 *  status 缺省 = 压根没拿到 HTTP 应答（DNS/连接/超时）。 */
export interface CoordCallError {
  kind: "error";
  status?: number;
  message: string;
  body?: unknown;
}

export type ClaimOutcome =
  /** 201：新租约成立 */
  | { kind: "acquired"; lease: Lease }
  /** 200：同 agent 对同资源重复 claim 的幂等返回（lease.md）——已持有即续 */
  | { kind: "already_yours"; lease: Lease }
  /** 409：资源被他人持有；holder 是撞车防护的用户可见形态 */
  | { kind: "conflict"; holder: LeaseConflict["holder"] }
  | CoordCallError;

export type HeartbeatOutcome =
  | { kind: "ok"; lease: Lease }
  /** 410：租约已 released/expired——防僵尸续命，调用方必须重新 claim */
  | { kind: "gone"; leaseStatus?: string }
  | CoordCallError;

export type ReleaseOutcome =
  | { kind: "ok"; lease: Lease }
  | { kind: "gone"; leaseStatus?: string }
  | CoordCallError;

/** 与旧 @repo/coord-service/client 的 QueryActiveClaimResult 语义逐臂对齐：
 *  free = 问过了、确实空闲；held = 问过了、有人持有；error = **没问到**。
 *  三者永不混同（ADR-006 判例）。 */
export type QueryActiveClaimOutcome =
  | { kind: "free" }
  | { kind: "held"; claim: Lease }
  | CoordCallError;

export type ListActiveClaimsOutcome =
  | { kind: "ok"; leases: Lease[] }
  | CoordCallError;

// ---------- 客户端接口 ----------

export interface CoordClient {
  /** POST /claims。agent_id 来源见 CoordClientOptions.agentId。 */
  claim(resourceId: string, resourceType: ResourceType, ttlSeconds?: number): Promise<ClaimOutcome>;
  /** POST /claims/:lease_id/heartbeat */
  heartbeat(leaseId: string): Promise<HeartbeatOutcome>;
  /** POST /claims/:lease_id/release。handoff_note 在类型层就是必填——
   *  没有交接就不能放手（lease.md：≥10 字符，服务端 422 兜底）。 */
  release(leaseId: string, handoffNote: string): Promise<ReleaseOutcome>;
  /** GET /claims 后按 resource_id 过滤出唯一活跃租约。三态，见类型注释。 */
  queryActiveClaim(resourceId: string): Promise<QueryActiveClaimOutcome>;
  /** GET /claims：本仓全部活跃租约。 */
  listActiveClaims(): Promise<ListActiveClaimsOutcome>;
}

export interface CoordClientOptions {
  /** coord-gateway 基址，如 https://coord-gateway.boardx.workers.dev（不含路径） */
  gatewayUrl: string;
  /** bearer：按仓 scoped token（推荐，agent 身份由网关按 DO 在册记录强绑定/注入，
   *  #721）或 ops 万能钥匙 COORD_API_TOKEN。 */
  token: string;
  /** "owner/name"，claims 按仓分片（RepoHub DO 每仓一个） */
  repo: string;
  /** agent 身份。scoped token 可省略——网关会把 token 在册身份注入 body，且请求侧
   *  自证一律不信（写了且不一致 → 403 token_agent_mismatch）。ops 万能钥匙保留
   *  自证语义，此时 heartbeat/release 必须提供本字段才能通过属主校验。 */
  agentId?: string;
  /** 测试注入口；缺省用全局 fetch。 */
  fetchImpl?: typeof fetch;
}

// ---------- 实现 ----------

interface RawResult {
  kind: "http";
  status: number;
  body: unknown;
}

export function createCoordClient(options: CoordClientOptions): CoordClient {
  const { gatewayUrl, token, repo, agentId } = options;
  const doFetch = options.fetchImpl ?? fetch;
  const base = `${gatewayUrl.replace(/\/+$/, "")}/api/coord/repos/${repo}`;

  async function call(subpath: string, init: { method: string; body?: unknown }): Promise<RawResult | CoordCallError> {
    try {
      const res = await doFetch(`${base}${subpath}`, {
        method: init.method,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      // body 解析失败不是错误臂的理由——状态码仍然可信，body 置 undefined
      const body: unknown = await res.json().catch(() => undefined);
      return { kind: "http", status: res.status, body };
    } catch (e) {
      // 纪律：每个 catch 显式产出 error 臂，绝不静默、绝不伪装成任何成功形状
      return { kind: "error", message: e instanceof Error ? e.message : String(e) };
    }
  }

  function httpError(r: RawResult, context: string): CoordCallError {
    return { kind: "error", status: r.status, message: `${context} 返回 HTTP ${r.status}`, body: r.body };
  }

  function asLease(body: unknown): Lease | null {
    if (body && typeof body === "object" && typeof (body as Lease).lease_id === "string") return body as Lease;
    return null;
  }

  function withAgent(body: Record<string, unknown>): Record<string, unknown> {
    // scoped token：省略 agent_id，由网关注入在册身份（#721 强绑定）；
    // 显式配置了 agentId（ops 自证 / 单测）才随 body 发送。
    return agentId === undefined ? body : { ...body, agent_id: agentId };
  }

  return {
    async claim(resourceId, resourceType, ttlSeconds) {
      const r = await call("/claims", {
        method: "POST",
        body: withAgent({
          protocol: PROTOCOL,
          resource_id: resourceId,
          resource_type: resourceType,
          ...(ttlSeconds === undefined ? {} : { ttl_seconds: ttlSeconds }),
        }),
      });
      if (r.kind === "error") return r;
      if (r.status === 201 || r.status === 200) {
        const lease = asLease(r.body);
        if (!lease) return { kind: "error", status: r.status, message: "claim 响应缺少 lease 对象——格式异常", body: r.body };
        return r.status === 201 ? { kind: "acquired", lease } : { kind: "already_yours", lease };
      }
      if (r.status === 409) {
        const holder = (r.body as Partial<LeaseConflict> | undefined)?.holder;
        if (holder) return { kind: "conflict", holder };
        return { kind: "error", status: 409, message: "claim 冲突但响应缺少 holder——格式异常", body: r.body };
      }
      return httpError(r, "claim");
    },

    async heartbeat(leaseId) {
      const r = await call(`/claims/${leaseId}/heartbeat`, {
        method: "POST",
        body: withAgent({ protocol: PROTOCOL }),
      });
      if (r.kind === "error") return r;
      if (r.status === 200) {
        const lease = asLease(r.body);
        if (!lease) return { kind: "error", status: 200, message: "heartbeat 响应缺少 lease 对象——格式异常", body: r.body };
        return { kind: "ok", lease };
      }
      if (r.status === 410)
        return { kind: "gone", leaseStatus: (r.body as { status?: string } | undefined)?.status };
      return httpError(r, "heartbeat");
    },

    async release(leaseId, handoffNote) {
      const r = await call(`/claims/${leaseId}/release`, {
        method: "POST",
        body: withAgent({ protocol: PROTOCOL, handoff_note: handoffNote }),
      });
      if (r.kind === "error") return r;
      if (r.status === 200) {
        const lease = asLease(r.body);
        if (!lease) return { kind: "error", status: 200, message: "release 响应缺少 lease 对象——格式异常", body: r.body };
        return { kind: "ok", lease };
      }
      if (r.status === 410)
        return { kind: "gone", leaseStatus: (r.body as { status?: string } | undefined)?.status };
      return httpError(r, "release");
    },

    async queryActiveClaim(resourceId) {
      const r = await call("/claims", { method: "GET" });
      if (r.kind === "error") return r;
      if (r.status !== 200) return httpError(r, "queryActiveClaim");
      const leases = (r.body as { leases?: Lease[] } | undefined)?.leases;
      if (!Array.isArray(leases))
        return { kind: "error", status: 200, message: "claims 列表响应缺少 leases 数组——格式异常", body: r.body };
      const claim = leases.find((l) => l.resource_id === resourceId);
      return claim ? { kind: "held", claim } : { kind: "free" };
    },

    async listActiveClaims() {
      const r = await call("/claims", { method: "GET" });
      if (r.kind === "error") return r;
      if (r.status !== 200) return httpError(r, "listActiveClaims");
      const leases = (r.body as { leases?: Lease[] } | undefined)?.leases;
      if (!Array.isArray(leases))
        return { kind: "error", status: 200, message: "claims 列表响应缺少 leases 数组——格式异常", body: r.body };
      return { kind: "ok", leases };
    },
  };
}

/** 读 COORD_GATEWAY_URL / COORD_API_TOKEN / COORD_REPO（可选 COORD_AGENT_ID），
 *  缺任一必填项返回 null——单一开关，调用方据此决定降级路径。
 *  （旧 COORD_SERVICE_URL / COORD_SERVICE_TOKEN 已随 coord-service 退役，ADR-017。） */
export function createCoordClientFromEnv(): CoordClient | null {
  const env: Record<string, string | undefined> =
    typeof process === "undefined" ? {} : process.env;
  const gatewayUrl = env["COORD_GATEWAY_URL"];
  const token = env["COORD_API_TOKEN"];
  const repo = env["COORD_REPO"];
  if (!gatewayUrl || !token || !repo) return null;
  return createCoordClient({ gatewayUrl, token, repo, agentId: env["COORD_AGENT_ID"] });
}
