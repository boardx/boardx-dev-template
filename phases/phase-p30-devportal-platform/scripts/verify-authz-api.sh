#!/usr/bin/env bash
# verify-authz-api.sh — p30/F03 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - contributor token 调 /p/:slug settings 数据接口 -> 403（服务端裁剪，非前端隐藏）
#   - owner token 调同接口 -> 200
#   - 非成员访问私有项目工作区接口 -> 无权限态而非数据泄漏
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F03): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
