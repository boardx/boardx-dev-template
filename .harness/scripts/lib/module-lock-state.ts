// module-lock-state.ts — 本地缓存"这个模块当前对应的 coord-service claim id 是哪个"。
// 纯粹是 dual-write 记账用，不是权威状态——GitHub lease issue 的评论历史在 Phase 5
// 之前始终是唯一权威。gitignored（见根 .gitignore module-lock-*.json 规则）。
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { STATE_DIR } from "./paths";

function statePath(moduleName: string): string {
  return join(STATE_DIR, `module-lock-${moduleName}.json`);
}

export function readModuleRemoteClaimId(moduleName: string): number | undefined {
  const p = statePath(moduleName);
  if (!existsSync(p)) return undefined;
  try {
    const data = JSON.parse(readFileSync(p, "utf8")) as { remoteClaimId?: number };
    return data.remoteClaimId;
  } catch {
    return undefined;
  }
}

export function writeModuleRemoteClaimId(moduleName: string, remoteClaimId: number): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(moduleName), JSON.stringify({ remoteClaimId }, null, 2) + "\n", "utf8");
}

export function clearModuleRemoteClaimId(moduleName: string): void {
  const p = statePath(moduleName);
  if (existsSync(p)) unlinkSync(p);
}
