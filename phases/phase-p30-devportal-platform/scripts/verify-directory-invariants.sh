#!/usr/bin/env bash
# verify-directory-invariants.sh — p30/F01 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 写入一个缺 owner 的 agent -> 目录 DO 拒绝（4xx）
#   - 重复 @handle 注册 -> 409
#   - agent 改名后 ULID 不变，且旧 ULID 引用仍可解析（D6 不断链）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F01): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
