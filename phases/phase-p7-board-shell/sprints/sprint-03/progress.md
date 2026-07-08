# 进度日志 — Sprint p7/03

## 当前已验证状态(唯一真相)
- 仓库根目录: `.claude/worktrees/p7-03-link-ctxmenu`（分支 worker/canvas-worker-1-p7-f12-f14-link-ctxmenu）
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F12/F14 已 passing；sprint p7/03 三个 feature（F11/F12/F14）全部 passing
- 当前 blocker: 无

## 会话记录
### 2026-07-08
- 本轮目标: F12（链接组件，issue #288）+ F14（右键 Context Menu，issue #289），同一分支一个 PR。
- 已完成:
  - **F12 链接组件**（uc-board-menu-011）：Board Menu 新增「链接」入口 + URL 输入面板
    （`add-link`/`board-link-panel`/`board-link-url`/`board-link-submit`/`board-link-error`）。
    校验：空、含空白、非 http(s) 就地报错不创建。线上 `type:"note"` 落库（服务端白名单
    note/rect 未动）+ color 哨兵 `link|url=<encodeURIComponent(URL)>`（URL 含 `|`/`=` 会撞
    哨兵分隔符，编码是必需的，e2e 用带 `|`/`=` 的 URL 验证往返无损）。fabric 渲染
    kind=link 白底卡片 + 蓝色下划线域名（text=hostname）；双击 / Widget Menu「打开链接」
    （`wm-open-link`）新标签打开；可移动/删除与其它 widget 一致。
  - **F14 右键 Context Menu**（uc-context-menu-001~004）：
    - 图层顺序**持久化**：color 哨兵新增 `|z=<整数>` 段，客户端渲染前按 (z, 原数组下标)
      稳定排序；上移/下移/置顶/置底 = 在排序后的层序上算目标下标、批量 PATCH color（只 PATCH
      与现值不同的项）。不加数据库列、不改白名单；刷新/协作端层序一致（e2e 断言 reload 后保持）。
    - 菜单按目标收窄：对象级 = 复制/剪切/创建副本/层级×4/锁定/删除；锁定态收窄 = 复制 +
      层级 + 解锁（隐藏剪切/副本/删除，uc-001 前端入口 3）；空白画布级 = 粘贴（剪贴板空则
      disabled）+ 选择所有；Esc 关闭菜单不执行动作。
    - 复制/剪切/粘贴复用 F08 剪贴板；锁定/解锁复用 p6:F20 `toggleLocked`（原
      `ctx-lock-unavailable` 占位删除，widgets-001 断言同步更新为 `ctx-lock`）。
    - **编组/取消编组入口留白**：依赖 p6:F21 的 `groupSelected/ungroupSelected`，main 上
      F21 尚未合并（board-canvas.tsx 无编组实现），入口等 F21 合并后接线，不重复实现编组语义。
  - 过程中发现并修复两个真实问题：
    1. 浏览器 WHATWG URL 解析器会把主机名里的空格百分号编码后「成功解析」（Node 会抛错），
       单靠 `new URL` 兜不住明显非 URL 的输入 → 显式拒绝含空白输入 + 拒绝 host 含 `%`。
    2. `upsertItem(doc, id, {color})` 对 doc 不认识的 id 会造出 text=""/x=0 的残缺条目，
       mergeRemoteItems 可能用它覆盖 React state（F12 verify 实测抓到）→ addLink 改为写入
       **全字段**。addText/addShape/addEmbed 存在同一隐患（在 main 基线上可复现
       widgets-001 flake），属存量问题不在本轮 scope，已另开后台任务建议同样修法。
  - 中途 merge 了最新 origin/main（含 #442 collab _rev 根治、#444 fabric 健壮性修复），
    冲突仅 `.harness/state/PROGRESS.md`（聚合计数，按合并后 feature_list 实算修正）；
    merge 后 typecheck + 两个 spec 重跑通过。
- 运行过的验证:
  - `pnpm --filter @repo/web run typecheck`：干净（每步都跑）。
  - `playwright test e2e/board-link-widget.spec.ts`：5/5 通过（merge 前后各至少一轮全绿）。
  - `playwright test e2e/board-context-menu.spec.ts`：6/6 通过（merge 前后各至少一轮全绿；
    merge 后首轮混跑时 2 条失败，单独重跑立即全绿，判定为负载噪音而非断言失败）。
  - 回归：context-menu-001 / context-menu-003 / canvas-copy-paste 全过；widgets-001 首条
    测试失败经 git stash 在**未改动基线**上复现相同失败（addText 竞态 + 该测试自带的
    add-shape 已知基线失败），非本轮回归。
  - `pnpm harness verify --feature F12` / `--feature F14`：真实门控通过，两个 feature 转
    passing（各含 verify:base）。
- 已记录证据: `evidence/F12.verify.log`、`evidence/F14.verify.log`。
- 已知风险或未解决问题:
  - addText/addShape/addEmbed 的 `upsertItem` 单字段写入隐患（见上，存量，已建议后台任务）。
  - F14 编组入口留白等 F21（F21 合并后接线是小改动：菜单加 ctx-group/ctx-ungroup 调
    groupSelected/ungroupSelected）。
  - 链接组件的 URL 编辑/OG 预览留后续增强（feature notes 已声明「OG 预览抓取可后续增强」）。
- 下一步最佳动作: PR review 通过后合并；F21 合并后回来接编组入口。

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
