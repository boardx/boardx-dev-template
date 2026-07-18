#!/usr/bin/env bash
# F08 按仓 scoped token e2e（打活体）：
#   1) admin mint 一个 scoped token（明文只在此响应出现一次）；
#   2) 用它调本仓 REST → 200；
#   3) 伪造他仓路径 → 403（token 只在所属仓 DO 有记录，跨仓查无即拒）；
#   4) admin revoke → 本仓再调 → 401（verify 实时查 DO，吊销即时生效，无缓存窗口）。
# 前置：env COORD_ADMIN_TOKEN（gateway 的 maintainer 特权 secret）。
# 用法：COORD_ADMIN_TOKEN=... [GATEWAY_URL=...] [REPO=owner/name] bash verify-token-scope.sh
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"
REPO="${REPO:-boardx/boardx-dev-template}"
OTHER_REPO="${OTHER_REPO:-boardx/definitely-not-my-repo}"
: "${COORD_ADMIN_TOKEN:?需要 COORD_ADMIN_TOKEN（gateway 管理特权 secret）}"

AGENT="e2e-token-scope-$$"
log() { printf '[e2e] %s\n' "$*"; }
fail() { printf '[e2e] FAIL: %s\n' "$*" >&2; exit 1; }

# status <expected> <method> <url> [token] [json-body] —— 断言 HTTP 状态码
status() {
  local expected="$1" method="$2" url="$3" token="${4:-}" body="${5:-}"
  local got
  got="$(curl -sS -o /dev/null -w '%{http_code}' -X "$method" "$url" \
    ${token:+-H "authorization: Bearer $token"} \
    -H "content-type: application/json" \
    ${body:+-d "$body"})"
  [ "$got" = "$expected" ] || fail "$method $url 期望 $expected 实得 $got"
}

# ---------- 1) mint（admin 特权） ----------
log "mint scoped token（agent=$AGENT, repo=$REPO）"
MINTED="$(curl -fsS -X POST "$GATEWAY_URL/api/coord/repos/$REPO/tokens/mint" \
  -H "authorization: Bearer $COORD_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"agent_id\":\"$AGENT\",\"owner\":\"e2e-script\"}")"
TOKEN="$(printf '%s' "$MINTED" | jq -r '.token')"
PREFIX="$(printf '%s' "$MINTED" | jq -r '.token_hash_prefix')"
case "$TOKEN" in coordtk_*) ;; *) fail "mint 未返回 coordtk_ 明文（got: $(printf '%s' "$MINTED" | jq -c 'del(.token)')）" ;; esac
log "OK: mint（hash 前缀 $PREFIX；明文不落盘不回显）"

# ---------- 2) 本仓 API → 200 ----------
status 200 GET "$GATEWAY_URL/api/coord/repos/$REPO/claims" "$TOKEN"
log "OK: scoped token 调本仓 API → 200"

# ---------- 2b) agent_id 强绑定（#721）：冒充他人身份 → 403 ----------
status 403 POST "$GATEWAY_URL/api/coord/repos/$REPO/claims" "$TOKEN" \
  "{\"protocol\":\"coord/0.1\",\"resource_id\":\"issue:1\",\"resource_type\":\"issue\",\"agent_id\":\"someone-else\",\"ttl_seconds\":3600}"
log "OK: scoped token 冒充他人 agent_id → 403（强绑定生效）"

# ---------- 3) 伪造他仓路径 → 403 ----------
status 403 GET "$GATEWAY_URL/api/coord/repos/$OTHER_REPO/claims" "$TOKEN"
log "OK: 伪造他仓路径 → 403（按仓 scope 生效）"

# ---------- 4) revoke → 401 ----------
log "revoke（hash 前缀 $PREFIX）"
curl -fsS -X POST "$GATEWAY_URL/api/coord/repos/$REPO/tokens/revoke" \
  -H "authorization: Bearer $COORD_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"token_hash_prefix\":\"$PREFIX\"}" >/dev/null
status 401 GET "$GATEWAY_URL/api/coord/repos/$REPO/claims" "$TOKEN"
log "OK: revoke 后 → 401（吊销即时生效）"

# 附带：管理面特权隔离——scoped token 不可自我 mint
status 401 POST "$GATEWAY_URL/api/coord/repos/$REPO/tokens/mint" "$TOKEN" "{\"agent_id\":\"evil\",\"owner\":\"evil\"}"
log "OK: scoped token 不可触达管理面（mint 401）"

log "PASS: F08 全链路（mint → 本仓 200 → 他仓 403 → revoke → 401）"
