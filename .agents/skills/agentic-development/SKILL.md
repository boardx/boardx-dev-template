---
name: agentic-development
description: >
  激活条件：用户提到 agent、工具、推理循环、memory、orchestrator、
  plan-act-observe、工具注册、最小权限、跨会话状态、可观测性 等关键词时触发。
  提供 agentic 系统开发的核心模式和实现约定。
---

# Agentic Development Skill

## 核心架构（三平面）

```
代码平面（运行时）                控制平面（harness）       交付平面（phases）
apps/orchestrator/             .harness/instructions/    phases/phase-NN/
packages/agent-core/           .harness/scripts/         sprints/sprint-MM/
packages/memory/               .harness/state/           feature_list.json
packages/tools/                .harness/templates/       active-features.json
```

**规则**：代码平面的实现必须与 `.harness/instructions/architecture.md` 的不变量一致。

---

## plan → act → observe 循环

```typescript
// 标准推理循环模式（来自 packages/agent-core）
import { createSession, appendStep } from "@repo/agent-core";

const session = createSession(task.id);

// 1. PLAN：分析目标，产出步骤
const planStep = appendStep(session, "plan", `目标: ${task.goal}`);

// 2. ACT：调用工具执行
const actStep = appendStep(session, "act", `执行: ${cmd}`, {
  tool: "shell",
  toolInput: { cmd },
});
const result = await tools.get("shell").run({ cmd });
actStep.toolOutput = result;

// 3. OBSERVE：记录结果，决定下一步
appendStep(session, "observe", `exit ${result.value.exitCode}: ${result.value.stdout}`);
```

**每步必须有 timestamp，便于事后归因（见 observability.md）。**

---

## 工具注册约定

```typescript
// 正确方式：声明能做/不能做，登记权限
export const myTool: Tool<Input, Output> = {
  manifest: {
    name: "my-tool",
    description: "...",
    permissions: ["shell"],          // 明确声明
    cannotDo: [
      "不修改 .harness/ 控制平面",   // 明确排除
      "不发起网络请求",
    ],
  },
  async run(input) {
    // 工具错误结构化返回，不抛裸异常
    try {
      // ...
      return { ok: true, value: result };
    } catch (err) {
      return { ok: false, error: String(err), code: "TOOL_ERROR" };
    }
  },
};

// 在注册表中声明并授权
registry.grant("shell");
registry.register(myTool);
```

**新增工具必须在 `agentic-patterns.md` 中登记**（能做什么、不能做什么）。

---

## 记忆层选择指南

| 场景 | 使用哪层 | 原因 |
|------|---------|------|
| 本回合临时变量（循环计数器等） | WorkingMemory | 不需要持久化 |
| 本会话 API token、中间结果 | SessionMemory | 进程退出后仍需要 |
| 跨会话 task 结果、知识片段 | DurableMemory | 下一轮 agent 需要读 |
| feature 状态、sprint 状态 | feature_list.json（权威来源） | harness 管理，不用代码读写 |

```typescript
import { createMemoryStack } from "@repo/memory";

const memory = createMemoryStack(sprintDir);
// 写工作记忆（临时）
memory.working.set("step-count", 3);
// 写会话记忆（持久到文件）
memory.session.set("auth-token", "xxx");
// 写持久记忆（跨会话）
memory.durable.write("task:T01", { status: "done" }, ["task", "status:done"]);
```

---

## 干活的人 / 检查的人分离

来自 `agentic-patterns.md`：生成代码的 agent 和评审代码的 evaluator 使用**不同上下文**。

**实现方式：**
1. 实现完成后，用 `.harness/rubrics/evaluator-rubric.md` 的六维打分
2. 评审用全新会话（不带原实现上下文）
3. 结论只有 Accept / Revise / Block 三种，不接受"差不多够了"

```
维度评分（0-2分 × 6维 = 12分满分）：
- 正确性：行为是否完全符合 user_visible_behavior
- 验证：evidence 是否真实且充分
- 范围纪律：是否只改了当前 feature 相关代码
- 可靠性：重启/重跑是否仍然可用
- 可维护性：代码和文档是否清晰可交接
- 交接准备度：仅靠仓库内文件能否继续开发
```

**多 agent 并行时的 verdict 权威（实战教训）：**
- **coordinator 唯一性**：同一时刻只能有一个 coordinator 在编排。接管前必须先向
  存量会话广播确认；双 coordinator 并行曾导致两轮 review 结论冲突（ACCEPT vs CHANGES）。
- **verdict 只能由 coordinator 编排的 reviewer 产出**，worker 不得自打 `review:*-ok`。
- **结论冲突时以可核验事实为准**：`git ls-tree` 实测 evidence 在分支树中且 blob 非空
  \> 任何打分或声称。evidence 不在 git 树 = 验证维度 0 分一票否决。

---

## 可观测性要求

每个工具调用和推理步骤都必须可追踪：

```typescript
// ✅ 可观测的：带 feature_id / session_id / step 类型
appendStep(session, "act", cmd, { tool: "shell", toolInput: { cmd } });

// ❌ 不可观测的：直接执行不记录
spawnSync("bash", ["-c", cmd]);
```

**失败时先看 steps 数组做归因**，不要直接改代码：
- 步骤太少 → 任务理解有问题（改 task.goal）
- act 步骤失败 → 工具问题（看 toolOutput）
- observe 没有触发 → 循环逻辑问题

**外部系统失败先分诊 infra vs 代码，再归因（实战教训）：**
CI/CD 失败不等于代码失败。先看 job annotations 与 steps 是否为空——
job 数秒即挂、steps 为空、annotation 写明 billing/payment 之类，是 **infra 类失败**：
不退回 worker 改代码，直接升级人类处理；只有确认是代码引起的失败才走返工路径。

---

## 新工具开发检查清单

```
□ 在 agentic-patterns.md 中登记（能做/不能做）
□ 实现 Tool<I, O> 接口（纯函数式）
□ 错误使用 ToolResult（不抛裸异常）
□ 声明 permissions 和 cannotDo
□ 在 ToolRegistry 中注册（明确 grant 权限）
□ 写单元测试（包括错误路径）
□ 在 feature_list 中对应 feature 的 verification 里用真实工具断言
```
