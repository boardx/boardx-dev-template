#!/usr/bin/env bash
# verify-llm-judgment.sh — p30/F17 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - 注入 decide 请求 -> 轮询断言其 summary/why 字段非空且带 provider 标注
#   - 关 LLM 开关 -> 新请求无 summary 但正常进待拍板（降级不断流）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F17): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
