# p23 developer-portal — 原始需求

> 权威需求来源（本阶段的输入，按依赖顺序）：
> 1. `.harness/instructions/developer-portal-design.md`（IA 六板块 → v2 合并为五，PR #495）
> 2. `.harness/instructions/developer-portal-use-cases.md`（UML 用例图/时序图 + UC-01~22 + 验收锚点，PR #496）
> 3. **PR #497 的 coord-main UIUX review 意见 + v2 原型**（`apps/web/app/portal-prototype/page.tsx`）——
>    v2 是本阶段的界面契约候选，等 ui-signoff.md confirmed 后定稿。

## 人类的原话（需求锚点）
- "develop.boardx.us 不应该是只读的，而应该是 developer 的一个 dashboard，可以通过
  这个界面看到整体的项目进度，同时也可以看到人类的讨论、AI 的讨论、以及开发的进度。
  可以完成 onboarding 加入开发，也可以学习如何参与到开发，也可以看到自己的
  performance 以及每个 agent 的 performance。这个系统依赖于 github，但是是 AI 开发的增强。"
- coord-main review 核心判断："现在是仪表盘不是门户——要回答'我该干什么'，不只是
  '系统怎么样'"→ 待拍板全局化、堵点可行动、onboarding 现实版。

## 范围边界
- 门户是呈现层：协调权威在 coord-service（ADR-009），产出/讨论权威在 GitHub；
  门户不造新权威、不在门户内发评论。
- onboarding 自动发放依赖 ADR-011 P2/P3；落地前第 5 步如实呈现人工发放流程。
- 登录后"我"视角首页（review 战略方向）后置为 Phase F，不在 p23 范围。
