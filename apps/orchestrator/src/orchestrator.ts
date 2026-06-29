// apps/orchestrator/src/orchestrator.ts
// 编排器：单一入口接收 Task，调度 AgentSession，汇总结果。
// 见 architecture.md："单一编排入口；规划与执行分离"

import type { Task, AgentSession, ReasoningStep } from "@repo/agent-core";
import { createSession, appendStep } from "@repo/agent-core";
import type { ToolRegistry } from "@repo/tools";
import type { MemoryStack } from "@repo/memory";

export interface OrchestratorConfig {
  /** 推理循环最大步数（防止无限循环） */
  maxSteps: number;
  /** 是否打印每一步到 stdout（可观测性） */
  verbose: boolean;
}

export const DEFAULT_CONFIG: OrchestratorConfig = {
  maxSteps: 50,
  verbose: true,
};

export class Orchestrator {
  constructor(
    private readonly tools: ToolRegistry,
    private readonly memory: MemoryStack,
    private readonly config: OrchestratorConfig = DEFAULT_CONFIG
  ) {}

  /**
   * 运行任务的完整生命周期：
   * 1. 规划（plan）
   * 2. 循环执行（act → observe）
   * 3. 检查验收标准
   * 4. 汇总结果到 memory
   */
  async run(task: Task): Promise<AgentSession> {
    const session = createSession(task.id);
    session.status = "running";

    this.log(`[Orchestrator] 开始任务: ${task.id} — ${task.goal}`);

    try {
      // ── 阶段 1：规划 ──────────────────────────────────────────────────────
      const planStep = appendStep(session, "plan", `目标: ${task.goal}\n验收标准: ${task.acceptance.join("; ")}`);
      this.emit(planStep);

      // ── 阶段 2：执行循环（act → observe）────────────────────────────────
      let steps = 0;
      let done = false;

      while (!done && steps < this.config.maxSteps) {
        steps++;

        // act：调用 shell 工具执行一条验收命令
        const cmd = task.acceptance[steps - 1];
        if (!cmd) { done = true; break; }

        const actStep = appendStep(session, "act", `执行验收命令 [${steps}/${task.acceptance.length}]: ${cmd}`, {
          tool: "shell",
          toolInput: { cmd },
        });
        this.emit(actStep);

        const shellT = this.tools.get<{ cmd: string }, { stdout: string; stderr: string; exitCode: number }>("shell");
        if (!shellT) {
          actStep.toolOutput = { error: "shell 工具未注册" };
          done = true;
          break;
        }

        const result = await shellT.run({ cmd });
        actStep.toolOutput = result;

        // observe：记录结果
        const obs = appendStep(
          session,
          "observe",
          result.ok
            ? `exit ${result.value.exitCode}: ${result.value.stdout.slice(0, 200)}`
            : `工具错误: ${result.error}`
        );
        this.emit(obs);

        // 写入工作记忆
        this.memory.working.set(`step-${steps}`, { cmd, result });

        if (!result.ok || (result.ok && result.value.exitCode !== 0)) {
          done = true;
          session.status = "failed";
          this.log(`[Orchestrator] 任务失败于步骤 ${steps}`);
        }

        if (steps >= task.acceptance.length) done = true;
      }

      if (session.status !== "failed") {
        session.status = "done";
        this.log(`[Orchestrator] 任务完成: ${task.id}`);
      }

      // ── 阶段 3：持久化摘要 ───────────────────────────────────────────────
      this.memory.durable.write(
        `task:${task.id}`,
        { taskId: task.id, goal: task.goal, status: session.status, stepCount: steps },
        ["task", `status:${session.status}`]
      );

    } catch (err) {
      session.status = "failed";
      appendStep(session, "observe", `未捕获异常: ${String(err)}`);
    }

    session.finishedAt = new Date().toISOString();
    return session;
  }

  private log(msg: string): void {
    if (this.config.verbose) console.log(msg);
  }

  private emit(step: ReasoningStep): void {
    if (this.config.verbose) {
      console.log(`  [${step.type.toUpperCase()}] ${step.content}`);
    }
  }
}
