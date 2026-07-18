#!/usr/bin/env bash
# verify-onboard-checkup.sh — p30/F05 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 对测试仓触发接入 -> 轮询体检事件流，四项体检（webhook/镜像种子/CODEOWNERS·CONTRIBUTING/分支保护）各出现 done/warn 终态
#   - 镜像种子计数 > 0
#   - 目录 DO 出现该项目（成为租户）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F05): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
