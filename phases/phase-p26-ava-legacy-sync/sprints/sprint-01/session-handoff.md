# 会话交接 — Sprint p26/01

## 当前已验证
- F01 / 同步旧 AVA chat 兼容 API：`passing`
- 证据：`phases/phase-p26-ava-legacy-sync/sprints/sprint-01/evidence/F01.verify.log`
- 门控命令：`pnpm harness verify --sprint p26/01 --feature F01`
- review 后证据刷新：`pnpm harness verify --sprint p26/01 --feature F01 --backfill-evidence`

## 本轮改动
- 新建 phase `p26` 与 sprint `p26/01`。
- 将旧 `boardx-backend/src/ava/ava.chat.controller.ts` 的 `/v1/chat/*` 调用面迁移为当前 Next API 路由。
- 新增 `apps/web/lib/ava-legacy-compat.ts`，集中处理旧 DTO 字段、模型降级、title、widget/chat/translate/digitize 转换。
- 新增 `apps/web/lib/ava-legacy-compat.test.ts`，覆盖旧字段映射与当前 AI 网关输出。
- 新增 `apps/web/app/api/v1/chat/handleRequestAIChat/route.test.ts`，覆盖 legacy role/content messages、Vercel AI data stream 形态和 malformed JSON 稳定错误响应。

## 仍损坏或未验证
- 旧 `boardx-web/src/components/ava` 的完整 UI parity 尚未迁移；由 F02/F03 继续。
- 旧后端真实 Claude/Gemini/digitize provider 细节尚未逐项映射；由 F04 继续，且必须通过 `packages/ai` 网关。
- 未启动本地 dev server；本轮验证走单元测试、类型检查与 harness base verify。

## 下一步最佳动作
- 分配并认领 F02，重点对照旧 `MessageEditor`、`ChatItem`、文件/语音/发送到白板行为。
- 不要手改 `active-features.json` 或 passing 状态；继续用 `pnpm harness claim` 和 `pnpm harness verify`。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --sprint p26/01`
- F01 局部调试:
  - `pnpm --filter @repo/web test -- lib/ava-legacy-compat.test.ts app/api/v1/chat/handleRequestAIChat/route.test.ts`
  - `pnpm --filter @repo/web typecheck`
