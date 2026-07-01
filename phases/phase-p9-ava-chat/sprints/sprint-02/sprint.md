# Sprint p9/02 — Codex AVA lane: thread CRUD, message operations, sharing, Deep Research, AI settings, suggested actions

- **所属阶段**: Phase p9 (ava-chat)
- **创建于**: 2026-07-01 12:49:43

## 本 sprint 目标
Codex AVA lane: thread CRUD, message operations, sharing, Deep Research, AI settings, suggested actions

## 领取的 feature(引用自阶段权威清单,按 id)
- F02 (P1, ava) — 聊天线程列表 CRUD（按日期分组/切换/重命名/删除/团队隔离）
- F03 (P2, ava) — 编辑/删除消息 + 重新生成后续回复
- F04 (P2, ava) — 分享聊天：生成/复用/关闭分享链接
- F07 (P2, ava) — AI 设置：模型/Agent/工具选择（发送前生效）
- F06 (P3, ava) — Deep Research（澄清→计划→执行时间线→报告）
- F10 (P3, ava) — 建议动作（快捷问题填入输入框）

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p9/02` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
