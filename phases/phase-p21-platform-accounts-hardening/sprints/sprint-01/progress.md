# 进度日志 — Sprint p21/01

## 当前已验证状态(唯一真相)
- 仓库根目录: boardx-dev-next（本次在 worktree agent-a2cc6841cb13e404c 中操作）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F05 已完成本轮改动，其余 F01-F04/F06 仍待各自 owner 处理
- 当前 blocker: 无（F05 自身范围内）；发现一个既存无关 bug 已 spawn_task 登记（见下）

## 会话记录
### 2026-07-04 19:59:51
- 本轮目标:
- 已完成:
- 运行过的验证:
- 已记录证据:
- 提交记录:
- 已知风险或未解决问题:
- 下一步最佳动作:

### 2026-07-05（wrk-payment-1，F05）
- 本轮目标: 完成 issue #377 / F05「Billing F04『额度不足触发』如实改写」。
- 已完成:
  - `phases/phase-p14-credits-billing/feature_list.json` F04 条目：`title`/`user_visible_behavior`/`notes`
    改为如实描述——AVA 页面「AI credits」横幅（data-testid=ai-low-credits-prompt）是无条件常驻展示的
    静态 UI，不由 402 额度不足响应触发，402 目前只走 `setSendError` 文字提示；用户可随时手动点击
    横幅上的 Upgrade 按钮进入升级弹窗，与真实额度状态无关。删除了此前不准确的「是 p9/p12 额度不足
    引导落点」表述。补充 notes：当前仅支持单一货币（USD），不支持退款，不支持自动续费管理（相对
    oldcode 双轨计费主动收窄的范围，非遗漏）。
  - `apps/web/e2e/billing-001-upgrade-plan.spec.ts`：把测试名从「AVA 额度提示可打开计划弹窗」改为
    「AVA 常驻额度提示横幅：点击 Upgrade 按钮可打开计划弹窗（横幅为静态常驻展示，非额度不足触发）」，
    只改名字/加注释，未改断言逻辑（原断言本身正确）。
  - 走的是 requirements/billing.md 里说明的默认路径 B（如实改描述，不新增因果链实现），未实现
    402 自动触发弹窗——按任务指示这是明确排除的范围。
  - 未改动 `apps/web/app/(app)/ava/page.tsx` 等运行时代码，符合硬约束。
- 运行过的验证:
  1. `grep -q 'ai-low-credits-prompt' "apps/web/app/(app)/ava/page.tsx"` → exit 0，PASS。
  2. `pnpm --filter @repo/web exec playwright test e2e/billing-001-upgrade-plan.spec.ts` → 完整 spec
     7 个 test 中 6 个通过，1 个既存无关失败（见下）；本 feature 实际改动的那条 test（原「AVA 额度
     提示可打开计划弹窗」，现改名后）单独运行 **通过**（exit 0）。
  3. `git cat-file -e HEAD:.../evidence/F05.verify.log` → 将在本 commit 落盘后满足。
- 已记录证据: `phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F05.verify.log`
- 提交记录: 见分支 `worker/wrk-payment-1-p21-f05-billing-f04-honest-desc`，PR 关闭 issue #377。
- 已知风险或未解决问题:
  - `billing-001-upgrade-plan.spec.ts` 里「用户菜单可打开计划弹窗；credits 模式进入购买 Credit 流程」
    这条 test 失败（`credit-pack-list` 元素找不到），**已确认在完全未修改代码的基线上同样复现**，
    与本 feature 无关，不在 F05 范围内修复。已用 spawn_task 登记为独立待办（task_8bfb199b），
    建议后续单独开 feature 处理这个 buy-credits-dialog 的真实 UI bug。
  - 未走路径 A（真正让 402 触发弹窗自动打开）——按任务说明这是明确排除的范围，如后续产品拍板要
    走路径 A，需要新开一个 feature，且要相应把 verification 换成真正模拟 402 后断言弹窗联动。
- 下一步最佳动作: F05 已完成，等待 PR review/rev-security（billing 域按 registry.yaml 要求过一次）。
  其余 wave1 feature（F03/F04/F06）仍待各自 owner 认领处理；F01/F02（wave0 安全类）优先级更高。
