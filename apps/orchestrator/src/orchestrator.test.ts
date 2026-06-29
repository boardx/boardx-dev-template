import { describe, it, expect, vi } from "vitest";
import { Orchestrator } from "./orchestrator";
import { createDefaultRegistry } from "@repo/tools";
import { WorkingMemory, SessionMemory, DurableMemory } from "@repo/memory";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeMemory() {
  const tmp = join(tmpdir(), `orch-test-${Date.now()}`);
  return {
    working: new WorkingMemory(),
    session: new SessionMemory(join(tmp, "session.json")),
    durable: new DurableMemory(join(tmp, "durable.json")),
  };
}

describe("Orchestrator: task lifecycle", () => {
  it("completes a task when acceptance commands all pass", async () => {
    const registry = createDefaultRegistry();
    const memory = makeMemory();
    const orch = new Orchestrator(registry, memory, { maxSteps: 10, verbose: false });

    const session = await orch.run({
      id: "test-T01",
      goal: "echo 能正常工作",
      acceptance: ["echo ok"],
    });

    expect(session.status).toBe("done");
    expect(session.steps.some((s) => s.type === "plan")).toBe(true);
    expect(session.steps.some((s) => s.type === "act")).toBe(true);
    expect(session.steps.some((s) => s.type === "observe")).toBe(true);
  });

  it("marks task as failed when acceptance command exits non-zero", async () => {
    const registry = createDefaultRegistry();
    const memory = makeMemory();
    const orch = new Orchestrator(registry, memory, { maxSteps: 10, verbose: false });

    const session = await orch.run({
      id: "test-T02",
      goal: "此任务会失败",
      acceptance: ["exit 1"],
    });

    expect(session.status).toBe("failed");
  });

  it("persists task result to durable memory", async () => {
    const registry = createDefaultRegistry();
    const memory = makeMemory();
    const orch = new Orchestrator(registry, memory, { maxSteps: 10, verbose: false });

    await orch.run({
      id: "test-T03",
      goal: "持久化测试",
      acceptance: ["echo persisted"],
    });

    const record = memory.durable.read("task:test-T03");
    expect(record).toBeDefined();
    expect((record as { status: string }).status).toBe("done");
  });
});
