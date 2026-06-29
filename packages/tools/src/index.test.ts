import { describe, it, expect } from "vitest";
import {
  ToolRegistry,
  shellTool,
  createDefaultRegistry,
  screenCommand,
  makeShellTool,
} from "./index";

// ─── ToolRegistry ────────────────────────────────────────────────────────────

describe("ToolRegistry: permission enforcement", () => {
  it("throws when tool requests an ungranted permission", () => {
    const registry = new ToolRegistry(); // 默认只有 read
    registry.register(shellTool);
    expect(() => registry.get("shell")).toThrow(/未授权的权限.*shell/);
  });

  it("returns tool when permission is granted", () => {
    const registry = new ToolRegistry();
    registry.grant("shell");
    registry.register(shellTool);
    expect(registry.get("shell")).toBeDefined();
  });

  it("lists registered tools' manifests", () => {
    const registry = createDefaultRegistry();
    const manifests = registry.list();
    expect(manifests.some((m) => m.name === "shell")).toBe(true);
  });
});

// ─── ShellTool ───────────────────────────────────────────────────────────────

describe("shellTool: basic execution", () => {
  it("runs echo and captures stdout", async () => {
    const result = await shellTool.run({ cmd: "echo hello" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stdout.trim()).toBe("hello");
      expect(result.value.exitCode).toBe(0);
    }
  });

  it("captures non-zero exit code without throwing", async () => {
    const result = await shellTool.run({ cmd: "exit 42" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exitCode).toBe(42);
    }
  });

  it("captures stderr output", async () => {
    const result = await shellTool.run({ cmd: "echo error-msg >&2" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stderr.trim()).toBe("error-msg");
    }
  });
});

// ─── ShellTool: deny 层（programmatic 拦截）─────────────────────────────────

describe("shellTool: deny 筛查", () => {
  it("拦截 sudo / 提权", () => {
    expect(screenCommand("sudo rm foo")).toMatch(/root|提权/);
  });

  it("拦截网络请求 curl/wget", () => {
    expect(screenCommand("curl https://evil.example.com")).toMatch(/网络/);
    expect(screenCommand("wget http://x")).toMatch(/网络/);
  });

  it("拦截写 .harness/（变更命令与重定向）", () => {
    expect(screenCommand("rm -rf .harness/state")).toMatch(/\.harness/);
    expect(screenCommand("echo x > .harness/config/foo.yaml")).toMatch(/\.harness/);
    expect(screenCommand("sed -i '' s/a/b/ .harness/agents/x.yaml")).toMatch(/\.harness/);
  });

  it("放行正常命令（读 .harness、跑 harness 脚本、普通 echo）", () => {
    expect(screenCommand("echo hello")).toBeNull();
    expect(screenCommand("cat .harness/rubrics/evaluator-rubric.md")).toBeNull();
    expect(screenCommand("tsx .harness/scripts/cli.ts verify")).toBeNull();
    expect(screenCommand("ls .harness/agents/")).toBeNull();
  });

  it("被拒命令在 run() 中返回结构化 DENIED，不实际执行", async () => {
    const result = await shellTool.run({ cmd: "sudo whoami" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("DENIED");
      expect(result.error).toMatch(/被拒绝/);
    }
  });

  it("makeShellTool 可注入自定义规则", async () => {
    const strict = makeShellTool([{ pattern: /\brm\b/, reason: "禁止删除" }]);
    const blocked = await strict.run({ cmd: "rm foo" });
    expect(blocked.ok).toBe(false);
    // 默认实例仍放行（自定义规则不影响默认）
    const allowed = await shellTool.run({ cmd: "echo ok" });
    expect(allowed.ok).toBe(true);
  });
});
