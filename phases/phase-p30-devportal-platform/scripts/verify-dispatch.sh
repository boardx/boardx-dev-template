#!/usr/bin/env bash
# verify-dispatch.sh — p30/F12 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 造 ready-for-dev issue -> tasks 出现在目标 agent 收件箱 + 租约建立
#   - 并发两个认领请求 -> 201/409 恰好各一（原子租约）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F12): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
