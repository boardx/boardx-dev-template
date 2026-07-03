# 原始需求（概览）— AVA AI 落地 (P18)（Phase p18）

> 流水线：本文件夹的全部 `*.md`（原始需求）→ requirement-author 智能体 → `../feature_list.json`（权威）。
> 本阶段是 **has_ui: true**，按 ADR-003：先由 ui-prototyper 用真实组件把界面做出来 → 人类工程师确认
> `../ui-signoff.md` → requirement-author 才能读「需求 + 已确认 UI」生成 feature_list.json。

## 背景 / 为什么做

phase-p9-ava-chat 的 feature_list（F01-F11）11 项里 10 项标 `passing`，但对照老代码
（`phases/requirements/oldcode/{boardx-web-develop,boardx-backend-develop}`）与
`phases/requirements/BoardX UI Prototype V1.html` 逐项核实代码后发现：**「壳」是真的，「AI」是假的**。

- 聊天壳/线程/编辑重生成/附件上传，工程上真实打通了数据库与状态机（这部分没问题）。
- 但 `packages/ai/` 里注释写的「LangGraph 编排」「LiteLLM 网关」，实际是一个单函数
  `runChatGraph()` 和一个只注册了 `stubProvider` 的 `ChatGateway`——零运行时依赖，零真实模型调用。
  所有 F01/F03/F06/F07 的对话/研究/设置功能，底层收到的都是模板化确定性回显。
- F06 Deep Research 前端有清晰的四阶段状态机 UI，但后端 `research/route.ts` 是纯函数，返回和用户
  输入的 topic 完全无关的硬编码文本，也不落库——刷新页面研究进度就丢了。
- F09（语音输入）与 `phase-p7-board-shell` 的 F10（语音转录到白板）互相 `blocked-on` 对方
  （都指望「STT 服务」），没有第三方 phase 真正拥有 STT 能力建设，形成无 owner 的循环阻塞。
- F04（分享邮件子动作）、F11（发送到 Board / 发送邮件）在 UI 上render 出来但按钮无 `onClick`，
  是永久 disabled 占位；F07 的 Agent 选择器数据源是硬编码的 2 个 Agent，真实数据依赖
  `phase-p11-ai-store` 的 F03（订阅/使用→带入 AVA），该 feature 目前仍 `in_progress`。

本阶段的目标是把这些「已经在 UI 上呈现给用户、但背后是假的/断的」的地方做实，**不扩大产品范围**
（画布 AI 直接生成 widget、Memories 记忆管理、演示文稿预览卡片等老代码里存在但从未纳入 use case 的
新能力域，拆到 `phase-p19` 单独跟踪，待人类对范围拍板后再排期）。

## 原始需求（按领域拆分到本文件夹的其余 *.md）

- `01-ai-layer-real-model.md` — AI 层去 stub 化
- `02-deep-research-realization.md` — Deep Research 真实化 + 持久化
- `03-voice-input-stt.md` — 解开 STT 循环阻塞 + 语音输入落地
- `04-close-out-placeholders.md` — 接通已知占位（分享邮件 / Agent 真实数据 / 附件富渲染 / 发送到 Board·邮件）
- `05-ux-detail-alignment.md` — UX 细节对齐 UI 原型

## 范围与边界

- 本阶段要做：见上述各领域文件的验收线索。
- 明确不做（拆到 phase-p19，待产品范围决策）：
  - AI 直接读写白板 widget（老代码 `digitizeWhiteBoard`/`translateWidgets`/`handleRequestAIWidget`
    对应的生成海报/音频/PPT/故事板/字幕到画布能力）
  - Memories 记忆管理（用户/团队/白板三级）
  - 演示文稿预览卡片（与 phase-p12 Studio & 演示 的边界待定）
  - 断点续聊 resume（老代码 `GET /api/ava/api/chat` resume）

## 已知约束 / 依赖

- 依赖 `phase-p9-ava-chat`（本阶段是在其地基上把 stub 换成真实实现，不是重做）。
- F07 的真实 Agent 数据接入依赖 `phase-p11-ai-store` 的 F03 转 `passing`；F03 未就绪前，该项在本阶段
  只能做「数据源改造 + 待 p11 就绪后切换」的接口设计，不能虚报为 passing。
- 语音输入依赖新建的 STT 能力（本阶段需求之一是「谁来拥有 STT」的决策与最小实现，见
  `03-voice-input-stt.md`），并与 `phase-p7-board-shell` 的 F10 共享同一 STT 集成——改动 F10 的
  `depends_on` 需要协调该阶段的 feature_list（本阶段只改自己的 owner 声明，不代持修改 p7 的文件）。
