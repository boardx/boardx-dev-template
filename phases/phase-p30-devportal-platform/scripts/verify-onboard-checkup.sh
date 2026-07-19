#!/usr/bin/env bash
# verify-onboard-checkup.sh — p30/F05 端到端验证（打活体 coord-gateway）。
#
# 断言范围（安装即注册这一段可以不依赖真实 GitHub App 账号做端到端验证——签一条
# 真实结构的 installation_repositories webhook 直接投递给部署的 gateway，走的是
# 真实签名校验 + 真实路由 + 真实目录 DO 写入，唯独安装动作本身是合成的）：
#   1. 签名合法的 installation_repositories(added) webhook → 202，registered=true，
#      project 出现在目录 DO（GET /api/coord/directory/projects 能查到该 slug）
#   2. 同一仓重复投递（幂等）→ 202，registered=false（已在册，不是失败）
#   3. /api/coord/onboard/installations/:id 与 /api/coord/onboard/checkup 无 token → 401
#      （fail-closed 门禁真实生效）
#
# 不在本脚本覆盖范围（需要真实 GitHub App 安装在真实可控仓库上，人工前置步骤）：
#   repo 列表 + collaborator permission 判定 admin、CODEOWNERS/CONTRIBUTING 与分支保护
#   两项体检——这些的真实交互逻辑由 apps/coord-gateway/test/onboard.test.ts（注入
#   fetch mock，覆盖 GitHub API 请求/响应结构）与 devportal e2e/p30/onboard.spec.ts
#   （route-mock 网络边界，UI 与 devportal 路由绑定全部真实运行）覆盖。真实仓库端到端
#   soak 依赖 G6 已拍板的租户 #2（agentic-harness-template 仓，其 GitHub App 安装是
#   前置人工步骤），届时补一段针对该仓的 checkup 真实断言。
#
# 需要环境变量：
#   COORD_API_TOKEN        目录读面 + onboard 面（ops token）
#   GITHUB_WEBHOOK_SECRET  签名合成 webhook（与部署的 gateway 配置一致才能通过签名校验）
#   GATEWAY_URL            可选，默认 https://coord-gateway.boardx.workers.dev
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"

if [[ -z "${COORD_API_TOKEN:-}" || -z "${GITHUB_WEBHOOK_SECRET:-}" ]]; then
  echo "FAIL: 需要 COORD_API_TOKEN 与 GITHUB_WEBHOOK_SECRET（活体验证凭据）" >&2
  exit 1
fi
command -v jq >/dev/null || { echo "FAIL: 需要 jq" >&2; exit 1; }
command -v openssl >/dev/null || { echo "FAIL: 需要 openssl（HMAC 签名）" >&2; exit 1; }

TS="$(date +%s)"
REPO_NAME="verify-onboard-$TS"
FULL_NAME="verify-org/$REPO_NAME"
SLUG="verify-onboard-$TS" # deriveSlug(repo_name) 对纯小写数字连字符名是恒等映射
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

sign() {
  # sha256= 前缀的 HMAC-SHA256 十六进制签名（同 apps/coord-gateway/src/signature.ts）
  printf '%s' "$1" | openssl dgst -sha256 -hmac "$GITHUB_WEBHOOK_SECRET" | sed 's/^.* //' | sed 's/^/sha256=/'
}

post_webhook() {
  local body="$1" delivery="$2"
  local sig
  sig="$(sign "$body")"
  curl -sS -o "$BODY_FILE" -w '%{http_code}' -X POST \
    -H "content-type: application/json" \
    -H "x-hub-signature-256: $sig" \
    -H "x-github-delivery: $delivery" \
    -H "x-github-event: installation_repositories" \
    -d "$body" \
    "$GATEWAY_URL/api/coord/webhooks/github"
}

PAYLOAD=$(jq -n --arg full "$FULL_NAME" --arg name "$REPO_NAME" '{
  action: "added",
  installation: {id: 999999001, account: {login: "verify-org", type: "Organization"}},
  repositories_added: [{full_name: $full, name: $name, private: false}]
}')

echo "== 1. installation_repositories(added) webhook → 202，registered=true"
status="$(post_webhook "$PAYLOAD" "verify-dlv-$TS-1")"
if [[ "$status" != "202" ]]; then
  echo "FAIL: webhook 期望 202，实际 $status" >&2
  cat "$BODY_FILE" >&2
  exit 1
fi
jq -e --arg slug "$SLUG" '.registered[0].slug == $slug and .registered[0].registered == true' "$BODY_FILE" >/dev/null \
  || { echo "FAIL: 首次投递期望 registered=[{slug:$SLUG, registered:true}]" >&2; cat "$BODY_FILE" >&2; exit 1; }

echo "== 2. 目录 DO 能查到该项目（安装即租户）"
curl -sS -o "$BODY_FILE" -w '%{http_code}\n' \
  -H "Authorization: Bearer $COORD_API_TOKEN" \
  "$GATEWAY_URL/api/coord/directory/projects" | { read -r code; [[ "$code" == "200" ]] || { echo "FAIL: 目录读面期望 200，实际 $code" >&2; exit 1; }; }
jq -e --arg slug "$SLUG" '.projects | map(.slug) | index($slug) != null' "$BODY_FILE" >/dev/null \
  || { echo "FAIL: 目录 DO 中未找到项目 slug=$SLUG" >&2; cat "$BODY_FILE" >&2; exit 1; }

echo "== 3. 重复投递同一仓（幂等）→ 202，registered=false"
status="$(post_webhook "$PAYLOAD" "verify-dlv-$TS-2")"
[[ "$status" == "202" ]] || { echo "FAIL: 重复投递期望 202，实际 $status" >&2; cat "$BODY_FILE" >&2; exit 1; }
jq -e '.registered[0].registered == false' "$BODY_FILE" >/dev/null \
  || { echo "FAIL: 重复投递期望 registered=false（已在册，非失败）" >&2; cat "$BODY_FILE" >&2; exit 1; }

echo "== 4. onboard 面无 token → 401（fail-closed 门禁真实生效）"
status="$(curl -sS -o "$BODY_FILE" -w '%{http_code}' "$GATEWAY_URL/api/coord/onboard/installations/1")"
[[ "$status" == "401" ]] || { echo "FAIL: 无 token 期望 401，实际 $status" >&2; cat "$BODY_FILE" >&2; exit 1; }
status="$(curl -sS -o "$BODY_FILE" -w '%{http_code}' "$GATEWAY_URL/api/coord/onboard/checkup?installation_id=1&owner=a&repo=b")"
[[ "$status" == "401" ]] || { echo "FAIL: 无 token 期望 401，实际 $status" >&2; cat "$BODY_FILE" >&2; exit 1; }

echo "PASS: 安装即注册 + 门禁真实生效（repo 列表/collaborator permission/CODEOWNERS·分支保护体检由单测 + e2e 覆盖，见脚本头部注释）"
