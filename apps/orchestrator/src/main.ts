// apps/orchestrator/src/main.ts
// 可执行入口：CLI 模式运行编排器
// 用法: tsx src/main.ts --task-id T01 --goal "检查健康端点" --acceptance "curl -sf localhost:3000/api/health"

import { parseArgs } from "node:util";
import { Orchestrator } from "./orchestrator";
import { createDefaultRegistry } from "@repo/tools";
import { createMemoryStack } from "@repo/memory";
import { join } from "node:path";

const { values } = parseArgs({
  options: {
    "task-id": { type: "string", default: `task-${Date.now()}` },
    "goal": { type: "string", default: "未指定目标" },
    "acceptance": { type: "string", multiple: true, default: [] },
    "sprint-dir": { type: "string", default: "." },
    "agent-id": { type: "string" }, // 多 agent 并发时按 owner/agent 隔离 session 记忆
    "quiet": { type: "boolean", default: false },
  },
  allowPositionals: false,
  strict: false,
});

const task = {
  id: values["task-id"] as string,
  goal: values["goal"] as string,
  acceptance: (values["acceptance"] as string[]),
};

const sprintDir = join(process.cwd(), values["sprint-dir"] as string);
const registry = createDefaultRegistry();
const memory = createMemoryStack(sprintDir, values["agent-id"] as string | undefined);
const orchestrator = new Orchestrator(registry, memory, {
  maxSteps: 50,
  verbose: !(values["quiet"] as boolean),
});

console.log(`\n==> 启动 Orchestrator`);
console.log(`    Task: ${task.id} — ${task.goal}`);
console.log(`    验收命令 (${task.acceptance.length} 条):`, task.acceptance);

orchestrator.run(task).then((session) => {
  console.log(`\n==> 任务结束: status=${session.status}, steps=${session.steps.length}`);
  process.exit(session.status === "done" ? 0 : 1);
}).catch((err) => {
  console.error("Orchestrator 崩溃:", err);
  process.exit(1);
});
