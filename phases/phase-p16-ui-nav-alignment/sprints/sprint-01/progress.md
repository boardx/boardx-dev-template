# 进度日志 — Sprint p16/01

## 当前已验证状态(唯一真相)
- 仓库根目录: /Users/shenyanbin/Downloads/harnessdemo4/boardx-dev-template/.claude/worktrees/agent-a418a98e7475772dd
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F01「全局导航接线：Ava / Surveys / Admin 入口」— 已实现，e2e 4/4 通过，PR 待 review（未标 passing，等待 harness verify 门控）
- 当前 blocker: 无（`@repo/auth#test` 在满负载并行跑 turbo 全套时偶发 5s bcrypt 超时，是预存在的环境时序问题，与本次改动无关——单独跑 100% 通过，详见 evidence/auth-test-isolated-pass.log）

## 会话记录
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
