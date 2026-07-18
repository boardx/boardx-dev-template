#!/usr/bin/env bash
# verify-enroll-heartbeat.sh — p30/F07 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - API enroll -> 拿一次性 token 打一次真实心跳 -> fleet 接口该 agent 状态由 waiting 变 live
#   - rotate 后旧 token 调 API -> 401（即时失效）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F07): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
