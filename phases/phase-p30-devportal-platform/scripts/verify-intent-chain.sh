#!/usr/bin/env bash
# verify-intent-chain.sh — p30/F09 端到端验证（打活体 coord-gateway + 真 GitHub issue）
#
# 断言（见 feature_list.json 对应 verification 与 docs/coord-platform/protocol/intents.md）：
#   1) 上行链：注入 intent.blocker → intent.escalate → GET /intents 断言
#      thread_status 翻「等待拍板」(awaiting_decision)。
#   2) 下行链：以 COORD_ADMIN_TOKEN 回写 intent.decide → 断言 thread_status 翻
#      「已闭环」(closed)；随后广播 intent.assign（人拍板后 coord 继续派工）→
#      断言该 assign 事件出现在链上，且已闭环状态不被拉回。
#   3) GitHub 双写：poll gh api 断言 issue 下出现对应的结构化评论（intent.blocker/
#      intent.escalate/intent.decide/intent.assign 四个标记均可见）。
#
# 前置：
#   - env：COORD_API_TOKEN（scoped/ops，发 blocker/escalate/assign）、
#     COORD_ADMIN_TOKEN（发 decide，与 andon 同级门禁）；gh CLI 已登录且对 $REPO
#     有读权限
#   - gateway 已配置 GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY（同 F06 反向投影，
#     见 verify-projection-e2e.sh 同一前置）
#   - cron 投影 tick 为 */2，轮询窗口按 3 个 tick 预留（同 F06 e2e 口径）
# 用法：GATEWAY_URL=https://coord-gateway.<acct>.workers.dev [REPO=owner/name] \
#       ISSUE=<真实 issue 号，用作意图线程锚点> bash verify-intent-chain.sh
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

GATEWAY_URL="${GATEWAY_URL:?需要 GATEWAY_URL（coord-gateway workers.dev 地址）}"
REPO="${REPO:-boardx/boardx-dev-template}"
ISSUE="${ISSUE:?需要 ISSUE（真实 issue 号，用作本次 e2e 的意图线程锚点）}"
: "${COORD_API_TOKEN:?需要 COORD_API_TOKEN}"
: "${COORD_ADMIN_TOKEN:?需要 COORD_ADMIN_TOKEN}"

API="$GATEWAY_URL/api/coord/repos/$REPO"
RESOURCE="issue:$ISSUE"
AGENT="e2e-intent-$$"
POLL_MAX=24   # 24 × 15s = 6min ≈ 3 个 cron tick（同 F06 e2e 口径）
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

thread_status() {
  curl -fsS "$API/intents?resource_id=$RESOURCE" \
    -H "authorization: Bearer $COORD_API_TOKEN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["thread_status"])'
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

# ---------- 1) 上行链：blocker → escalate → awaiting_decision ----------
log "注入 intent.blocker @ $RESOURCE"
api POST /intents "{\"type\":\"intent.blocker\",\"resource_id\":\"$RESOURCE\",\"agent_id\":\"$AGENT\",\"payload\":{\"reason\":\"e2e 演练：依赖服务不可用，阻塞验证（issue #$ISSUE）\"}}" >/dev/null

log "注入 intent.escalate @ $RESOURCE"
api POST /intents "{\"type\":\"intent.escalate\",\"resource_id\":\"$RESOURCE\",\"agent_id\":\"module-coord-$$\",\"payload\":{\"reason\":\"e2e 演练：需要人类确认降级方案（issue #$ISSUE）\",\"escalated_to\":\"usam\"}}" >/dev/null

check_awaiting_decision() { [ "$(thread_status)" = "awaiting_decision" ]; }
poll "thread_status=awaiting_decision（上行链：blocker→escalate）" check_awaiting_decision

# ---------- 2) 下行链：decide（admin 面）→ closed；随后 assign 广播不拉回 ----------
log "回写 intent.decide（COORD_ADMIN_TOKEN）"
api POST /intents "{\"type\":\"intent.decide\",\"resource_id\":\"$RESOURCE\",\"agent_id\":\"usam\",\"payload\":{\"reason\":\"e2e 演练：按降级方案 A 拍板通过\",\"issue_ref\":\"#$ISSUE\",\"decision\":\"approved\"}}" "$COORD_ADMIN_TOKEN" >/dev/null

check_closed() { [ "$(thread_status)" = "closed" ]; }
poll "thread_status=closed（下行链：人拍板闭环）" check_closed

log "广播 intent.assign（拍板后 coord 继续派工）"
api POST /intents "{\"type\":\"intent.assign\",\"resource_id\":\"$RESOURCE\",\"agent_id\":\"coord-main\",\"payload\":{\"target_agent_id\":\"wrk-e2e-continue\",\"target_resource_id\":\"$RESOURCE\",\"note\":\"按拍板结果继续（e2e 演练）\"}}" >/dev/null

check_assign_present_and_still_closed() {
  local chain
  chain="$(curl -fsS "$API/intents?resource_id=$RESOURCE" -H "authorization: Bearer $COORD_API_TOKEN")"
  printf '%s' "$chain" | python3 -c '
import json, sys
d = json.load(sys.stdin)
types = [e["type"] for e in d["events"]]
ok = "intent.assign" in types and d["thread_status"] == "closed"
sys.exit(0 if ok else 1)
'
}
poll "intent.assign 出现在链上且已闭环不被拉回" check_assign_present_and_still_closed

# ---------- 3) GitHub 双写：gh api 断言四类评论均出现 ----------
check_github_comments() {
  gh api "repos/$REPO/issues/$ISSUE/comments" --paginate \
    --jq '[.[].body] | join("\n")' 2>/dev/null > /tmp/intent-comments-$$.txt || return 1
  local ok=1
  for marker in "intent.blocker" "intent.escalate" "intent.decide" "intent.assign"; do
    grep -q -- "$marker" /tmp/intent-comments-$$.txt || ok=0
  done
  rm -f /tmp/intent-comments-$$.txt
  [ "$ok" -eq 1 ]
}
poll "GitHub issue #$ISSUE 出现四类意图消息的双写评论" check_github_comments

log "PASS: 上行链 blocker→escalate→awaiting_decision、下行链 decide→closed（assign 广播不拉回）、GitHub 双写全链路可见"
