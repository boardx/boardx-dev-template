#!/usr/bin/env bash
# verify-authz-api.sh — p30/F03 端到端验证（活体：真实 coord-gateway 目录 + 真实 devportal 部署）。
#
# 断言（服务端角色裁剪，非前端隐藏——这是本 feature notes 点名的反面测试核心）：
#   1. 注册一个私有测试项目 + 三个测试工程师（owner / contributor / 身份混淆诱饵）+
#      一个公开测试项目，全部 active membership；
#   2. 用与目标部署一致的 SESSION_SECRET 铸造测试身份的 devportal session cookie
#      （lib/mint-devportal-session.mjs，与 lib/session.ts::signSession 同构 HS256）；
#      cookie 的 sub 用的是 github_login（认证身份），绝不是 handle（展示用自然键）——
#      owner 与 contributor 的 handle 与 github_login 刻意设成不同字符串，且诱饵工程师
#      的 handle 恰好等于 owner 的 github_login，membership 角色是 contributor：
#      这组数据专门用来堵住「用 handle 判定登录者」的身份混淆漏洞（PR #783 复审发现）——
#      若鉴权 join 键退回用 handle 匹配，owner 登录会被误配到诱饵记录，角色变成
#      contributor，下面的断言会因此变红。
#   3. GET /api/portal/workspace/<slug>/settings（真实 HTTP，非页面组件内部调用）：
#        contributor → 403，响应体不含任何治理数据
#        owner       → 200，响应体只含 {project, role}，role 必须是 owner（非 contributor）
#   4. 未登录（无 cookie）→ 401，且未知 slug 与已知私有 slug 的未登录响应码必须一致
#      （都是 401）——防止用 404 vs 401 差异匿名枚举私有项目是否存在。
#   5. 公开项目非成员 → 200，role 必须是 public-viewer（不得冒充 contributor）。
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
PUBLIC_SLUG="verify-authz-public-$TS"
# handle 与 github_login 刻意不同（回归测试核心）。
OWNER_HANDLE="verify-owner-handle-$TS"
OWNER_LOGIN="verify-owner-login-$TS"
CONTRIB_HANDLE="verify-contrib-handle-$TS"
CONTRIB_LOGIN="verify-contrib-login-$TS"
OUTSIDER_LOGIN="verify-outsider-login-$TS"
# 诱饵：handle 恰好等于 owner 的 github_login，github_login 却是完全不同的人。
DECOY_HANDLE="$OWNER_LOGIN"
DECOY_LOGIN="verify-decoy-login-$TS"
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

echo "== 0. 注册测试项目（私有 + 公开）"
dir_req 201 POST /projects "$COORD_ADMIN_TOKEN" "{\"slug\":\"$SLUG\",\"name\":\"verify-authz-$TS\",\"visibility\":\"private\"}"
PROJECT_ID="$(jq -r .project.project_id "$BODY")"
dir_req 201 POST /projects "$COORD_ADMIN_TOKEN" "{\"slug\":\"$PUBLIC_SLUG\",\"name\":\"verify-authz-public-$TS\",\"visibility\":\"public\"}"

echo "== 1. 注册测试工程师（owner / contributor / 身份混淆诱饵 / outsider），handle != github_login"
dir_req 201 POST /engineers "$COORD_ADMIN_TOKEN" "{\"handle\":\"$OWNER_HANDLE\",\"github_login\":\"$OWNER_LOGIN\"}"
dir_req 201 POST /engineers "$COORD_ADMIN_TOKEN" "{\"handle\":\"$CONTRIB_HANDLE\",\"github_login\":\"$CONTRIB_LOGIN\"}"
dir_req 201 POST /engineers "$COORD_ADMIN_TOKEN" "{\"handle\":\"$DECOY_HANDLE\",\"github_login\":\"$DECOY_LOGIN\"}"
dir_req 201 POST /engineers "$COORD_ADMIN_TOKEN" "{\"handle\":\"$OUTSIDER_LOGIN\",\"github_login\":\"$OUTSIDER_LOGIN\"}"

echo "== 2. 建 membership（pending）并 approve 成 active（owner/contributor/诱饵，诱饵只给 contributor）"
dir_req 201 POST /memberships "$COORD_ADMIN_TOKEN" "{\"project\":\"$SLUG\",\"engineer\":\"$OWNER_HANDLE\",\"role\":\"owner\"}"
OWNER_MEM_ID="$(jq -r .membership.membership_id "$BODY")"
dir_req 201 POST /memberships "$COORD_ADMIN_TOKEN" "{\"project\":\"$SLUG\",\"engineer\":\"$CONTRIB_HANDLE\",\"role\":\"contributor\"}"
CONTRIB_MEM_ID="$(jq -r .membership.membership_id "$BODY")"
dir_req 201 POST /memberships "$COORD_ADMIN_TOKEN" "{\"project\":\"$SLUG\",\"engineer\":\"$DECOY_HANDLE\",\"role\":\"contributor\"}"
DECOY_MEM_ID="$(jq -r .membership.membership_id "$BODY")"

dir_req 200 POST "/memberships/$OWNER_MEM_ID/transition" "$COORD_ADMIN_TOKEN" '{"action":"approve"}'
dir_req 200 POST "/memberships/$CONTRIB_MEM_ID/transition" "$COORD_ADMIN_TOKEN" '{"action":"approve"}'
dir_req 200 POST "/memberships/$DECOY_MEM_ID/transition" "$COORD_ADMIN_TOKEN" '{"action":"approve"}'

echo "== 3. 铸造测试身份的 devportal session cookie（sub = github_login，不是 handle）"
OWNER_JWT="$(node "$SCRIPT_DIR/lib/mint-devportal-session.mjs" "$OWNER_LOGIN" "$SESSION_SECRET")"
CONTRIB_JWT="$(node "$SCRIPT_DIR/lib/mint-devportal-session.mjs" "$CONTRIB_LOGIN" "$SESSION_SECRET")"
OUTSIDER_JWT="$(node "$SCRIPT_DIR/lib/mint-devportal-session.mjs" "$OUTSIDER_LOGIN" "$SESSION_SECRET")"

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

echo "== 5. owner 调同一接口 → 200，role 必须是 owner（身份混淆回归：不能被诱饵顶替成 contributor）"
api_get 200 "$OWNER_JWT" "/api/portal/workspace/$SLUG/settings"
jq -e ".project.slug == \"$SLUG\" and .role == \"owner\"" "$BODY" >/dev/null \
  || { echo "FAIL: owner 登录应解析出 role=owner——若拿到 contributor 说明 join 键退回用了 handle（身份混淆漏洞复现）" >&2; cat "$BODY" >&2; exit 1; }

echo "== 6. 未登录不能靠 404/401 差异枚举私有项目是否存在：已知私有 slug 与未知 slug 都是 401"
api_get 401 "" "/api/portal/workspace/$SLUG/access"
api_get 401 "" "/api/portal/workspace/unknown-project-$TS/access"

echo "== 7. 已登录访问未知 slug → 404"
api_get 404 "$OWNER_JWT" "/api/portal/workspace/unknown-project-$TS/access"

echo "== 8. 公开项目非成员 → 200，role 必须是 public-viewer（不冒充 contributor）"
api_get 200 "$OUTSIDER_JWT" "/api/portal/workspace/$PUBLIC_SLUG/access"
jq -e '.role == "public-viewer"' "$BODY" >/dev/null

echo "PASS: p30/F03 服务端角色裁剪 — contributor 403 / owner 200(role=owner，抗身份混淆) / 未登录 401(不枚举) / 未知项目 404 / 公开项目非成员 public-viewer，均为真实 HTTP 状态码与角色差异（非前端隐藏）"
