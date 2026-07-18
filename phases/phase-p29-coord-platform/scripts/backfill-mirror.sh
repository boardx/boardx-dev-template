#!/usr/bin/env bash
# F04 镜像冷启动回填：用 gh api 拉 open issues/PRs → POST /mirror/upsert。
# webhook 只送增量；存量数据用本脚本一次性灌入（App token 自动回填随后续 feature）。
# 需要：COORD_API_TOKEN、gh 已登录；可选 COORD_GATEWAY_URL / REPO / LIMIT。
set -euo pipefail
BASE="${COORD_GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"
REPO="${REPO:-boardx/boardx-dev-template}"
LIMIT="${LIMIT:-50}"
: "${COORD_API_TOKEN:?需要 env COORD_API_TOKEN}"

upsert() { # stdin: {kind, data} JSON
  curl -s -o /dev/null -w '%{http_code}' -m 30 \
    -X POST "$BASE/api/coord/repos/$REPO/mirror/upsert" \
    -H "authorization: Bearer $COORD_API_TOKEN" -H 'content-type: application/json' -d @-
}

echo "==> 回填 open issues（≤$LIMIT）"
gh api "repos/$REPO/issues?state=open&per_page=$LIMIT" --paginate=false \
  --jq '.[] | select(.pull_request == null) | {kind:"issue", data:{number:.number, state:.state, title:.title, labels:[.labels[].name], assignees:[.assignees[].login]}}' |
while IFS= read -r line; do
  code="$(printf '%s' "$line" | upsert)"
  [ "$code" = "200" ] || { echo "✗ issue upsert 失败 ($code): $line"; exit 1; }
done

echo "==> 回填 open PRs（≤$LIMIT，逐个取 mergeable）"
for n in $(gh api "repos/$REPO/pulls?state=open&per_page=$LIMIT" --jq '.[].number'); do
  gh api "repos/$REPO/pulls/$n" --jq '{kind:"pr", data:{number:.number, state:(if .merged then "merged" else .state end), title:.title, head_sha:.head.sha, mergeable:(if .mergeable == true then "MERGEABLE" elif .mergeable == false then "CONFLICTING" else "UNKNOWN" end), merge_state:(.mergeable_state | ascii_upcase), labels:[.labels[].name], assignees:[.assignees[].login], draft:.draft}}' |
    { code="$(upsert)"; [ "$code" = "200" ] || { echo "✗ pr#$n upsert 失败 ($code)"; exit 1; }; }
done
echo "✓ 回填完成"
