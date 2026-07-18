# 进度日志 — Sprint p26/01

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/phase-p26-ava`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: 本 sprint 无；F01 已 passing。
- 当前 blocker: 无。

## 会话记录
### 2026-07-15
- 本轮目标: 落地旧 AVA chat 后端调用面的 Next 兼容 API。
- 已完成:
  - `F01` 从 `not_started` 分配到 sprint-01，owner `codex-ava` 认领后经 harness 升级为 `passing`。
  - 兼容旧后端端点：
    - `GET /api/v1/chat/getModel/:user`
    - `POST /api/v1/chat/handleRequestAIWidget`
    - `POST /api/v1/chat/handleRequestAIWidgetV2`
    - `POST /api/v1/chat/handleRequestAvaTitle`
    - `POST /api/v1/chat/handleRequestAIChat`
    - `POST /api/v1/chat/handleRequestTranslateWidgets`
    - `POST /api/v1/chat/handleRequestDigitizeWhiteboard`
- 运行过的验证:
  - `pnpm harness verify --sprint p26/01 --feature F01`
  - `pnpm harness verify --sprint p26/01 --feature F01 --backfill-evidence`
- 已记录证据:
  - `evidence/F01.verify.log @ 2026-07-15T09:38:21.462Z`
- 提交记录:
  - 尚未提交。
- 已知风险或未解决问题:
  - 兼容层目前将旧 `claude`/`gemini`/其他非 `stub:` 模型名降级到 `stub:default`，避免绕过当前 provider 网关或依赖缺失的旧后端环境。
  - review 后已补上 legacy role/content 消息转换、`x-vercel-ai-data-stream` 流式响应和 malformed JSON 稳定错误测试。
- 下一步最佳动作:
  - 以 F02 为下一个 feature，迁移旧前端 composer 与消息动作 UI，保持现有 AVA `data-testid` 稳定。
