#!/usr/bin/env bash
# F06 反向投影 e2e（打活体）：
#   1) 经 gateway 建测试 claim → 轮询 gh api 断言关联 PR 出现 coord/lease check；
#   2) 经 admin 路由 raise andon → 断言 open PR 的 coord/andon status 变 failure；
#   3) clear andon → 断言恢复 success。
# 前置（secrets 激活后才能真跑）：
#   - env：COORD_API_TOKEN、COORD_ADMIN_TOKEN；gh CLI 已登录且对 $REPO 有读权限
#   - gateway 已配置 GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY（App 私钥须为 PKCS#8：
#     GitHub 下载的是 PKCS#1，需 openssl pkcs8 -topk8 -nocrypt 转换后再 secret put）
#   - cron 投影 tick 为 */2，轮询窗口按 3 个 tick 预留
# 用法：GATEWAY_URL=https://coord-gateway.<acct>.workers.dev [REPO=owner/name] \
#       [ISSUE=<有关联 open PR 的 issue 号>] bash verify-projection-e2e.sh
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:?需要 GATEWAY_URL（coord-gateway workers.dev 地址）}"
REPO="${REPO:-boardx/boardx-dev-template}"
ISSUE="${ISSUE:?需要 ISSUE（一个有关联 open PR 的 issue 号，PR title/body 须含 #号）}"
: "${COORD_API_TOKEN:?需要 COORD_API_TOKEN}"
: "${COORD_ADMIN_TOKEN:?需要 COORD_ADMIN_TOKEN}"

API="$GATEWAY_URL/api/coord/repos/$REPO"
AGENT="e2e-projection-$$"
POLL_MAX=24   # 24 × 15s = 6min ≈ 3 个 cron tick
POLL_INTERVAL=15

log() { printf '[e2e] %s\n' "$*"; }
fail() { printf '[e2e] FAIL: %s\n' "$*" >&2; exit 1; }

api() { # method path [json-body] [token]
  local method="$1" path="$2" body="${3:-}" token="${4:-$COORD_API_TOKEN}"
  curl -fsS -X "$method" "$API$path" \
    -H "authorization: Bearer $token" \
    -H "content-type: application/json" \
    ${body:+-d "$body"}
}

# 关联 PR 的 head sha：取第一个 title/body 含 #ISSUE 的 open PR
pr_head_sha() {
  gh pr list --repo "$REPO" --state open \
    --json number,title,body,headRefOid \
    --jq "[.[] | select((.title + \" \" + (.body // \"\")) | test(\"#${ISSUE}([^0-9]|\$)\"))][0].headRefOid"
}

poll() { # desc check-fn
  local desc="$1" fn="$2" i
  for i in $(seq 1 "$POLL_MAX"); do
    if "$fn"; then log "OK: $desc"; return 0; fi
    log "等待 $desc（$i/$POLL_MAX）..."
    sleep "$POLL_INTERVAL"
  done
  fail "$desc 超时（${POLL_MAX}x${POLL_INTERVAL}s）"
}

HEAD_SHA="$(pr_head_sha)"
[ -n "$HEAD_SHA" ] && [ "$HEAD_SHA" != "null" ] || fail "issue #$ISSUE 没有关联 open PR（title/body 须含 #$ISSUE）"
log "目标 PR head_sha=$HEAD_SHA"

# ---------- 1) claim → coord/lease check ----------
log "建测试 claim：issue:$ISSUE by $AGENT"
CLAIM="$(api POST /claims "{\"protocol\":\"coord/0.1\",\"resource_id\":\"issue:$ISSUE\",\"resource_type\":\"issue\",\"agent_id\":\"$AGENT\",\"ttl_seconds\":3600}")"
LEASE_ID="$(printf '%s' "$CLAIM" | python3 -c 'import json,sys; print(json.load(sys.stdin)["lease_id"])')"
log "lease_id=$LEASE_ID"

check_lease_run() {
  gh api "repos/$REPO/commits/$HEAD_SHA/check-runs" \
    --jq '[.check_runs[] | select(.name=="coord/lease")] | length > 0' 2>/dev/null | grep -q true
}
poll "coord/lease check 出现在 $HEAD_SHA" check_lease_run

# ---------- 2) andon raise → coord/andon failure ----------
log "raise andon（stop-merge）"
api POST /andon "{\"action\":\"raise\",\"agent_id\":\"$AGENT\",\"severity\":\"stop-merge\",\"scope\":\"repo\",\"reason\":\"e2e 投影验证停线演练（F06，自动清除）\"}" "$COORD_ADMIN_TOKEN" >/dev/null

andon_status_is() { # failure|success
  gh api "repos/$REPO/commits/$HEAD_SHA/status" \
    --jq "[.statuses[] | select(.context==\"coord/andon\")][0].state" 2>/dev/null | grep -qx "$1"
}
check_andon_failure() { andon_status_is failure; }
poll "coord/andon status=failure" check_andon_failure

# ---------- 3) andon clear → coord/andon success ----------
log "clear andon"
api POST /andon "{\"action\":\"clear\",\"agent_id\":\"$AGENT\",\"scope\":\"repo\",\"reason\":\"e2e 演练结束，解除停线（F06）\"}" "$COORD_ADMIN_TOKEN" >/dev/null

check_andon_success() { andon_status_is success; }
poll "coord/andon status=success" check_andon_success

# ---------- 收尾：释放测试租约（handoff 纪律） ----------
api POST "/claims/$LEASE_ID/release" "{\"protocol\":\"coord/0.1\",\"agent_id\":\"$AGENT\",\"handoff_note\":\"e2e 投影验证完成，测试租约释放\"}" >/dev/null
log "PASS: lease→check、andon→failure→success 全链路投影可见"
