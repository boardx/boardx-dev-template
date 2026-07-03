# 进度日志 — Phase p19 Room Realignment

## 当前已验证状态(唯一真相)
- 立项完成：gap-report.md + requirements/uc-rr-001..010 + feature_list.json（11 features，全部 not_started）。
- GitHub 投影：Milestone "Phase p19: Room Realignment" 已创建；feature issues 待切 sprint 后由 `harness sync` 自动创建（issue 只对已分配 sprint 的 feature 开）。
- 当前 blocker：**ui-signoff.md status=pending**（ADR-003 门控，已实测 new-sprint 拒绝）。等人类工程师核对 `ui-signoff.md` 中 6 项取舍与 8 屏原型对照后改 confirmed。
- 当前最高优先级未完成功能：F01 房间详情壳（wave 0 还有 F02/F05/F07/F09/F10 可并行）。

## 会话记录
### 2026-07-03 立项会话
- 本轮目标：Room gap 调研 → 按流程立项 p19（UC + feature_list + GitHub 投影）。
- 已完成：四方对照 gap 调研（原型/oldcode/权威需求/当前实现）；scaffold phase p19（--ui）；
  写 10 份修订 UC（含三个领域模型修正：房间级文件库、Room Survey 作用域、下线 legacy 单画布）；
  生成 feature_list.json 11F（带 design_ref/depends_on/wave/可执行 verification）；
  定制 ui-signoff.md（p17 模式：核对原型屏 + 6 项取舍）；sync --apply 建 milestone。
- 运行过的验证：`jq .features|length` = 11；`harness sync --phase p19` dry-run + apply；
  `harness new-sprint` 门控拒绝（预期行为，留证于本文件）。
- 提交记录：664f01f（立项工件）。
- 已知风险或未解决问题：feature_list 属草拟，ui-signoff 若提修改意见需修订后再定稿；
  F03/F08 依赖的迁移需与 p10/p13 现有表结构核对细节。
- 下一步最佳动作：人类确认 ui-signoff → `pnpm harness new-sprint --phase p19 --id 01 --goal "wave0 骨架" --features F01,F02,F05,F07,F09,F10` → `pnpm harness sync --phase p19 --apply`（此时自动开 issues）→ 按 harness 流程逐 feature 开发。
