// MCP server（F07）：agent 接入面——一个 URL + bearer token 即获得协调工具集。
// 传输是 MCP streamable HTTP（单 POST 端点，JSON-RPC 2.0）。刻意手写最小实现、
// 不引第三方 SDK：约束是①保持零运行时依赖纪律②工具全部是 RepoHub DO 的薄封装，
// 引 SDK 的复杂度大于收益。协议语义来源：docs/coord-platform/protocol/*.md。
import type { Env } from "./index";
import { authorizeRepoAccess } from "./auth";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
}

const SERVER_INFO = { name: "coord-platform", version: "0.1.0" };
// 未指定时的兜底协议版本（客户端 initialize 传了就回显它，最大化兼容面）
const DEFAULT_MCP_PROTOCOL = "2025-03-26";
const PROTOCOL = "coord/0.1";

// ---------- 工具定义（JSON Schema 即接入文档：schema 写清楚，agent 不用读源码） ----------

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOLS: ToolDef[] = [
  {
    name: "claim_issue",
    description:
      "原子认领一个资源（issue/feature/module/role）。同一资源任一时刻至多一个活跃持有者：" +
      "成功返回租约 Lease；已被他人持有则返回冲突详情（当前持有者、租约新鲜度）——撞车防护。" +
      "同 agent 对同资源重复认领幂等返回现有租约。",
    inputSchema: {
      type: "object",
      properties: {
        resource_id: {
          type: "string",
          description: "资源标识，如 issue:698 / feature:p29/F07 / module:devportal / role:coord-main",
        },
        resource_type: {
          type: "string",
          enum: ["feature", "issue", "coordinator-role", "module", "custom"],
          description: "资源类型，与 resource_id 前缀对应",
        },
        agent_id: { type: "string", description: "你的 agent 身份 ID（问责锚点）" },
        ttl_seconds: {
          type: "integer",
          minimum: 60,
          maximum: 86400,
          description: "租约 TTL 秒数，默认 21600（6h）；到期未心跳会被机械回收",
        },
      },
      required: ["resource_id", "resource_type", "agent_id"],
    },
  },
  {
    name: "heartbeat",
    description: "为持有中的租约续期（推进 expires_at）。只有持有者可以心跳；对已释放/已过期租约心跳会被拒绝。",
    inputSchema: {
      type: "object",
      properties: {
        lease_id: { type: "string", description: "claim 时返回的 lease_id" },
        agent_id: { type: "string", description: "必须是租约持有者" },
      },
      required: ["lease_id", "agent_id"],
    },
  },
  {
    name: "release",
    description:
      "释放租约。handoff_note 必填（≥10 字符）：没有交接就不能放手——写清楚做到哪、剩什么、下一个人从哪继续。",
    inputSchema: {
      type: "object",
      properties: {
        lease_id: { type: "string", description: "要释放的 lease_id" },
        agent_id: { type: "string", description: "必须是租约持有者" },
        handoff_note: { type: "string", minLength: 10, description: "交接说明（≥10 字符，必填）" },
      },
      required: ["lease_id", "agent_id", "handoff_note"],
    },
  },
  {
    name: "get_realtime_status",
    description:
      "获取仓库实时状态汇总：issue 镜像 + PR 镜像（含 mergeable/head_sha/新鲜度时间戳）+ 当前全部活跃租约。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_ready_work",
    description:
      "获取可认领的工作：镜像中 open 且带 status:ready-for-dev 标签的 issue，已排除有活跃租约（他人正在做）的。",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_events",
    description:
      "读取协调事件流（append-only 唯一可信历史）。用 since 传上次收到的 event_id 做断点续传，不重不漏。",
    inputSchema: {
      type: "object",
      properties: {
        since: { type: "string", description: "上次收到的 event_id（ULID），只返回其后的事件" },
        limit: { type: "integer", minimum: 1, maximum: 500, description: "最多返回条数，默认 100" },
      },
    },
  },
  {
    name: "submit_evidence",
    description:
      "提交完成声明（EvidenceManifest）。声明不是事实：必须锚定 head_sha，每条 attestation 的 " +
      "exit_code 必须为 0 且 output_excerpt 含真实输出。非法声明会被拒收。",
    inputSchema: {
      type: "object",
      properties: {
        manifest_id: { type: "string", description: "声明 ID，如 evm_01J..." },
        resource_id: { type: "string", description: "声明针对的资源，如 feature:p29/F07" },
        agent_id: { type: "string" },
        head_sha: { type: "string", description: "声明锚定的 commit SHA（7-40 位十六进制）" },
        attestations: {
          type: "array",
          minItems: 1,
          description: "每条对应一条 verification 命令的执行证据",
          items: {
            type: "object",
            properties: {
              command: { type: "string" },
              exit_code: { type: "integer", description: "必须为 0 才构成有效声明" },
              output_digest: { type: "string", description: "sha256:<hex>" },
              output_excerpt: { type: "string", description: "真实输出片段（如 'Tests 12 passed'）" },
              log_url: { type: "string", description: "完整日志路径/URL" },
            },
            required: ["command", "exit_code", "output_digest", "output_excerpt", "log_url"],
          },
        },
        attested_at: { type: "string", description: "ISO 8601 时间戳" },
      },
      required: ["manifest_id", "resource_id", "agent_id", "head_sha", "attestations", "attested_at"],
    },
  },
];

// ---------- JSON-RPC 帮手 ----------

function rpcResult(id: number | string | null, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function rpcError(id: number | string | null, code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// 工具结果统一走 content[0].text（JSON 字符串）；isError 用于业务失败
// （DO 4xx 映射为工具级错误而非 JSON-RPC error——调用是成功的，是业务被拒）
function toolResult(id: number | string | null, body: unknown, isError = false): Response {
  return rpcResult(id, {
    content: [{ type: "text", text: JSON.stringify(body) }],
    isError,
  });
}

// ---------- 工具执行（全部薄封装转发 DO） ----------

type Args = Record<string, unknown>;

async function doFetch(
  stub: DurableObjectStub,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const res = await stub.fetch(`https://repohub${path}`, {
    method,
    ...(body !== undefined
      ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
      : {}),
  });
  return { status: res.status, body: await res.json() };
}

async function callTool(
  stub: DurableObjectStub,
  name: string,
  args: Args,
): Promise<{ body: unknown; isError: boolean }> {
  const wrap = (r: { status: number; body: unknown }) => ({
    body: r.status >= 400 ? { status: r.status, ...(r.body as Record<string, unknown>) } : r.body,
    isError: r.status >= 400,
  });

  switch (name) {
    case "claim_issue":
      return wrap(
        await doFetch(stub, "POST", "/claims", {
          protocol: PROTOCOL,
          resource_id: args["resource_id"],
          resource_type: args["resource_type"],
          agent_id: args["agent_id"],
          ...(args["ttl_seconds"] !== undefined ? { ttl_seconds: args["ttl_seconds"] } : {}),
        }),
      );
    case "heartbeat":
      return wrap(
        await doFetch(stub, "POST", `/claims/${String(args["lease_id"])}/heartbeat`, {
          protocol: PROTOCOL,
          agent_id: args["agent_id"],
        }),
      );
    case "release":
      return wrap(
        await doFetch(stub, "POST", `/claims/${String(args["lease_id"])}/release`, {
          protocol: PROTOCOL,
          agent_id: args["agent_id"],
          handoff_note: args["handoff_note"],
        }),
      );
    case "get_realtime_status": {
      // 三路只读聚合：issue 镜像 + PR 镜像 + 活跃租约，一次调用给 agent 全景
      const [issues, prs, claims] = await Promise.all([
        doFetch(stub, "GET", "/realtime/issues"),
        doFetch(stub, "GET", "/realtime/prs"),
        doFetch(stub, "GET", "/claims"),
      ]);
      return {
        body: {
          issues: (issues.body as Record<string, unknown>)["items"],
          prs: (prs.body as Record<string, unknown>)["items"],
          active_claims: (claims.body as Record<string, unknown>)["leases"],
        },
        isError: false,
      };
    }
    case "get_ready_work": {
      const [issues, claims] = await Promise.all([
        doFetch(stub, "GET", "/realtime/issues?state=open"),
        doFetch(stub, "GET", "/claims"),
      ]);
      const held = new Set(
        ((claims.body as Record<string, unknown>)["leases"] as Array<Record<string, unknown>>).map(
          (l) => l["resource_id"] as string,
        ),
      );
      const items = (
        (issues.body as Record<string, unknown>)["items"] as Array<Record<string, unknown>>
      ).filter(
        (i) =>
          Array.isArray(i["labels"]) &&
          (i["labels"] as unknown[]).includes("status:ready-for-dev") &&
          !held.has(`issue:${i["number"]}`),
      );
      return { body: { ready: items }, isError: false };
    }
    case "get_events": {
      const q = new URLSearchParams();
      if (typeof args["since"] === "string") q.set("since", args["since"]);
      if (typeof args["limit"] === "number") q.set("limit", String(args["limit"]));
      const qs = q.toString();
      return wrap(await doFetch(stub, "GET", `/events${qs ? `?${qs}` : ""}`));
    }
    case "submit_evidence":
      return wrap(
        await doFetch(stub, "POST", "/evidence", { protocol: PROTOCOL, ...args }),
      );
    default:
      // 到不了这里（tools/call 前置判断），防御性兜底
      return { body: { error: `unknown_tool: ${name}` }, isError: true };
  }
}

// ---------- 入口（index.ts 只加一条路由指到这里，逻辑全在本文件降低 F06 冲突面） ----------

export async function handleMcp(
  req: Request,
  env: Env,
  owner: string,
  repo: string,
): Promise<Response> {
  // 鉴权同 REST（auth.ts 共用矩阵）：缺配置 fail-closed 503，坏 token 401，
  // scoped token（F08）经该仓 DO 实时 verify——跨仓 403，已吊销 401
  const denied = await authorizeRepoAccess(req, env, `${owner}/${repo}`);
  if (denied) return denied;
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  let rpc: JsonRpcRequest;
  try {
    rpc = (await req.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  const id = rpc.id ?? null;

  switch (rpc.method) {
    case "initialize":
      return rpcResult(id, {
        // 回显客户端请求的版本（本实现无版本相关行为差异，回显最大化兼容）
        protocolVersion:
          typeof rpc.params?.["protocolVersion"] === "string"
            ? rpc.params["protocolVersion"]
            : DEFAULT_MCP_PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });

    case "notifications/initialized":
      return new Response(null, { status: 202 }); // 通知无响应体（streamable HTTP 语义）

    case "tools/list":
      return rpcResult(id, { tools: TOOLS });

    case "tools/call": {
      const name = rpc.params?.["name"];
      if (typeof name !== "string" || !TOOLS.some((t) => t.name === name)) {
        return rpcError(id, -32602, `Unknown tool: ${String(name)}`);
      }
      const args = (rpc.params?.["arguments"] ?? {}) as Args;
      const stub = env.REPOHUB.get(env.REPOHUB.idFromName(`${owner}/${repo}`));
      const r = await callTool(stub, name, args);
      return toolResult(id, r.body, r.isError);
    }

    default:
      return rpcError(id, -32601, `Method not found: ${String(rpc.method)}`);
  }
}
