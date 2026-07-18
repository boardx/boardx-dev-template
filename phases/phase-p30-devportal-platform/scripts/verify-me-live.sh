#!/usr/bin/env bash
# verify-me-live.sh — p30/F08 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 注入一条 decide 请求 + 制造一个 agent 心跳超时 -> /me 数据接口 N 秒内反映
#   - 待拍板列排序按 SLA
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F08): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
