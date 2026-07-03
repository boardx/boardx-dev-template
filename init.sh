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
# 总是覆盖安装（保证 hook 升级生效；内容幂等）。
install_pre_commit_hook() {
  local hook_path=".git/hooks/pre-commit"
  mkdir -p .git/hooks
  cat > "${hook_path}" << 'HOOK'
#!/usr/bin/env bash
# harness-hook (pre-commit): 三道防线
STAGED=$(git diff --cached --name-only 2>/dev/null || true)

# 1) 禁止手改脚本派生的只读视图
if echo "${STAGED}" | grep -q "active-features.json"; then
  echo "✗ [harness] active-features.json 是脚本派生只读视图，禁止手改。改 feature_list.json 后重跑 new-sprint。"
  exit 1
fi

# 2) lockfile 必须是 pnpm 9（lockfileVersion '9.0'）——防本机 pnpm 8 把它退回 6.0 害 CI
if echo "${STAGED}" | grep -q "pnpm-lock.yaml"; then
  ver=$(git show :pnpm-lock.yaml 2>/dev/null | head -1)
  if ! printf '%s' "$ver" | grep -q "lockfileVersion: '9.0'"; then
    echo "✗ [harness] pnpm-lock.yaml 不是 lockfileVersion '9.0'（你可能用了 pnpm 8）。"
    echo "  用 corepack pnpm@9.0.0 install --lockfile-only 重生成后再提交。"
    exit 1
  fi
fi

# 3) 防误用 git add -A 卷入参考代码/巨量文件
if echo "${STAGED}" | grep -q "phases/requirements/oldcode/"; then
  echo "✗ [harness] oldcode/ 是参考代码（已 gitignore），不要提交。"
  exit 1
fi
cnt=$(printf '%s\n' "${STAGED}" | grep -c . || true)
if [ "${cnt:-0}" -gt 800 ]; then
  echo "✗ [harness] 本次 staged ${cnt} 个文件，疑似误用 git add -A 卷入大目录。请用明确路径 git add。"
  exit 1
fi
HOOK
  chmod +x "${hook_path}"
  echo "  ✓ pre-commit hook（active-features / lockfile 9.0 / 巨量提交 防线）"
}

# pre-push: 轻量门控，与 CI 的快速迭代策略对齐（见 .github/workflows/harness-verify.yml）——
# 只对受本次改动影响的模块跑 typecheck/lint/test（turbo --affected，通常 <2 分钟）。
# 全量回归（web build + 全量 e2e）不在 push 时跑：由 CI 定时任务（烟测每小时按需、
# e2e 每 3 小时）+ feature 转 passing 前的 pnpm harness verify / verify:full 承担。
# 跳过用 git push --no-verify；push 前想跑全量：pnpm -w run verify:full。
install_pre_push_hook() {
  local hook_path=".git/hooks/pre-push"
  mkdir -p .git/hooks
  cat > "${hook_path}" << 'HOOK'
#!/usr/bin/env bash
# harness-hook (pre-push): 轻量门控（受影响模块 typecheck/lint/test，对齐 CI）
# 全量验证不在这里：CI 定时回归 + 标 passing 前的 verify:full 负责。
echo "==> [harness] pre-push: 受影响模块 typecheck/lint/test（turbo --affected；跳过用 git push --no-verify）"
# --affected 相对 origin/main 计算改动面；拿不到 origin/main（如首次 clone 未 fetch）则回退全量 verify:base
if git rev-parse --verify -q origin/main >/dev/null; then
  export TURBO_SCM_BASE="origin/main"
  if ! pnpm turbo run typecheck lint test --affected; then
    echo "✗ [harness] 受影响模块验证失败，push 中止。修复后再推，或 git push --no-verify 临时跳过。"
    exit 1
  fi
else
  echo "  ! 本地没有 origin/main 引用，回退全量 verify:base"
  if ! pnpm -w run verify:base; then
    echo "✗ [harness] verify:base 失败，push 中止。"
    exit 1
  fi
fi
HOOK
  chmod +x "${hook_path}"
  echo "  ✓ pre-push hook（受影响模块轻量门控，对齐 CI 快速迭代策略）"
}

if [ -d ".git" ]; then
  install_pre_commit_hook
  install_pre_push_hook
else
  echo "  ! 不在 git 仓库根目录，跳过 hook 安装"
fi

echo "==> 生成 subagent（从 .harness/agents/*.yaml → .claude/agents + .codex/agents）"
pnpm harness gen-subagents

# 可选：起本地依赖服务（Postgres + Redis）。默认不起，保证基础验证无 docker 也能跑。
if [ "${RUN_INFRA:-0}" = "1" ]; then
  echo "==> RUN_INFRA=1，起本地依赖服务（infra/docker-compose.yml）"
  docker compose -f infra/docker-compose.yml up -d
fi

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
