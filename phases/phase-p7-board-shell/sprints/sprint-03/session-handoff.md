# 会话交接 — Sprint p7/03

## 当前已验证
- F11（Board Menu 工具栏框架）：passing（上轮，见 `evidence/F11.verify.log`）。
- F12（链接组件，issue #288）：passing。验证：`playwright test e2e/board-link-widget.spec.ts`
  （5/5）+ `verify:base`，harness 门控通过。证据：`evidence/F12.verify.log`。
- F14（右键 Context Menu，issue #289）：passing。验证：
  `playwright test e2e/board-context-menu.spec.ts`（6/6）+ `verify:base`，harness 门控通过。
  证据：`evidence/F14.verify.log`。
- sprint p7/03 三个 feature 全部 passing。分支
  `worker/canvas-worker-1-p7-f12-f14-link-ctxmenu` 已 merge 最新 origin/main
  （含 #442 collab _rev、#444 fabric 修复），merge 后 typecheck + 两个 spec 重跑全绿。

## 本轮改动（F12 + F14，一个 PR）
- `apps/web/components/board/board-canvas.tsx`：
  - F12：`LINK_MARK`/`isLink`/`getLinkUrl` 哨兵（`link|url=<encodeURIComponent(URL)>`，
    URL 必须编码——含 `|`/`=` 会撞哨兵分隔符）；`addLink`（校验空/含空白/非 http(s)，
    浏览器 URL 解析器会把空格编码进 host 而不抛错，显式拒绝）；Board Menu「链接」入口 +
    输入面板；Widget Menu `wm-open-link`；双击链接 = 新标签打开（不进入文本编辑）；
    链接排除出色板/格式刷（setColor/applyFormat 会重写判别头）。
  - F14：`getZ` + `sortedItems`（按 (z, 原下标) 稳定排序供渲染）；`arrange` 重写为算目标
    下标批量 PATCH `|z=` 段（持久化，旧版仅本地重排刷新即丢）；右键菜单重构（对象级/
    锁定收窄/空白画布级 + 剪切 + 选择所有 + 真实锁定/解锁）；Esc 关闭菜单；
    粘贴带 w/h 保尺寸。
  - `addLink` 的 `upsertItem` 直写 collab doc 用**全字段**（只写 color 会造出 text=""
    残缺条目并可能覆盖 React state，F12 verify 实测抓到）。
- `apps/web/components/board/fabric-canvas.tsx`：RenderItem/CanvasTestApi 增 kind
  `"link"` + `linkUrl`；链接卡片渲染（白底 + 蓝色下划线域名）。
- `apps/web/e2e/helpers/canvas.ts`：CanvasItem 类型同步（link kind + linkUrl）。
- `apps/web/e2e/board-link-widget.spec.ts`（新）5 条；`board-context-menu.spec.ts`（新）6 条。
- `apps/web/e2e/widgets-001-use-canvasx-widgets.spec.ts`：`ctx-lock-unavailable` 占位断言
  更新为真实 `ctx-lock`（F14 把占位升级为真实锁定/解锁入口）。

## 仍损坏或未验证
- **存量隐患（非本轮引入）**：addText/addShape/addEmbed 的 `upsertItem(doc, id, {color})`
  单字段写入会造残缺 doc 条目（widgets-001 首条测试在未改动基线上可复现 text="" flake，
  已 git stash 验证与本轮无关）。修法已在 addLink 验证（写全字段），已开后台任务建议推广。
- F14 编组/取消编组入口留白：依赖 p6:F21 `groupSelected/ungroupSelected`，main 上 F21 未
  合并。F21 合并后接线（菜单加 ctx-group/ctx-ungroup 即可），不要重复实现编组。
- 链接组件 URL 编辑/OG 预览：feature notes 声明的后续增强，本轮未做。

## 下一步最佳动作
- PR（Closes #288/#289）等 review 合并；F21 合并后回来接编组入口。
- 不要碰：`apps/web/app/api/board-items/[itemId]/route.ts` 与
  `apps/web/app/api/boards/[id]/items/route.ts` 的白名单（note/rect 不可扩展，color 是
  唯一可扩展的透传字段）。
- 图层顺序的哨兵段是 `|z=<整数>`（getZ 缺省 0）；新增 widget 类型时注意复制/格式刷类操作
  不得重写 color 判别头（link 的排除逻辑是先例）。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --phase p7 --sprint p7/03 --feature F12 --owner canvas-worker-1`
  （F14 同理；两者已 passing，重跑为 no-op，直接跑对应 spec 复验即可）
- 调试: `pnpm --filter @repo/web exec playwright test e2e/board-link-widget.spec.ts e2e/board-context-menu.spec.ts --reporter=list`
- e2e 环境: docker up → migrate → 跑 spec → **docker down**（ADR-007）；子网冲突时改
  `infra/.env`/`.env` 的 `COMPOSE_SUBNET` 为未占用段（本轮 172.23→172.30→172.46）。
