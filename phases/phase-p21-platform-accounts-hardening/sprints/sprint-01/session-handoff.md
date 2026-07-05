# 会话交接 — Sprint p21/01

## 当前已验证
- F05（Billing F04「额度不足触发」如实改写，wrk-payment-1）：本轮改动的两处验证命令均已跑通
  （grep 命中 + 目标 e2e 用例通过），日志见
  `phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F05.verify.log`。
  未跑 `pnpm harness verify` 门控转正式 passing（按 harness 规则由脚本门控，非本次会话自行标记）。

## 本轮改动
- `phases/phase-p14-credits-billing/feature_list.json`：F04 条目的 title/user_visible_behavior/notes
  改为如实描述现状（AVA「AI credits」横幅是无条件常驻的静态 UI，不由 402 额度不足触发），并补充
  单一货币(USD)/不支持退款/不支持自动续费管理的范围收窄说明。
- `apps/web/e2e/billing-001-upgrade-plan.spec.ts`：仅改一条 test 的名字 + 加注释，去掉「触发」这个
  误导性措辞，断言逻辑未动。
- 未碰 `apps/web/app/(app)/ava/page.tsx` 等运行时代码（按任务硬约束，本 feature 是文档/描述层修正，
  不实现路径 A 的「402 自动触发弹窗」新行为）。

## 仍损坏或未验证
- `billing-001-upgrade-plan.spec.ts` 的「用户菜单可打开计划弹窗；credits 模式进入购买 Credit 流程」
  这条 test 失败（`credit-pack-list` 元素找不到）。**已确认是既存 bug，未修改代码的基线上同样复现**，
  与 F05 无关，未在本次修复，已 spawn_task 登记（task_8bfb199b）。下一轮如有 owner 接手，建议单独
  开 feature 处理 buy-credits-dialog 的这个真实功能 bug。
- F01-F04（除本轮的 F04 描述修正外）/F06 均仍是各自 owner 的待办，未在本次会话内处理。

## 下一步最佳动作
- F05 本身已完成，等待 PR review（billing 域涉及 rev-security 建议门槛，见 registry.yaml）。
- 下一轮可继续处理 p21 的 F01/F02（wave0 安全类，优先级更高）或 F03/F04/F06（wave1，无 owner 冲突）。
- 不要在本 feature 分支上顺手实现路径 A（402 自动触发弹窗）——那是明确排除的范围，需要新开 feature。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p21/01`
- 调试:`bash scripts/init-worktree-env.sh && docker compose -f infra/docker-compose.yml up -d && pnpm --filter @repo/data run migrate && cd apps/web && pnpm exec playwright test e2e/billing-001-upgrade-plan.spec.ts`
