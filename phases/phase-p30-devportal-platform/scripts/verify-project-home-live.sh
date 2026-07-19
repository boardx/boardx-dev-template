#!/usr/bin/env bash
# verify-project-home-live.sh — p30/F21 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 对测试仓 merge 一个 PR -> <=60s 内火花线数据端点计数 +1（N2 新鲜度）
#   - SLA 兑现率字段与 F06 审批史一致性抽查
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F21): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
