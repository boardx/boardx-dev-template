# Issue #316 review follow-up evidence

- Issue: https://github.com/boardx/boardx-dev-template/issues/316
- Branch (round 1): `codex/issue-316-canvas-review-fixes`（base `worker/canvas-p6-f07-guidelines`，PR #324 因 base 分支合并后被删自动关闭）
- Branch (round 2, 本轮): `worker/canvas-worker-1-issue-316-review-fixes`（cherry-pick f336570 → `origin/main` f650943，与 F12/F15/F16/F19/F20 合流解冲突）
- Timestamp: round 1 `2026-07-03T18:55:50Z` / round 2 `2026-07-08`（重验证结果见下方 Round 2 小节与 PR body）

## Scope

Implemented the p6/08 F13/F14 review follow-up hardening items:

1. Fabric reconcile no longer unconditionally discards the active object; it only syncs active selection when the active ids differ from React selection state.
2. Fabric init now guards disposed setup before publishing `fcRef.current` or `window.__canvasTestApi`.
3. `clickCanvasBlank` now uses `window.__canvasTestApi.getCanvasBlankScreenPoint()` instead of a hardcoded top-right canvas coordinate.
4. `BoardItem` keeps flat extension fields while `ItemPatch` blocks accidental `id` / `type` edits; added explicit `x: undefined` patch semantics coverage.
5. Screen-rect math is deduplicated through `itemToScreenRect`; Fabric object metadata moved from bare object assertions to WeakMaps.

## Verification

```bash
pnpm --filter @repo/canvas run test
```

Result: passed, 15 tests.

```bash
pnpm --filter @repo/canvas run typecheck
pnpm --filter @repo/web run typecheck
pnpm --filter @repo/web run lint
```

Result: passed. Web lint emitted existing `LABEL-LANG-MIX` warnings only.

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @repo/data run migrate
```

Result: passed. The local worktree env used PostgreSQL `60244`, Redis `60245`, web `60246`, and MinIO `60247`.

```bash
pnpm --filter @repo/web exec playwright test \
  e2e/canvas-render.spec.ts \
  e2e/canvas-add.spec.ts \
  e2e/canvas-update.spec.ts \
  e2e/canvas-delete.spec.ts \
  e2e/canvas-pan-zoom.spec.ts \
  e2e/canvas-select.spec.ts \
  e2e/canvas-copy-paste.spec.ts \
  e2e/canvas-undo-redo.spec.ts \
  e2e/widget-menu-framework.spec.ts \
  e2e/widget-sticky.spec.ts \
  e2e/canvas-fabric-engine.spec.ts \
  e2e/canvas-guidelines.spec.ts \
  e2e/widget-menu-009-refresh-widget.spec.ts \
  --reporter=list
```

Result: passed, 34 tests.

```bash
pnpm -w run verify:base
```

Result: passed, 45 successful / 45 total.

```bash
git push -u origin codex/issue-316-canvas-review-fixes
```

Result: pre-push `verify:full` passed `verify:base` (45/45) and `next build`, then hit repo-wide e2e failures outside the canvas area before canvas specs were reached:

- `ai-store-001-browse-items.spec.ts` pagination test
- `ai-store-003-subscribe-use-item.spec.ts` subscribe/use flow
- `auth-reset-password.spec.ts` reset-password flow

Per issue-dev-loop instructions, this repo-wide full-regression blocker was recorded and skipped for push/PR creation. Scoped canvas verification and `verify:base` passed.

## Round 2（2026-07-08，cherry-pick f336570 → main，分支 worker/canvas-worker-1-issue-316-review-fixes）

与 main 上后续落地的 F12/F15/F16/F19/F20 合流解冲突（fabric-canvas.tsx：连接线
buildConnectorObject 分支、F20 ActiveSelection anyLocked 主防线、F16 连接线
screen rect 均保留并纳入新守卫/新 helper）。重跑验证：

- `pnpm --filter @repo/canvas test`：15/15 通过（含 `x: undefined` patch 语义测试）。
- `pnpm --filter @repo/canvas run typecheck` / `pnpm --filter @repo/web run typecheck`：干净。
- 定向 e2e（docker infra + migrate 后执行，跑完即 down）：
  - `canvas-select.spec.ts` + `canvas-fabric-engine.spec.ts`：6/6 passed（32.7s）。
  - `widget-connector.spec.ts`：6/6 passed（38.1s）。
  - 覆盖本轮全部改动面：clickCanvasBlank 新锚点（select/connector 两个使用方）、
    reconcile selection guard、fabric 引擎对象计数、F16 连接线 screen rect helper 化。
- 17 文件全量 e2e 批首跑 12.1m 退出码 0；复跑期间本机多 worktree 资源竞争把
  postgres 打进 recovery mode（"the database system is in recovery mode" 环境签名），
  按 coordinator 指令终止全量批、收窄为上述定向 spec，不再对环境加压。

## Notes

- Docker socket access, `tsx` IPC during data migrations, and Next/Playwright local server listen required sandbox escalation in this desktop environment.
- `scripts/init-worktree-env.sh` wrote valid env files but exited on an existing trailing typo in its final echo (`compose_env...: unbound variable`); generated env files were inspected and used successfully.
