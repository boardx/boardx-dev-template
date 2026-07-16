# 会话交接 - Sprint p27/06

## 首个工作

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- 首个 Feature: F11 AVA, Template, Agent Builder, and recommendations。
- Claim: `pnpm harness claim --phase p27 --feature F11 --owner <agent-id>`。
- 首个失败测试: `apps/web/e2e/ava-ai-store-skills.spec.ts`。
- F11 门控: `pnpm harness verify --sprint p27/06 --feature F11`。

## 依赖门禁

- F07 未 passing 时不得开始 F11。
- F12 依赖 F01-F11；任何前置 Feature 未 passing 都不得领取 F12。
- F12 首个新增测试为 `apps/web/e2e/ai-store-014-legacy-compat.spec.ts`，门控为 `pnpm harness verify --sprint p27/06 --feature F12`。

## 已知实现边界

- AVA 按 `skillKind` 保留真实 text/image 执行链，切 Team 清空旧选择。
- Agent Builder 和 Template 输出归当前消费 Team。
- F12 是最终兼容和基础回归门禁；只有它及全部前置 passing 后 coordinator 才能关闭 #662。
