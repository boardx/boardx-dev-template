# 进度日志 — Sprint p21/01

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-next
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `./init.sh`（基础）+ 各 feature 自己的 `verification` 命令
- 当前最高优先级未完成功能: F06 已完成本轮范围，等待 harness verify 门控；F01/F02（wave0 安全类）/F03/F04/F05 仍在其它 owner 或未开工
- 当前 blocker: 无（F06 范围内）

## 会话记录
### 2026-07-04 19:59:51
- 本轮目标: 立项 phase p21，claim F01/F02/F05/F06
- 已完成: phase scaffold（见 commit 6a193b9/3846aa3）
- 运行过的验证: （无，立项阶段）
- 已记录证据: （无）
- 提交记录: 6a193b9 harness(p21) 立项
- 已知风险或未解决问题: F06 待实现
- 下一步最佳动作: wrk-claude-1 认领 F06 开工

### 2026-07-05（wrk-claude-1，F06）
- 本轮目标: 实现 F06「Profile/Home 文档与追踪字段同步」（issue #378）
- 已完成:
  1. `phases/phase-p2-home/feature_list.json` F04：核实 `apps/web/app/(app)/recent/page.tsx`
     真实实现是复用 `/api/boards?scope=recent` 的真实最近白板列表（loading/empty/error/
     有数据四态），而非占位页。已将 `user_visible_behavior` 改为如实描述真实实现，
     `verification` 从指向不存在的 `e2e/recent-placeholder.spec.ts` 改为指向真实存在的
     `apps/web/e2e/home-004-view-recent-page.spec.ts`。
  2. `phases/phase-p1-profile-common/requirements/README.md`：把"aiModel/privacy 字段来自
     oldcode"的描述改为如实说明二者是本阶段新设计、非 oldcode 移植（核实 oldcode User 实体
     无此二字段）。
  3. `phases/phase-p2-home/feature_list.json` F03/F06 的 notes：核实 p9:F01、p11:F01/F02
     均已 passing，真正卡住 Agent 数据/使用入口接通的是 p11:F03（AI Store「订阅并使用项目」，
     当前 in_progress），blocked_on 从笼统的"p9/p11 未接通"改为精确的 `p11:F03`。
- 运行过的验证: `./init.sh`（全绿）；F06 的两条 verification 命令均 exit 0（见下）。
- 已记录证据: `phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F06.verify.log`
- 提交记录: 74ba75f（主改动 + Closes #378）、7be2e8a（补全 verify log 第二条命令记录）
- 已知风险或未解决问题: 无（本 feature 纯文档修正，未改动运行时代码）
- 下一步最佳动作: 开 PR 供 coord-main / rev 门控转 passing；不要在 F06 范围外顺手改
  p2/p1/p11 的其它字段。

### 2026-07-05（wrk-claude-1，F06 code-reviewer 修复轮）
- 本轮目标: 修复 PR #390 code-reviewer 发现的真实阻断项——p2-F04 的 verification 命令
  已改指向新测试，但 status 仍留 `passing`、evidence 字段仍指向旧命令产出的过期证据，
  新命令从未真正跑过，证据链与 status 脱钩。
- 已完成:
  1. `bash scripts/init-worktree-env.sh` 给当前 worktree 分配独占 docker compose 端口
     （之前直接 `docker compose up -d` 用了默认端口/project name，`next dev` 连不上，
     ECONNREFUSED :5432——本 worktree 此前从未跑过这一步）。
  2. 实际执行 F04 的三条 verification：`docker compose -f infra/docker-compose.yml up -d`
     → `pnpm --filter @repo/data run migrate` → `pnpm --filter @repo/web exec playwright
     test e2e/home-004-view-recent-page.spec.ts`，3/3 用例通过，真实输出落盘到
     `phases/phase-p2-home/evidence/F04.verify.log`（新建，已确认不被 .gitignore 挡住，
     `.gitignore:31` 对 `phases/**/evidence/*.log` 有 allow 例外）。
  3. `phases/phase-p2-home/feature_list.json` F04 的 `evidence` 字段从旧时间戳
     `2026-06-29T19:48:18.599Z`（对应已删除的旧测试产出）改为新日志的真实时间戳
     `2026-07-05T00:43:41.000Z`；status 保持 `passing`（因为新命令确实全部通过，不是
     "两头都占"，是验证后确认真实成立）。
- 运行过的验证: 见上，3/3 playwright 用例通过，exit 0。
- 已记录证据: `phases/phase-p2-home/evidence/F04.verify.log`
- 已知风险或未解决问题: 无。
- 下一步最佳动作: push 到同一分支 `worker/wrk-claude-1-p21-f06-profile-home-docs`
  （不开新 PR），等 coordinator 处理 #389 合并后一起过门禁。
