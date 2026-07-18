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
#   D1_DATABASE          D1 库名（缺省 coord-service-staging，即退役前的在用库）
# 以及：wrangler 登录态（wrangler whoami 可用，CLOUDFLARE_ACCOUNT_ID 已设）。
#
# 2026-07-18 割接完成注记（p29-F10 stage-2）：packages/coord-service 已从仓库删除，
# 本脚本按库名直连 D1（不再依赖 coord-service 的 wrangler.toml）。本仓存量已灌入并
# 对账通过（6/6）；保留脚本供未来接入仓复用/审计复现。D1 库本体的最终下线由人类
# 在归档确认后于 Cloudflare 侧执行。
set -euo pipefail

: "${COORD_GATEWAY_URL:?需要 COORD_GATEWAY_URL}"
: "${COORD_ADMIN_TOKEN:?需要 COORD_ADMIN_TOKEN（gateway 管理面 bearer）}"
REPO="${GITHUB_REPO:-boardx/boardx-dev-template}"
D1_DATABASE="${D1_DATABASE:-coord-service-staging}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUT_DIR="${ROOT}/phases/phase-p29-coord-platform/evidence"
mkdir -p "$OUT_DIR"
EXPORT_JSON="${OUT_DIR}/F10.tasks-d1-export.$(date +%Y%m%dT%H%M%S).json"

echo "==> 1/3 从 D1（${D1_DATABASE}）导出存量 tasks（按库名直连，coord-service 已退役）"
(
  cd "${ROOT}"
  pnpm exec wrangler d1 execute "$D1_DATABASE" \
    --remote --json \
    --command "SELECT * FROM tasks ORDER BY id"
) > "$EXPORT_JSON"
COUNT="$(jq '.[0].results | length' "$EXPORT_JSON")"
echo "    导出 ${COUNT} 行 → ${EXPORT_JSON}（留档，ADR-011 派生快照）"

if [ "$COUNT" -eq 0 ]; then
  echo "==> D1 无存量 tasks，无需导入。完成。"
  exit 0
fi

echo "==> 2/3 经 gateway 管理面导入 RepoHub DO（幂等：重跑已存在且内容一致的行 skipped；"
echo "    同 id 不同内容 → 服务端 409 import_conflict，curl -f 直接失败，绝不静默覆盖）"
RESULT="$(
  jq '{tasks: .[0].results}' "$EXPORT_JSON" | curl -fsS \
    -X POST "${COORD_GATEWAY_URL}/api/coord/repos/${REPO}/tasks/import" \
    -H "Authorization: Bearer ${COORD_ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    --data @-
)"
echo "    import 结果：${RESULT}"

echo "==> 3/3 对账：import 响应的 imported+skipped 必须 === D1 导出行数"
# coord-main #732 复核：旧对账（GET assignee=* 数行数）有 200 上限截断风险——
# 存量一旦超 200 行，「行数不少于导出」永真，对账失去意义。改为直接断言 import
# 响应逐行处理数：每一行要么新导入要么内容一致跳过，总和恰好等于导出行数。
IMPORTED="$(echo "$RESULT" | jq -r '.imported')"
SKIPPED="$(echo "$RESULT" | jq -r '.skipped')"
PROCESSED=$((IMPORTED + SKIPPED))
echo "    imported=${IMPORTED} skipped=${SKIPPED} processed=${PROCESSED}；D1 导出：${COUNT}"
if [ "$PROCESSED" -ne "$COUNT" ]; then
  echo "!! 对账失败：imported+skipped（${PROCESSED}）!= D1 导出行数（${COUNT}），检查 import 结果" >&2
  exit 1
fi
echo "==> 完成。重跑本脚本安全（幂等；内容漂移会被服务端 409 拦截）。"
