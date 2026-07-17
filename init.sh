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
# --affected 相对 origin/main 计算改动面。用解析后的单一 merge-base SHA 而非
# origin/main 引用：分支含 merge commit 时 turbo 内部 git 会报
# "fatal: multiple merge bases found"（git merge-base 命令本身总返回单个最优解）。
# 拿不到 base（首次 clone 未 fetch 等）→ 回退全量 verify:base。
BASE_SHA="$(git merge-base origin/main HEAD 2>/dev/null || true)"
if [ -n "${BASE_SHA}" ]; then
  # 审计链体检（ADR-012）：只体检本次 push 触碰了 feature_list.json / sprints/** 的
  # phase（只有这些文件能引入假 passing / 断证据 / 派生视图矛盾；改 adr/、requirements/
  # 不触发，否则 phase-01 的历史欠债会卡死所有 ADR 提交）。历史欠债不阻塞无关 push，
  # 谁触碰谁先还（存量修复见 ADR-012 remediation）。
  # 注意 pathspec 必须用 '**' 递归匹配：'phases/*/sprints/' 对嵌套文件（如
  # sprints/sprint-01/evidence/F01.verify.log）返回空，会漏拦 sprint 目录内的
  # 全部改动（coord-main 实测：非递归 → 0 文件，'**' → 命中；见 PR #521 review）。
  CHANGED_PHASES="$(git diff --name-only "${BASE_SHA}"..HEAD -- 'phases/*/feature_list.json' 'phases/*/sprints/**' 2>/dev/null | awk -F/ '{print $2}' | sed -n 's/^phase-\([^-]*\)-.*/\1/p' | sort -u)"
  if [ -n "${CHANGED_PHASES}" ] && ! pnpm exec tsx --version >/dev/null 2>&1; then
    # fresh worktree 依赖未装时 tsx 不可用——doctor 跑不了就 warn 跳过（与下方
    # verify:base 回退同精神），不能让"环境没装好"伪装成"审计失败"卡死 push。
    echo "  ! tsx 不可用（依赖未安装？），跳过审计链体检（doctor）——先 ./init.sh 装依赖后重推可恢复体检"
    CHANGED_PHASES=""
  fi
  for PHASE_ID in ${CHANGED_PHASES}; do
    if ! pnpm harness doctor --phase "${PHASE_ID}"; then
      echo "✗ [harness] phase ${PHASE_ID} 审计链体检失败（假 passing / 断证据 / 派生视图矛盾），push 中止。"
      echo "  按 doctor 输出修复（通常是 pnpm harness verify --sprint ${PHASE_ID}/<MM> [--backfill-evidence]）；跳过（不推荐）：git push --no-verify"
      exit 1
    fi
  done
  export TURBO_SCM_BASE="${BASE_SHA}"
  if ! pnpm turbo run typecheck lint test --affected; then
    echo "✗ [harness] 受影响模块验证失败，push 中止。修复后再推，或 git push --no-verify 临时跳过。"
    exit 1
  fi
else
  echo "  ! 解析不到与 origin/main 的 merge-base，回退全量 verify:base"
  if ! pnpm -w run verify:base; then
    echo "✗ [harness] verify:base 失败，push 中止。"
    exit 1
  fi
fi
HOOK
  chmod +x "${hook_path}"
  echo "  ✓ pre-push hook（受影响模块轻量门控，对齐 CI 快速迭代策略）"
}

# reference-transaction: 见 ADR-005（共享主 checkout 隔离）——只在共享主 checkout
# （非 linked worktree）里挡 refs/heads/* 的非快进更新，防止一个会话的 reset --hard /
# branch -f 让另一个恰好检出同一分支的并发会话无声丢失 commit。worktree 内天然隔离，
# 不受影响。临时放行：ALLOW_HISTORY_REWRITE=1 <原命令>。
install_reference_transaction_hook() {
  local hook_path=".git/hooks/reference-transaction"
  mkdir -p .git/hooks
  cat > "${hook_path}" << 'HOOK'
#!/usr/bin/env bash
# harness-hook (reference-transaction): 见 ADR-005
STATE="${1:-}"
[ "${STATE}" = "prepared" ] || exit 0
[ "${ALLOW_HISTORY_REWRITE:-0}" = "1" ] && exit 0

GIT_DIR="$(git rev-parse --git-dir 2>/dev/null || true)"
COMMON_DIR="$(git rev-parse --git-common-dir 2>/dev/null || true)"
# linked worktree（git-dir != git-common-dir）天然隔离，不拦截
[ -n "${GIT_DIR}" ] && [ "${GIT_DIR}" = "${COMMON_DIR}" ] || exit 0

is_zero() { [[ "$1" =~ ^0+$ ]]; }

while read -r old new ref; do
  case "${ref}" in
    refs/heads/*) ;;
    *) continue ;;
  esac
  is_zero "${old}" && continue   # 分支创建
  is_zero "${new}" && continue   # 分支删除
  if ! git merge-base --is-ancestor "${old}" "${new}" 2>/dev/null; then
    echo "✗ [harness] 共享主 checkout 检测到非快进更新: ${ref} ${old:0:8} -> ${new:0:8}" >&2
    echo "  reset --hard / branch -f / 强制 rebase 等操作会让其他并发使用这个目录" >&2
    echo "  的会话看到分支 commit 无声消失（见 ADR-005，docs/adr）。" >&2
    echo "  请改用独立 worktree：git worktree add <path> -b <branch>。" >&2
    echo "  确认这个目录当前只有你在用、且就是要这么做：ALLOW_HISTORY_REWRITE=1 <原命令>" >&2
    exit 1
  fi
done
exit 0
HOOK
  chmod +x "${hook_path}"
  echo "  ✓ reference-transaction hook（共享主 checkout 非快进更新防护，ADR-005）"
}

if [ -d ".git" ]; then
  install_pre_commit_hook
  install_pre_push_hook
  install_reference_transaction_hook
else
  echo "  ! 不在 git 仓库根目录，跳过 hook 安装"
fi

echo "==> 生成 subagent（从 .harness/agents/*.yaml → .claude/agents + .codex/agents）"
pnpm harness gen-subagents

# 可选：起本地依赖服务（Postgres + Redis）。默认不起，保证基础验证无 docker 也能跑。
if [ "${RUN_INFRA:-0}" = "1" ]; then
  echo "==> RUN_INFRA=1，起本地依赖服务（infra/docker-compose.yml）"
  docker compose -f infra/docker-compose.yml up -d --wait
  echo "==> 应用数据库 migrations"
  pnpm --filter @repo/data run migrate
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
