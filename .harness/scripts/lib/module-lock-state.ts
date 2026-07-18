// module-lock-state.ts — 本地缓存"这个模块当前对应的 coord-gateway lease id 是哪个"。
// 纯粹是记账用，不是权威状态——权威在 RepoHub DO（ADR-017）。gitignored
// （见根 .gitignore module-lock-*.json 规则）。
//
// 2026-07-18 割接（p29-F10 stage-1）：id 从 coord-service 的数字 claim id 换成
// coord-gateway 的字符串 lease id（`lse_...`）。旧文件里的数字 id 指向已退役的
// coord-service，对 gateway 无意义——读到时按"无记录"处理即可（下一次 acquire 会
// 覆盖写入新 lease id）。
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { STATE_DIR } from "./paths";

function statePath(moduleName: string): string {
  return join(STATE_DIR, `module-lock-${moduleName}.json`);
}

export function readModuleRemoteClaimId(moduleName: string): string | undefined {
  const p = statePath(moduleName);
  if (!existsSync(p)) return undefined;
  try {
    const data = JSON.parse(readFileSync(p, "utf8")) as { remoteClaimId?: unknown };
    // 数字 = coord-service 时代的遗留记录，视为无记录（见文件头）
    return typeof data.remoteClaimId === "string" ? data.remoteClaimId : undefined;
  } catch {
    return undefined;
  }
}

export function writeModuleRemoteClaimId(moduleName: string, remoteClaimId: string): void {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(moduleName), JSON.stringify({ remoteClaimId }, null, 2) + "\n", "utf8");
}

export function clearModuleRemoteClaimId(moduleName: string): void {
  const p = statePath(moduleName);
  if (existsSync(p)) unlinkSync(p);
}
