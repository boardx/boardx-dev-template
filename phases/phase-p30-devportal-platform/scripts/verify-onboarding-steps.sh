#!/usr/bin/env bash
# verify-onboarding-steps.sh — p30/F14 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 新 pending->active 成员 -> 清单接口 5 步全 false
#   - 模拟 enroll + 认领 + merge 事件 -> 对应步翻 true（自动完成检测）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F14): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
