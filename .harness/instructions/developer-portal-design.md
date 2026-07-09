# Developer Portal 设计规格：develop.boardx.us 作为 AI 增强开发的统一人类入口

> 定位：`develop.boardx.us` 不是一个"只读协调状态页"，而是**开发者门户**——人类
> 参与 BoardX agentic 开发的单一入口。它把 GitHub（代码/PR/讨论的底座）与
> coord-service（协调/身份/性能的 AI 原生增强层）编织成一个统一的人类视角。
>
> 权威规格：本文是 IA（信息架构）+ 分阶段计划；组织模型见 ADR-010，身份/onboarding
> 机制见 ADR-011，协调权威见 ADR-009。已建的协调卡片（Coordinators / Active Claims /
> Recent Events）是本门户的第一批组件（PR #428/#447）。

## 0. 核心理念：GitHub 是底座，门户是 AI 增强

- **GitHub 是事实底座**：代码、PR、commit、feature 规格、人类讨论都在 GitHub，
  是唯一的产出与讨论权威。门户**不取代** GitHub。
- **coord-service 是 AI 原生增强层**：协调（谁在做什么）、身份（谁参与）、性能
  （做得快不快好不好）——这些"让 agentic 开发对人类可读"的信息，GitHub 表达不了，
  由 coord-service 承载。
- **门户是统一的人类透镜**：一个人类工程师打开 develop.boardx.us，应该一眼看到
  项目在往哪走、谁在讨论什么、开发进展如何、怎么加入、自己和每个 agent 表现如何——
  不用在 GitHub 几百个 issue/PR、D1、feature_list.json 之间来回拼图。这就是
  "依赖 GitHub，但是 AI 开发的增强"的含义。

## 1. 六大板块（IA）与各自数据源

| 板块 | 人类看什么 | 数据源 | 状态 |
|---|---|---|---|
| **① Project Pulse 项目脉搏** | 整体进度：各 phase 的 feature passing/total、flow-time 趋势、当前活跃 agent 数、近期合并节奏 | `phases/*/feature_list.json` 聚合 + coord-service `/status` + `gh pr list` | 新建 |
| **② Live Coordination 实时协调** | 谁此刻在协调什么、谁持有哪些租约、最近协调事件 | coord-service `/status`（claims + events） | ✅ 已建（3 张卡） |
| **③ Development Progress 开发进度** | feature 按 phase/status 分布、PR 队列（in-review/blocked/mergeable）、谁在做哪个 | feature_list.json + `gh pr/issue list` | 新建 |
| **④ Discussions 讨论流** | **人类的讨论 + AI 的讨论**分流呈现：协调叙述（#323）、feature issue 讨论、决策/事故复盘；按作者类型（人类 vs agent）区分标记 | GitHub issues/comments（作者身份区分 human/agent）+ coord-service events（cycle-plan/andon 等 AI 叙述） | 新建 |
| **⑤ Onboarding & Learn 加入与学习** | 自助 GitHub 登录加入开发（ADR-011 流程）；渲染"如何参与开发"教程（human-developer-onboarding.md） | GitHub OAuth + coord-service 身份 API（ADR-011）+ 仓库文档渲染 | 新建（依赖 ADR-011） |
| **⑥ Performance 性能** | **自己的 performance + 每个 agent 的 performance**：flow-time、周期承诺达成率、持有租约、吞吐 | coord-service events + `cycle-report` + `gh pr` 合并时长（**per-agent 归因是 ADR-010 待建差距**） | 新建（依赖 ADR-010 P2） |

## 2. 人类 vs AI 讨论的区分（板块 ④ 的关键）

用户明确要求"看到人类的讨论以及 AI 的讨论"。实现要点：
- **作者类型标记**：GitHub 评论作者若匹配 registry/coord-service 里的 agent 身份
  （或 GitHub bot 账号），标为 🤖 AI；否则标为 👤 人类。门户按这个分流/着色。
- **两类讨论的性质不同**：人类讨论多是方向/拍板/反馈；AI 讨论多是巡检/cycle-plan/
  事故复盘/协调通牒。门户可以给"待人类拍板"的 AI 讨论加显著标记（承接 coordinator-sop
  "需要人类批复"的既有约定），让人类不漏掉真正需要他决策的东西。
- **权威仍在 GitHub**：门户只是聚合+分流呈现，讨论本体和权威都在 GitHub issue，
  门户不另建评论存储（符合 §0"GitHub 是底座"）。

## 3. 分阶段建设（复用已建，逐板块加，不 big-bang）

已建：**② Live Coordination**（Coordinators / Active Claims / Recent Events 三卡）。

- **Phase A — ① Project Pulse**：加一个顶部概览带（各 phase passing/total 进度条 +
  flow-time 趋势 + 活跃 agent 数）。纯读 feature_list + /status + gh，最快见效、
  最能回答"项目往哪走"。
- **Phase B — ④ Discussions**：聚合 #323 + feature issue 评论，按 human/agent 分流
  着色，"待人类拍板"高亮。让人类一处看全人类与 AI 的讨论。
- **Phase C — ③ Development Progress**：feature 矩阵（phase × status）+ PR 队列卡片，
  与板块①互补（①是脉搏概览，③是可下钻明细）。
- **Phase D — ⑤ Onboarding & Learn**：接 ADR-011 的 P2/P3（GitHub OAuth + 自助
  onboarding UI + issue 审批）落进门户；旁边渲染 human-developer-onboarding.md 教程。
- **Phase E — ⑥ Performance**：per-agent 性能面板，同时收口 ADR-010 的 per-agent
  flow-time 归因差距（cycle-report 扩展按 agent 细分）。

每个 Phase 一批可独立 review 的 PR，各自 go/no-go；顺序可按人类当下最想看到的板块
调整（建议 A→B 先行，"项目脉搏 + 讨论流"是人类日常最高频的两个诉求）。

## 4. 与已定架构的衔接（不重复造轮子）

- 身份/权限：所有板块的 SysAdmin 门禁复用现有 `requireSysAdmin`；onboarding 的
  GitHub OAuth 与身份权威走 ADR-011，不另起身份系统。
- 数据读取：coord-service 侧统一走已建的 `/status`（公开只读）+ ADR-011 的身份 API；
  GitHub 侧走 `gh`/REST，缓存策略沿用 registry 卡片的 60s 缓存思路。
- 权威边界不变：门户是**呈现层**，不产生新权威——协调权威在 coord-service（ADR-009），
  产出/讨论权威在 GitHub。门户挂了不影响任何一方的权威，只是人类少了个方便的透镜。

## 5. 一句话总结
develop.boardx.us = 把"GitHub 上散落的产出与讨论" + "coord-service 里的协调/身份/
性能" 合成一块，让人类一眼看懂 agentic 开发、并能自助加入、看到自己和每个 agent
表现的**统一门户**——这是 AI 开发对人类协作体验的增强，不是对 GitHub 的替代。
