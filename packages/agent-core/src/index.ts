// packages/agent-core/src/index.ts
// 核心推理循环接口：plan → act → observe
// 实现必须与 .harness/instructions/architecture.md 的不变量一致。

// V2 contracts are exposed here during the migration window so existing
// consumers can adopt them without changing package boundaries in one jump.
export * from "@repo/harness-core";

export type TaskStatus = "pending" | "running" | "done" | "failed";

/** Task — 进入推理循环的唯一入口 */
export interface Task {
  id: string;
  goal: string;
  /** 验收标准（一组 shell 命令，全部 exit 0 = 完成） */
  acceptance: string[];
  metadata?: Record<string, unknown>;
}

/** 推理循环的一步 */
export interface ReasoningStep {
  type: "plan" | "act" | "observe";
  content: string;
  tool?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  timestamp: string;
}

/** AgentSession — 一个任务的完整生命周期 */
export interface AgentSession {
  id: string;
  taskId: string;
  status: TaskStatus;
  steps: ReasoningStep[];
  startedAt: string;
  finishedAt?: string;
  /** 最终产出（summary / artifact path 等） */
  result?: unknown;
}

/** ReasoningLoop — plan→act→observe 循环的执行契约 */
export interface ReasoningLoop {
  /**
   * 运行推理循环直到任务完成或失败。
   * 每一步通过 onStep 回调通知，便于可观测性（见 observability.md）。
   */
  run(task: Task, onStep?: (step: ReasoningStep) => void): Promise<AgentSession>;
}

/** 工具调用最小权限声明（见 agentic-patterns.md） */
export type PermissionLevel = "read" | "write" | "network" | "shell";

export interface ToolManifest {
  name: string;
  description: string;
  permissions: PermissionLevel[];
  /** 结构化错误返回，不抛裸异常 */
  canFail: true;
}

/** 创建新会话 */
export function createSession(taskId: string): AgentSession {
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    taskId,
    status: "pending",
    steps: [],
    startedAt: new Date().toISOString(),
  };
}

/** 向会话追加一步，返回新步骤引用 */
export function appendStep(
  session: AgentSession,
  type: ReasoningStep["type"],
  content: string,
  extra?: Partial<ReasoningStep>
): ReasoningStep {
  const step: ReasoningStep = {
    type,
    content,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  session.steps.push(step);
  return step;
}
