// 常量 + 固定数据 —— 与 directory-fixture-server.mjs 分开是刻意的：playwright.config.ts
// 需要引用 FIXTURE_PORT/FIXTURE_TOKEN，但只 import 常量文件，不触发起服务的副作用
// （server.mjs 顶层 server.listen() 若被 config 当模块 import 会在 config 加载阶段就跑起来，
// 且拿不到正确的 argv 端口——这是本文件存在的直接原因）。
//
// 安全审计修复（PR #783 复审）：engineer 的 handle 与 github_login 在本 fixture 里刻意
// 设成不同字符串，并额外放一个「诱饵」工程师（handle 恰好等于真实 owner 的 github_login）
// ——如果 lib/workspace-authz.ts 的身份 join 键退回到用 handle 匹配，登录者 owner-user
// 会被误配到诱饵记录（contributor 角色）而不是真正的 owner，workspace-authz.spec.ts 的
// 回归用例会因此变红。这是把「用 handle 和 login 相等掩盖错配」的原测试坑位堵死。
export const FIXTURE_TOKEN = "e2e-fixture-directory-token";
export const FIXTURE_PORT = 3401;

export const FIXTURE_PROJECTS = [
  { project_id: "prj_fixture01", slug: "fixture-proj", name: "Fixture Project", visibility: "private" },
  { project_id: "prj_fixture02", slug: "fixture-public", name: "Fixture Public Project", visibility: "public" },
];

export const FIXTURE_ENGINEERS = [
  // 真实 owner：handle 与 github_login 刻意不同——身份 join 键必须是 github_login。
  { engineer_id: "eng_owner01", handle: "alice-eng", github_login: "owner-user" },
  // 真实 contributor：同样 handle != github_login。
  { engineer_id: "eng_contrib01", handle: "bob-eng", github_login: "contrib-user" },
  // 身份混淆诱饵：handle 恰好等于上面 owner 的 github_login（"owner-user"），
  // 但 github_login 是完全不同的人。若鉴权错误按 handle join，登录者 owner-user
  // 会被误配到这条记录而不是真正的 owner。
  { engineer_id: "eng_decoy01", handle: "owner-user", github_login: "decoy-totally-different-person" },
  { engineer_id: "eng_outsider01", handle: "outsider-eng", github_login: "outsider-user" },
];

export const FIXTURE_MEMBERSHIPS = [
  { project_id: "prj_fixture01", engineer_id: "eng_owner01", role: "owner", status: "active" },
  { project_id: "prj_fixture01", engineer_id: "eng_contrib01", role: "contributor", status: "active" },
  // 诱饵工程师在同一项目里只是 contributor——如果 join 键搞错，会把真正的 owner 误判/降权成 contributor。
  { project_id: "prj_fixture01", engineer_id: "eng_decoy01", role: "contributor", status: "active" },
];
