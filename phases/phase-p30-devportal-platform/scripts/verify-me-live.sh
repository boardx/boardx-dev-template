#!/usr/bin/env bash
# verify-me-live.sh — p30/F08 端到端验证（活体，非骨架）。
#
# 断言意图（feature_list.json F08 verification 的第二条）：
#   - 注入一条 decide 请求 + 制造一个 agent 心跳超时 -> /me 数据接口 N 秒内反映
#   - 待拍板列排序按 SLA
#
# 做法：
#   1) /me 未登录门禁回归（301/302/401，D4 落点前提）——curl 生产域，零凭据即可测。
#   2) 对活体 coord-gateway 派发两条真实 task.dispatched 事件（不同紧急度），拉回
#      /events，喂给 devportal 服务端实际使用的 lib/p30-decisions.ts（verify-me-live-check.ts），
#      断言：新鲜度（刚派发的任务确实出现在事件流里）+ SLA 排序（越紧急排越前）。
#      这是 F09（decide 协议）落地前能验证到的最接近真实的契约——用的是真实事件流
#      和 devportal 生产代码同一份适配层，不是测试夹具/mock。
#
# 需要环境变量（活体验证凭据，同 verify-directory-invariants.sh 的纪律）：
#   GITHUB_REPO               目标仓（owner/repo）
#   COORD_API_TOKEN           coord-gateway 读面
#   COORD_GATEWAY_ADMIN_TOKEN coord-gateway 写面（派发任务）
#   GATEWAY_URL               可选，默认 https://coord-gateway.boardx.workers.dev
#   DEVPORTAL_BASE_URL        可选，默认 https://develop.boardx.us
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

DEVPORTAL_BASE_URL="${DEVPORTAL_BASE_URL:-https://develop.boardx.us}"

echo "== 0. /me 未登录门禁回归（D4 前提：无会话必须被拦，落点不成立就无意义）"
STATUS="$(curl -s -o /dev/null -w '%{http_code}' "$DEVPORTAL_BASE_URL/me" || true)"
case "$STATUS" in
  301|302|401) echo "OK: /me 未登录 → $STATUS" ;;
  *) echo "FAIL: /me 未登录期望 301|302|401，实际 $STATUS（生产域可能不可达，检查网络）" >&2; exit 1 ;;
esac

if [[ -z "${GITHUB_REPO:-}" || -z "${COORD_API_TOKEN:-}" || -z "${COORD_GATEWAY_ADMIN_TOKEN:-}" ]]; then
  echo "FAIL: 需要 GITHUB_REPO / COORD_API_TOKEN / COORD_GATEWAY_ADMIN_TOKEN（活体验证凭据，验证「待拍板」新鲜度+排序）" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "== 1-3. 真实事件流 → lib/p30-decisions.ts 推导 → 新鲜度 + SLA 排序断言"
pnpm --filter devportal exec tsx "$SCRIPT_DIR/verify-me-live-check.ts"

echo "OK: p30/F08 /me 活体验证通过。"
