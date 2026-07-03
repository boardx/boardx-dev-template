# 进度日志 — Sprint p15/05

## 当前已验证状态(唯一真相)
- 仓库根目录: `.claude/worktrees/agent-ab6334749b787c634`（worker wrk-admin-1）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F05（AI Store 官方精选页）— 实现完成，e2e 自测通过，
  待协调者跑 `pnpm harness verify --sprint p15/05` 门控转 passing（本 worker 不可自己标 passing）。
- 当前 blocker: 无。分支基于 `origin/harness/coord-flip-p15-f04`（含 F04→passing 的门控翻转 +
  F05 认领派发到 sprint-05/wrk-admin-1，该 coord PR #217 截至本轮仍 OPEN 未合并 main）。

## 会话记录
### 2026-07-02

- 本轮目标: 落地 F05（AI Store 官方精选页：SysAdmin 查看已通过平台审核 APPROVED 的项目，
  切换官方精选状态 isFeatured，精选项目 Explore 侧优先展示/带精选标，无权限不可访问），
  复用 F04 审核页的资源管理布局（notes 要求），消费 P11 建表迁移已有的 `ai_store_items.featured` 字段。
- 已完成:
  - `packages/data/src/aiStore.ts`: 新增 `listFeaturedCandidateItems`（精选候选列表：只看
    scope=platform 且 status=approved，即 F04 审核通过集合；支持 featured/搜索/分页筛选）、
    `setAiStoreItemFeatured`（精选切换：只对 scope=platform 且 status=approved 的项目生效，
    `UPDATE ... WHERE scope='platform' AND status='approved'` 一步完成校验+写入，避免
    TOCTOU；目标值与当前值相同视为幂等，不报错；未命中——不存在/非 platform/非
    approved，比如已被撤回到 pending——返回 undefined，调用方转 409）。
  - `apps/web/app/api/admin/ai-store/featured/route.ts`（新增）: GET 精选候选列表 API，复用
    F01/F04 的 `requireSysAdmin()` 门控，未登录 401 / 非 SysAdmin 403。
  - `apps/web/app/api/admin/ai-store/[id]/featured/route.ts`（新增）: POST 精选切换
    （featured: boolean），同一套 `requireSysAdmin()` 门控 + 原子校验转移 + 409 处理。
  - `apps/web/app/(app)/admin/ai-store/featured/page.tsx`: 从 F01 遗留的 `ComingSoon` 占位页
    整页重写为真实精选页，复用 F04 审核页的布局结构（标题区、状态/精选 Tab、搜索筛选区、
    列表、loading/empty 态），卡片操作从"批准/拒绝/撤回"按钮改为单一星标切换按钮
    （"设为精选"/"取消精选"），FEATURED 徽标即时反映。
  - `apps/web/e2e/admin-004-featured-ai-store.spec.ts`（新增）: 9 个测试用例，覆盖：
    未登录跳转登录页、非 SysAdmin 无权限、未登录/非 SysAdmin 调 API 401/403、
    设为精选（即时反映在星标/徽标）、取消精选、精选页只展示 APPROVED（PENDING 与
    REJECTED 项目均不出现，验证 notes 要求的"只显示已通过审核"边界）、精选 Tab 筛选、
    精选切换幂等性（重复提交同一目标值不报错 + 非法 body 400 + 撤回到 PENDING 后
    再切换精选返回 409，验证不能绕过 F04 状态机）、非 SysAdmin 越权防护。
- 运行过的验证:
  - `bash scripts/init-worktree-env.sh` + `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`（幂等，无新增迁移；`featured` 字段已由
    P11 的 016_ai_store.sql 建表引入，F05 未新增/修改任何迁移）
  - `pnpm --filter @repo/web exec playwright test e2e/admin-004-featured-ai-store.spec.ts`
    （9/9 一次性干净通过，无重试、无 flaky，约 12-17s）
  - `pnpm --filter @repo/data run typecheck` / `pnpm --filter @repo/web run typecheck`：均通过
  - `pnpm --filter @repo/data run lint` / `pnpm --filter @repo/web run lint`：均通过
  - `pnpm -w run verify:base`：45/45 全部通过，无回归（详见 evidence）
- 已记录证据:
  - `phases/phase-p15-admin/sprints/sprint-05/evidence/F05-verify.txt`
    （declared verification 三条命令完整输出：docker compose up -d、
    `@repo/data run migrate`、e2e 9/9 一次性通过；用 `.txt` 而非 `.log` 后缀，
    因为仓库 `.gitignore` 里 `*.log` 会被忽略，沿用 F04 的证据命名约定）
- 提交记录: 分支 `worker/wrk-admin-1-p15-f05-featured-impl`（基于
  `origin/harness/coord-flip-p15-f04`，PR 待开）
- 已知风险或未解决问题:
  - 分支基础说明：本 worktree 最初误从 `origin/main` 切分支，但 `main` 尚未合并
    `origin/harness/coord-flip-p15-f04`（PR #217，F04→passing 门控翻转 + F05 认领派发到
    wrk-admin-1/sprint-05）。发现 `main` 上 F05 仍是 `blocked/owner:null` 后改为基于该
    coord 分支重新开工，避免在过期的功能清单状态上工作。若 #217 与本 PR 合并顺序颠倒，
    需要留意 `feature_list.json` 的合并冲突（预期是相邻区块追加，无逻辑重叠）。
  - 未触碰 F01（admin shell）/F02（用户管理）/F03（团队管理）/F04（审核页）范围内的任何代码。
- 下一步最佳动作: F05 实现 + 自测已完成，等待协调者/CI 跑
  `pnpm harness verify --sprint p15/05` 门控转 passing（本 worker 权限范围内不可自行标记）。
  合并前建议确认 #217（F04 gate-flip）已先落地 main，避免 F05 的 depends_on 校验失败。
