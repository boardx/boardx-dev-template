#!/usr/bin/env bash
# verify-authz-api.sh — p30/F03 端到端验证（活体：真实 coord-gateway 目录 + 真实 devportal 部署）。
#
# 断言（服务端角色裁剪，非前端隐藏——这是本 feature notes 点名的反面测试核心）：
#   1. 注册一个私有测试项目 + 两个测试工程师（owner / contributor）+ active membership；
#   2. 用与目标部署一致的 SESSION_SECRET 铸造两枚测试身份的 devportal session cookie
#      （lib/mint-devportal-session.mjs，与 lib/session.ts::signSession 同构 HS256）；
#   3. GET /api/portal/workspace/<slug>/settings（真实 HTTP，非页面组件内部调用）：
#        contributor → 403，响应体不含任何治理数据
#        owner       → 200，响应体只含 {project, role}
#   4. 未登录（无 cookie）→ 401；未知 slug → 404（同一 access 探针端点）。
#
# 需要环境变量：
#   COORD_API_TOKEN     目录读面（ops）
#   COORD_ADMIN_TOKEN    目录写面（注册测试 project/engineer/membership，身份/授权类特权）
#   SESSION_SECRET       devportal session 签名密钥（须与目标部署一致——本地验证用
#                         playwright.config.ts 的 E2E_SESSION_SECRET；线上验证用部署 secret）
#   DEVPORTAL_BASE_URL   可选，默认 http://127.0.0.1:3400（本地 next dev）
#   GATEWAY_URL          可选，默认 https://coord-gateway.boardx.workers.dev
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GATEWAY_URL="${GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"
DEVPORTAL_BASE_URL="${DEVPORTAL_BASE_URL:-http://127.0.0.1:3400}"
DIR_BASE="$GATEWAY_URL/api/coord/directory"

if [[ -z "${COORD_API_TOKEN:-}" || -z "${COORD_ADMIN_TOKEN:-}" || -z "${SESSION_SECRET:-}" ]]; then
  echo "FAIL: 需要 COORD_API_TOKEN / COORD_ADMIN_TOKEN / SESSION_SECRET（活体验证凭据）" >&2
  exit 1
fi
command -v jq >/dev/null || { echo "FAIL: 需要 jq" >&2; exit 1; }
command -v node >/dev/null || { echo "FAIL: 需要 node（铸造测试 session cookie）" >&2; exit 1; }

TS="$(date +%s)"
SLUG="verify-authz-$TS"
OWNER_HANDLE="verify-owner-$TS"
CONTRIB_HANDLE="verify-contrib-$TS"
BODY="$(mktemp)"
trap 'rm -f "$BODY"' EXIT

dir_req() { # <expected> <method> <path> <token> [json_body]
  local expected="$1" method="$2" path="$3" token="$4" data="${5:-}"
  local args=(-sS -o "$BODY" -w '%{http_code}' -X "$method" -H "Authorization: Bearer $token" -H "content-type: application/json")
  [[ -n "$data" ]] && args+=(-d "$data")
  local status; status="$(curl "${args[@]}" "$DIR_BASE$path")"
  if [[ "$status" != "$expected" ]]; then
    echo "FAIL: $method $DIR_BASE$path 期望 $expected，实际 $status" >&2
    cat "$BODY" >&2
    exit 1
  fi
}

echo "== 0. 注册测试项目（私有）"
dir_req 201 POST /projects "$COORD_ADMIN_TOKEN" "{\"slug\":\"$SLUG\",\"name\":\"verify-authz-$TS\",\"visibility\":\"private\"}"
PROJECT_ID="$(jq -r .project.project_id "$BODY")"

echo "== 1. 注册两个测试工程师（owner / contributor）"
dir_req 201 POST /engineers "$COORD_ADMIN_TOKEN" "{\"handle\":\"$OWNER_HANDLE\",\"github_login\":\"$OWNER_HANDLE\"}"
dir_req 201 POST /engineers "$COORD_ADMIN_TOKEN" "{\"handle\":\"$CONTRIB_HANDLE\",\"github_login\":\"$CONTRIB_HANDLE\"}"

echo "== 2. 建 membership（pending）并 approve 成 active"
dir_req 201 POST /memberships "$COORD_ADMIN_TOKEN" "{\"project\":\"$SLUG\",\"engineer\":\"$OWNER_HANDLE\",\"role\":\"owner\"}"
OWNER_MEM_ID="$(jq -r .membership.membership_id "$BODY")"
dir_req 201 POST /memberships "$COORD_ADMIN_TOKEN" "{\"project\":\"$SLUG\",\"engineer\":\"$CONTRIB_HANDLE\",\"role\":\"contributor\"}"
CONTRIB_MEM_ID="$(jq -r .membership.membership_id "$BODY")"

dir_req 200 POST "/memberships/$OWNER_MEM_ID/transition" "$COORD_ADMIN_TOKEN" '{"action":"approve"}'
dir_req 200 POST "/memberships/$CONTRIB_MEM_ID/transition" "$COORD_ADMIN_TOKEN" '{"action":"approve"}'

echo "== 3. 铸造两枚测试身份的 devportal session cookie"
OWNER_JWT="$(node "$SCRIPT_DIR/lib/mint-devportal-session.mjs" "$OWNER_HANDLE" "$SESSION_SECRET")"
CONTRIB_JWT="$(node "$SCRIPT_DIR/lib/mint-devportal-session.mjs" "$CONTRIB_HANDLE" "$SESSION_SECRET")"

api_get() { # <expected> <cookie_or_empty> <path>
  local expected="$1" cookie="$2" path="$3"
  local args=(-sS -o "$BODY" -w '%{http_code}')
  [[ -n "$cookie" ]] && args+=(-H "cookie: devportal_session=$cookie")
  local status; status="$(curl "${args[@]}" "$DEVPORTAL_BASE_URL$path")"
  if [[ "$status" != "$expected" ]]; then
    echo "FAIL: GET $DEVPORTAL_BASE_URL$path 期望 $expected，实际 $status" >&2
    cat "$BODY" >&2
    exit 1
  fi
}

echo "== 4. contributor 调治理台数据接口 → 403（服务端裁剪，响应体不含治理数据）"
api_get 403 "$CONTRIB_JWT" "/api/portal/workspace/$SLUG/settings"
jq -e '.error == "forbidden" and (has("project") | not)' "$BODY" >/dev/null \
  || { echo "FAIL: 403 响应体不应携带 project 数据（防假阳性核心断言）" >&2; cat "$BODY" >&2; exit 1; }

echo "== 5. owner 调同一接口 → 200，拿到真实数据"
api_get 200 "$OWNER_JWT" "/api/portal/workspace/$SLUG/settings"
jq -e ".project.slug == \"$SLUG\" and .role == \"owner\"" "$BODY" >/dev/null

echo "== 6. 未登录（无 cookie）→ 401（工作区探针端点未加 project 数据）"
api_get 401 "" "/api/portal/workspace/$SLUG/access"

echo "== 7. 未知 slug → 404"
api_get 404 "$OWNER_JWT" "/api/portal/workspace/unknown-project-$TS/access"

echo "PASS: p30/F03 服务端角色裁剪 — contributor 403 / owner 200 / 未登录 401 / 未知项目 404，均为真实 HTTP 状态码差异（非前端隐藏）"
