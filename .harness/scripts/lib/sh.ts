import { spawnSync } from "node:child_process";

export interface ShResult { code: number; stdout: string; stderr: string; }

export function sh(cmd: string, cwd?: string): ShResult {
  const r = spawnSync("bash", ["-c", cmd], { cwd, encoding: "utf8" });
  return { code: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}
