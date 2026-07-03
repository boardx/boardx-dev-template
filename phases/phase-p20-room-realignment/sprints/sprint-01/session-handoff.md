# 会话交接 — Sprint p20/01

## 当前已验证
- **F01 passing**（2026-07-04 门控通过）：房间详情壳 + 五 tab 导航。验证 = e2e/room-rr-001-detail-shell.spec.ts
  4 用例全过 + 存量 room/room-chat/canvas 29 个 e2e 无回归 + verify:base 过（design lint 修掉 text-[10px]→text-10）。
- 立项工件齐备：gap-report.md、requirements/uc-rr-001..010、feature_list.json（11F）、
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
- F01 已 passing。wave0 其余（F02/F05/F07/F09/F10）互不依赖，可多 agent 并行领取；
  wave1 的 F03/F06/F08/F11 依赖 F01（壳已就位，合并后即可开工）。
- F01 实现要点：壳在 apps/web/app/(app)/rooms/[id]/layout.tsx（客户端组件，fetch room+members）；
  /rooms/[id] 服务端 redirect 到 boards；files/、surveys/ 是占位页（F03/F08 替换）。
- 不要动：rooms/[id]/board 旧页面（F10 统一处理）；phase-04 feature_list 的 F12 描述（F07 一并修订）。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p20/01`
- 调试:`DATABASE_URL=postgresql://boardx:boardx@localhost:5433/boardx pnpm --filter @repo/web dev`
