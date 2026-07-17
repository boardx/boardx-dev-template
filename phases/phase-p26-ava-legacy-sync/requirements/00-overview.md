# 原始需求 — AVA 旧功能同步（Phase p26）

## 用户/业务目标
将本机旧项目 `/Users/shenyangjun/boardx/boardx-web` 与 `/Users/shenyangjun/boardx/boardx-backend` 中 AVA 相关能力同步到当前 `boardx-dev-template`，但必须沿用当前项目的 Next API routes、`packages/ai` 网关、`packages/data` 持久化与 harness 验证门控，不照搬旧 Redux/Nest/provider 基础设施。

## 已确认旧系统来源
- 旧前端：
  - `src/app/[language]/ava`
  - `src/components/ava`
  - `src/components/aistore/AvaChat`
  - `src/services/ai-service/ava`
  - `docs/README-AVA-Architecture.md`、`docs/ava-technical-implementation.md`、`docs/ava-migration-backlog.md`
- 旧后端：
  - `src/ava/ava.chat.controller.ts`
  - `src/ava/ava.chat.service.ts`
  - `src/ava/infrustructure/*`
  - `src/ava/tools/*`
  - `src/core/dto/ava/*`

## 同步原则
- 旧后端 `/v1/chat/*` 端点先落成当前 Next 项目的兼容 API，内部走 `@repo/ai` 网关与当前 stub/真实 provider 约定。
- 旧前端组件能力分批迁移到当前 `apps/web/app/(app)/ava/page.tsx` 与侧车组件；不得引入旧 Redux 服务层。
- API catch 块只记录 `console.error(error)`，客户端返回稳定错误码/文案，不泄漏原始异常。
- `ANTHROPIC_API_KEY` 或外部订阅查询缺失时必须诚实降级，不允许打垮 capabilities 或兼容端点。
- 涉及邮件能力时复用现有 `outbound_emails` 与频控基础设施，不新建邮件基础设施。

## 第一批验收线索
- 旧后端端点有当前项目对应路由：
  - `GET /api/v1/chat/getModel/:user`
  - `POST /api/v1/chat/handleRequestAIWidget`
  - `POST /api/v1/chat/handleRequestAIWidgetV2`
  - `POST /api/v1/chat/handleRequestAvaTitle`
  - `POST /api/v1/chat/handleRequestAIChat`
  - `POST /api/v1/chat/handleRequestTranslateWidgets`
  - `POST /api/v1/chat/handleRequestDigitizeWhiteboard`
- 兼容层可用单元测试断言旧 DTO 字段映射、模型降级、widget/chat/title/digitize 行为。
- `@repo/web` 类型检查通过。

