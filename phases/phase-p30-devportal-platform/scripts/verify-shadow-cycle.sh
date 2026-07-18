#!/usr/bin/env bash
# verify-shadow-cycle.sh — p30/F10 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - coord.shadow.* 事件数 > 0 且时间跨度 >= 24h 且覆盖 >= 1 个完整 C-cycle（G5 已拍板：取长者）
#   - 每条影子决策带 rule-id 与输入快照
#   - 对照台账 evidence/R1-shadow-audit.md 存在且「误判」计数字段为 0（人类核对后落台账，不允许自评）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F10): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
