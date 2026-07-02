# 会话交接 — Sprint p11/01

## 当前已验证
- F01（AI Store 浏览/筛选）：实现完成，自测全绿（见 `progress.md` 明细 + `evidence/`）。
  **未**标记为 passing——按硬约束，只有 `pnpm harness verify` 门控可转移该状态，本轮只到「PR 已开、待 review」。

## 本轮改动
- 数据层：`packages/data/migrations/016_ai_store.sql`（新表 `ai_store_items` + 12 条种子数据）、
  `packages/data/src/aiStore.ts`（仓储 + 可见性纯函数）、`packages/data/src/aiStore.test.ts`（单测）、
  `packages/data/src/index.ts`（导出登记）。
- API 层：新增 `apps/web/app/api/ai-store/items/route.ts`（列表+分页）、
  `apps/web/app/api/ai-store/items/[id]/route.ts`（详情）；删除旧内存桩 `apps/web/app/api/ai-store/route.ts`。
- 前端：`apps/web/app/(app)/ai-store/store-browser.tsx` 在既有 UI 原型基础上接入真实分页与详情弹窗
  （详情里的 Subscribe 按钮是禁用占位，动作留给 F03，本 feature 不做）。
- 测试：`apps/web/e2e/ai-store-001-browse-items.spec.ts` 从 6 例扩到 9 例（新增 API 401、分页、详情弹窗）。

## 仍损坏或未验证
- 无功能性问题。两个环境级风险（非本 feature 引入，详见 `progress.md`「已知风险」）：
  1. `playwright.config.ts` 硬编码端口 3000，与本沙箱其他并行 worktree 的 dev server 冲突——
     已用临时未提交配置在隔离端口上验证 9/9 通过，**未改动**共享的 `playwright.config.ts`。
  2. `infra/docker-compose.yml` 默认项目名冲突，多 worktree 并行跑字面验证命令会互相踩容器——
     本轮用 `-p <唯一名>` 规避，**未改动**该 compose 文件（不在 F01 范围）。
  这两点建议 coordinator 评估是否要作为独立的 harness 基建改进处理（非 F01 阻塞项）。

## 下一步最佳动作
- 下一轮：等 PR #115（Closes #115）走完 review 门禁（code-reviewer / e2e-verifier / feature-evaluator），
  由 coordinator 合并后跑 `pnpm harness verify --sprint p11/01` 把 F01 转 passing。
- F02（创建/更新 AI Store 项目）依赖 F01 的表结构，可在 F01 passing 后开工；不要在 F01 review 未完成前
  就开始动 F02（避免同一 owner 并发多个 in_progress）。
- 不要动：`apps/web/playwright.config.ts`、`infra/docker-compose.yml`（上面两个已知风险相关但故意保持原样，
  留给 coordinator 决定是否单独立项处理）。

## 命令
- 启动:`pnpm -w run dev`（若 3000 被占，见「已知风险」）
- 验证:`pnpm harness verify --sprint p11/01`
- 调试:
  ```
  export PG_PORT=5540 REDIS_PORT=6540
  docker compose -p wrkstore1f01 -f infra/docker-compose.yml up -d
  set -a && source .env && set +a
  pnpm --filter @repo/data run migrate
  pnpm --filter @repo/web exec playwright test e2e/ai-store-001-browse-items.spec.ts
  ```
