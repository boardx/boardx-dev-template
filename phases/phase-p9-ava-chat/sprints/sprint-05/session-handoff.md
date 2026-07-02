# 会话交接 — Sprint p9/05

## 当前已验证
- F09「语音输入 / 实时转写」已 passing。
- 通过 `pnpm harness verify --sprint p9/05 --feature F09`，其中包含:
  - `pnpm --filter @repo/web exec playwright test e2e/ava-voice-input.spec.ts`
  - `pnpm -w run verify:base`

## 本轮改动
- `apps/web/app/(app)/ava/page.tsx`
  - AVA composer 增加语音按钮和录音面板。
  - 支持录音中剩余时间、音量 meter、停止、取消、错误提示、转写预览。
  - 使用 `window.__avaVoiceMock` deterministic hook 模拟 STT 成功和错误分支，不调用外部 STT。
- `apps/web/e2e/ava-voice-input.spec.ts`
  - 覆盖成功转写填入 composer、取消不发送、权限拒绝、不支持、无麦克风、录音过短、转写失败。
- `phases/phase-p9-ava-chat/feature_list.json`
  - F09 经 harness verify 升级为 `passing` 并写入 evidence。

## 仍损坏或未验证
- 无已知损坏。
- 真实外部 STT 服务未接入；本 feature 按验收要求使用 deterministic stub 完成端到端输入体验。

## 下一步最佳动作
- 由主 agent 选择 p9/05 下一个未完成 feature。
- 不要手改 `active-features.json`；它仍是派生视图。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p9/05`
- 调试:`pnpm --filter @repo/web exec playwright test e2e/ava-voice-input.spec.ts`
