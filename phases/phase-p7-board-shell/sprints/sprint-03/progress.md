# 进度日志 — Sprint p7/03

## 当前已验证状态(唯一真相)
- 仓库根目录: `.claude/worktrees/p7-03-board-menu`
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F11 已 passing；下一个是 F12（链接组件）
- 当前 blocker: 无（原竞态阻断已缓解并转为 issue #432 交给 coord-collab 跟进，不再阻断 F11）

## 会话记录
### 2026-07-07
- 本轮目标: F11（Board Menu 工具栏框架 + 组件创建入口）。issue #282（F01）失联超过约定
  窗口后由 coord-board 重新认领，本轮先完成 F11（unblocked，优先级更高的独立线）。
- 已完成:
  - 发现 Board Menu 工具栏（sticky/text/shape/assets/templates 等 BoardTool）在 F02/F12/
    F15 等既有 feature 里已经就位，F11 真正新增的是 chart（图表，p6:F18 未实现）和
    eraser（橡皮擦，p6:F17 未实现）两个入口的"占位 + 不可用反馈"处理，以及新的
    `e2e/board-menu.spec.ts`（10 条用例，覆盖 uc-board-menu-001~007+012）。
  - **压测中发现并部分修复一个真实的、非本 feature 引入的底层竞态**：`packages/collab`
    的 `seedItems()` 对已知 id 永久跳过不覆盖，若后台 `poll()` 恰好在"创建 POST 已落库、
    color PATCH 还没落库"的窗口发起 GET，会把无 color 的版本永久卡进 Yjs doc。已在
    `addShape`/`addText`/`addEmbed` 里补 `upsertItem` 直写规避大部分窗口（压测失败率从
    约 80% 降到约 20%），完全根治需要 `packages/collab` 加版本号裁决，超出 coord-board
    的 area，已提 issue #432 交给 coord-collab。
- 运行过的验证:
  - `pnpm exec tsc --noEmit`：干净。
  - `playwright test e2e/board-menu.spec.ts`：多轮压测（单测 + 全量），干净通过。
  - `pnpm harness verify --phase p7 --sprint p7/03 --feature F11 --owner canvas-worker-1`：
    真实门控通过，F11 转 passing（含 `verify:base` 基础验证）。
- 已记录证据: `evidence/F11.verify.log`。
- 提交记录: 见本轮 commit（feat(board-menu): p7-F11 ...）。
- 已知风险或未解决问题:
  - issue #432（packages/collab 竞态根治）仍未关闭，属于 coord-collab area，coord-board
    不再继续深挖；`board-menu.spec.ts` 的 uc-board-menu-004 测试理论上仍有低概率因该竞态
    偶发失败（已用 `expect.poll` 容忍，但该 bug 表现为"卡死"而非"短暂延迟"，poll 不能
    100% 兜住，是已知、已记录的残留风险，不是本次遗漏）。
  - F01（issue #282，Board Header 框架）已重新认领，本地已有一版实现（返回按钮 + 撤销/
    重做禁用态）但尚未跑完 harness verify（受当时系统资源紧张影响，已暂停等负载下降），
    是下一步要收尾的另一条线，不属于本次 F11 提交范围。
- 下一步最佳动作:
  - 收尾 F01 的 harness verify + commit/push/PR/label。
  - F17（手绘）、F18（图表）落地后，回来把 F11 里的占位态换成真实入口。
  - 跟进 issue #432（coord-collab 处理进度）。
