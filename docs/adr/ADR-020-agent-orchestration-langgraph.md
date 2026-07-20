# ADR-020: agent-orchestration-langgraph（产品内多步 agent 流程用 LangGraph 编排）

- 状态: Accepted
- 适用层：项目实现（专属）——评估依据是本仓具体代码现状；结论中的"多步 agent
  用状态机图引擎、不手搓"这条原则是方法论，已回填进
  `.harness/instructions/architecture.md` 的参考栈
- 日期: 2026-07-20
- 作者：coord-architecture（人类指示：技术架构里加入智能体编排一节，评估 LangGraph）
- 关联：ADR-015（同款"先量化痛点再选型"方法）；`packages/ai/src/graph.ts`（本 ADR 要
  替换的手写占位实现）；p18-F03/F04（Deep Research，第一个迁移目标）

## 背景：现状已经在为这一天打埋伏，但一直没真的做

`packages/ai/src/graph.ts` 现在只有一个"单节点聊天壳"，它自己的头部注释写得很直白：

> 如实说明：这不是 LangGraph，也没有图结构——当前只是「单 generate 节点」的最小
> 编排壳……保留 NodeFn/GraphState 抽象是为了让 Deep Research 扩展成真正的多阶段
> 状态机时不必改调用方；在那之前不要把这里当作已有编排框架来引用。

`researchGenerator.ts`（AVA Deep Research，P18 F04）验证了这个预判：`ResearchPhase`/
`ResearchTimelineItem`（`status: queued/running/complete`）已经在数据模型层面假装
有"阶段"，但实际执行是**一次性**丢给网关一个"只输出 JSON"的长提示词，解析结果里
硬塞出多阶段的样子——不是真的分步执行、不能在某阶段失败后从那一步恢复、不能在
关键阶段插入人工确认。这正是"看起来是多步 agent，实际是单次超长 prompt 硬编"的
经典缺陷模式。

同时 `packages/agent-core`（plan→act→observe 接口）、`packages/tools`（工具契约）、
`packages/memory`（三层记忆）都是手写的、没有第三方库支撑的抽象——本质上是在
从零发明一个和 LangGraph 解决同一类问题的小型框架，且没有它自带的检查点持久化、
条件边、人工介入中断、失败重放这些能力。

运行时约束核实过：`apps/web` 的 AI 相关路由（含 Deep Research）声明
`runtime = "nodejs"`（163 处），不在 edge runtime 下跑，LangGraph.js 的
Postgres checkpointer（`@langchain/langgraph-checkpoint-postgres`）能直接用，
没有 Workers 边缘环境的兼容性问题。`apps/devportal` 是 Cloudflare Pages/Workers
edge 运行时，本 ADR **明确不覆盖它**（devportal 没有产品级多步 agent 功能，
只有协调协议客户端调用）。

## 决策：`apps/web` 的多步 agent 流程用 LangGraph.js（StateGraph + PG checkpointer）编排

**范围界定（最容易混淆的一点，必须先说清楚）**：本 ADR 讨论的是**产品内单个
AI 功能的多步执行**（如 Deep Research 的"想清楚问题→检索→分节撰写→汇总"），
跟 harness 的 **coord-gateway/RepoHub DO**（协调多个独立、长时运行的开发者
CLI 会话——coord-main/module-coordinator/worker 之间认领 feature、合并 PR）
是完全不同层面的问题，**不是同一个"编排"**：

| | LangGraph（本 ADR） | coord-gateway（ADR-009/017，不变） |
|---|---|---|
| 编排的是什么 | 一次请求内的 LLM 调用序列（节点=一次模型/工具调用） | 多个独立 agent **会话**之间的资源互斥与任务分派 |
| 运行时长 | 秒到分钟级，一次 HTTP 请求生命周期内 | 小时到天级，跨会话跨进程 |
| 状态载体 | LangGraph checkpointer（PG） | coord-gateway 的 RepoHub DO（租约/事件） |
| 谁在用 | apps/web 的产品代码 | agent 本体（Claude Code/Codex 等 CLI） |

两者不互相替代，也不该用同一套机制模拟另一套——不要试图用 LangGraph 编排开发
agent 协作，也不要试图用 coord-gateway 编排一次 AI 请求内的多步生成。

**具体决策**：

1. `packages/ai/src/graph.ts` 用 LangGraph.js 的 `StateGraph` 重写。`GraphState`
   接口的字段基本可以直接映射成 LangGraph 的 state schema（`messages`/`modelId`/
   `onToken` 等），`NodeFn` 概念对应 LangGraph 的节点函数——迁移是重写不是推倒
   重来，现有的"节点=纯函数"设计已经和 LangGraph 的心智模型一致。
2. **第一个真正迁移的功能是 Deep Research**（P18 F03/F04 之后的下一步），因为它是
   本仓当前唯一"数据模型已经承认多阶段、执行却是单次"的功能，收益最直接可验证：
   - 每个 `ResearchPhase` 变成图里一个真实节点，`status` 字段由图的执行状态驱动
     （不再是提示词编出来的假状态）。
   - 用 `interrupt_before` 在"澄清问题已生成、计划待确认"这一步暂停——现在
     research route 注释里"避免'还没确认计划就已经在跑'的假象"这条本来是靠
     手写状态字段硬撑的约束，LangGraph 的中断机制是这条约束的**原生实现**，
     不再是模拟。
   - 某阶段失败可以从那一步重放，不必重新生成整份研究。
3. Checkpointer 选 **Postgres**（`@langchain/langgraph-checkpoint-postgres`），
   落在与 `ontology_actions`/业务表同一个 PG 实例——不引入第二个状态存储，
   与 ADR-016 之前确立的"canonical 永远是 PG"原则（见
   `.harness/instructions/project/knowledge-ontology.md`）一致。
4. `packages/agent-core`/`packages/tools`/`packages/memory` **不立即删除**，
   逐功能评估：Deep Research 迁移时验证 LangGraph 的节点/工具调用/checkpointer
   能否覆盖这三个包现在承担的职责，覆盖到的部分标记废弃、迁移完成后再删，
   避免"因为换了框架就大范围重写"的过度反应（同 ADR-015 教训：框架不会替你
   建纪律，也不该替你决定删多少现有代码）。
5. Studio（`presentationGenerator.ts`）、Survey AI 报告（`reportSummaryGenerator.ts`）
   等其它 CAP-AI 功能**暂不强制迁移**——它们目前是真正的单次生成（不像 Deep
   Research 那样已经在数据模型层面伪装多阶段），迁移收益不明确前不动它们，
   避免"有了新框架就到处套用"。

## 为什么不是别的方案

- **继续手写 `graph.ts`**：等于持续自研一个功能子集，且永远补不齐检查点持久化/
  失败重放/人工中断这些 LangGraph 已经生产验证过的能力，性价比低。
- **CrewAI / AutoGen 等其它编排框架**：LangGraph 是这几个里对"图/状态机"建模
  最直接的（其它框架更偏"多 agent 对话"范式，跟 Deep Research 这种"单一目标、
  多阶段流水线"的形状不如状态图贴合），且 LangChain 生态与 `packages/ai`
  已经在用的 provider 抽象（anthropic/qwen）衔接成本最低。
- **不做任何改变**：`researchGenerator.ts` 的"假多阶段"模式会在下一个多步 AI
  功能立项时被重新发明一次，与其等着复现同一个问题，不如借这次机会把可复用的
  编排层立好。

## 后果

- 新增依赖：`@langchain/langgraph`、`@langchain/langgraph-checkpoint-postgres`（
  仅 `apps/web`，`apps/devportal` 不受影响）。
- Deep Research 从"单次生成、数据模型硬编多阶段"变成"真实图执行、状态由图驱动"
  ——现有 e2e（stub provider 确定性验证）需要适配 LangGraph 的执行路径，不是
  纯新增测试。
- 代价：多一层依赖需要团队学习 LangGraph 的心智模型（节点/边/checkpointer/
  interrupt）；`packages/ai` 的边界需要重新画一次（哪些逻辑属于 LangGraph 节点，
  哪些仍是纯 provider 适配层）。
- 明确不做的事：不把 LangGraph 引入 `apps/devportal`（edge runtime，且没有
  产品级多步 agent 功能）；不用它替代或模拟 coord-gateway 的跨会话协调职责。

## 我们什么情况下会改主意

- 若 Deep Research 迁移后发现 LangGraph 的 checkpointer/interrupt 机制与
  Cloudflare 侧的 SSE 流式输出（`onToken` 回调）集成成本过高、超过手写方案，
  重新评估是否只取用它的 state schema 概念、执行仍手写。
- 若未来有功能需要"多个独立 AI 角色互相协作/辩论"（不是单一目标多阶段流水线），
  LangGraph 的 StateGraph 未必是最贴合的模型，需要单独评估 multi-agent 对话
  范式的框架（如 CrewAI/AutoGen），不能假设 LangGraph 是唯一答案。
