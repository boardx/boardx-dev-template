// gen-subagents.ts — 从 .harness/agents/*.yaml 生成工具特定的 subagent 文件
// Claude Code: .claude/agents/<name>.md  (YAML frontmatter + system prompt)
// Codex:       .codex/agents/<name>.toml (TOML format)
// 原则：规格只写一次，两种格式从同一来源生成，行为不漂移。

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { HARNESS_DIR, REPO_ROOT } from "./lib/paths";
import { log } from "./lib/log";
import type { Args } from "./lib/args";

interface AgentSpec {
  name: string;
  description: string;
  role: string;
  context_isolation?: boolean;
  tools?: string[];
  allowed_commands?: string[];
  model?: { claude?: string; codex?: string };
  system_prompt?: string;
  rubric_ref?: string;
}

const AGENTS_DIR = join(HARNESS_DIR, "agents");
const CLAUDE_AGENTS_DIR = join(REPO_ROOT, ".claude", "agents");
const CODEX_AGENTS_DIR = join(REPO_ROOT, ".codex", "agents");

/** 工具名称 → Claude Code tool 字符串映射 */
function toClaudeTools(tools: string[]): string[] {
  const map: Record<string, string> = {
    read_files: "Read",
    bash_restricted: "Bash",
    bash_git_readonly: "Bash",
    bash_search_readonly: "Bash",
    write_files: "Write",
  };
  return [...new Set(tools.map((t) => map[t] ?? t))];
}

/** 生成 Claude Code subagent .md */
function generateClaudeMd(spec: AgentSpec): string {
  const claudeTools = toClaudeTools(spec.tools ?? []);
  const model = spec.model?.claude ?? "claude-sonnet-4-6";

  const frontmatter = [
    "---",
    `name: ${spec.name}`,
    `description: ${spec.description.trim().replace(/\n/g, " ")}`,
    `model: ${model}`,
    claudeTools.length ? `tools:\n${claudeTools.map((t) => `  - ${t}`).join("\n")}` : "",
    "---",
  ]
    .filter(Boolean)
    .join("\n");

  const body = spec.system_prompt?.trim() ?? `# ${spec.name}\n\n${spec.description}`;
  return `${frontmatter}\n\n${body}\n`;
}

/** 生成 Codex subagent .toml */
function generateCodexToml(spec: AgentSpec): string {
  const model = spec.model?.codex ?? "gpt-5.4-mini";
  const tools = spec.tools ?? [];
  const allowedCmds = spec.allowed_commands ?? [];

  const lines = [
    `# ${spec.name}.toml — 由 pnpm harness gen-subagents 自动生成`,
    `# 修改请改 .harness/agents/${spec.name}.yaml，然后重新运行 gen-subagents`,
    ``,
    `[agent]`,
    `name = "${spec.name}"`,
    `description = """`,
    spec.description.trim(),
    `"""`,
    `model = "${model}"`,
    `context_isolation = ${spec.context_isolation ?? false}`,
    ``,
    `[tools]`,
    `allowed = [${tools.map((t) => `"${t}"`).join(", ")}]`,
    ``,
  ];

  if (allowedCmds.length) {
    lines.push(`[shell]`);
    lines.push(`allowed_commands = [`);
    for (const cmd of allowedCmds) {
      lines.push(`  "${cmd}",`);
    }
    lines.push(`]`);
    lines.push(``);
  }

  if (spec.system_prompt) {
    lines.push(`[prompts]`);
    lines.push(`system = """`);
    lines.push(spec.system_prompt.trim());
    lines.push(`"""`);
  }

  return lines.join("\n") + "\n";
}

export function genSubagents(_args: Args): void {
  if (!existsSync(AGENTS_DIR)) {
    log.info(`找不到 ${AGENTS_DIR}，跳过（无 agent 规格文件）`);
    return;
  }

  mkdirSync(CLAUDE_AGENTS_DIR, { recursive: true });
  mkdirSync(CODEX_AGENTS_DIR, { recursive: true });

  const yamlFiles = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".yaml"));
  if (!yamlFiles.length) {
    log.info("没有找到 .yaml 规格文件");
    return;
  }

  let generated = 0;
  for (const file of yamlFiles) {
    const raw = readFileSync(join(AGENTS_DIR, file), "utf8");
    const spec = parse(raw) as AgentSpec;
    if (!spec.name) {
      log.warn(`${file} 缺少 name 字段，跳过`);
      continue;
    }

    // 生成 Claude md
    const claudePath = join(CLAUDE_AGENTS_DIR, `${spec.name}.md`);
    writeFileSync(claudePath, generateClaudeMd(spec), "utf8");
    log.ok(`Claude:  ${claudePath}`);

    // 生成 Codex toml
    const codexPath = join(CODEX_AGENTS_DIR, `${spec.name}.toml`);
    writeFileSync(codexPath, generateCodexToml(spec), "utf8");
    log.ok(`Codex:   ${codexPath}`);

    generated++;
  }

  log.info(`\n共生成 ${generated} 个 subagent（每个 2 种格式）`);
  log.info(`  Claude: ${CLAUDE_AGENTS_DIR}`);
  log.info(`  Codex:  ${CODEX_AGENTS_DIR}`);
}
