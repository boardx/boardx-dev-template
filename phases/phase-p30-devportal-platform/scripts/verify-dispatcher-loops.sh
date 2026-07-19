#!/usr/bin/env bash
# verify-dispatcher-loops.sh — p30/F15 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - loops 状态接口：五个 loop 各有 last_run 且间隔符合周期（1m/5m/15m/1h/24h）
#   - 制造一个 stale 租约 -> 15m loop（测试模式加速 tick）产出回收草案进待拍板而非直接回收（永不直接改项目内状态）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F15): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
