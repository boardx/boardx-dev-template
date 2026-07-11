#!/usr/bin/env bash
# devapp-update.sh — devapp.boardx.us 服务器侧更新脚本（CI 与人工共用同一条路径）。
# 由 CI（.github/workflows/deploy-devapp.yml）在 rsync 代码后远程执行；人工更新时
# SSH 上服务器直接跑它也一样。步骤 = infra/DEPLOYMENT.md §6 的固化版。
# 前置：代码已同步到 /opt/boardx（含本脚本自身），env/compose.prod.yml 已在位。
set -euo pipefail

cd /opt/boardx
echo "==> [devapp-update] $(date -u +%FT%TZ) 开始更新"

echo "==> 1/5 依赖"
pnpm install --frozen-lockfile 2>&1 | tail -1

echo "==> 2/5 数据库迁移"
pnpm --filter @repo/data run migrate 2>&1 | tail -3

echo "==> 3/5 构建 web"
cd apps/web && NODE_ENV=production pnpm build 2>&1 | tail -3
cd /opt/boardx

echo "==> 4/5 重启服务"
systemctl restart boardx-web boardx-collab boardx-workflow

echo "==> 5/5 本机健康检查（最多等 30s）"
for i in $(seq 1 15); do
  if curl -sf -m 3 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo "✓ web 健康：$(curl -s -m 3 http://127.0.0.1:3000/api/health)"
    echo "==> [devapp-update] 完成"
    exit 0
  fi
  sleep 2
done
echo "✗ web 重启后 30s 内未通过健康检查" >&2
systemctl status boardx-web --no-pager | tail -5 >&2
exit 1
