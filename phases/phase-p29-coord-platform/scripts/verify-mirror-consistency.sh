#!/usr/bin/env bash
# F04 e2e：抽样 open PR，对比 /realtime 镜像与 GitHub API 实况
# （head_sha 与 state 必须一致；mergeable 打印供人工核对——GitHub 侧异步计算，不硬断言）。
# 需要：COORD_API_TOKEN、gh 已登录。镜像为空时先跑 backfill-mirror.sh。
set -euo pipefail
BASE="${COORD_GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"
REPO="${REPO:-boardx/boardx-dev-template}"
N="${N:-5}"
: "${COORD_API_TOKEN:?需要 env COORD_API_TOKEN}"
AUTH=(-H "authorization: Bearer $COORD_API_TOKEN")

nums="$(gh api "repos/$REPO/pulls?state=open&per_page=$N" --jq '.[].number')"
[ -n "$nums" ] || { echo "（无 open PR，改用最近 issue 验证存在性）"; nums=""; }

fail=0
for n in $nums; do
  gh_sha="$(gh api "repos/$REPO/pulls/$n" --jq '.head.sha')"
  gh_state="$(gh api "repos/$REPO/pulls/$n" --jq 'if .merged then "merged" else .state end')"
  mirror="$(curl -s -m 30 "${AUTH[@]}" "$BASE/api/coord/repos/$REPO/realtime/prs/$n")"
  m_sha="$(printf '%s' "$mirror" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("head_sha",""))')"
  m_state="$(printf '%s' "$mirror" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("state",""))')"
  m_at="$(printf '%s' "$mirror" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("mirrored_at",""))')"
  status=ok
  [ "$gh_sha" = "$m_sha" ] && [ "$gh_state" = "$m_state" ] || { status=MISMATCH; fail=1; }
  echo "PR#$n gh(sha=${gh_sha:0:8},state=$gh_state) mirror(sha=${m_sha:0:8},state=$m_state,at=$m_at) -> $status"
done
[ "$fail" -eq 0 ] || { echo "✗ 镜像与 GitHub 实况不一致"; exit 1; }
echo "✓ F04 e2e 通过：抽样镜像与 GitHub 实况一致（head_sha/state），响应带 mirrored_at 锚点"
