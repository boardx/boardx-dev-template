# 会话交接 — Sprint p20/01

## 当前已验证
- 无 feature 开工。立项工件齐备：gap-report.md、requirements/uc-rr-001..010、feature_list.json（11F）、
  ui-signoff.md **status: confirmed**（yanbinshen，2026-07-03）。
- GitHub 投影完成：Milestone "Phase p20: Room Realignment (P20)"（#18），issues #298-#303
  对应本 sprint 6 个 feature（F01/F02/F05/F07/F09/F10，label sprint:p20-01）。

## 本轮改动
- 仅立项/控制平面文件，无业务代码改动。分支 feat/p20-room-realignment-scaffold（PR #296 待合并）。
- 注意：阶段原拟 p19，因 main 已被 AVA 阶段占用改号 p20；重复 milestone #17 已删。

## 仍损坏或未验证
- 全部 6 个 feature not_started。F03/F08 的迁移设计需先核对 p10 room_files 相邻表与 p13 surveys 表结构。
- 本 worktree 的 pre-push hook 是旧版（跑 verify:full）；main 新政策不要求，push 用 --no-verify 或跑 ./init.sh 对齐。

## 下一步最佳动作
- 合并 PR #296 后，从 **F01（房间详情壳）** 开始：`pnpm harness claim` 领取 → 写
  e2e/room-rr-001-detail-shell.spec.ts（先定验证契约）→ 实现 rooms/[id]/layout.tsx 壳。
- wave0 其余（F02/F05/F07/F09/F10）互不依赖，可多 agent 并行领取。
- 不要动：rooms/[id]/board 旧页面（F10 统一处理）；phase-04 feature_list 的 F12 描述（F07 一并修订）。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p20/01`
- 调试:`DATABASE_URL=postgresql://boardx:boardx@localhost:5433/boardx pnpm --filter @repo/web dev`
