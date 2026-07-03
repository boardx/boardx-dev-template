# Phase p18 — AVA AI 落地 (P18)

- **slug**: ava-ai-realization
- **状态**: not_started
- **创建于**: 2026-07-03 07:10:14

## 目标
把 AVA 的 stub AI 层做实：真实模型接入、Deep Research 持久化、解开语音输入 STT 循环阻塞、接通已知占位（分享邮件/Agent真实数据/消息发送到Board与邮件），并对齐 UI 原型细节

## 背景
来自本阶段前一轮的老代码 vs 新代码差距分析：phase-p9-ava-chat 的 feature_list 11 项里 10 项标 passing，
但真实核对代码后发现"壳"是真的（聊天/线程/附件/编辑重生成落库真实），"AI 智能层"是确定性 stub
（`packages/ai/` 无真实模型调用，Deep Research 后端硬编码且不落库），另有若干已知占位
（F04 邮件分享子动作、F07 的 Agent 真实数据依赖 p11-F03、F11 的发送到 Board/发邮件按钮）尚未接通，
以及 F09 语音输入与 phase-p7-board-shell 的 F10 互相 blocked-on 对方、无 STT 能力 owner 的循环阻塞。

## 范围与边界
- 本阶段交付:
  - AI 层去 stub 化：`packages/ai/` 接入至少一个真实模型 provider，真实响应替代确定性回显
  - Deep Research 真实化：后端按用户 topic 生成澄清/计划/报告（非硬编码），新增持久化实体支持刷新后恢复
  - 解开 F09（语音输入）与 phase-p7-F10 的循环 blocked-on：建立一个明确的 STT 能力 owner
  - 接通已知占位：F04 分享邮件子动作、F07 Agent 真实数据接入（待 p11-F03 转 passing）、F08 附件消息内富渲染（图片缩略图/音频播放器/文件预览）、F11 发送到 Board / 发送邮件
  - 语音输入端到端实现（浏览器录音 + 音量可视化 + STT 转写）
  - UX 细节对齐 UI 原型：Deep Research 澄清/计划两步交互式确认、Agent 切换禁用态、分享只读页四态覆盖
- 明确不做（延后到 phase-p19，待人类对产品范围拍板后再排期）:
  - AI 直接读写白板 widget（对齐老代码 `digitizeWhiteBoard`/`translateWidgets`/`handleRequestAIWidget`：生成海报/音频/PPT/故事板/字幕到画布）
  - Memories 记忆管理（用户/团队/白板三级）
  - 演示文稿预览卡片（`PresentationPreviewCard`/`PresentationPreviewModal`，与 phase-p12 边界待定）
  - 断点续聊 resume

## 需求 → 功能清单 流水线
1. **原始需求**写进同目录的 `requirements/` 文件夹（可按领域放多份 `*.md`，人类语言、可模糊）。
2. 调 **requirement-author** 智能体：读 `requirements/` 全部 `*.md` → 生成/更新 `feature_list.json`
   （每个 feature 带可执行 `verification`）。
3. `requirements/` 是输入/上下文,**不是权威**;权威永远是 `feature_list.json`。

## 权威功能清单
本阶段的唯一权威功能来源是同目录的 `feature_list.json`。
sprint 通过 `feature.sprint` 字段领取功能;`active-features.json` 是脚本派生的只读视图。

## 退出条件(Definition of Done for this Phase)
- `feature_list.json` 中本阶段所有 feature 均为 `passing`。
- `.harness/state/quality-document.md` 相关领域评级未下降。
- 阶段 `progress.md` 已收尾,无未记录的半成品。
