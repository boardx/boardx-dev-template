#!/usr/bin/env bash
# verify-req-pipeline.sh — p30/F18 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - API 提交需求 -> 轮询节点状态依次推进到「人工审核」
#   - 审核通过 -> gh api 断言 issue 真实创建且进当前 sprint
#   - 提交超容量需求 -> 下发被阻塞并有提示事件（边界④）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F18): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
