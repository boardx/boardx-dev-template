# AGENTS.md — apps/web 局部指令

> 包级 scoped 指令（渐进披露第 2 层），补充根 AGENTS.md。

## 本包职责
Next.js(App Router) 前端 + 面向用户的 API route handlers。CAP-WEB / CAP-UI。

## 局部约束
- **DB 不散写**：所有 Postgres 访问走 `@repo/data` 的仓储函数，禁止在 route 里写裸 SQL。
- **入队走封装**：任务入队用 `@repo/queue` 的 `makeQueue`/`QUEUE_NAMES`，不硬编码队列名。
- **API 错误结构化**：route 返回 `{ error }` + 合适状态码，不抛裸异常给客户端。
- 用到 pg/bullmq 的 route 必须 `export const runtime = "nodejs"`（不能跑 edge）。
- UI 组件走 shadcn 惯用法（`cn` + variant），样式用 Tailwind，别内联魔法值。
- 验证见 `.harness/instructions/testing-standards.md` 的「CAP-WEB」段。
