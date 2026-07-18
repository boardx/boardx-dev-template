// dispatch.ts — 门户派工的资格判定与 broker 配置（#594 P3）。
//
// 谁能在门户派工：**在 registry 里 own 至少一个协调者身份的人类**（Access email →
// owner 匹配 → kind ∈ 协调层）。这把派工权与 registry 里的协调者归属绑定，实现
// issue 说的"人类身份映射"——不是任何过 Access 的人都能派工。
//
// 服务端 broker（F10-pre 起）：数据源从冻结退役中的 coord-service D1 切到
// coord-gateway（RepoHub DO 权威）。派工/撤回是 gateway 的 COORD_ADMIN_TOKEN
// 管理面——复用既有 Pages secret COORD_GATEWAY_ADMIN_TOKEN（F08 mint 同款），
// 永不到浏览器；派工的 note 里带上真实人类 email 做审计。
// COORD_DISPATCH_TOKEN / COORD_SERVICE_URL：deprecated（旧 coord-service broker
// 通道，本轮只切数据源不删配置；割接 PR 删除，遵守 env 原子纪律）。
import { parse } from "yaml";
import { ownerMatches } from "@/lib/access";
import { readRepoFile } from "@/lib/repo-files";

const COORDINATOR_KINDS = new Set(["coordinator", "module-coordinator", "architecture-coordinator"]);

export interface RegistryAgent {
  id: string;
  kind: string;
  owner?: string;
  active?: boolean;
  areas?: string[];
}

export async function loadRegistry(): Promise<RegistryAgent[] | null> {
  const raw = await readRepoFile(".harness/agents/registry.yaml");
  if (!raw) return null;
  const doc = parse(raw) as { agents?: RegistryAgent[] };
  return (doc.agents ?? []).map((a) => ({ ...a, active: a.active ?? true }));
}

/** 当前人类是否有派工资格：own 至少一个 active 的协调者身份。 */
export function canDispatch(agents: RegistryAgent[], email: string): boolean {
  return agents.some((a) => a.active !== false && COORDINATOR_KINDS.has(a.kind) && ownerMatches(a.owner, email));
}

export function dispatchBroker(): { token: string; baseUrl: string } | null {
  // F10-pre：tasks 收件箱权威已迁 RepoHub DO；baseUrl 指向 gateway 的按仓前缀，
  // 下游调用（/tasks、/tasks/:id/recall）的相对路径与 coord-service 时代一致。
  const token = process.env["COORD_GATEWAY_ADMIN_TOKEN"];
  const gatewayUrl = process.env["COORD_GATEWAY_URL"];
  const repo = process.env["GITHUB_REPO"];
  if (!token || !gatewayUrl || !repo) return null;
  return { token, baseUrl: `${gatewayUrl}/api/coord/repos/${repo}` };
}
