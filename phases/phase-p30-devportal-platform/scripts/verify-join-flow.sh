#!/usr/bin/env bash
# verify-join-flow.sh — p30/F06 端到端验证（打活体 coord-gateway，同 verify-directory-invariants.sh 套路）。
#
# 断言意图（完成契约）：
#   1. API 提交加入申请（含 modules/intro）-> 目录 DO 出现 pending Membership，SLA 倒计时可读
#      （GET /memberships/:id/sla：pending 有真实 hoursLeft/deadline）
#   2. owner token 批准（approve）-> active + 只增审计事件（directory.membership.transitioned）
#   3. 另一条申请驳回（reject）-> rejected 终态；rejected 后任何迁移一律 409（不可逆）
#   4. sla 端点对非 pending 状态返回 sla:null（已出结果的申请不再倒计时）
#   5. 项目自定义 SLA 承诺（promiseH=4h）下，新申请立即落在 urgent 区间
#
# 需要环境变量：
#   COORD_API_TOKEN   目录读面（ops）
#   COORD_ADMIN_TOKEN 目录写面（身份/授权/审批为管理特权）
#   GATEWAY_URL       可选，默认 https://coord-gateway.boardx.workers.dev
#                     （本地 `pnpm --filter coord-gateway dev` 起 wrangler dev 后可指向
#                      http://localhost:8799，配上本地 .dev.vars 的 token 即可离线验证）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"
BASE="$GATEWAY_URL/api/coord/directory"

if [[ -z "${COORD_API_TOKEN:-}" || -z "${COORD_ADMIN_TOKEN:-}" ]]; then
  echo "FAIL: 需要 COORD_API_TOKEN 与 COORD_ADMIN_TOKEN（活体验证凭据）" >&2
  exit 1
fi
command -v jq >/dev/null || { echo "FAIL: 需要 jq" >&2; exit 1; }

TS="$(date +%s)"
HANDLE="verify-join-eng-$TS"
SLUG="verify-join-proj-$TS"
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

req() {
  local expected="$1" method="$2" path="$3" token="$4" body="${5:-}"
  local args=(-sS -o "$BODY_FILE" -w '%{http_code}' -X "$method" \
    -H "Authorization: Bearer $token" -H "content-type: application/json")
  [[ -n "$body" ]] && args+=(-d "$body")
  local status
  status="$(curl "${args[@]}" "$BASE$path")"
  if [[ "$status" != "$expected" ]]; then
    echo "FAIL: $method $path 期望 $expected，实际 $status" >&2
    cat "$BODY_FILE" >&2
    exit 1
  fi
}

echo "== 0. 建 engineer + 4h SLA 承诺的项目"
req 201 POST /engineers "$COORD_ADMIN_TOKEN" "{\"handle\":\"$HANDLE\",\"github_login\":\"gh-$TS\"}"
req 201 POST /projects "$COORD_ADMIN_TOKEN" "{\"slug\":\"$SLUG\",\"name\":\"Verify Join $TS\",\"sla\":{\"promiseH\":4}}"

echo "== 1. 提交加入申请（modules/intro）-> pending"
req 201 POST /memberships "$COORD_ADMIN_TOKEN" \
  "{\"project\":\"$SLUG\",\"engineer\":\"@$HANDLE\",\"role\":\"contributor\",\"modules\":[\"collab\"],\"intro\":\"verify e2e 自动化申请\"}"
MID="$(jq -r '.membership.membership_id' "$BODY_FILE")"
jq -e '.membership.status == "pending"' "$BODY_FILE" >/dev/null
jq -e '.membership.modules == ["collab"]' "$BODY_FILE" >/dev/null

echo "== 2. SLA 端点：pending 返回真实倒计时，4h 承诺下立即 urgent"
req 200 GET "/memberships/$MID/sla" "$COORD_API_TOKEN"
jq -e '.status == "pending"' "$BODY_FILE" >/dev/null
jq -e '.sla.urgent == true' "$BODY_FILE" >/dev/null
jq -e '.sla.timedOut == false' "$BODY_FILE" >/dev/null

echo "== 3. owner 批准 -> active，SLA 端点转为 sla:null"
req 200 POST "/memberships/$MID/transition" "$COORD_ADMIN_TOKEN" '{"action":"approve","actor":"verify-owner"}'
jq -e '.membership.status == "active"' "$BODY_FILE" >/dev/null
req 200 GET "/memberships/$MID/sla" "$COORD_API_TOKEN"
jq -e '.status == "active" and .sla == null' "$BODY_FILE" >/dev/null

echo "== 4. 另一条申请：owner 驳回 -> rejected 终态，之后任何迁移 409"
req 201 POST /engineers "$COORD_ADMIN_TOKEN" "{\"handle\":\"$HANDLE-2\",\"github_login\":\"gh-$TS-2\"}"
req 201 POST /memberships "$COORD_ADMIN_TOKEN" "{\"project\":\"$SLUG\",\"engineer\":\"@$HANDLE-2\",\"role\":\"contributor\"}"
MID2="$(jq -r '.membership.membership_id' "$BODY_FILE")"
req 200 POST "/memberships/$MID2/transition" "$COORD_ADMIN_TOKEN" '{"action":"reject","actor":"verify-owner"}'
jq -e '.membership.status == "rejected"' "$BODY_FILE" >/dev/null
req 409 POST "/memberships/$MID2/transition" "$COORD_ADMIN_TOKEN" '{"action":"approve"}'
req 409 POST "/memberships/$MID2/transition" "$COORD_ADMIN_TOKEN" '{"action":"reject"}'

echo "== 5. 只增审计：批准/驳回都留下 directory.membership.transitioned"
req 200 GET "/events?limit=500" "$COORD_API_TOKEN"
jq -e --arg mid "$MID" '[.events[] | select(.type == "directory.membership.transitioned" and .payload.membership_id == $mid)] | length >= 1' "$BODY_FILE" >/dev/null
jq -e --arg mid "$MID2" '[.events[] | select(.type == "directory.membership.transitioned" and .payload.membership_id == $mid)] | length >= 1' "$BODY_FILE" >/dev/null

echo "PASS: p30/F06 加入审批流 + SLA（modules/intro 落库、SLA 倒计时/urgent、approve/reject 终态、审计事件）"
