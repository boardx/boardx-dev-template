#!/usr/bin/env node
// p30-F03 e2e 用固定目录数据 fixture server：本地模拟 coord-gateway 的平台目录读面
// （/api/coord/directory/projects|engineers|memberships），让 workspace-authz.spec.ts
// 能在没有真实 Cloudflare 部署时，仍然打真实 HTTP 请求验证服务端裁剪逻辑
// （lib/workspace-authz.ts 的 fetch 路径本身不作任何测试环境特判）。
//
// 用法（作为独立进程运行，见 playwright.config.ts 的 webServer 条目）：
//   node directory-fixture-server.mjs [port]
// Bearer token 固定为 FIXTURE_TOKEN（directory-fixture-constants.mjs，playwright.config.ts
// 同步注入 COORD_API_TOKEN）。
import { createServer } from "node:http";
import {
  FIXTURE_ENGINEERS,
  FIXTURE_MEMBERSHIPS,
  FIXTURE_PORT,
  FIXTURE_PROJECTS,
  FIXTURE_TOKEN,
} from "./directory-fixture-constants.mjs";

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://fixture");
  // 无鉴权健康检查（playwright webServer.url 探活用，2xx 才算就绪）——不暴露任何目录数据。
  if (req.method === "GET" && url.pathname === "/healthz") return json(res, 200, { ok: true });

  const auth = req.headers["authorization"];
  if (auth !== `Bearer ${FIXTURE_TOKEN}`) return json(res, 401, { error: "unauthorized" });

  if (req.method === "GET" && url.pathname === "/api/coord/directory/projects")
    return json(res, 200, { projects: FIXTURE_PROJECTS });
  if (req.method === "GET" && url.pathname === "/api/coord/directory/engineers")
    return json(res, 200, { engineers: FIXTURE_ENGINEERS });
  if (req.method === "GET" && url.pathname === "/api/coord/directory/memberships")
    return json(res, 200, { memberships: FIXTURE_MEMBERSHIPS });
  return json(res, 404, { error: "not_found" });
});

const port = Number(process.argv[2] ?? FIXTURE_PORT);
server.listen(port, "127.0.0.1", () => {
  // eslint-disable-next-line no-console
  console.log(`directory fixture server listening on 127.0.0.1:${port}`);
});
