#!/usr/bin/env bash
# verify-mailbox.sh — p30/F13 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - A token 发消息给离线 B -> 状态 stored；B 心跳 -> delivered；B 读 + 回执 -> aligned
#   - ScheduleWakeup 到点产生唤醒事件
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F13): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
