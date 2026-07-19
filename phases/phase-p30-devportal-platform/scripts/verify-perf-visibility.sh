#!/usr/bin/env bash
# verify-perf-visibility.sh — p30/F22 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 本人 token 拉指标 -> 200 含数值
#   - 无关系 token -> 403/裁剪（D1 服务端裁剪）
#   - 相关项目 owner token -> 200
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F22): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
