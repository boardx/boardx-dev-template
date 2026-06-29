#!/usr/bin/env bash
# lint-design.sh — 强制 uiux-standards：禁硬编码颜色/像素魔数，必须用语义 token。
# 接进 web 的 lint → verify:base 门控。违规即 exit 1。
set -euo pipefail
cd "$(dirname "$0")/.."
viol=0

hex=$(grep -rnE "#[0-9a-fA-F]{3,6}" app components --include="*.tsx" 2>/dev/null | grep -iE "class" || true)
if [ -n "$hex" ]; then echo "✗ className 里硬编码 hex 颜色（改用语义 token）:"; echo "$hex"; viol=1; fi

px=$(grep -rnE "\[[0-9]+px\]" app components --include="*.tsx" 2>/dev/null || true)
if [ -n "$px" ]; then echo "✗ 像素魔数任意值 [Npx]（改用 Tailwind spacing scale）:"; echo "$px"; viol=1; fi

pal=$(grep -rnE "(bg|text|border)-(neutral|gray|slate|zinc|red|green|blue|yellow)-[0-9]+" app components --include="*.tsx" 2>/dev/null || true)
if [ -n "$pal" ]; then echo "✗ 调色板硬编码色（改用 bg-primary/text-destructive 等语义 token）:"; echo "$pal"; viol=1; fi

if [ "$viol" = "0" ]; then echo "✓ design lint: 无硬编码颜色/像素魔数"; else exit 1; fi
