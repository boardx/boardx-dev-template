# 会话交接 — Sprint p9/04

## 当前已验证
- F05（公开分享对话只读页 /chatShare/:threadId）: 代码+测试完成，本地验证全绿，尚未 `passing`
  （不可自标，需 `pnpm harness verify --sprint p9/04` 门控）。
  - `pnpm --filter @repo/web exec playwright test e2e/share-view-chat.spec.ts` → 4 passed
  - `pnpm --filter @repo/web exec playwright test e2e/ava-share-chat.spec.ts`（F04 回归）→ 2 passed
  - `pnpm -w run verify:base` → 45/45 successful

## 本轮改动
- 新增 `apps/web/e2e/share-view-chat.spec.ts`（F05 verification 指定的 spec，此前缺失）。
- **未改动** `apps/web/app/chatShare/[id]/page.tsx`、`apps/web/app/api/chatShare/[id]/route.ts`、
  `packages/data/src/avaChat.ts`：F04（PR #178）已经把 F05 需要的整页只读体验和安全模型做完了，
  实测走完 F05 全部验收点（loading / 有序渲染 / 只读无 composer / invalid / unavailable / empty），
  本次判断为「只补测试覆盖，不重写已有实现」。
- 合并了协调者控制面分支 `origin/harness/coord-verify-p12-f01`，把 F05 从
  `not_started/owner:null` 同步为 `in_progress/sprint:04/owner:wrk-ava-1`（认领提交
  52f2e95，非本 worker 产生）；顺带解决 `.harness/state/PROGRESS.md` 的一处自动聚合文件冲突。
- 新建 sprint-04 目录（`progress.md`/`session-handoff.md`/`evidence/`）。

## 仍损坏或未验证
- 无新增已知问题。既有低危（F04 遗留）：`apps/web/app/api/ava/threads/[id]/share/route.ts`
  POST/DELETE 的 catch 分支返回 `String(err)`，未在本次范围内修复。
- F05 尚未跑 `pnpm harness verify --sprint p9/04` 门控，未翻 passing。

## 下一步最佳动作
- Review 通过后跑 `pnpm harness verify --sprint p9/04` 翻 F05 passing。
- F05 passing 后可解锁下游依赖（如 F06 报告面板只读部分）。
- 不要重写 `/chatShare/[id]` 页面或 `/api/chatShare/[id]` 路由——已验证满足 F05 全部验收。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --sprint p9/04`
- 调试: `bash scripts/init-worktree-env.sh && docker compose -f infra/docker-compose.yml up -d && pnpm --filter @repo/data run migrate`
