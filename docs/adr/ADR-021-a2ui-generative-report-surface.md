# ADR-021: a2ui-generative-report-surface（声明式生成式 UI 协议，限定范围采用）

- 状态: Accepted
- 适用层：项目实现（专属）——评估依据是本仓具体需求文档现状；决策框架
  （何时该用声明式生成式 UI 协议而非手搓）是方法论，已回填模板 architecture.md
- 日期: 2026-07-21
- 作者：coord-architecture（人类要求：评估 Next.js + LangGraph + A2UI 兼容性，
  判断是否要用 A2UI 构建对话）
- 关联：ADR-020（LangGraph 编排引擎，本 ADR 是它的下游延伸）；
  `phases/phase-p25-survey/requirements/08-dynamic-report-engine-design.md`、
  `05-ai-report-agent.md`（本 ADR 的第一落点）

## 背景：不是纯理论评估，仓库里已经有真实落点

`08-dynamic-report-engine-design.md`（Survey Dynamic Report Engine）明确把"后端
报告结构和前端渲染器都是写死的"列为**要解决的问题**，提出的架构是：

```
Report Planner → Report Block Library（可复用 UI/图表模块）
              → Report Composer（排 block 顺序、选布局密度、绑图表数据）
              → Insight Generator → Theme Engine
```

这个设计**在概念上已经是声明式生成式 UI 的心智模型**——"Report Block Library"
就是一个预批准组件目录，"Report Composer 排 block 顺序、绑数据"就是 agent 在
组装一棵声明式 UI 树。只是手搓的：自己定 JSON 形状、自己写渲染器、自己处理
流式更新与安全边界（agent 输出会不会被当成可执行代码）。

`05-ai-report-agent.md`（Survey Report Agent，Use Case 见附件 PDF）第 5 步验证了
同一个需求会重复出现：**"用户可以编辑报告框架的章节标题、章节顺序、关注重点"**
——这是一个"agent 动态生成一棵可交互、可重排的结构化界面"的场景，不是聊天文字
回复能表达的（纯文本/markdown 表格装不下"可拖拽重排的章节列表"这种交互）。

## 协议现状核实（2026-07-21 直接查证，不依赖训练记忆）

行业里同时存在两个容易混淆的协议，必须先分清：

| | AG-UI（CopilotKit） | A2UI（Google） |
|---|---|---|
| 管什么 | 前后端**怎么连**：event-driven 状态同步、流式响应、tool 调用 | agent **想画什么** UI：声明式组件树 + 数据，JSON 格式 |
| 类比 | 传输层/管道 | 管道里流动的内容（生成式 UI 这一种载荷） |
| 与 LangGraph 关系 | 有官方 LangGraph adapter（CopilotKit 博客有 LangGraph 实战案例） | 不直连任何编排框架，经 AG-UI 承载 |
| 与 Next.js 关系 | 官方文档：**AG-UI 是 React/Next.js 客户端的推荐传输层**，原生支持承载 A2UI payload | React 渲染器 SDK，v0.8 起标"稳定" |

结论：**LangGraph 不直接对接 A2UI**，链路是
`LangGraph（编排，ADR-020）→ CopilotKit 的 AG-UI adapter（传输）→ A2UI（UI 载荷格式）→ React 渲染器（apps/web）`。
Next.js 侧无障碍：`apps/web` 的相关路由已是 `runtime="nodejs"`（ADR-020 已验证），
SSE/WebSocket 传输不受 edge runtime 限制。

A2UI 本身的设计动机是"安全边界"：agent 只能从**预批准组件目录**里选组件、传数据，
不能下发可执行代码——这条对"多组织 agent 互不信任的 mesh"（Google 的原始场景）
价值更大；本仓是单租户、单一 LLM provider 受控输出，注入风险本来就比开放 mesh 低，
但"组件目录固定、agent 只填数据不下发代码"这条纪律本身仍然值得要——今天不用
A2UI 也该有这条约束，只是 A2UI 把它做成了协议级保证而不是靠人肉审查生成内容。

## 决策：限定范围采用，不覆盖普通聊天

**采用 A2UI（经 CopilotKit AG-UI 承载）用于"生成式结构化界面"这一类交互，
不用于替代普通聊天文字回复**：

- **覆盖**：Dynamic Report Engine 的 Report Composer 输出（报告 block 树）、
  Report Agent 的可编辑大纲预览（章节标题/顺序/语气的交互式编辑）。这类交互的
  共同特征：**agent 需要在运行时决定一棵结构，用户需要交互式编辑这棵结构**，
  不是"读一段文字"。
- **不覆盖**：AVA 的常规对话消息（文字/markdown 回复足够，没有"文字墙"问题）；
  单次生成、无需交互编辑的内容（Studio 演示文稿生成、Survey AI 摘要）——这些
  维持现状（hand-built 组件 + gateway 网关模式，同 ADR-020 的既有边界）。
- **实现路径**：Report Block Library 的现有 block 目录**迁移为 A2UI 组件目录**
  （复用不重写——现有 block 已经是"预批准组件"的雏形）；Report Composer 的组装
  逻辑改为 LangGraph 节点产出 A2UI 声明式 JSON（而不是直接产出最终渲染结果），
  经 CopilotKit AG-UI 流式传给前端；前端用 A2UI 的 React 渲染器替换手写的
  report-renderer（渲染逻辑收口，不用每加一种 block 就改一遍渲染分支）。

## 为什么不是"继续手搓"

- 手搓已经在复刻 A2UI 解决的问题（block 目录、组装、流式更新），且没有协议级的
  "agent 只能填数据不能下发代码"保证——这条安全边界现在完全靠开发纪律，没有
  机械门控（同 ADR-012/013/014 的一贯教训：能机器判定的绝不该只靠人肉）。
- A2UI 有现成的多平台渲染器（React 是本仓需要的），不用每次加新 block 类型都
  同时改后端 shape 和前端渲染器两处。

## 后果

- 新增依赖：CopilotKit（AG-UI 传输层）+ A2UI React 渲染器，仅 `apps/web` 涉及
  Dynamic Report Engine / Report Agent 的路由，不影响 devportal（edge runtime，
  同 ADR-020 的既有边界，coord-gateway 协调层不受影响）。
- Report Block Library 需要一次性梳理成 A2UI 组件目录格式（工作量集中在迁移
  期，之后新增 block 类型的边际成本下降）。
- 代价：多学一个协议（A2UI 的声明式 JSON schema + AG-UI 的事件模型）；调试链路
  变长（LangGraph 节点 → AG-UI 事件 → A2UI payload → React 渲染，四层排障）。

## 我们什么情况下会改主意

- 若 Report Composer 的实际 block 种类长期停留在个位数、且从不需要用户交互式
  重排（只读展示），协议层的投入产出比不划算，退回纯 gateway + hand-built 组件
  即可，不必为了"用协议"而用协议。
- 若 CopilotKit 的 LangGraph adapter 在生产环境暴露出流式性能或状态同步的真实
  问题，重新评估是否只取 A2UI 的 JSON schema 概念、传输层自己写（不经 AG-UI）。
