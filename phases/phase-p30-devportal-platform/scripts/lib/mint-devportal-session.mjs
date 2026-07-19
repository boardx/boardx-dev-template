#!/usr/bin/env node
// 铸造与 apps/devportal/lib/session.ts::signSession 同构的测试 session JWT（HS256）。
// 不依赖 jose（避免跨包解析问题）——纯 node:crypto 手写 HS256 签名，字段与产出必须
// 与 verifySession() 的校验逻辑（iss=devportal、sub=login、HS256）严格对齐。
// 用法：node mint-devportal-session.mjs <login> <secret> [ttl_seconds]
import { createHmac } from "node:crypto";

function b64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const [login, secret, ttlArg] = process.argv.slice(2);
if (!login || !secret) {
  console.error("用法：node mint-devportal-session.mjs <login> <secret> [ttl_seconds]");
  process.exit(1);
}
const ttl = Number(ttlArg ?? 3600);
const now = Math.floor(Date.now() / 1000);

const header = { alg: "HS256" };
const payload = {
  sub: login,
  iss: "devportal",
  iat: now,
  exp: now + ttl,
  email: null,
  name: null,
  avatarUrl: null,
};

const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
const signature = createHmac("sha256", secret).update(signingInput).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

process.stdout.write(`${signingInput}.${signature}`);
