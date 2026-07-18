// dispatch.ts — 门户派工的资格判定与 broker 配置（#594 P3）。
//
// 谁能在门户派工：**在 registry 里 own 至少一个协调者身份的人类**（Access email →
// owner 匹配 → kind ∈ 协调层）。这把派工权与 registry 里的协调者归属绑定，实现
// issue 说的"人类身份映射"——不是任何过 Access 的人都能派工。
//
// 服务端 broker：coord-service 的 POST /tasks 要 coordinator token。devportal 持
// 一个协调者级 broker token（COORD_DISPATCH_TOKEN，Pages secret，永不到浏览器）
// 代调；派工的 note 里带上真实人类 email 做审计。同 #629 mint 的 broker 模式。
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
  const token = process.env["COORD_DISPATCH_TOKEN"];
  const baseUrl = process.env["COORD_SERVICE_URL"];
  return token && baseUrl ? { token, baseUrl } : null;
}
