#!/usr/bin/env bash
# verify-portal-live.sh — p29/F09 活体验证：门户数据链路秒级跟随 GitHub 变更。
#
# 链路：gh 改测试 issue 的 label → GitHub webhook → gateway Queues → RepoHub 镜像
#      → (a) REST /realtime/issues 反映变更  (b) WS /stream 广播 mirror.updated。
# 门户页面的数据接口就是这条链路（devportal 只是 Access 门禁后的代理/订阅端），
# 因此镜像接口在 N 秒内反映变更 = 门户数据源实时性成立。
#
# 依赖：gh（已登录，对 $REPO 有写权限）、curl、python3。
# 环境：COORD_API_TOKEN（必填）；COORD_GATEWAY_URL / COORD_REPO / TEST_ISSUE /
#      DEADLINE_SECONDS 可覆盖默认值。
set -euo pipefail

: "${COORD_API_TOKEN:?需要 COORD_API_TOKEN（gateway REST bearer）}"
GATEWAY_URL="${COORD_GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"
REPO="${COORD_REPO:-boardx/boardx-dev-template}"
TEST_ISSUE="${TEST_ISSUE:-}"
DEADLINE_SECONDS="${DEADLINE_SECONDS:-60}"

api="$GATEWAY_URL/api/coord/repos/$REPO"
auth=(-H "authorization: Bearer $COORD_API_TOKEN")

fail() { echo "FAIL: $*" >&2; exit 1; }

# 0) gateway 活着且已接线
curl -fsS "$GATEWAY_URL/api/coord/healthz" | grep -q '"ok":true' \
  || fail "gateway healthz 不可达或未配置（$GATEWAY_URL）"

# 1) 选测试 issue：未指定则取仓里最新的 open issue
if [ -z "$TEST_ISSUE" ]; then
  TEST_ISSUE=$(gh issue list --repo "$REPO" --state open --limit 1 --json number --jq '.[0].number // empty')
  [ -n "$TEST_ISSUE" ] || fail "仓库没有 open issue 可用作探针（可用 TEST_ISSUE=<n> 指定）"
fi

probe_label="live-probe-$(date +%s)"
echo "== 活体探针：issue #$TEST_ISSUE 加 label '$probe_label'（$REPO）"
gh label create "$probe_label" --repo "$REPO" --color BFDADC \
  --description "F09 portal-live 探针（脚本自动清理）" >/dev/null
cleanup() {
  gh issue edit "$TEST_ISSUE" --repo "$REPO" --remove-label "$probe_label" >/dev/null 2>&1 || true
  gh label delete "$probe_label" --repo "$REPO" --yes >/dev/null 2>&1 || true
}
trap cleanup EXIT

# 2) 记录当前事件游标（之后只看新事件）
since=$(curl -fsS "${auth[@]}" "$api/events?limit=500" \
  | python3 -c 'import json,sys; ev=json.load(sys.stdin)["events"]; print(ev[-1]["event_id"] if ev else "")')

gh issue edit "$TEST_ISSUE" --repo "$REPO" --add-label "$probe_label" >/dev/null
t0=$SECONDS

# 3) 断言 a：REST 镜像在 deadline 内出现新 label
until curl -fsS "${auth[@]}" "$api/realtime/issues" | grep -q "$probe_label"; do
  [ $((SECONDS - t0)) -ge "$DEADLINE_SECONDS" ] \
    && fail "${DEADLINE_SECONDS}s 内 /realtime/issues 未反映 label 变更（webhook→镜像链路断）"
  sleep 2
done
lat=$((SECONDS - t0))
echo "PASS: /realtime/issues 在 ${lat}s 内反映 label 变更"

# 4) 断言 b：事件流出现对应 mirror.updated（WS 广播与 events 表同源同信封）
qs="limit=500"; [ -n "$since" ] && qs="since=$since&$qs"
curl -fsS "${auth[@]}" "$api/events?$qs" \
  | python3 -c '
import json, sys
issue = sys.argv[1]
evs = json.load(sys.stdin)["events"]
hits = [e for e in evs if e["type"] == "mirror.updated" and e["resource_id"] == f"issue:{issue}"]
assert hits, f"事件流缺 mirror.updated issue:{issue}（WS 订阅端不会收到推送）"
print(f"PASS: mirror.updated issue:{issue} 已入事件流（WS 广播同源），event_id={hits[-1]['event_id']}")
' "$TEST_ISSUE"

echo "== F09 活体验证通过：改 label → ${lat}s 内 镜像接口 + 事件流（WS 源）双双反映变更"
