#!/usr/bin/env bash
# verify-tenant-isolation.sh — p30/F04 端到端验证（骨架，实现时补齐断言）
#
# 断言意图（实现前即定下的完成契约，见 feature_list.json 对应 verification）：
#   - DO 级合成命名空间：向项目 A 写一条需求与一条 talk 消息 -> 项目 B 的对应接口返回不含该数据
#   - 并发向两项目写入互不阻塞（N3 隔离）
#   - 【G6 后补断言段】真实租户 #2（agentic-harness-template）接入后追加同型抽查（GitHub App 安装为前置人工步骤）
#
# 纪律：宁可显式红也不许空 exit 0 假绿（coord-main #751 转正约束）。
set -euo pipefail

echo "TODO(p30/F04): 实现后启用 — 本脚本为骨架，断言意图见头部注释" >&2
exit 1
