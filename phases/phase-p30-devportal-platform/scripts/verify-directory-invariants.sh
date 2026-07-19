#!/usr/bin/env bash
# verify-directory-invariants.sh — p30/F01 端到端验证（打活体 coord-gateway）。
#
# 断言不变量（实现前定下的完成契约）：
#   1. 写入一个缺 owner 的 agent → 目录 DO 拒绝（422 owner_required）
#   2. 重复 @handle 注册（不同 github_login）→ 409 handle_taken
#   3. agent 改名后 ULID 不变，且旧 ULID 引用仍可解析（D6 不断链）
#   4. 非法 membership 状态迁移（pending→suspend）→ 409
#   5. agents 行三答字段非空：owner（属于哪个人类）/ parent 键存在 / projects（哪个项目的）
#
# 需要环境变量：
#   COORD_API_TOKEN   目录读面（ops）
#   COORD_ADMIN_TOKEN 目录写面（身份/授权/审批为管理特权）
#   GATEWAY_URL       可选，默认 https://coord-gateway.boardx.workers.dev
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
HANDLE="verify-eng-$TS"
SLUG="verify-proj-$TS"
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

# req <expected_status> <method> <path> <token> [json_body]
# 响应体落 $BODY_FILE；状态不符 → 显式红。
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

echo "== 0. 读面可达（ops token）"
req 200 GET /projects "$COORD_API_TOKEN"
jq -e '.projects | type == "array"' "$BODY_FILE" >/dev/null

echo "== 1. 缺 owner 的 agent 被拒（422 owner_required）"
req 422 POST /agents "$COORD_ADMIN_TOKEN" '{"name":"ownerless"}'
jq -e '.error == "owner_required"' "$BODY_FILE" >/dev/null

echo "== 2. @handle 全局唯一：重复注册（不同 github_login）→ 409"
req 201 POST /engineers "$COORD_ADMIN_TOKEN" \
  "{\"handle\":\"$HANDLE\",\"github_login\":\"gh-$TS\"}"
req 409 POST /engineers "$COORD_ADMIN_TOKEN" \
  "{\"handle\":\"$HANDLE\",\"github_login\":\"gh-$TS-impostor\"}"
jq -e '.error == "handle_taken"' "$BODY_FILE" >/dev/null

echo "== 3. agent 改名 ULID 不变 + 旧 ULID 引用仍可解析（D6）"
req 201 POST /agents "$COORD_ADMIN_TOKEN" \
  "{\"owner\":\"@$HANDLE\",\"name\":\"renamer\"}"
AGENT_ID="$(jq -re '.agent.agent_id' "$BODY_FILE")"
req 200 POST "/agents/$AGENT_ID/rename" "$COORD_ADMIN_TOKEN" '{"name":"renamed"}'
jq -e --arg id "$AGENT_ID" '.agent.agent_id == $id and .agent.name == "renamed"' "$BODY_FILE" >/dev/null
req 200 GET "/agents/$AGENT_ID" "$COORD_API_TOKEN"   # 旧 ULID 照常解析
jq -e --arg id "$AGENT_ID" '.agent.agent_id == $id and .agent.name == "renamed"' "$BODY_FILE" >/dev/null

echo "== 4. 非法 membership 状态迁移被拒（pending→suspend → 409）"
req 201 POST /projects "$COORD_ADMIN_TOKEN" "{\"slug\":\"$SLUG\"}"
req 201 POST /memberships "$COORD_ADMIN_TOKEN" \
  "{\"project\":\"$SLUG\",\"engineer\":\"@$HANDLE\",\"role\":\"contributor\"}"
MEMBERSHIP_ID="$(jq -re '.membership.membership_id' "$BODY_FILE")"
req 409 POST "/memberships/$MEMBERSHIP_ID/transition" "$COORD_ADMIN_TOKEN" '{"action":"suspend"}'
jq -e '.error | startswith("invalid_transition:")' "$BODY_FILE" >/dev/null
req 200 POST "/memberships/$MEMBERSHIP_ID/transition" "$COORD_ADMIN_TOKEN" '{"action":"approve"}'

echo "== 5. agents 行三答字段非空（哪个项目的 / 属于哪个人类 / parent 是谁）"
req 201 POST /enrollments "$COORD_ADMIN_TOKEN" \
  "{\"agent_id\":\"$AGENT_ID\",\"project\":\"$SLUG\"}"
req 200 GET /agents "$COORD_API_TOKEN"
jq -e --arg id "$AGENT_ID" --arg h "$HANDLE" --arg s "$SLUG" '
  .agents[] | select(.agent_id == $id)
  | (.owner.handle == $h)                # 属于哪个人类
    and (has("parent"))                  # parent 是谁（顶级为 null 但键必答）
    and (.projects == [$s])              # 哪个项目的
    and (.identifier == "@\($h)/renamed")
' "$BODY_FILE" >/dev/null

echo "== 6. 面隔离：写路径对 ops token 401（写面仅 admin）"
req 401 POST /projects "$COORD_API_TOKEN" '{"slug":"sneaky"}'

echo "PASS: 目录不变量全部成立（gateway=$GATEWAY_URL，suffix=$TS）"
