# 进度日志 — Sprint p11/04

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-template（本 worktree：worker/wrk-store-1-p11-f03-subscribe）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F03「订阅并使用项目」— 实现完成，等待协调者跑 `pnpm harness verify` 门控转 passing（本 worker 不可自行标 passing）
- 当前 blocker: 无（本地环境曾因宿主机 Docker 资源争用导致 postgres 反复崩溃重启，已确认与代码无关，稳定窗口下测试全绿）

## 会话记录
### 2026-07-02 (wrk-store-1)
- 本轮目标: 实现 P11 F03「订阅并使用项目（个人/团队订阅 + 使用入口带入 AVA/工具/模板）」
- 已完成:
  - 新增 `ai_store_subscriptions` 表（migration 019_ai_store_subscriptions.sql），独立于 F04 的 favorites 表，降低并行冲突面。
  - 新增 `packages/data/src/aiStoreSubscriptions.ts`（订阅/取消订阅/查询订阅/是否可订阅的纯函数与仓储函数），未改动既有 `aiStore.ts`。
  - 新增 `apps/web/app/api/ai-store/items/[id]/subscribe/route.ts`：POST 订阅（personal/team，team 需 owner/admin 角色）、DELETE 取消订阅、GET 查询当前订阅态。
  - `apps/web/app/api/ai-store/items/route.ts` 新增 `?subscribed=me` 查询分支（与 F04/F05 已有的 `?owner=me` / `?authorized=me` 并列）。
  - `apps/web/app/(app)/ai-store/store-browser.tsx`：详情弹窗与卡片新增可用的 Subscribe/Unsubscribe 按钮（原 F01 占位禁用态解除）；新增 Subscribe nav 视图列出已订阅项目，含 Use/Unsubscribe 入口。
  - `apps/web/app/(app)/ava/page.tsx`：新增对 `?agentItemId=` / `?toolItemId=` 查询参数的处理——挂载时拉取该 AI Store 项目名称，预填 composer 草稿，实现「使用 Agent/工具」把资源上下文带入新 AVA 会话。
  - 新增 e2e 规格 `apps/web/e2e/ai-store-003-subscribe-use-item.spec.ts`（F03 验证契约里指定的文件名）。
  - 顺带修正 `ai-store-001-browse-items.spec.ts` 中一条过期断言（原断言 detail-subscribe 永远 disabled，是 F01 给 F03 留的占位断言，F03 上线后应为 enabled）。
- 运行过的验证:
  - `pnpm --filter @repo/data run migrate`（全部迁移含 019_ai_store_subscriptions.sql 应用成功）
  - `pnpm --filter @repo/web exec playwright test e2e/ai-store-003-subscribe-use-item.spec.ts` → 2 passed
  - 回归：`ai-store-001/002/004/005` 全部 e2e（10+10 tests）→ 全部 passed
  - 回归：`ava-chat-basic.spec.ts` + `ava-threads.spec.ts` → 5/6 passed（1 个失败是仓库既有缺陷，与本次改动无关，见下）
  - `pnpm -w run verify:base` → 45/45 successful，exit 0
- 已记录证据: `phases/phase-p11-ai-store/sprints/sprint-04/evidence/`
  - `F03.verify.txt`（F03 spec 单独跑，2 passed）
  - `f01-f02-regression.txt`（F01+F02 回归，10 passed）
  - `f04-f05-regression.txt`（F04+F05 回归，10 passed）
  - `ava-regression.txt`（AVA 回归，5/6 passed，含既有缺陷说明）
  - `verify-base.txt`（verify:base 全量输出）
- 提交记录: 见 PR（分支 `worker/wrk-store-1-p11-f03-subscribe`）
- 已知风险或未解决问题:
  - `apps/web/e2e/ava-chat-basic.spec.ts` 的空态建议断言用了过期 testid `getByTestId("suggestion")`，实际渲染的是 `data-testid="suggested-action"`（p9 F10 建议动作上线时改的名字，没同步更新这条更早的 F01 测试）。已确认这是 **origin/main 上的既有缺陷**，与本次 F03 改动无关（在 merge 前后用 `git show origin/main:...` 核对过两边一致）。不在本次改动范围内自行修复，已用 spawn_task 开了独立任务跟踪。
  - 「使用模板」入口（type=template）目前只做了跳转 `/boards?template=<id>`，因为仓库里暂无「按模板建板」的后端管线（`POST /api/boards` 目前必须挂在 room 下），这部分基础设施不存在，超出本 feature 范围（uc-ai-store-003 的「不包含」条目也明确排除了目标工具内部执行细节）。Agent/AI工具/图片工具的「使用」入口是真实可用的（带入 AVA 会话）。
  - 本地开发环境的 Docker（postgres/redis/minio）在本机资源紧张（同时有 70+ worktree 容器）时会反复崩溃重启，验证过程中多次重试等待稳定窗口才跑通；这是环境问题不是代码问题，已确认在稳定窗口下全部测试通过。
- 下一步最佳动作:
  - 协调者 review PR 后跑 `pnpm harness verify --sprint p11/04` 门控转 F03 passing。
  - 若后续要做「模板 Use = 真正建板」，需要先补一个不挂 room 的「新建空白/模板板」入口（可能是新 feature，不在 F03 范围）。
