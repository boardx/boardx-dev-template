#!/usr/bin/env bash
# verify-full.sh — 本地镜像 CI 的完整门控。push 前/标 passing 前跑这个。
# = verify:base(typecheck+lint+test) + web build(抓 prerender/Suspense 类错) +
#   有 docker 时起 pg/redis + migrate + 全量 Playwright e2e（抓跨阶段回归）。
# 设计动机：verify:base 不含 e2e/build，导致本地"passing"漏掉只有 CI 能抓的回归。
set -euo pipefail

PNPM="corepack pnpm@9.0.0"

# DB/Redis/web 端口：优先 apps/web/.env.local（本机端口覆盖），否则环境变量，否则默认。
if [ -f apps/web/.env.local ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^(DATABASE_URL|REDIS_URL|E2E_PORT)=' apps/web/.env.local | xargs) 2>/dev/null || true
fi
export DATABASE_URL="${DATABASE_URL:-postgresql://boardx:boardx@localhost:5432/boardx}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
# e2e/next dev 端口：多个 worktree 并行跑 verify:full 时，若都用默认 3000，Playwright
# 的 reuseExistingServer 会复用到别的 worktree 的 server（测错代码），下面的清理步骤
# 也会误杀别的 worktree 的 server。scripts/init-worktree-env.sh 会写入独立 E2E_PORT。
export E2E_PORT="${E2E_PORT:-3000}"
# 从 URL 解析端口给 docker compose 发布
export PG_PORT="$(printf '%s' "$DATABASE_URL" | sed -E 's#.*:([0-9]+)/.*#\1#')"
export REDIS_PORT="$(printf '%s' "$REDIS_URL" | sed -E 's#.*:([0-9]+).*#\1#')"

echo "==> [1/3] verify:base（typecheck + lint + test）"
$PNPM -w run verify:base

echo "==> [2/3] web 生产构建（抓 prerender/Suspense 类构建错）"
$PNPM --filter @repo/web run build

if docker info >/dev/null 2>&1; then
  echo "==> [3/3] 起 pg/redis（${PG_PORT}/${REDIS_PORT}）+ migrate + 全量 e2e"
  docker compose -f infra/docker-compose.yml up -d
  PGID=$(docker compose -f infra/docker-compose.yml ps -q postgres)
  for i in $(seq 1 20); do
    [ "$(docker inspect --format '{{.State.Health.Status}}' "$PGID" 2>/dev/null)" = "healthy" ] && break
    sleep 2
  done
  $PNPM --filter @repo/data run migrate
  $PNPM --filter @repo/web exec playwright install chromium >/dev/null 2>&1 || true
  # 清 :$E2E_PORT 上残留的 next dev + 旧 .next：反复本地 verify 会留僵尸 server 抢端口，
  # 或上次 `next build` 的生产 .next 与 next dev 冲突，导致全量 e2e 从中途整片崩溃
  # （quality-document #8）。Playwright reuseExistingServer 会复用僵尸 server 跑到旧代码。
  # 只清本 worktree 自己的 E2E_PORT，不碰其它端口——避免误杀别的 worktree 的 dev server。
  lsof -ti tcp:"$E2E_PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
  rm -rf apps/web/.next
  $PNPM --filter @repo/web exec playwright test
  echo "✓ 全量 e2e 通过"
else
  echo "!! [3/3] docker 未运行，跳过 e2e。构建/类型已验，但跨阶段回归未覆盖——"
  echo "   建议起 docker 后重跑 verify:full，否则有回归风险。"
fi

echo "✓ verify:full 完成"
