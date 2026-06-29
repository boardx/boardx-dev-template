import { describe, it, expect } from "vitest";
import { createSession, appendStep } from "./index";

describe("agent-core: createSession", () => {
  it("creates a session with pending status", () => {
    const session = createSession("task-001");
    expect(session.status).toBe("pending");
    expect(session.taskId).toBe("task-001");
    expect(session.steps).toHaveLength(0);
    expect(session.id).toMatch(/^session-/);
  });
});

describe("agent-core: appendStep", () => {
  it("appends a plan step and returns it", () => {
    const session = createSession("task-002");
    const step = appendStep(session, "plan", "分析任务目标");
    expect(session.steps).toHaveLength(1);
    expect(step.type).toBe("plan");
    expect(step.content).toBe("分析任务目标");
    expect(step.timestamp).toBeTruthy();
  });

  it("preserves step order: plan → act → observe", () => {
    const session = createSession("task-003");
    appendStep(session, "plan", "规划");
    appendStep(session, "act", "执行");
    appendStep(session, "observe", "观察结果");
    expect(session.steps.map((s) => s.type)).toEqual(["plan", "act", "observe"]);
  });
});
