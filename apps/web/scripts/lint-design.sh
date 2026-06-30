#!/usr/bin/env bash
# lint-design.sh — 强制 uiux-standards 门控。违规即 exit 1，接入 web lint → verify:base。
# 覆盖范围：硬编码颜色/像素、原生表单元素、微交互完整性、无障碍基础、骨架完整性。
set -euo pipefail
cd "$(dirname "$0")/.."
viol=0
err() { echo "✗ $*"; viol=1; }

# ── 1. 颜色/像素硬编码 ────────────────────────────────────────────────────────
hex=$(grep -rnE "#[0-9a-fA-F]{3,6}" app components --include="*.tsx" 2>/dev/null | grep -iE "class" || true)
[ -n "$hex" ] && err "className 里硬编码 hex 颜色（改用语义 token）:" && echo "$hex"

px=$(grep -rnE "\[[0-9]+px\]" app components --include="*.tsx" 2>/dev/null || true)
[ -n "$px" ] && err "像素魔数任意值 [Npx]（改用 Tailwind spacing scale）:" && echo "$px"

pal=$(grep -rnE "(bg|text|border)-(neutral|gray|slate|zinc|red|green|blue|yellow)-[0-9]+" app components --include="*.tsx" 2>/dev/null || true)
[ -n "$pal" ] && err "调色板硬编码色（改用 bg-primary/text-destructive 等语义 token）:" && echo "$pal"

# ── 2. 原生表单元素（必须用 shadcn 封装）────────────────────────────────────
# 允许 shadcn 组件本身内部使用（components/ui/ 路径排除）；只扫 app/ 页面层
raw_select=$(grep -rn "<select" app --include="*.tsx" 2>/dev/null || true)
[ -n "$raw_select" ] && err "app/ 中使用原生 <select>（改用 components/ui/select）:" && echo "$raw_select"

# canvas 内联编辑器（board/page.tsx）和 checkbox 是允许的原生 input 例外
raw_input=$(grep -rn "<input" app --include="*.tsx" 2>/dev/null \
  | grep -v "components/ui" \
  | grep -v 'type="checkbox"' \
  | grep -v "board/page.tsx" || true)
[ -n "$raw_input" ] && err "app/ 中使用原生 <input>（改用 components/ui/input；canvas 内联编辑器和 checkbox 除外）:" && echo "$raw_input"

# nav tab 和 canvas 便签删除按钮（极小图标、绝对定位）是允许的例外
# sidebar.tsx 位于 components/，app-shell 内部按钮已通过 focus-visible 标准，不在此处扫描
raw_btn=$(grep -rn "<button" app --include="*.tsx" 2>/dev/null \
  | grep -v "components/ui" \
  | grep -v "account/page.tsx" \
  | grep -v "board/page.tsx" || true)
[ -n "$raw_btn" ] && err "app/ 中使用原生 <button>（改用 components/ui/button；nav tab / canvas 图标按钮除外）:" && echo "$raw_btn"

# ── 3. 微交互完整性：有 hover: 的文件必须也有 transition- ────────────────────
# 按文件粒度：如果文件用了 hover: 但整个文件里没有任何 transition- 则报错
# （避免 cn() 多行场景的假阳性）
for f in $(grep -rl "hover:" app components --include="*.tsx" 2>/dev/null | grep -v "components/ui/" || true); do
  if ! grep -q "transition" "$f" 2>/dev/null; then
    err "$f 文件里有 hover: 但没有任何 transition-*（加 transition-colors duration-200）"
  fi
done

# ── 4. 无障碍基础 ────────────────────────────────────────────────────────────
# <img> 没有 alt 属性
img_no_alt=$(grep -rn "<img" app components --include="*.tsx" 2>/dev/null | grep -v "alt=" || true)
[ -n "$img_no_alt" ] && err "<img> 缺少 alt 属性（无障碍必须）:" && echo "$img_no_alt"

# 独立 <input>（非 shadcn ui）没有 aria-label 也没有 htmlFor 关联
# （只提示；shadcn Input 本身通过 forwardRef 支持 aria-label）

# ── 5. 焦点环完整性：直接用 outline-none 而不补 focus-visible:ring ──────────
bare_outline=$(grep -rn "outline-none" app components --include="*.tsx" 2>/dev/null \
  | grep -v "focus-visible:ring" \
  | grep -v "components/ui/" || true)
[ -n "$bare_outline" ] && err "裸 outline-none 缺少 focus-visible:ring（必须补焦点高亮）:" && echo "$bare_outline"

# ── 6. loading/error/empty state 骨架完整性（UI 页面层）───────────────────────
# 每个 "use client" 页面如果有数据获取（fetch/useEffect），必须有对应状态标记
# 检测策略：有 useEffect+fetch 但无任何 data-testid 含 loading/skeleton/empty/error
pages_with_fetch=$(grep -rl "useEffect" app --include="*.tsx" 2>/dev/null | grep -v "/api/" || true)
for f in $pages_with_fetch; do
  has_fetch=$(grep -l "fetch(" "$f" 2>/dev/null || true)
  [ -z "$has_fetch" ] && continue
  # 检查是否有状态标记（data-testid 或 aria-label 含关键词，或 skeleton/loading 组件）
  has_state=$(grep -E 'data-testid=.*?(loading|skeleton|empty|error)|<Skeleton|aria-busy|"加载中|"暂无|"没有' "$f" 2>/dev/null || true)
  if [ -z "$has_state" ]; then
    err "$f 有数据获取但缺少 loading/empty/error 状态标记（加 data-testid=\"loading\" skeleton 或 empty state 元素）"
  fi
done

# ── 结果 ─────────────────────────────────────────────────────────────────────
if [ "$viol" = "0" ]; then
  echo "✓ design lint: 全部通过（颜色/间距/原生元素/微交互/无障碍/状态完整性）"
else
  exit 1
fi
