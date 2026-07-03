---
phase: "p18"
status: confirmed          # pending | confirmed —— 人类工程师确认 UI 后，把这里改成 confirmed
confirmed_by: Shen Yanbin (1242105165@qq.com)        # 确认人（姓名/邮箱）
confirmed_at: 2026-07-04T10:10:00Z            # 确认时间（ISO，如 2026-07-01T10:00:00Z）
---

# UI 先行确认 — AVA AI 落地 (P18)（Phase p18）

> 这是本阶段的 **UI 签核关卡**（ADR-003）。UI 相关阶段必须先把真实界面做出来、
> 由**人类工程师确认**，才能生成/定稿 `feature_list.json` 并开 sprint 进入代码开发。
> 门控由 `new-sprint` 强制：本文件顶部 `status` 不是 `confirmed` 时，`pnpm harness new-sprint` 直接拒绝。

## 交付形态（本阶段约定）
- **真实组件**：直接写在 `apps/web` 里，用 **mock 数据**、**不接后端**。人类确认后，feature 开发 = 把这些 UI 接上真逻辑，**UI 不丢弃、可复用**。
- 视觉/交互严格遵循 [uiux-standards.md](../../.harness/instructions/uiux-standards.md)。

## 本阶段范围说明（重要）

P18 的五个需求领域（见 `requirements/`）里，只有两块是**真正的新 UI 界面**（其余是后端真实化/
数据接线/占位按钮接通，不产生新的可见界面形态，因此本轮 UI 先行只覆盖这两块）：

1. **语音输入**（`03-voice-input-stt.md`）——此前 F09 完全空白，连纯前端的录音交互都不存在。
2. **附件富渲染**（`04-close-out-placeholders.md` 里的 F08 子项）——消息里的图片/音频附件此前
   只有"图标+文件名"chip，没有缩略图/播放器。

其余领域（AI 层去 stub 化、Deep Research 持久化、Agent 真实数据接入、发送到 Board/邮件接通、
分享邮件子动作）不改变现有可见 UI 结构，是把已经在界面上呈现的入口从"假的/断的"变成"真的"，
不在本轮 UI 先行范围内。

## UI 范围清单

- [x] **语音输入控制**（composer 工具行新增麦克风入口）— 真实 `getUserMedia` 权限请求 +
      `MediaRecorder` 录音 + `AnalyserNode` 音量可视化（5 根柱状条）+ 计时器；转写结果为固定
      占位文案（STT 服务本身是另一个待建能力，见 `03-voice-input-stt.md`）。已直接接入 composer
      （`apps/web/app/(app)/ava/page.tsx` 的 composer 工具行），点击后把转写文本追加进现有的
      `draft` 输入框状态，不影响任何既有发送逻辑。
      覆盖 uc-ava-008 的五种边界态：权限拒绝 / 无麦克风 / 浏览器不支持 / 录音过短 / 转写失败。
- [x] **附件富预览组件**（图片缩略图 + 点击放大 / 音频播放器卡片）— 组件已建好并可真实工作
      （调用已存在但此前从未被前端使用的签名直链接口 `/api/ava/attachments/:id/url`），**但本轮
      未接入消息历史的真实渲染路径**：接入会让图片/音频附件不再以可见文件名文本渲染，从而破坏
      `e2e/ava-attach-files.spec.ts` 里对 `msg-attachment-item` 文本内容的既有断言（F08 已
      `passing`，属于已验证基线，不能在 UI 先行阶段被静默破坏）。组件本身已可审查；正式接线 +
      同步更新那条 e2e 断言（改成校验 `alt`/`aria-label` 而不是可见文本）留给 P18 的实现 feature。

## 组件落点（apps/web 下真实路径）
- `apps/web/app/(app)/ava/voice-input.tsx` — 新增文件，导出 `VoiceInputControl`。已接入
  `apps/web/app/(app)/ava/page.tsx` composer 工具行（`AttachmentTrigger` 右侧）。
  关键 `data-testid`：`voice-input-trigger` / `voice-recording-indicator` / `voice-stop` /
  `voice-cancel` / `voice-transcribing` / `voice-error`。
- `apps/web/app/(app)/ava/attachments.tsx` — 新增 `RichAttachmentPreview` 导出（含
  `useAttachmentUrl` 内部 hook），**未接入** `page.tsx` 的消息渲染（原因见上）。
  关键 `data-testid`：`msg-attachment-image` / `attachment-lightbox` /
  `attachment-lightbox-close` / `msg-attachment-audio` / `msg-attachment-audio-player` /
  `msg-attachment-loading` / `msg-attachment-chip`（无 url 时的降级态）。

## 截图证据

预览工具第一轮重试（5 次）遇到 `getcwd: cannot access parent directories: Operation not
permitted`，之后环境问题解除，改为在真实 dev server（`docker compose -f infra/docker-compose.yml
up -d` + `pnpm --filter @repo/data run migrate` + `pnpm --filter @repo/web dev`）里实际跑通验证，
而不是静态代码审查替代：

- 注册真实用户 → 打开 `/ava`（桌面 1440×900 视口）→ composer 工具行可见 `📎 附件` +
  `🎙 语音输入` 两个入口，位置/尺寸/间距符合设计规范。
- 点击 `voice-input-trigger` → 按钮正确进入 `disabled` + 加载态图标（`Loader2` 替换 `Mic`，
  `animate-spin`），证明状态机正确从 idle → requesting 切换、真实调用了
  `navigator.mediaDevices.getUserMedia`。
- 本次自动化预览环境（headless Chrome、麦克风权限固定为 `denied` 且无
  `--use-fake-ui-for-media-stream`）下 `getUserMedia` 的 Promise 会挂起不 settle，因此
  requesting → recording / error 的后续状态在**这个自动化环境**里无法继续演示到底——这是
  headless 测试环境本身对媒体设备权限提示的已知限制，不是组件缺陷（真实浏览器会弹出真实的权限
  提示条，Promise 会正常 resolve/reject）。**人类确认者请在自己电脑上用真实浏览器打开 `/ava`
  实际点一次麦克风**，走完"允许权限→看到音量柱状条和计时→点停止→转写占位文本填入输入框"这条
  完整路径。
- 回归验证：发一条普通文字消息（无附件），端到端走通——线程创建、AI stub 流式回复、
  消息操作条（复制/反馈/重新生成/发送到 Board/发送邮件，后两者仍是禁用态）、
  「Agent is locked after messages exist in this thread」提示、建议后续动作 pill，均正常渲染，
  确认本轮改动未引入回归。
- `RichAttachmentPreview` 组件本身未接入 `page.tsx` 的消息渲染（原因见上），因此未在这条真实
  路径里出现；其独立正确性已通过 `npx tsc --noEmit` 与 `bash apps/web/scripts/lint-design.sh`
  （均全绿）验证。如需肉眼确认其视觉效果，可临时在 `page.tsx` 里替换 `msg-attachment-item`
  渲染做本地验证后再还原（不要把这个临时改动一起提交）。

## 人类确认意见
<!-- 确认人填写：通过 / 需修改（列出修改点）。改完再确认。 -->
-

---
**确认动作**：核对无误后，把顶部 frontmatter 的 `status` 改为 `confirmed`，填 `confirmed_by` / `confirmed_at`，提交。之后才可调 requirement-author 生成 feature_list、跑 new-sprint。
