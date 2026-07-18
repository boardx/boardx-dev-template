#!/usr/bin/env bash
# verify-explore-live.sh — p30/F20 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 接入第二个租户（G6：agentic-harness-template）-> /explore 数据接口出现两卡
#   - 计数/活跃度字段来自聚合器非常量
#   - 无鉴权 header 也 200（公开层免登录 D3）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F20): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
