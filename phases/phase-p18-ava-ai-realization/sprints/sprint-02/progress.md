# 进度日志 — Sprint p18/02

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: <feature id / title>
- 当前 blocker: <无 / 描述>

## 会话记录
### 2026-07-03 10:52:35
- 本轮目标:
- 已完成:
- 运行过的验证:
- 已记录证据:
- 提交记录:
- 已知风险或未解决问题:
- 下一步最佳动作:

### 2026-07-04（wrk-ava-p18-3，F07）
- 本轮目标：F07 语音输入端到端接通——把 `apps/web/app/(app)/ava/voice-input.tsx` 里
  `MOCK_TRANSCRIPTS` 随机占位文案替换为真实转写（F06 落地的 `packages/ai` STT provider）。
- 已完成：
  - 新增 `apps/web/app/api/ava/transcribe/route.ts`：鉴权（`currentUser`）→ 读 multipart
    `file` 字段 → 调 `@repo/ai` 的 `transcribeAudio`（OpenAI Whisper API）→ 返回 `{text}`；
    无 `OPENAI_API_KEY` 时走路由内置确定性 stub 回退（口径对齐 `packages/ai/src/gateway.ts`
    的 `stubProvider`），保证本地/CI 无供应商额度时端到端链路仍可被 e2e 真实覆盖。
  - `voice-input.tsx`：`recorder.ondataavailable` 收集音频 chunk，`onstop` 里组装
    `Blob` → `FormData` → POST `/api/ava/transcribe`，成功回填 `onTranscribed(text)`，
    失败走已有 `transcription-failed` 错误分支；删除"STT 服务未就绪"相关过时注释。
  - `playwright.config.ts`：chromium project 加
    `--use-fake-device-for-media-stream` / `--use-fake-ui-for-media-stream`，仅影响
    该 project 的浏览器启动参数。
  - 新增 `apps/web/e2e/ava-voice-input.spec.ts`：覆盖正常路径（录音→真实转写文本回填）、
    取消录音（不产生文本）、转写请求失败（展示 transcription-failed 文案）。
  - 排查记录：e2e 中若同时调用 `context.grantPermissions(["microphone"])` 会与
    fake-ui 标志的自动授权互相干扰，导致 `getUserMedia` 挂起不 resolve——已去掉该调用，
    仅依赖 launchOptions 的 fake-ui/fake-device 标志。
- 运行过的验证：
  - `pnpm --filter @repo/web exec playwright test e2e/ava-voice-input.spec.ts`（3 passed，
    重复跑两次均稳定通过）
  - `pnpm harness verify --sprint p18/02 --feature F07`（含 `verify:base` 全量 45 个任务通过）
- 已记录证据：`phases/phase-p18-ava-ai-realization/sprints/sprint-02/evidence/F07.verify.log`
- 提交记录：见后续 commit（Closes #258）
- 已知风险或未解决问题：无 `OPENAI_API_KEY` 环境下走的是路由层 stub 转写，不是真实 Whisper
  调用；真实 STT 链路由 F06 的 `node scripts/stt-smoke.mjs`（env-gated）冒烟覆盖。
- 下一步最佳动作：F07 已 passing；下一 feature 由 coordinator 派发。
