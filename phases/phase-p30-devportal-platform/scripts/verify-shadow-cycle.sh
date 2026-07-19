#!/usr/bin/env bash
# verify-shadow-cycle.sh — p30/F10 端到端验证：R1 CoordBrain 影子模式。
#
# 断言（见 feature_list.json F10 notes，G5 已拍板周期参数）：
#   1. coord.shadow.* 事件数 > 0（GET /shadow-decisions 有数据、结构含 rule/subject_id/
#      decision/reason，每条决策带 rule-id 与输入快照）。
#   2. GET /shadow-cycle-status 报告的事件流时间跨度（first_at → last_at）与阈值
#      比较：阈值 = max(24h, CYCLE_HOURS=3h)（G5：取长者，当前恒为 24h，公式写成
#      通用形式以防 CYCLE_HOURS 未来变化）。跨度未达标只是"尚未跑满周期"的合法中间
#      态——本脚本诚实报告"未满足/已满足"，不因为未满足就静默通过（宁可显式红）。
#   3. evidence/R1-shadow-audit.md 模板存在（人类核对记录格式；审计数据本身要等
#      真实运行满周期后由人类填写，PR 阶段只提供模板，不提供假数据）。
#
# 用法：
#   COORD_API_TOKEN=... bash verify-shadow-cycle.sh                 # 判定当前状态（可能红，见上）
#   COORD_API_TOKEN=... CHECK_SPAN_ONLY=1 bash verify-shadow-cycle.sh  # 只查跨度不要求达标（CI 用）
set -euo pipefail

BASE="${COORD_GATEWAY_URL:-https://coord-gateway.boardx.workers.dev}"
REPO="${REPO:-boardx/boardx-dev-template}"
CYCLE_HOURS="${CYCLE_HOURS:-3}"          # 与 apps/coord-gateway/src/cycle.ts CYCLE_HOURS 保持同源
: "${COORD_API_TOKEN:?需要 env COORD_API_TOKEN}"
AUTH=(-H "authorization: Bearer $COORD_API_TOKEN")
REPO_URL="$BASE/api/coord/repos/$REPO"

echo "== 1. GET /shadow-decisions 结构断言 =="
decisions_json="$(curl -sf -m 30 "${AUTH[@]}" "$REPO_URL/shadow-decisions?limit=1000")"
count="$(printf '%s' "$decisions_json" | python3 -c '
import json, sys
d = json.load(sys.stdin)
items = d.get("decisions")
assert isinstance(items, list), "decisions 必须是数组"
for it in items:
    for k in ("rule", "subject_id", "decision", "reason", "at"):
        assert k in it, f"决策缺字段 {k}: {it}"
print(len(items))
')"
if [ "$count" -eq 0 ]; then
  echo "✗ coord.shadow.* 事件数为 0——CoordBrain cron tick 尚未产出任何影子决策。" >&2
  echo "  （合法中间态：部署后需等 cron 至少跑过一次 tick；本仓当前无 open PR/issue 时" >&2
  echo "   决策集合也可能持续为空——检查 GET $REPO_URL/shadow-cycle-status 确认 tick 是否在跑）" >&2
  exit 1
fi
echo "✓ 事件数=$count，字段结构（rule/subject_id/decision/reason/at）齐全"

echo "== 2. GET /shadow-cycle-status 跨度断言 =="
status_json="$(curl -sf -m 30 "${AUTH[@]}" "$REPO_URL/shadow-cycle-status")"
python3 - "$status_json" "$CYCLE_HOURS" "${CHECK_SPAN_ONLY:-0}" <<'PYEOF'
import json, sys

body = json.loads(sys.argv[1])
cycle_hours = float(sys.argv[2])
check_span_only = sys.argv[3] == "1"

event_count = body.get("event_count", 0)
first_at = body.get("first_at")
last_at = body.get("last_at")
span_ms = body.get("span_ms", 0)

print(f"事件计数={event_count} first_at={first_at} last_at={last_at} span_ms={span_ms}")

threshold_ms = max(24 * 3600 * 1000, cycle_hours * 3600 * 1000)  # G5：取长者
span_h = span_ms / 3600_000
threshold_h = threshold_ms / 3600_000

if span_ms >= threshold_ms:
    print(f"✓ 已满足：影子事件流跨度 {span_h:.2f}h >= 门槛 {threshold_h:.2f}h（24h 与 {cycle_hours} 个 C-cycle 取长者）")
else:
    msg = f"尚未满足：影子事件流跨度 {span_h:.2f}h < 门槛 {threshold_h:.2f}h"
    print(("△ " if check_span_only else "✗ ") + msg)
    if not check_span_only:
        sys.exit(1)
PYEOF

echo "== 3. evidence/R1-shadow-audit.md 模板存在性 =="
EVIDENCE_FILE="$(dirname "$0")/../evidence/R1-shadow-audit.md"
if [ ! -f "$EVIDENCE_FILE" ]; then
  echo "✗ 缺 $EVIDENCE_FILE（人类核对台账模板）" >&2
  exit 1
fi
grep -q "误判" "$EVIDENCE_FILE" || { echo "✗ 模板缺少「误判」计数字段"; exit 1; }
echo "✓ evidence/R1-shadow-audit.md 模板存在，含「误判」字段"

echo "✓ p30/F10 verify-shadow-cycle 断言通过（CHECK_SPAN_ONLY=${CHECK_SPAN_ONLY:-0}）"
