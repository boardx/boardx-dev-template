#!/usr/bin/env tsx
// seed-agents.ts — 从 .harness/agents/registry.yaml 生成 coord-service 的 agents 表种子数据。
//
// 纯增量、幂等：只给远端 D1 里还没有的 id 生成新行 + 新 token；已存在的 id 完全不碰
// （包括不改 kind/areas），因为它的 token 只在当初生成那一刻打印过一次，重新生成一个
// "新" token 打印出来但不落库，会造成"打印的 token 其实用不了"这种误导——所以干脆
// 不碰，要更新已有身份的 kind/areas 走单独的手动 SQL，不是这个脚本的职责。
//
// 用法：
//   npx tsx scripts/seed-agents.ts            # 目标 coord-service-staging（默认）
//   npx tsx scripts/seed-agents.ts --production  # 目标生产库（Phase 5+ 才会用到）
//
// 前置：packages/coord-service/.env.cloudflare 已配置（本脚本自己 source，不需要外部
// 先 export）。
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_DIR = join(__dirname, "..");
const REPO_ROOT = join(PACKAGE_DIR, "..", "..");
const REGISTRY_PATH = join(REPO_ROOT, ".harness", "agents", "registry.yaml");
// 中央凭据文件（gitignored，.gitignore 的 .harness/state/.cache/ 整目录规则覆盖）。
// #493：OPERATIONS.md/onboarding 文档均以此文件为准（#520 标准化），seed 必须真写入。
const CREDENTIALS_PATH = join(REPO_ROOT, ".harness", "state", ".cache", "coord-credentials.json");
const DEFAULT_SERVICE_URL = "https://coord-service-staging.boardx.workers.dev";

/** 把新 mint 的 token 合并进中央凭据文件（不覆盖已有身份的 token），mode 600。 */
function mergeIntoCredentialsFile(minted: { id: string; token: string }[]): string {
  let doc: { COORD_SERVICE_URL?: string; tokens?: Record<string, string> } = {};
  if (existsSync(CREDENTIALS_PATH)) {
    try {
      doc = JSON.parse(readFileSync(CREDENTIALS_PATH, "utf8")) as typeof doc;
    } catch {
      throw new Error(`${CREDENTIALS_PATH} 已存在但不是合法 JSON——手工检查后重试，拒绝覆盖。`);
    }
  }
  doc.COORD_SERVICE_URL = doc.COORD_SERVICE_URL ?? DEFAULT_SERVICE_URL;
  doc.tokens = doc.tokens ?? {};
  for (const { id, token } of minted) {
    doc.tokens[id] = token; // 新 mint 的身份此前必无 token；同 id 重跑不可能走到这（幂等跳过）
  }
  mkdirSync(dirname(CREDENTIALS_PATH), { recursive: true });
  writeFileSync(CREDENTIALS_PATH, JSON.stringify(doc, null, 2) + "\n", "utf8");
  chmodSync(CREDENTIALS_PATH, 0o600);
  return CREDENTIALS_PATH;
}

interface RegistryAgent {
  id: string;
  kind: string;
  areas?: string[];
}

interface RegistryDoc {
  agents: RegistryAgent[];
}

function loadRegistryAgents(): RegistryAgent[] {
  const doc = parseYaml(readFileSync(REGISTRY_PATH, "utf8")) as RegistryDoc;
  return doc.agents;
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

const isProduction = process.argv.includes("--production");
const databaseName = isProduction ? "coord-service" : "coord-service-staging";
const envName = isProduction ? "production" : "staging";

function wranglerExecute(args: string[]): string {
  return execFileSync(
    "sh",
    ["-c", `set -a; . ./.env.cloudflare; set +a; npx wrangler ${args.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ")}`],
    { cwd: PACKAGE_DIR, encoding: "utf8" }
  );
}

function fetchExistingIds(): Set<string> {
  const raw = wranglerExecute([
    "d1", "execute", databaseName, "--remote", "--env", envName,
    "--command", "SELECT id FROM agents", "--json",
  ]);
  const start = raw.indexOf("[");
  const parsed = JSON.parse(raw.slice(start)) as Array<{ results: Array<{ id: string }> }>;
  const results = parsed[0]?.results ?? [];
  return new Set(results.map((r) => r.id));
}

function main(): void {
  const registryAgents = loadRegistryAgents();
  const existingIds = fetchExistingIds();
  const toInsert = registryAgents.filter((a) => !existingIds.has(a.id));

  if (toInsert.length === 0) {
    console.log(`所有 ${registryAgents.length} 个 registry.yaml 身份在 ${databaseName} 里都已存在，无新增。`);
    return;
  }

  const nowIso = new Date().toISOString();
  const statements: string[] = [];
  const printed: { id: string; kind: string; token: string }[] = [];

  for (const agent of toInsert) {
    const token = generateToken();
    const tokenHash = sha256Hex(token);
    const areasSql = agent.areas ? `'${JSON.stringify(agent.areas).replace(/'/g, "''")}'` : "NULL";
    statements.push(
      `INSERT INTO agents (id, kind, areas, token_hash, active, created_at) ` +
        `VALUES ('${agent.id}', '${agent.kind}', ${areasSql}, '${tokenHash}', 1, '${nowIso}');`
    );
    printed.push({ id: agent.id, kind: agent.kind, token });
  }

  const sqlFile = join(REPO_ROOT, `.seed-agents-${Date.now()}.sql`);
  writeFileSync(sqlFile, statements.join("\n") + "\n", "utf8");
  try {
    wranglerExecute(["d1", "execute", databaseName, "--remote", "--env", envName, "--file", sqlFile]);
  } finally {
    unlinkSync(sqlFile);
  }

  console.log(`\n已新增 ${printed.length} 个身份到 ${databaseName}（${registryAgents.length - toInsert.length} 个已存在，跳过）。`);
  const credPath = mergeIntoCredentialsFile(printed.map(({ id, token }) => ({ id, token })));
  console.log(`新 token 已写入中央凭据文件（mode 600、gitignored）：${credPath}`);
  console.log("会话取用（把值贴进聊天/issue = 泄露，只贴路径）：");
  for (const { id, kind } of printed) {
    console.log(`  ${id} (${kind}): export COORD_SERVICE_TOKEN=$(jq -r '.tokens[\"${id}\"]' ${credPath})`);
  }
}

main();
