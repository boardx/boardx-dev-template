# 会话交接 — Sprint p21/01

## 当前已验证
- F06（Profile/Home 文档与追踪字段同步，owner wrk-claude-1）：实现完成，两条 verification
  命令本地跑通（exit 0）：
  - `grep -q 'p11' phases/phase-p2-home/feature_list.json`
  - `git cat-file -e HEAD:phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F06.verify.log`
  日志见 `evidence/F06.verify.log`。status 仍为 `in_progress`（未跑 `pnpm harness verify`
  门控转 passing，按硬约束不能自己改状态）。
- `./init.sh` 基础验证全绿（typecheck/test 45 tasks successful）。

## 本轮改动
- `phases/phase-p2-home/feature_list.json`：F04 的 user_visible_behavior/verification/
  evidence-notes 改为如实反映真实实现（真实最近白板列表，非占位页）；F03/F06 的 notes 里
  blocked_on 从笼统的"p9/p11"改为精确的 `p11:F03`。
- `phases/phase-p1-profile-common/requirements/README.md`：oldcode 溯源描述修正
  （aiModel/privacy 是本阶段新设计，非 oldcode 移植）。
- `phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F06.verify.log`：
  新增，记录两条 verification 命令的真实执行结果。
- 未改动任何运行时代码（apps/web 等一律未动，只读了 `recent/page.tsx` 确认真实行为）。

## 仍损坏或未验证
- F06 尚未经 `pnpm harness verify` 门控转 passing——这一步按硬约束需要 coord/verify 脚本执行，
  不是本 agent 自行判定。
- p21 phase 内其它 feature（F01/F02/F03/F04/F05）不在本次范围内，现状见
  `phases/phase-p21-platform-accounts-hardening/feature_list.json`：
  - F01（wrk-platform-1）、F02（wrk-platform-2）：wave0 安全类，in_progress，需过 rev-security。
  - F03/F04：not_started，owner null。
  - F05（wrk-payment-1）：in_progress。
- p11:F03（Agent→AVA 桥接）仍 in_progress，是 p2-F03/F06 的真实 blocker，本轮只是把表述改
  精确，未去解决它（不属于 F06 范围）。

## 下一步最佳动作
- 开 PR（分支 `worker/wrk-claude-1-p21-f06-profile-home-docs`，PR 正文含 `Closes #378`），
  交 coord-main / review 门禁跑 `pnpm harness verify --sprint p21/01 --feature F06` 转 passing。
- 不要在 F06 范围外顺手改 p1/p2/p11 的其它字段或代码；p21 的其它 feature 由各自 owner 处理。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p21/01`
- 调试:`grep -n 'p11' phases/phase-p2-home/feature_list.json`；
  `git cat-file -e HEAD:phases/phase-p21-platform-accounts-hardening/sprints/sprint-01/evidence/F06.verify.log`
