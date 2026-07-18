#!/usr/bin/env bash
# verify-command-bar.sh — p30/F19 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - API 发「提需求:测试需求」-> F18 流水线出现该条
#   - 发一句超纲指令 -> 响应含 queued=true 且 coord 队列出现条目（不沉默失败）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F19): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
