# 进度日志 — Sprint p11/01

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>/.claude/worktrees/agent-aa79024b76a7a3ca6
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F01（实现+自测已完成，等待 PR review + `pnpm harness verify` 门控转 passing）
- 当前 blocker: 无阻断实现的问题；有一个环境级限制见下方「已知风险」。

## 会话记录
### 2026-07-01 17:xx（wrk-store-1）
- 本轮目标: 实现 F01（AI Store 浏览/筛选：Explore + 类型 Tab + 搜索/标签/分页 + 详情弹窗）。
- 已完成:
  - 新迁移 `packages/data/migrations/016_ai_store.sql`：`ai_store_items` 表
    （type/scope=personal|team|platform/owner_user_id/team_id/status/likes/views/featured/tags/examples），
    含 12 条 platform+published 种子数据（对齐既有 UI 原型 store-browser.tsx 的样例，供浏览/筛选/分页联调）。
  - 新仓储 `packages/data/src/aiStore.ts`：`listAiStoreItems`（type/q/tag 筛选 + 分页，
    可见性 = published+platform 或 published+team(命中当前团队) 或 personal(属主本人)）、
    `getAiStoreItem`、纯函数 `isAiStoreItemVisible`（单测覆盖，`aiStore.test.ts` 8 例）。
  - 新 API：`GET /api/ai-store/items`（列表+分页，替换旧的内存桩 `/api/ai-store`）、
    `GET /api/ai-store/items/:id`（详情，含可见性校验，不可见/不存在返回 404）。
    两者未登录均 401（页面层 `/ai-store` server component 仍做 302→/login 跳转，未改动）。
  - 前端 `apps/web/app/(app)/ai-store/store-browser.tsx`：在已有的 Explore UI 原型基础上
    （该原型此前已用真实组件 + mock API 建好，属于本仓 UI 先行阶段产物）接入真实分页
    （page/pageSize/totalPages + Prev/Next 控件）与详情弹窗（点卡片打开，展示描述/示例/统计，
    含禁用态 Subscribe 入口——订阅动作留给 F03，不在本 feature 范围）。
  - 更新 e2e `apps/web/e2e/ai-store-001-browse-items.spec.ts`：保留原有 6 个用例（未登录跳转/
    submenu/类型筛选/搜索/空态/标签筛选），新增 3 个用例（API 401、分页翻页、详情弹窗开关），共 9 例。
  - 删除旧内存桩路由 `apps/web/app/api/ai-store/route.ts`（无其他代码引用该路径）。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`（用 `PG_PORT`/`REDIS_PORT` 环境变量隔离到
    本 worktree 专用端口 5540/6540，避免与并行的其他 worktree 容器冲突——见下方已知风险）。
  - `pnpm --filter @repo/data run migrate` — 016 迁移成功，幂等可重跑。
  - `pnpm --filter @repo/data run test` — 22 例通过（含新增 aiStore 8 例）。
  - `pnpm --filter @repo/data run typecheck` / `pnpm --filter @repo/web run typecheck` — 均 exit 0。
  - `pnpm --filter @repo/web run lint`（design lint）— exit 0。
  - `pnpm --filter @repo/web exec playwright test e2e/ai-store-001-browse-items.spec.ts` 等价跑法：
    因端口 3000 被同机另一并行 worktree 的 dev server 占用（非本 feature 代码问题，见风险说明），
    用临时未提交的 playwright config（仅改 baseURL/webServer 端口为 3540，跑完即删除，未进入 diff）
    在本 worktree 专属端口上跑通，9/9 通过，两次独立运行均绿。
- 已记录证据: `phases/phase-p11-ai-store/sprints/sprint-01/evidence/`
  - `e2e-playwright-output.txt`（9/9 通过的完整输出）
  - `build-verify-output.txt`（migrate + data test + typecheck×2 + web lint 全部输出）
  - `screenshot-explore.png`（Explore 页：12 results，类型 Tab/标签/分页数据）
  - `screenshot-detail-modal.png`（详情弹窗：描述/示例/统计/禁用态 Subscribe）
- 提交记录: 见分支 `worker/wrk-store-1-p11-f01-ai-store-browse` 的 PR（Closes #115）。
- 已知风险或未解决问题:
  1. **端口 3000 环境冲突（非代码问题）**：`apps/web/playwright.config.ts` 硬编码
     `next dev -p 3000` + `baseURL: localhost:3000`。本沙箱同时有多个 git worktree 并行跑各自的
     dev server，3000 端口在验证时被另一个 worktree（`boardx-dev-template-uiux-improvements`）
     占用，导致按仓库里"标准"命令原样跑会因端口冲突而非功能问题失败。已用等价的临时本地配置
     （只改端口，未提交）证明测试本身 9/9 通过。**未修改** `playwright.config.ts`（不在本 feature
     范围，且是所有 worker 共享的文件，贸然改动风险外溢到其他并行 agent）。建议 coordinator 后续
     评估是否要给 `playwright.config.ts` 加 `PORT` 环境变量支持以从根本解决多 worktree 并行冲突。
  2. **docker compose 项目名冲突**：`infra/docker-compose.yml` 无显式 `name:`，默认项目名派生自
     compose 文件所在目录名（`infra`），多个 worktree 并行跑字面命令
     `docker compose -f infra/docker-compose.yml up -d` 时会用同一个默认项目名/容器名，
     互相 up/down 会冲突（本轮验证中途曾被另一并行 session 的操作把本 worktree 的容器坼掉一次，
     之后改用 `-p <唯一名>` 隔离规避）。同样建议 coordinator 后续评估补充 `-p ${WORKTREE_ID}` 之类
     的隔离约定，而非本 feature 现在处理。
- 下一步最佳动作: PR 走 review（code-reviewer / e2e-verifier / feature-evaluator，按
  `.harness/agents/registry.yaml` 的 required_for 路由），过了之后由 coordinator 跑
  `pnpm harness verify --sprint p11/01` 门控转 F01 → passing。F02（创建/更新）可在 F01 落库后开工。
