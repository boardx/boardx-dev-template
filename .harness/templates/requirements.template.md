# 原始需求（概览）— {{PHASE_NAME}}（Phase {{PHASE_ID}}）

> 这是 `requirements/` 文件夹里的**起始模板**。需求多时按领域拆成多份
> （如 `auth.md`、`teams.md`、`rooms.md`），本文件可改名/删除。
>
> 流水线：**本文件夹的全部 *.md（原始需求）→ requirement-author 智能体 → feature_list.json（权威）**。
>
> 原始需求是「输入/上下文」，不是权威；权威永远是 `../feature_list.json`。
> 这里可以模糊、可以是用户故事；模糊之处由 requirement-author 提问澄清后再落成 feature。

## 背景 / 为什么做
<这块需求解决谁的什么问题；放进来的业务上下文>

## 原始需求（用户故事 / 大白话都行）
- 作为 <角色>，我想要 <能力>，以便 <价值>。
- …

## 验收线索（可观察的成功是什么样）
> 不必写成命令，写「成功时用户能看到/收到什么」即可；requirement-author 会转成可执行 verification。
- …

## 范围与边界
- 本阶段要做：
- 明确不做（留到后续）：

## 已知约束 / 依赖
- 依赖的能力平面（CAP-AUTH / CAP-DATA / CAP-COLLAB…）：
- 技术或合规约束：

## 切分提示（给 requirement-author 的建议，可留空）
- 期望的 feature 粒度（一次会话能完成并验证）：
- 优先级 / 先后依赖：
