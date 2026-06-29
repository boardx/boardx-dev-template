#!/usr/bin/env bash
# init.sh — 一键 bootstrap:安装依赖 + 基础验证 + 安装 git hooks + 打印启动命令
# 改下面三个变量为你项目的真实命令即可。
set -euo pipefail

INSTALL_CMD="pnpm install"
VERIFY_CMD="pnpm -w run verify:base"   # 基础验证:类型检查 + lint + 单测
START_CMD="pnpm -w run dev"

echo "==> 工作目录: $(pwd)"

echo "==> 安装依赖: ${INSTALL_CMD}"
eval "${INSTALL_CMD}"

echo "==> 安装 git hooks"
install_pre_commit_hook() {
  local hook_path=".git/hooks/pre-commit"
  # 幂等：如果已经安装了 harness hook，跳过
  if [ -f "${hook_path}" ] && grep -q "harness-hook" "${hook_path}" 2>/dev/null; then
    echo "  git pre-commit hook 已安装，跳过"
    return
  fi
  mkdir -p .git/hooks
  cat > "${hook_path}" << 'HOOK'
#!/usr/bin/env bash
# harness-hook: 防止手动修改 active-features.json（它是脚本派生的只读视图）
STAGED=$(git diff --cached --name-only 2>/dev/null || true)
if echo "${STAGED}" | grep -q "active-features.json"; then
  echo ""
  echo "✗ [harness] 检测到 active-features.json 在 staged 文件中。"
  echo ""
  echo "  active-features.json 是脚本派生的只读视图，禁止手改。"
  echo ""
  echo "  如需修改 feature 的 sprint 归属，请："
  echo "  1. 修改对应阶段的 feature_list.json（feature.sprint 字段）"
  echo "  2. 运行 pnpm harness new-sprint --phase NN --id MM 重新生成"
  echo ""
  exit 1
fi
HOOK
  chmod +x "${hook_path}"
  echo "  ✓ git pre-commit hook 已安装 (保护 active-features.json)"
}

if [ -d ".git" ]; then
  install_pre_commit_hook
else
  echo "  ! 不在 git 仓库根目录，跳过 hook 安装"
fi

echo "==> 生成 subagent（从 .harness/agents/*.yaml → .claude/agents + .codex/agents）"
pnpm harness gen-subagents

echo "==> 基础验证: ${VERIFY_CMD}"
if ! eval "${VERIFY_CMD}"; then
  echo "!! 基础验证失败。请先修复基础状态,不要在坏的基础上继续叠功能。" >&2
  exit 1
fi

echo "==> 启动命令: ${START_CMD}"
if [ "${RUN_START_COMMAND:-0}" = "1" ]; then
  echo "==> RUN_START_COMMAND=1,直接启动"
  eval "${START_CMD}"
fi
