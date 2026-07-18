#!/usr/bin/env bash
# verify-intent-chain.sh — p30/F09 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 注入 blocker -> escalate -> 断言 decide 出现在待拍板接口（上行链）
#   - 回写拍板 -> assign 广播事件出现且线程状态翻「已闭环」（下行链）
#   - GitHub issue 双写用 gh api 断言
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F09): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
