// enroll 向导可选运行时（p30/F07，UC-06，供应商中立）+ 接入命令生成。
// ⚠️ 与 lib/mock/p30.ts 不同：本文件不是 mock——运行时清单与安装命令格式是真实
// 产品面契约（enroll-wizard.tsx 接真后从这里取，不再从 mock 文件读）。
export const ENROLL_RUNTIMES = ["Claude Code", "Codex", "Gemini CLI", "自研"] as const;
export type EnrollRuntime = (typeof ENROLL_RUNTIMES)[number];

/** agent 名合法性（服务端 Directory 的 AGENT_SEGMENT_RE 是权威判定；这里只做
 *  前端即时反馈，与 enroll-wizard.tsx 原有校验保持一致：小写字母/数字/连字符，2-39 位）。 */
export const AGENT_NAME_RE = /^[a-z0-9][a-z0-9-]{1,38}$/;

/** 接入命令：token 由调用方在 mint 成功后一次性拿到，此处只负责拼装展示文案。 */
export function installCommand(agentId: string, token: string): string {
  return `npx boardx-agent connect --agent ${agentId} --token ${token}`;
}
