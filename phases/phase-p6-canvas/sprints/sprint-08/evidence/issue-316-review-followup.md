# Issue #316 review follow-up evidence

- Issue: https://github.com/boardx/boardx-dev-template/issues/316
- Branch: `codex/issue-316-canvas-review-fixes`
- Worktree: `/private/tmp/boardx-worktrees/issue-316-canvas-review-fixes`
- Base: `origin/worker/canvas-p6-f07-guidelines`
- Timestamp: `2026-07-03T18:55:50Z`

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

## Notes

- Docker socket access, `tsx` IPC during data migrations, and Next/Playwright local server listen required sandbox escalation in this desktop environment.
- `scripts/init-worktree-env.sh` wrote valid env files but exited on an existing trailing typo in its final echo (`compose_env...: unbound variable`); generated env files were inspected and used successfully.
