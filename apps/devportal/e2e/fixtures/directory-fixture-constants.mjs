// 常量 + 固定数据 —— 与 directory-fixture-server.mjs 分开是刻意的：playwright.config.ts
// 需要引用 FIXTURE_PORT/FIXTURE_TOKEN，但只 import 常量文件，不触发起服务的副作用
// （server.mjs 顶层 server.listen() 若被 config 当模块 import 会在 config 加载阶段就跑起来，
// 且拿不到正确的 argv 端口——这是本文件存在的直接原因）。
export const FIXTURE_TOKEN = "e2e-fixture-directory-token";
export const FIXTURE_PORT = 3401;

export const FIXTURE_PROJECTS = [
  { project_id: "prj_fixture01", slug: "fixture-proj", name: "Fixture Project", visibility: "private" },
  { project_id: "prj_fixture02", slug: "fixture-public", name: "Fixture Public Project", visibility: "public" },
];

export const FIXTURE_ENGINEERS = [
  { engineer_id: "eng_owner01", handle: "owner-user" },
  { engineer_id: "eng_contrib01", handle: "contrib-user" },
  { engineer_id: "eng_outsider01", handle: "outsider-user" },
];

export const FIXTURE_MEMBERSHIPS = [
  { project_id: "prj_fixture01", engineer_id: "eng_owner01", role: "owner", status: "active" },
  { project_id: "prj_fixture01", engineer_id: "eng_contrib01", role: "contributor", status: "active" },
];
