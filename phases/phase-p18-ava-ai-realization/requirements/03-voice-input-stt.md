# 解开 STT 循环阻塞 + 语音输入落地

## 背景 / 为什么做
`phase-p9-ava-chat` 的 F09（语音输入）备注：blocked-on STT（语音转写）服务，与
`phase-p7-board-shell` 的 F10（语音转录到白板）共用同一 STT 集成。而 F10 的备注反过来写
"blocked-on p9（AI 语音转写）"。两边互相指对方，没有第三方 phase 真正拥有 STT 能力建设，
形成无 owner 的循环阻塞——这不是"即将解决"，是一个被两个 feature 互相甩锅、永远排不上期的
基础设施缺口。老代码里这是真实能力：`MediaRecorder` 录制 + 最短时长保护 + 转写文本清洗
（修复中文标点识别伪影）+ 独立的会议级实时转录（阿里云 Fun-ASR + VAD）。

## 原始需求
- 作为工程团队，我们需要先决定"谁来拥有 STT 能力"，把 F09 与 p7-F10 的 `depends_on` 都指向这个
  统一的 owner，而不是继续互相指对方。
- 作为用户，我可以点击 AVA 输入区的麦克风按钮，请求浏览器麦克风权限，录音时能看到剩余时间和音量
  变化的可视化反馈（不是静态的"录音中…"文案）。
- 作为用户，录音结束后，语音应该被转写成文本填入输入框供我检查/编辑/发送；或者作为音频附件随消息
  一起发送，并在消息里展示音频播放卡片。
- 作为用户，麦克风权限被拒绝、没有麦克风、浏览器不支持、录音时长过短、转写失败时，我应该看到清楚
  的提示，而不是无响应或报错崩溃；取消录音不应该发送空消息。

## 验收线索
- 先有一个明确的 STT 能力交付物（自建最小转写服务，或接入第三方 STT API，二选一，由实现时决定并
  记录选型理由），使其成为 F09 和 p7-F10 共同依赖的、可排期的能力，而不是互相指望对方。
- 点击麦克风按钮到出现权限请求，到录音中看到时长和音量变化，到结束后文本出现在输入框——整条路径
  可在浏览器里真实走通（不是纯 mock）。
- 五种边界场景（权限拒绝/无麦克风/浏览器不支持/录音过短/转写失败）都有对应的用户可见提示文案。
- 取消录音（未完成即中止）不产生任何消息，输入框保持录音前的状态。

## 范围与边界
- 本阶段要做：STT 能力 owner 决策 + 前端录音/音量可视化 + 转写接入 + 边界态处理。
- 明确不做：不做老代码里独立的"会议级实时转录弹窗"（`RealtimeTranscriptionDialog.tsx`，阿里云
  Fun-ASR + VAD 那套更复杂的会议转录场景）；`phase-p7-board-shell` 的 F10 本身（语音转录写入白板）
  不在本阶段范围内，只负责让它能解除 blocked 状态、指向正确的 STT owner。

## 已知约束 / 依赖
- 依赖的能力平面：CAP-AI（新增 STT 能力）。
- 需要与 `phase-p7-board-shell` 协调：本阶段只改自己（p18/p9 相关文件）里对 STT owner 的引用，
  不代持修改 `phase-p7-board-shell/feature_list.json` 里 F10 的 `depends_on`——若需要联动修改，
  应作为一个明确的协调事项在 sprint 规划时提出，而不是本阶段单方面改别的 phase 的权威文件。

## 切分提示
- 建议先出一个"STT 能力 owner 决策"的小 feature（可能不涉及代码，只是架构决策 + 更新依赖声明），
  再做前端录音/可视化，最后接转写。

## 选型决策（F06 落地）

**决策**：STT 能力由 CAP-AI（`packages/ai`）拥有，第一个 provider 接入 **OpenAI Whisper API**
（`POST /v1/audio/transcriptions`，multipart/form-data，`model=whisper-1`）。
交付物：`packages/ai/src/sttProvider.ts` 的 `transcribeAudio(input): Promise<{ text }>`。

**理由**：
1. **API 成熟且形态最简**：一次 HTTP 调用（上传音频 multipart）即得转写文本，无需会话/流式/WebSocket
   握手，与"POST 一段音频得到转写文本"的验收线索一一对应。
2. **与仓库零依赖风格兼容**：无 SDK，直接 `fetch` + Node 22 全局 `FormData`/`Blob` 即可组装请求，
   与 `anthropicProvider.ts` 的手法完全一致（凭证走环境变量、可注入 `fetchImpl` 供单测、
   缺 key 抛可读错误、HTTP 错误面完整）。
3. **可替换性**：`STT_BASE_URL` 可指向任何兼容 Whisper API 的自建/代理端点（如 faster-whisper
   server），`STT_MODEL` 可换模型——即使未来换供应商，`transcribeAudio` 契约不变，上层
   （p9-F09 语音输入、p7-F10 白板转录）不受影响。
4. **对比落选项**：自建最小转写服务（如 whisper.cpp 服务化）需要引入模型权重分发与部署面，
   超出"解开循环阻塞"这个 feature 的最小交付；阿里云 Fun-ASR（老代码用于会议级实时转录）
   是流式/VAD 场景，本阶段明确不做。

**配置**：`OPENAI_API_KEY`（必填，缺失时调用抛可读错误）、`STT_BASE_URL`（可选）、
`STT_MODEL`（可选，默认 whisper-1）。冒烟：`node scripts/stt-smoke.mjs`（env-gated，
无凭证 SKIP 退出 0）。

**依赖联动**：p9-F09 与 p7-F10 的 `depends_on` 应统一指向本 feature（p18-F06）。
跨 phase 权威文件（`phase-p7-board-shell/feature_list.json`）的修改是独立协调事项，
不在本 feature 内代持（见 notes）。
