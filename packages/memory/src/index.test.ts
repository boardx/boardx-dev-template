import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync, existsSync } from "node:fs";
import { WorkingMemory, SessionMemory, DurableMemory, createMemoryStack } from "./index";

// ─── WorkingMemory ──────────────────────────────────────────────────────────

describe("WorkingMemory", () => {
  it("stores and retrieves values", () => {
    const mem = new WorkingMemory();
    mem.set("key", { x: 1 });
    expect(mem.get("key")).toEqual({ x: 1 });
  });

  it("returns undefined for missing keys", () => {
    const mem = new WorkingMemory();
    expect(mem.get("missing")).toBeUndefined();
  });

  it("exports snapshot", () => {
    const mem = new WorkingMemory();
    mem.set("a", 1);
    mem.set("b", "hello");
    const snap = mem.snapshot();
    expect(snap).toEqual({ a: 1, b: "hello" });
  });

  it("clears all keys", () => {
    const mem = new WorkingMemory();
    mem.set("x", 42);
    mem.clear();
    expect(mem.has("x")).toBe(false);
  });
});

// ─── SessionMemory ──────────────────────────────────────────────────────────

describe("SessionMemory", () => {
  let tmpPath: string;

  beforeEach(() => {
    tmpPath = join(tmpdir(), `session-test-${Date.now()}.json`);
  });

  afterEach(() => {
    if (existsSync(tmpPath)) rmSync(tmpPath);
  });

  it("persists values to file", () => {
    const mem = new SessionMemory(tmpPath);
    mem.set("token", "abc123");
    const mem2 = new SessionMemory(tmpPath); // 重新加载
    expect(mem2.get("token")).toBe("abc123");
  });

  it("merges a working memory snapshot", () => {
    const mem = new SessionMemory(tmpPath);
    mem.mergeSnapshot({ a: 1, b: 2 });
    expect(mem.get("a")).toBe(1);
    expect(mem.get("b")).toBe(2);
  });
});

// ─── DurableMemory ──────────────────────────────────────────────────────────

describe("DurableMemory", () => {
  let tmpPath: string;

  beforeEach(() => {
    tmpPath = join(tmpdir(), `durable-test-${Date.now()}.json`);
  });

  afterEach(() => {
    if (existsSync(tmpPath)) rmSync(tmpPath);
  });

  it("writes and reads records", () => {
    const mem = new DurableMemory(tmpPath);
    mem.write("result-001", { ok: true }, ["task:T01"]);
    expect(mem.read("result-001")).toEqual({ ok: true });
  });

  it("finds records by tag", () => {
    const mem = new DurableMemory(tmpPath);
    mem.write("r1", "a", ["tag:x"]);
    mem.write("r2", "b", ["tag:x", "tag:y"]);
    mem.write("r3", "c", ["tag:z"]);
    expect(mem.findByTag("tag:x")).toHaveLength(2);
  });

  it("is idempotent (same key overwrites)", () => {
    const mem = new DurableMemory(tmpPath);
    mem.write("k", "v1");
    mem.write("k", "v2");
    expect(mem.read("k")).toBe("v2");
    expect(mem.all()).toHaveLength(1);
  });
});

// ─── createMemoryStack: 并发隔离 ──────────────────────────────────────────────

describe("createMemoryStack: agent 隔离", () => {
  let sprintDir: string;

  beforeEach(() => {
    sprintDir = join(tmpdir(), `mem-stack-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    if (existsSync(sprintDir)) rmSync(sprintDir, { recursive: true, force: true });
  });

  it("不同 agentId 的 session 互不覆盖（写入隔离文件）", () => {
    const a = createMemoryStack(sprintDir, "claude");
    const b = createMemoryStack(sprintDir, "codex");
    a.session.set("k", "from-claude");
    b.session.set("k", "from-codex");
    // 各自从隔离文件重新加载，互不污染
    expect(createMemoryStack(sprintDir, "claude").session.get("k")).toBe("from-claude");
    expect(createMemoryStack(sprintDir, "codex").session.get("k")).toBe("from-codex");
  });

  it("durable 在不同 agent 间共享（同一文件）", () => {
    const a = createMemoryStack(sprintDir, "claude");
    a.durable.write("shared", { v: 1 });
    const b = createMemoryStack(sprintDir, "codex");
    expect(b.durable.read("shared")).toEqual({ v: 1 });
  });

  it("不传 agentId 时回退到旧的 session.json（行为不变）", () => {
    const s = createMemoryStack(sprintDir);
    s.session.set("k", "v");
    expect(existsSync(join(sprintDir, ".memory", "session.json"))).toBe(true);
  });

  it("非法字符的 agentId 被规整为安全文件名", () => {
    const s = createMemoryStack(sprintDir, "team/claude:1");
    s.session.set("k", "v");
    expect(existsSync(join(sprintDir, ".memory", "session.team_claude_1.json"))).toBe(true);
  });
});
