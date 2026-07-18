#!/usr/bin/env bash
# verify-notify-ranking.sh — p30/F16 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 同时注入巡检+拍板两类通知 -> 红点计数接口只计拍板（最高级）
#   - 巡检项 folded=true（默认折叠）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F16): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
