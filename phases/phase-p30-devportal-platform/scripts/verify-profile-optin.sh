#!/usr/bin/env bash
# verify-profile-optin.sh — p30/F23 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 未 opt-in 用户档案接口无聚合指标字段
#   - opt-in 后出现且值为区间字符串非精确数
#   - 分身页匿名 200 且含 owner/parent（默认全公开，ULID 不断链）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F23): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
