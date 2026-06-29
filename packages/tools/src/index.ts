// packages/tools/src/index.ts
// 工具子系统：最小权限原则 + 纯函数式契约
// 见 agentic-patterns.md："每个工具 = 纯函数式契约；工具错误必须结构化返回"

import { spawnSync } from "node:child_process";

// ─── 核心类型 ──────────────────────────────────────────────────────────────

export type PermissionLevel = "read" | "write" | "network" | "shell";

/** 工具成功结果 */
export interface ToolOk<T> {
  ok: true;
  value: T;
}

/** 工具失败结果（结构化，不抛裸异常） */
export interface ToolErr {
  ok: false;
  error: string;
  code?: string;
}

export type ToolResult<T> = ToolOk<T> | ToolErr;

/** 工具契约：输入 I → 输出 ToolResult<O> */
export interface Tool<I, O> {
  manifest: ToolManifest;
  run(input: I): Promise<ToolResult<O>>;
}

export interface ToolManifest {
  name: string;
  description: string;
  /** 声明此工具需要的权限（不声明 = 不获取） */
  permissions: PermissionLevel[];
  /** 此工具明确不做什么（最小权限原则的文档部分） */
  cannotDo: string[];
}

// ─── ToolRegistry — 注册与最小权限分发 ───────────────────────────────────

export class ToolRegistry {
  private tools = new Map<string, Tool<unknown, unknown>>();
  /** 允许的权限集合；默认只允许 read */
  private allowedPermissions: Set<PermissionLevel> = new Set(["read"]);

  register<I, O>(tool: Tool<I, O>): void {
    this.tools.set(tool.manifest.name, tool as Tool<unknown, unknown>);
  }

  /** 提升权限（新增工具需在此处声明） */
  grant(permission: PermissionLevel): void {
    this.allowedPermissions.add(permission);
  }

  get<I, O>(name: string): Tool<I, O> | undefined {
    const tool = this.tools.get(name);
    if (!tool) return undefined;
    // 权限检查：工具声明的权限必须全部在允许集合内
    const denied = tool.manifest.permissions.filter((p) => !this.allowedPermissions.has(p));
    if (denied.length > 0) {
      throw new Error(
        `工具 "${name}" 请求未授权的权限: ${denied.join(", ")}。` +
          `请在 agentic-patterns.md 中登记并在代码中调用 registry.grant()。`
      );
    }
    return tool as Tool<I, O>;
  }

  list(): ToolManifest[] {
    return [...this.tools.values()].map((t) => t.manifest);
  }
}

// ─── 命令前置筛查（programmatic deny 层）─────────────────────────────────
//
// 重要：这是「best-effort 筛查」，不是安全隔离。对 bash 做字符串/正则匹配
// 必然可被变量、编码、间接执行绕过（如 `e=curl; $e ...`）。它的价值是挡住
// 诚实的误操作和低级滥用，把 cannotDo 从「纯文档」升级为「有演员的护栏」。
//
// 硬保证只能靠 OS 级沙箱：独立低权用户、.harness/ 只读挂载、无网络 namespace、
// 显式 uid/受限 env。见 ADR-002。manifest.cannotDo 不应被当作隔离承诺。

export interface DenyRule {
  /** 命中即拒绝执行 */
  pattern: RegExp;
  /** 拒绝原因（回给调用方，便于排错） */
  reason: string;
}

/** 默认拒绝规则：对应 shellTool.manifest.cannotDo 的程序化执行 */
export const DEFAULT_DENY_RULES: DenyRule[] = [
  // root / 提权
  { pattern: /\bsudo\b/, reason: "不允许以 root/提权方式运行（sudo）" },
  { pattern: /\bsu\s+-?\b/, reason: "不允许切换用户提权（su）" },
  // 网络请求（agent 应走 network 工具，而非裸 shell）
  {
    pattern: /\b(curl|wget|nc|ncat|telnet|ssh|scp|sftp|ftp)\b/,
    reason: "不允许在 shell 中发网络请求（使用 network 工具代替）",
  },
  // 写 .harness/ 控制平面：拦截「变更类命令 + 指向 .harness/」与「重定向进 .harness/」
  {
    pattern: /\b(rm|mv|cp|tee|truncate|chmod|chown|ln)\b[^|&;]*\.harness\//,
    reason: "不允许修改 .harness/ 控制平面目录",
  },
  { pattern: />>?\s*[^|&;]*\.harness\//, reason: "不允许重定向写入 .harness/ 控制平面目录" },
  { pattern: /\bsed\b[^|&;]*-i[^|&;]*\.harness\//, reason: "不允许就地编辑 .harness/ 控制平面文件" },
];

/** 前置筛查：命中任一 deny 规则则返回拒绝原因，否则 null */
export function screenCommand(cmd: string, rules: DenyRule[] = DEFAULT_DENY_RULES): string | null {
  for (const r of rules) {
    if (r.pattern.test(cmd)) return r.reason;
  }
  return null;
}

// ─── ShellTool — 受约束的 shell 执行工具 ─────────────────────────────────

export interface ShellInput {
  cmd: string;
  /** 工作目录（绝对路径）；不提供则使用当前目录 */
  cwd?: string;
  /** 超时毫秒，默认 30000 */
  timeoutMs?: number;
}

export interface ShellOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** 用指定 deny 规则构造一个 shell 工具实例（默认实例不可被调用方绕过规则） */
export function makeShellTool(denyRules: DenyRule[] = DEFAULT_DENY_RULES): Tool<ShellInput, ShellOutput> {
  return {
    manifest: {
      name: "shell",
      description: "在受控环境中执行 shell 命令，捕获 stdout/stderr（带 best-effort deny 筛查）",
      permissions: ["shell"],
      cannotDo: [
        "不允许执行网络请求（best-effort 拦截 curl/wget/nc 等；硬保证靠无网络沙箱）",
        "不允许修改 .harness/ 目录（best-effort 拦截变更命令/重定向；硬保证靠只读挂载）",
        "不允许以 root 权限运行（best-effort 拦截 sudo/su；硬保证靠低权用户）",
        "注意：deny 筛查对 bash 是字符串匹配，可被绕过，不构成安全隔离边界，见 ADR-002",
      ],
    },
    async run(input: ShellInput): Promise<ToolResult<ShellOutput>> {
      // 前置筛查：在 spawn 之前挡住命中 deny 规则的命令
      const denied = screenCommand(input.cmd, denyRules);
      if (denied) {
        return { ok: false, error: `命令被拒绝：${denied}`, code: "DENIED" };
      }
      try {
        const r = spawnSync("bash", ["-c", input.cmd], {
          cwd: input.cwd,
          encoding: "utf8",
          timeout: input.timeoutMs ?? 30_000,
        });
        if (r.error) {
          return { ok: false, error: r.error.message, code: "SPAWN_ERROR" };
        }
        return {
          ok: true,
          value: {
            stdout: r.stdout ?? "",
            stderr: r.stderr ?? "",
            exitCode: r.status ?? 1,
          },
        };
      } catch (err) {
        return { ok: false, error: String(err), code: "UNKNOWN" };
      }
    },
  };
}

/** 默认 shell 工具实例（内置 DEFAULT_DENY_RULES，调用方无法关闭筛查） */
export const shellTool: Tool<ShellInput, ShellOutput> = makeShellTool();

// ─── 默认注册表（带 shell 权限）────────────────────────────────────────────

export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.grant("shell");
  registry.register(shellTool);
  return registry;
}
