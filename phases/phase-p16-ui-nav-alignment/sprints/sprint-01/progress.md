# 进度日志 — Sprint p16/01

## 当前已验证状态(唯一真相)
- 仓库根目录: /Users/shenyanbin/Downloads/harnessdemo4/boardx-dev-template/.claude/worktrees/agent-a418a98e7475772dd
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F01「全局导航接线：Ava / Surveys / Admin 入口」— 已实现，e2e 4/4 通过，PR 待 review（未标 passing，等待 harness verify 门控）
- 当前 blocker: 无（`@repo/auth#test` 在满负载并行跑 turbo 全套时偶发 5s bcrypt 超时，是预存在的环境时序问题，与本次改动无关——单独跑 100% 通过，详见 evidence/auth-test-isolated-pass.log）

## 会话记录

### 2026-07-03（追加：修复 feature-evaluator review 意见，10/16 Revise → 待复审）
- 评审发现的核心问题：F03 的 verification 命令 `grep -qi 'ava|ai-store|surveys|admin' /tmp/lint-design-out.txt`
  之所以 exit 0，是因为匹配到了脚本第 11 行**我自己写的说明性 echo**（"含 ava/ai-store/surveys/admin/studio/presentations
  等模块"），不是 §7 规则真正扫描这些页面后产出的违规内容——**验证是自证式的，删掉 §7 全部检测逻辑只留那行 echo，
  命令照样通过**。评审同时指出：code review 报告里其实已经确认 `ava/page.tsx` 同一文件内既有中文 label（理解文件/
  起草邮件…）又有英文 label（Today/Yesterday/Last 7 days/Older），但 §7 原本的分组逻辑（按文件整体是否含中文字符
  二分为 zh_files/en_files）没有把"同文件内混用"作为独立类别显式报出来，只是碰巧让该文件同时出现在两个列表里。
- 修复：
  1. 重写 §7 检测逻辑，拆成两个独立子规则：(a) 同文件内混用（文件里既有含中文的 label 行、也有不含中文的 label 行）
     (b) 跨文件混用（一批文件整体纯中文 label、另一批整体纯英文 label，排除掉已经算进 (a) 的文件）。
  2. 所有真实命中的输出行统一加 `LABEL-LANG-MIX:` 前缀，且每行都带真实的 `文件路径:行号:源码内容`（用 `grep -F`
     锚定文件路径前缀，而不是原来会被 `(app)` 目录名里的括号打挂 `-E` 正则转义的写法——过程中还顺手修了一个
     bug：原来的 `${f//\//\\/}` 转义在 `grep -E` 里把 `(app)` 当成捕获组导致空匹配，在 `set -e` 下让整个脚本
     以 exit 1 收场，这个 bug 本身也是这次修复顺带发现并修掉的）。
  3. 把 feature_list.json F03 的 verification 命令改成锚定 `LABEL-LANG-MIX:` 前缀行，而不是脚本任意输出：
     `grep 'LABEL-LANG-MIX:' /tmp/lint-design-out.txt | grep -qiE 'ava|ai-store|surveys|admin'`。
     用一次"临时删掉 §7 整段逻辑"的反证跑法验证过：删掉规则后这条新命令确实会 exit 1（之前的旧命令不会），
     证明新验证不再是自证式的。
  4. 把 `evidence` 字段从空字符串补成 `phases/phase-p16-ui-nav-alignment/sprints/sprint-01/evidence/F03.verify.log`
     （完整 lint 输出 + 命令 + exit 结果）。
- 重新跑过的验证：
  - F03 新 verification 命令 → exit 0，且 `LABEL-LANG-MIX:` 输出里真实包含 `app/(app)/ava/page.tsx`、
    `app/(app)/admin/admin-home.tsx`、`app/(app)/admin/ai-store/review/page.tsx` 等新模块路径下的具体行。
  - `pnpm --filter web lint` → exit 0。
  - `pnpm -w run verify:base` → 仍是唯一失败任务 `@repo/auth#test`（同上一轮记录的 flaky timeout，与本次改动
    无关，单独跑 `pnpm --filter @repo/auth test` 稳定通过）。
- 未变的结论：§7 规则本身仍是警告级（不拦截 verify:base），原因不变——语言混用是项目级既有事实，修复归属
  phase-p17；这次只修了"验证命令测的是不是真东西"这个问题，没有改变"要不要现在拦截"的判断。
### 2026-07-03 00:46:39
- 本轮目标: 实现 p16-F01「全局导航接线：Ava / Surveys / Admin 入口」（issue #220）
- 已完成:
  - `apps/web/lib/session.ts`：`PublicUser` 新增 `isSysAdmin: boolean` 字段，`toPublicUser` 复用 `@repo/auth` 的 `isSysAdmin(platform_role)`（与 `lib/admin.ts` requireSysAdmin 同一套判定，前端不重新实现鉴权，只透传服务端已算好的结果）。
  - `apps/web/components/app-shell/sidebar.tsx`：`RAIL_ITEMS` 新增 Ava（`/ava`，Sparkles 图标）、Surveys（`/surveys`，ClipboardList 图标）两个入口，复用现有 rail 渲染结构；新增 Admin 入口（`/admin`，ShieldCheck 图标），仅当 `user?.isSysAdmin` 为真时渲染（非禁用态，是完全不出现在 DOM 里）。所有 rail 入口加 `data-testid="rail-nav-<label>"`。
  - `apps/web/e2e/nav-001-global-entry-points.spec.ts`（新增）：4 个用例，全部走真实点击路径（非 `page.goto()` 直达）——登录用户点击 Ava/Surveys 入口到达对应页面；普通用户看不到 Admin 入口（`toHaveCount(0)`）；SysAdmin 用户看到并点击进入 `/admin`。
- 运行过的验证:
  - `cd apps/web && pnpm exec playwright test e2e/nav-001-global-entry-points.spec.ts` → 4/4 通过（1.5m，见 evidence/nav-001-e2e-pass.log）。此前几次运行在host 负载极高（load avg 一度 111，多个并行 worktree 的 docker 容器同时跑）时出现 Postgres 反复进入 recovery mode 导致的瞬时失败，非代码问题——host 负载降下来后连续跑通。
  - `pnpm -w run verify:base` → 36/43 成功，唯一失败 `@repo/auth#test`（bcrypt hash 测试 5s 超时，仅在 turbo 全量并行跑时出现）；单独跑 `pnpm --filter @repo/auth run test` 100% 通过（15/15，1.4s），确认与本次改动无关（本次改动未触碰 packages/auth 任何文件）。
  - `cd apps/web && pnpm exec tsc --noEmit` → 通过，无类型错误。
- 已记录证据:
  - `evidence/nav-001-e2e-pass.log`（4/4 通过的完整 playwright 输出）
  - `evidence/verify-base-run.log`（verify:base 完整输出，含 auth#test 的环境性失败）
  - `evidence/auth-test-isolated-pass.log`（@repo/auth 单独跑 100% 通过，证明失败与本次改动无关）
- 提交记录: 待 push（见 session-handoff.md）
- 已知风险或未解决问题:
  - `@repo/auth#test` 在 turbo 全量并行（`verify:base`）下偶发超时，是这台机器上多个 worktree 并发导致的资源竞争问题，不是本 feature 引入的回归；建议后续单独开 issue 给这个测试加更宽松的 timeout 或改用更快的 bcrypt cost factor（不在本 feature 范围内，未动）。
  - 未做：AI Store 入口提升到 sidebar（feature notes 里标注为可选，未做）。
- 下一步最佳动作: 等待 PR review + `pnpm harness verify --sprint p16/01` 门控通过后由 harness 标记 passing。
