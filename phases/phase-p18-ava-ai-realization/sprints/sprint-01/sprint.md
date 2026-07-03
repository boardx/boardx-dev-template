# Sprint p18/01 — Wave 0 无依赖项：AI 真实 provider、DR 持久化、STT 能力、分享邮件、附件富渲染接线、分享四态 e2e

- **所属阶段**: Phase p18 (ava-ai-realization)
- **创建于**: 2026-07-03 10:52:19

## 本 sprint 目标
Wave 0 无依赖项：AI 真实 provider、DR 持久化、STT 能力、分享邮件、附件富渲染接线、分享四态 e2e

## 领取的 feature(引用自阶段权威清单,按 id)
- F01 (P1, ai-core) — AI 层去 stub 化：真实模型 provider 接入 + 网关路由
- F03 (P1, deep-research) — Deep Research 持久化实体 + 刷新恢复
- F06 (P1, voice) — STT 能力落地（解开 p9-F09 ↔ p7-F10 循环阻塞）
- F08 (P2, share) — 分享聊天「发送到我的邮箱」接通
- F10 (P2, attachments) — 消息附件富渲染接线（图片缩略图/lightbox + 音频播放器）
- F12 (P3, share) — 分享只读页四态 e2e 补齐 + Agent 禁用态断言

> 实际工作集见同目录 `active-features.json`(脚本派生,只读,勿手改)。
> 修改功能归属:改阶段 `feature_list.json` 里对应 feature 的 `sprint` 字段,再重跑
> `pnpm harness new-sprint`(或 refresh)重新派生。

## 完成标准
- 上述每个 feature 经 `pnpm harness verify --sprint p18/01` 门控为 `passing`。
- `session-handoff.md` 与 `progress.md` 已更新。
