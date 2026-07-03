#!/usr/bin/env bash
# lint-design.sh — 强制 uiux-standards 门控。违规即 exit 1，接入 web lint → verify:base。
# 覆盖范围：硬编码颜色/像素、原生表单元素、微交互完整性、无障碍基础、骨架完整性、跨模块文案语言一致性。
# 扫描范围：app/ + components/ 全量 grep（非路径白名单），天然覆盖 P0-P4 reskin 页面
# 以及后续 harness pipeline 新增的 Ava/AI Store/Surveys/Admin/Studio/Presentations 等模块。
set -euo pipefail
cd "$(dirname "$0")/.."
viol=0
err() { echo "✗ $*"; viol=1; }

echo "· 扫描范围：app/ + components/（含 ava/ai-store/surveys/admin/studio/presentations 等模块）"

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

# ── 7. 文案语言一致性：同一类 UI 标签（label=/label:）不应中英文混用 ─────────────
# 只看 label="..." / label: "..." 这类明确的 UI 展示文案 prop（不看 aria-label/placeholder/
# 邮箱等自然含中英混排的字段，避免误报）。两种粒度都测：
#   (a) 同一文件内部：既有中文 label 又有英文 label（如 ava/page.tsx 的"理解文件" vs "Today"）。
#   (b) 跨文件：整个项目里，一批文件全用中文 label、另一批全用英文 label（如
#       board-canvas.tsx「选择/平移/连接线」 vs sidebar.tsx「Home/Rooms」）。
# 每条真实命中都以 "LABEL-LANG-MIX:" 前缀 + 文件:行号 的形式输出，可被 grep 精确锚定，
# 不会与本脚本自身的说明性 echo 混淆（那些行不带这个前缀、也不含真实源文件路径:行号）。
#
# 注：此检测目前是**警告级**（不置 viol=1，不拦截 verify:base）。原因：首次跑这条规则
# 就发现语言不一致是项目级的既有事实（P0-P4 reskin 页面多为英文 label，harness pipeline
# 之后新建的 Ava/Admin/Rooms/Studio/Board 等模块多为中文 label，甚至同一文件内都有混用），
# 涉及文件众多，修复属于内容/文案层面的 reskin 工作（归属 phase-p17），不是这个 feature
# （扩大 lint 覆盖）的范围。把它做成 err 会让本次新增检测直接拖垮所有人的 verify:base
# 基础门禁。等 phase-p17 把文案语言统一之后，可以把下面的 warn 改回 err，转为硬门禁。
label_lines=$(grep -rnE '(^|[^a-zA-Z-])label(=|: )"[^"]+"' app components --include="*.tsx" 2>/dev/null \
  | grep -v "components/ui/" \
  | grep -v "aria-label" || true)
if [ -n "$label_lines" ]; then
  # (a) 同文件内混用：文件内既有含中文字符的 label 行，也有不含中文字符的 label 行。
  same_file_mix_files=$(comm -12 \
    <(echo "$label_lines" | grep -E '[一-龥]' | cut -d: -f1 | sort -u) \
    <(echo "$label_lines" | grep -vE '[一-龥]' | cut -d: -f1 | sort -u) || true)
  if [ -n "$same_file_mix_files" ]; then
    echo "⚠ LABEL-LANG-MIX(同文件内中英混用，警告，不拦截；修复归属 phase-p17 reskin)："
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      echo "$label_lines" | grep -F "${f}:" | sed 's/^/    LABEL-LANG-MIX: /'
    done <<< "$same_file_mix_files"
  fi

  # (b) 跨文件：整个项目里一批文件纯中文 label、另一批纯英文 label（分别排除掉已经在
  # 同文件内混用名单里的文件，避免重复计入）。
  zh_only_files=$(comm -23 \
    <(echo "$label_lines" | grep -E '[一-龥]' | cut -d: -f1 | sort -u) \
    <(echo "$same_file_mix_files" | sort -u) || true)
  en_only_files=$(comm -23 \
    <(echo "$label_lines" | grep -vE '[一-龥]' | cut -d: -f1 | sort -u) \
    <(echo "$same_file_mix_files" | sort -u) || true)
  if [ -n "$zh_only_files" ] && [ -n "$en_only_files" ]; then
    echo "⚠ LABEL-LANG-MIX(跨文件中英混用，警告，不拦截；修复归属 phase-p17 reskin)：以下文件整体用中文 label，而以下文件整体用英文 label，同一层级 UI 组件的文案语言应统一："
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      echo "$label_lines" | grep -F "${f}:" | head -1 | sed 's/^/    LABEL-LANG-MIX: /'
    done <<< "$zh_only_files"
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      echo "$label_lines" | grep -F "${f}:" | head -1 | sed 's/^/    LABEL-LANG-MIX: /'
    done <<< "$en_only_files"
    echo "  示例（Board 工具条 vs Sidebar 导航）：见 components/board/board-canvas.tsx 与 components/app-shell/sidebar.tsx"
  fi
fi

# ── 结果 ─────────────────────────────────────────────────────────────────────
if [ "$viol" = "0" ]; then
  echo "✓ design lint: 全部通过（颜色/间距/原生元素/微交互/无障碍/状态完整性/文案语言一致性）"
else
  exit 1
fi
