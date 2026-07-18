#!/usr/bin/env bash
# migrate-tasks-d1-to-repohub.sh — F10 割接：coord-service D1 存量 tasks → RepoHub DO
#
# 流程：wrangler d1 execute --json 导出 D1 tasks 全量 → 经 coord-gateway 管理面
# POST /tasks/import 灌入该仓的 RepoHub DO。**幂等可重跑**：DO 侧按原 id
# INSERT-or-skip（已存在的行 skipped，不覆盖、不产生事件——导入是审计回填，
# 不是活跃协调信号，见 docs/coord-platform/protocol/events.md §Tasks）。
#
# 真跑等割接窗口（人类拍板时机，feature_list F10 notes）。本脚本合入时只要求
# `bash -n` 语法通过。
#
# 需要的环境：
#   COORD_GATEWAY_URL    如 https://coord-gateway.boardx.workers.dev
#   COORD_ADMIN_TOKEN    gateway 管理面 bearer（派工/导入特权）
#   GITHUB_REPO          目标仓（缺省 boardx/boardx-dev-template）
#   D1_DATABASE          D1 库名（缺省 coord-service-staging，即生产在用库）
#   WRANGLER_ENV         wrangler env（缺省 staging，对应 coord-service wrangler.toml）
# 以及：packages/coord-service 的 wrangler 登录态（wrangler whoami 可用）。
set -euo pipefail

: "${COORD_GATEWAY_URL:?需要 COORD_GATEWAY_URL}"
: "${COORD_ADMIN_TOKEN:?需要 COORD_ADMIN_TOKEN（gateway 管理面 bearer）}"
REPO="${GITHUB_REPO:-boardx/boardx-dev-template}"
D1_DATABASE="${D1_DATABASE:-coord-service-staging}"
WRANGLER_ENV="${WRANGLER_ENV:-staging}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUT_DIR="${ROOT}/phases/phase-p29-coord-platform/evidence"
mkdir -p "$OUT_DIR"
EXPORT_JSON="${OUT_DIR}/F10.tasks-d1-export.$(date +%Y%m%dT%H%M%S).json"

echo "==> 1/3 从 D1（${D1_DATABASE}，env=${WRANGLER_ENV}）导出存量 tasks"
(
  cd "${ROOT}/packages/coord-service"
  pnpm exec wrangler d1 execute "$D1_DATABASE" \
    --env "$WRANGLER_ENV" --remote --json \
    --command "SELECT * FROM tasks ORDER BY id"
) > "$EXPORT_JSON"
COUNT="$(jq '.[0].results | length' "$EXPORT_JSON")"
echo "    导出 ${COUNT} 行 → ${EXPORT_JSON}（留档，ADR-011 派生快照）"

if [ "$COUNT" -eq 0 ]; then
  echo "==> D1 无存量 tasks，无需导入。完成。"
  exit 0
fi

echo "==> 2/3 经 gateway 管理面导入 RepoHub DO（幂等：重跑已存在的行 skipped）"
RESULT="$(
  jq '{tasks: .[0].results}' "$EXPORT_JSON" | curl -fsS \
    -X POST "${COORD_GATEWAY_URL}/api/coord/repos/${REPO}/tasks/import" \
    -H "Authorization: Bearer ${COORD_ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    --data @-
)"
echo "    import 结果：${RESULT}"

echo "==> 3/3 对账：DO 侧行数 >= D1 导出行数"
DO_COUNT="$(
  curl -fsS "${COORD_GATEWAY_URL}/api/coord/repos/${REPO}/tasks?assignee=*" \
    -H "Authorization: Bearer ${COORD_ADMIN_TOKEN}" | jq '.tasks | length'
)"
echo "    DO tasks（assignee=*，上限 200）：${DO_COUNT}；D1 导出：${COUNT}"
if [ "$DO_COUNT" -lt "$COUNT" ] && [ "$DO_COUNT" -lt 200 ]; then
  echo "!! 对账失败：DO 行数少于 D1 导出（且未触到 200 上限），检查 import 结果" >&2
  exit 1
fi
echo "==> 完成。重跑本脚本安全（幂等）。"
