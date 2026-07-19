# ADR-018: spec_ref 闭环——每个 feature 必须能追溯到一个 story

- 状态：Accepted（人类 2026-07-19 拍板）
- 适用层：方法论（可移植）
- 日期：2026-07-19
- 作者：coord-architecture
- 关联：ADR-001（single in_progress）、ADR-003（UI 先行签核）、ADR-012（审计链）、
  docs/proposals/community-practice-review-2026-07.md P3（intent drift / spec-driven）

## 背景

harness 已经有「完成」的机械门控（verify + doctor：没有可执行 verification、没有
落盘证据 = 不算完成），但**「开始」这一端一直没有对应的门控**。一个 feature 只要
`user_visible_behavior` 一句话写得像那么回事，就能被 claim、被实现、被 verify 门控成
passing——它背后有没有真实需求、有没有人（人类）真正想清楚要什么，全靠自觉。

这正是社区共识里的 **intent drift**：欠规格的一句话描述，实现者（无论人类还是
agent）会自选默认值填补空白，选的往往不是真正想要的那个。`user_visible_behavior`
天然只有一两句话，撑不住负路径、非功能约束、界面细节这些真正容易分歧的内容。

## 决策

**每个 feature 必须有一个 `spec_ref` 字段，指向 `phases/<phase>/requirements/` 下
一个具体的 story 章节**（格式 `<文件名>.md#R<n>`，`requirements.template.md` 提供
R1-R8 的稳定编号骨架）。这不是文档倡议，是机械门控，三道门：

1. **`claim`**（最早、最便宜）：认领 feature 时校验 spec_ref 能解析（文件存在 +
   章节存在）。解析不了直接拒绝，不让"无 story 就动手"发生。
2. **`verify`**（完成前的第二道）：门控 passing 前重新校验一次——防"claim 时有效，
   干活途中 requirements 文件被删/改坏"。已 passing 的 feature（backfill 模式）
   不受影响，与 `passing_is_irreversible` 的精神一致。
3. **`doctor`**（复核）：对 `in_progress` 的 feature 做同样校验，FAIL 级——审阅时
   再确认一次，不等到 verify 才发现。**不倒查已 passing 的历史 feature**（见下）。

**UI 先行签核追加同一纪律**：`assertUiSignedOff` 现在同时要求 `requirements/`
文件夹有真实内容（不是刚 scaffold 出来的裸模板）。即便人类手改了 `ui-signoff.md`
的 `status: confirmed`，没有对应 requirements 仍然不放行——"界面对不对"和"这块界面
背后有没有真实需求"是两件事，两者都要过。

**GitHub 投影延伸闭环**：`sync-github.ts` 生成的 issue body 新增 `## Story` 小节，
把 spec_ref 解析成指回 requirements 文件的链接；缺失时渲染醒目警告而非静默省略——
"需求→feature→PR→issue"全链路在 GitHub 上也可见。

### 裸模板检测：不能只看 `{{...}}` 占位符

`new-phase.ts` 用 `renderTemplateFile()` 在 scaffold 那一刻就把 `{{PHASE_NAME}}`
等占位符替换成真实值了——文件落地时早就不含 `{{}}`，这个信号在人类填写之前就已经
消失。真正的判据是「内容是不是和刚 scaffold 出来那份一字不差」：把
`requirements.template.md` 用该 phase 的真实变量重新渲染一遍，逐字比对当前文件，
一样就是没人碰过的裸模板。这是实现过程中用负面用例测出来的真实 bug（第一版用
`{{...}}` 检测，端到端验证时被 UI 先行门控的假阳性放行揭穿）。

### 历史存量：不倒查已 passing，只堵未来

`spec_ref` 是新字段，此前 262 个历史 feature 里 216 个已 passing、31 个
`not_started`。**对已 passing 的历史 feature 不做任何倒查**——`passing_is_irreversible`
的精神是"不重新评判已完成的历史"，倒查会制造无意义的 FAIL 风暴，也不该为已交付的
工作编造事后 story。仅有 3 个已经 `in_progress` 的 feature 会在这条规则落地后
需要补一个 spec_ref 才能继续走到 passing——每个约几分钟工作量，已通知对应 owner。
`not_started` 的历史 feature 下次被 claim 时才会遇到这条门，届时补 story 即是
"确保未来每个新工作都有 story"的本意，不是额外负担。

## 后果

- 新 feature 从此有默认正确姿势：写需求 → 编号 → 写 feature 时天然带 spec_ref，
  requirement-author 的产出从三元组变四元组。
- 三道机械门（claim/verify/doctor）+ GitHub 投影，形成"需求→feature→PR→issue"
  的完整闭环，且**人类和 AI 都要经过它**（人类手改 signoff 也过不了 requirements
  覆盖检查）。
- 代价：三个已在途的历史 feature 需要补 story 才能收尾（一次性、小额）；
  requirement-author 的认知负担增加一步（先写 R 编号章节，再引用），但这一步换来
  的正是防 intent drift 的实质价值，不是纯流程税。

## 我们什么情况下会改主意

若 spec_ref 的强制要求在实践中被证明只是绕过门槛的形式（如 agent 习惯性写
"R1#背景 我不知道"这类占位式 spec_ref 却依然通过校验），需要升级为内容质量检查
（如最小字数、负路径关键词存在性），而不是只做存在性校验。当前先验证结构性闭环，
内容质量交给人类审阅。
