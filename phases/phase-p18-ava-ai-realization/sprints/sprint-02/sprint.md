# Sprint p18/02 — Wave 1 依赖项：真实模型失败态/停止、DR 真实生成两步确认、语音端到端、Agent 真实数据、消息发送到 Board/邮件

- **所属阶段**: Phase p18 (ava-ai-realization)
- **创建于**: 2026-07-03 10:52:35

## 本 sprint 目标
Wave 1 依赖项：真实模型失败态/停止、DR 真实生成两步确认、语音端到端、Agent 真实数据、消息发送到 Board/邮件

## 领取的 feature(引用自阶段权威清单,按 id)
- F02 (P2, ai-core) — 真实模型下的失败态与停止生成
- F04 (P2, deep-research) — Deep Research 真实生成（替换硬编码 stub）+ 两步交互确认
- F07 (P2, voice) — 语音输入端到端接通（真实转写替换占位文案）
- F09 (P2, ai-settings) — Agent 选择器接入 AI Store 真实订阅数据
- F11 (P2, message-actions) — 消息「发送到 Board」「发送邮件」接通

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p18/02` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
