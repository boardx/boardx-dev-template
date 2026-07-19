#!/usr/bin/env bash
# verify-enroll-heartbeat.sh — p30/F07 端到端验证（打活体 coord-gateway）。
#
# 断言（实现前定下的完成契约）：
#   1. enroll 查重：owner 命名空间内重复 agent 名 → 409 agent_name_taken
#   2. mint-on-reveal：拿到一次性明文 token（coordtk_ 前缀），且列表接口不含明文/完整 hash
#   3. agent 用自己的 scoped token 打真实心跳 → 200；冒充别的 agent 心跳 → 403
#   4. 心跳事件真实转发进本仓 RepoHub 事件流（非 mock 定时器，p30/F07 的 /relay/event）
#   5. revoke 后旧 token 立即失效：同一 token 再打心跳 → 401（即时失效）
#
# 需要环境变量：
#   COORD_API_TOKEN   目录/RepoHub 读面（ops）
#   COORD_ADMIN_TOKEN 目录写面 + RepoHub token mint/revoke（管理特权）
#   GATEWAY_URL       可选，默认 https://coord-gateway.boardx.workers.dev
#   REPO              可选，默认 boardx/boardx-dev-template（已接入 PROJECTION_REPOS 的仓）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"
REPO="${REPO:-boardx/boardx-dev-template}"
DIR_BASE="$GATEWAY_URL/api/coord/directory"
REPO_BASE="$GATEWAY_URL/api/coord/repos/$REPO"

if [[ -z "${COORD_API_TOKEN:-}" || -z "${COORD_ADMIN_TOKEN:-}" ]]; then
  echo "FAIL: 需要 COORD_API_TOKEN 与 COORD_ADMIN_TOKEN（活体验证凭据）" >&2
  exit 1
fi
command -v jq >/dev/null || { echo "FAIL: 需要 jq" >&2; exit 1; }

TS="$(date +%s)"
HANDLE="enroll-eng-$TS"
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

# req <expected_status> <method> <url> <token> [json_body]
req() {
  local expected="$1" method="$2" url="$3" token="$4" body="${5:-}"
  local args=(-sS -o "$BODY_FILE" -w '%{http_code}' -X "$method" \
    -H "Authorization: Bearer $token" -H "content-type: application/json")
  [[ -n "$body" ]] && args+=(-d "$body")
  local status
  status="$(curl "${args[@]}" "$url")"
  if [[ "$status" != "$expected" ]]; then
    echo "FAIL: $method $url 期望 $expected，实际 $status" >&2
    cat "$BODY_FILE" >&2
    exit 1
  fi
}

echo "== 0. 注册 engineer + 两个同 owner agent（起始态）"
req 201 POST "$DIR_BASE/engineers" "$COORD_ADMIN_TOKEN" \
  "{\"handle\":\"$HANDLE\",\"github_login\":\"gh-$HANDLE\"}"
req 201 POST "$DIR_BASE/agents" "$COORD_ADMIN_TOKEN" "{\"owner\":\"@$HANDLE\",\"name\":\"worker\"}"
AGENT_ID="$(jq -re '.agent.agent_id' "$BODY_FILE")"
req 201 POST "$DIR_BASE/agents" "$COORD_ADMIN_TOKEN" "{\"owner\":\"@$HANDLE\",\"name\":\"attacker\"}"
ATTACKER_ID="$(jq -re '.agent.agent_id' "$BODY_FILE")"

echo "== 1. enroll 查重：owner 命名空间内重复名字 → 409 agent_name_taken（err-ns-dup 映射源）"
req 409 POST "$DIR_BASE/agents" "$COORD_ADMIN_TOKEN" "{\"owner\":\"@$HANDLE\",\"name\":\"worker\"}"
jq -e '.error == "agent_name_taken"' "$BODY_FILE" >/dev/null

echo "== 2. mint-on-reveal：一次性明文 token（coordtk_ 前缀），列表接口不露明文/完整 hash"
req 201 POST "$REPO_BASE/tokens/mint" "$COORD_ADMIN_TOKEN" \
  "{\"agent_id\":\"$AGENT_ID\",\"owner\":\"$HANDLE\"}"
TOKEN="$(jq -re '.token' "$BODY_FILE")"
TOKEN_HASH_PREFIX="$(jq -re '.token_hash_prefix' "$BODY_FILE")"
[[ "$TOKEN" == coordtk_* ]] || { echo "FAIL: token 格式不对：$TOKEN" >&2; exit 1; }
req 200 GET "$REPO_BASE/tokens" "$COORD_ADMIN_TOKEN"
if grep -qF "$TOKEN" "$BODY_FILE"; then
  echo "FAIL: token 列表接口泄漏明文" >&2; exit 1
fi

req 201 POST "$REPO_BASE/tokens/mint" "$COORD_ADMIN_TOKEN" \
  "{\"agent_id\":\"$ATTACKER_ID\",\"owner\":\"$HANDLE\"}"
ATTACKER_TOKEN="$(jq -re '.token' "$BODY_FILE")"

echo "== 3. 心跳自证：agent 自己的 scoped token 打心跳 → 200；冒充别的 agent → 403"
req 200 POST "$DIR_BASE/agents/$AGENT_ID/heartbeat" "$TOKEN" '{}'
FIRST_HB_AT="$(jq -re '.agent.last_heartbeat_at' "$BODY_FILE")"
[[ -n "$FIRST_HB_AT" && "$FIRST_HB_AT" != "null" ]] || { echo "FAIL: 心跳时间戳未落地" >&2; exit 1; }
req 403 POST "$DIR_BASE/agents/$AGENT_ID/heartbeat" "$ATTACKER_TOKEN" '{}'
jq -e '.error == "token_agent_mismatch"' "$BODY_FILE" >/dev/null

echo "== 4. 心跳真实转发进 RepoHub 事件流（真实 WS 广播通道，非前端定时器）"
req 200 GET "$REPO_BASE/events?limit=500" "$COORD_API_TOKEN"
jq -e --arg id "$AGENT_ID" '
  [.events[] | select(.type == "directory.agent.heartbeat" and .payload.agent_id == $id)] | length > 0
' "$BODY_FILE" >/dev/null

echo "== 5. revoke 即时失效：吊销后同一 token 再打心跳 → 401"
req 200 POST "$REPO_BASE/tokens/revoke" "$COORD_ADMIN_TOKEN" \
  "{\"token_hash_prefix\":\"$TOKEN_HASH_PREFIX\"}"
req 401 POST "$DIR_BASE/agents/$AGENT_ID/heartbeat" "$TOKEN" '{}'

echo "PASS: enroll 查重 + mint-on-reveal + 心跳自证/转发 + revoke 即时失效全部成立（gateway=$GATEWAY_URL，repo=$REPO，suffix=$TS）"
