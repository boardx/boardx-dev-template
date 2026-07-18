// @repo/coord-projection：反向投影（RepoHub 事件 → GitHub check/status）。
// 引擎纯函数、认证与应用层 fetch 可注入；宿主（coord-gateway cron）负责编排。
export {
  project,
  type ProjectionEvent,
  type OpenPr,
  type ActiveLease,
  type AndonState,
  type GithubCall,
  type ProjectionInput,
} from "./engine";
export { createGitHubAppAuth, type GitHubAppAuth, type GitHubAppAuthOptions } from "./github-app";
export { applyCalls, type ApplyOptions, type ApplyResult } from "./apply";
