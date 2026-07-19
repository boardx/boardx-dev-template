#!/usr/bin/env bash
# verify-auto-merge.sh — p30/F11 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 测试仓开全绿 PR -> 轮询断言被自动合并 + 审计事件 + PR 评论存在（gh api）
#   - 触发测试 andon -> 第二个全绿 PR 不被合并（冻结）
#   - 关「机械合并」开关 -> 同样不合并（fail-open 到人）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F11): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
