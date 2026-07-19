# 原始需求（概览）— {{PHASE_NAME}}（Phase {{PHASE_ID}}）

> 这是 `requirements/` 文件夹里的**起始模板**。
> 占位符两套语义：`{{…}}` 由 new-phase 脚本替换；`<…>` 由你手工填写。
>
> 流水线：**本文件夹的全部 *.md（原始需求）→ requirement-author 智能体 → feature_list.json（权威）**。
> 原始需求是「输入/上下文」，不是权威；这里可以模糊、可以是用户故事，
> 模糊之处由 requirement-author 提问澄清后再落成 feature。
>
> **写到什么程度算够** → 对照 `.harness/rubrics/ready-for-dev.md`（终点线是它，不是字数）。
>
> **人类拍板 2026-07-19**：每个 feature 必须能追溯到本文件夹里的一个 story 章节
> （`feature_list.json` 的 `spec_ref` 字段，格式 `<文件名>.md#R<n>`）。没有可追溯
> story 的 feature 不能被 `claim`、不能被 `verify` 门控为 passing；has_ui 阶段
> 若没有对应 requirements，即便 UI signoff 已确认也不能开 sprint（见 `lib/ui-signoff.ts`）。
>
> 需求多时按领域拆成多份 `*.md`；**拆分后本文件保留为索引**：列出各文件与建议
> 阅读顺序。章节 ID（R1…Rn）在每份文件内独立编号，`spec_ref` 用
> `<文件名>#R3` 形式引用，标题可改、ID 不改。

## R1 背景 / 为什么做
<这块需求解决谁的什么问题；放进来的业务上下文>

## R2 原始需求（用户故事 / 大白话都行）
- 作为 <角色>，我想要 <能力>，以便 <价值>。
- …

## R3 验收线索（成功与失败都要写）
> 不必写成命令，写「用户能看到/收到什么」即可；requirement-author 会转成可执行 verification。
- 成功路径：…
- **负路径/边界**（欠规格重灾区，逼自己想）：失败时用户看到什么？空态长什么样？
  无权限的人访问会发生什么？并发/重复提交呢？

## R4 界面线索（has_ui 阶段必填，纯后端阶段删除本节）
- 这块需求有界面吗？涉及哪些页面/入口？
- 线框/参考/竞品截图（有就贴路径或链接；没有写"待 UI 先行阶段产出"）
- 提醒：has_ui 阶段的 feature 清单要等真实 UI 经人类确认（ui-signoff）后才定稿，
  且 ui-signoff 现在也要求本 requirements 文件夹有真实内容（不能是裸模板）。

## R5 非功能约束（没有特殊要求就写「无」，不许留空——留空 = agent 自选默认值）
- 性能/规模预期：
- 安全/隐私/合规：
- 兼容与降级要求：

## R6 范围与边界
- 本阶段要做：
- 明确不做（留到后续）：

## R7 已知约束 / 依赖
- 依赖的能力平面（CAP-AUTH / CAP-DATA / CAP-COLLAB…）：
- 技术或合规约束：

## R8 切分提示（给 requirement-author 的建议，可留空）
- 期望的 feature 粒度（一次会话能完成并验证）：
- 优先级 / 先后依赖：
