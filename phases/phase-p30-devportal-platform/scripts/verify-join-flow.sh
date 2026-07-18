#!/usr/bin/env bash
# verify-join-flow.sh — p30/F06 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - API 提交加入申请 -> 目录 DO 出现 pending Membership
#   - owner token 批准 -> active + 只增审计事件
#   - onboarding issue 在 GitHub 真实存在（gh api 断言，双写 N5）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F06): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
