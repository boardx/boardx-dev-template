# 进度日志 — Sprint p6/09

## 当前已验证状态(唯一真相)
- 仓库根目录: /Users/shenyanbin/Documents/projects/boardx-dev-next/.claude/worktrees/p6-09-multiselect
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- Sprint p6/09（F12+F19+F20+F21）全部 passing，本 sprint 收尾。
- 当前 blocker: 无

## 会话记录
### 2026-07-03（canvas-worker-1，stacked 在 F20 之上）
- 本轮目标: F21 多选组合批量操作——批量对齐 + 编组/解组（issue #274，p6-09 系列最后一个 feature）。
- 开工前先读现状：整体拖动（fabric ActiveSelection）、批量锁定（F20）、批量删除（早期落地）
  均已具备，真正的缺口只有批量对齐（左/右/上/下/水平居中/垂直居中/等间距）和编组/解组
  （fabric ActiveSelection 是临时多选，不是持久编组）。
- 已完成:
  - **批量对齐**：`alignSelected(mode)`（board-canvas.tsx）。基准为选中对象（过滤锁定项后）
    的包围盒（minX/maxX/minY/maxY），7 种模式（left/right/top/bottom/hcenter/vcenter/
    distribute-h/distribute-v）算出目标 x/y，复用 F20 建立的「先过滤 getLocked 再操作」模式
    + 既有的 `apiMove`/`recordOp({kind:"move"})` 落库与撤销栈路径（未绕过、未新开管线）。
    等间距分布未直接复用 F07 的 `computeSpacingSnap`（那是"拖动中与单个邻居比较"的检测逻辑，
    语义是被动吸附提示，不是主动对整个选中集合分布)，改写为独立的「排序 + 首尾固定 + 中间
    按总跨度均匀分布间隙」几何算法，选中 ≥3 个对象才展示（少于 3 个首尾已固定，没有中间项
    可调整，等间距没有意义）。
  - **编组/解组**：持久化字段复用 F12/F19/F20 建立的 color `|k=v` 哨兵编码约定，新增
    `|group=<groupId>` 段（groupId 取编组时选中集合中第一个 item 的 id，不额外引入 id 生成器/
    新表）。`groupSelected`/`ungroupSelected` 两个函数，编组要求过滤锁定项后 ≥2 个才生效
    （业务规则：锁定组件不得通过多选操作绕过锁定限制）。整体选中语义在 `onFabricSelection`
    里实现：点击命中 id 后，若命中对象带 groupId，则把同 groupId 的全部成员并入选中集合
    （组闭包展开），fabric 层完全不感知 groupId，只在 React 选中态回调这一处理。整体拖动/
    整体删除因此自动获得（复用既有的多选拖动/deleteSelected，不需要为编组单开落库路径）。
  - **范围取舍（写入 feature notes 同源说明）**：不支持组嵌套——重新编组时新 groupId 直接
    覆盖旧值；组内对象仍可通过双击等既有单选路径再单独选中/编辑（不额外禁止）。
  - Widget Menu 新增 7 个对齐按钮（`wm-align-objects-*` 前缀，为与既有的文本排版对齐入口
    `wm-align-left/center/right`——uc-widget-menu-013——区分，未复用同名 testid）+ 2 个分布
    按钮（`wm-distribute-h/v`，仅 ≥3 选中展示）+ `wm-group`/`wm-ungroup`（编组入口在选中 ≥2
    且未全部同组时展示；解组入口在选中集合含任一已编组成员时展示，两者可同时出现）。
  - **修复真实回归（非本轮引入但本轮暴露）**：Widget Menu 加入这么多新按钮后单行不再放得下
    （实测宽度 1466px > 1220px 视口），在两侧溢出并遮挡画布空白区域，导致
    `canvas-select.spec.ts`「点选/Shift多选/点空白清除/Esc清除」用例点击视口右上角空白点时
    误命中溢出的菜单而非清空选择。修复：widget-menu 容器加 `flex-wrap` + `max-w-[92vw]`，
    菜单换行而不是横向溢出。
- 新写 e2e: `apps/web/e2e/widget-active-selection.spec.ts`（8 个用例）——对齐入口显示/隐藏
  （选中数阈值）、左对齐、右/顶/底/水平居中/垂直居中、等间距水平分布（3 对象几何断言）、
  对齐遇锁定对象（锁定项不动）、编组+整体选中+整体删除、解组恢复独立选择、编组入口显隐规则。
  坐标用 `POST /api/boards/:id/items` 直接指定 x/y（不依赖 add-note 的自动摆放位置），使对齐/
  分布断言可确定复现。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/widget-active-selection.spec.ts`（8/8 通过）
  - `cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json`（0 错误）
  - 回归（widget-text / widget-sticky / widget-menu-framework / widget-menu-002-style-widget /
    widget-style / widget-lock-delete-refresh / canvas-select / canvas-undo-redo，共 44 条）：
    44 passed（含上面描述的 widget-menu 溢出修复后重跑）。
  - `pnpm harness verify --sprint p6/09 --feature F21 --owner canvas-worker-1` → 门控通过，
    F21 = passing（含 verify:base 全量基础验证）。
- 已记录证据: `phases/phase-p6-canvas/sprints/sprint-09/evidence/F21.verify.log`。
- 提交记录: 见分支 `worker/canvas-worker-1-p6-f21-multiselect`（stacked 在
  `worker/canvas-worker-1-p6-f20-lock` 之上）提交历史。
- 已知风险或未解决问题:
  - 编组/解组不进撤销栈（与 F19 样式变更、F20 锁定/解锁一致的既有不一致，非本轮新增，一并记录）。
  - Context Menu 的层级/编组锁定入口（uc-context-menu-003/004）不在本 feature 契约范围内，
    feature notes 已注明「p7 复用本能力」。
  - 组嵌套、组内对象的独立选中/编辑边界按最简单方式处理（见上方范围取舍），若后续 p7 出现更
    复杂需求（如多级分组、组内单独锁定）需要重新评估数据结构，目前的单段 `|group=<id>` 编码
    不足以表达嵌套关系。
- **Sprint p6/09 收尾**：F12（文本组件+样式+转便利贴）、F19（组件样式面板+应用格式）、
  F20（锁定/解锁+删除+刷新）、F21（多选批量对齐+编组）全部 passing，sprint-09 全部完成。
  下一步是 p6-10 系列（#275 形状/#276 连接线/#277 手绘/#278 图表），需要开新 sprint。

### 历史记录（F12/F19/F20，见下）
### 2026-07-04 04:29:00（canvas-worker-1）
- 本轮目标: F12 文本组件 + 文本样式 + 文本转便利贴（issue #271）
- 已完成:
  - 复用既有文本组件创建/编辑入口（board-menu-003 已落地的 add-text/dblclick 编辑）。
  - 扩展 item.color 哨兵编码：在既有 `<base>[:bold]` 后追加 `|k=v` 样式段
    （font/size/italic/align），沿用同一持久化字段，未改 DB schema / API 白名单。
  - Widget Menu 新增文本样式面板（wm-font/wm-fontsize/wm-italic/wm-align-left/center/right），
    对文本与便签均生效（含文字对象），形状/嵌入组件不显示。
  - Widget Menu 新增「转为便利贴」（wm-convert-to-notes）：仅单选文本时出现，按空行分段 +
    段内按行拆分，批量创建便利贴（type:"note"），原文本组件保留，空文本/无法拆分时不创建。
  - fabric-canvas.tsx `buildItemObject` 消费新样式字段渲染（fontFamily/fontSize/fontStyle/
    textAlign），`__canvasTestApi.getItems()` 暴露 kind/italic/fontFamily/fontSize/align。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/widget-text.spec.ts`（6/6 通过）
  - `pnpm -w run verify:base`（45/45 通过；含 typecheck/lint/test 全量）
  - 回归：widget-sticky / widget-menu-framework / widget-menu-002-style-widget /
    widget-menu-009-refresh-widget / canvas-select / board-menu-003-create-text 共 23 条全绿；
    widgets-001/widgets-004 的 2 条既有失败（add-shape testid 基线缺失，spec 内注释已声明），
    与本次改动无关，未新增回归。
  - `pnpm harness verify --sprint p6/09 --feature F12 --owner canvas-worker-1` → F12 passing。
- 已记录证据: `phases/phase-p6-canvas/sprints/sprint-09/evidence/F12.verify.log`
  （harness verify 输出 + 手动补充的回归验证结果）。
- 提交记录: 见分支 `worker/canvas-worker-1-p6-f12-text` 提交历史。
- 已知风险或未解决问题:
  - `wm-convert-to-notes` 仅支持单选一个文本对象转换（uc 未要求多选批量转换，范围纪律内不展开）。
  - F19/F20/F21（样式面板颜色/边框/透明度、锁定、多选批量对齐）仍是 not_started，队列后续项。
- 下一步最佳动作: 下一轮可从 F19（组件样式调整 + 应用格式）或 F20（锁定/解锁+删除+刷新）
  任一开始；F12 相关文件（board-canvas.tsx 的 color 样式段编码 withStyle/styleGet）已可复用于
  F19 的边框/透明度扩展，建议延续同一 `|k=v` 编码约定，避免另起字段。

### 2026-07-03（canvas-worker-1，stacked 在 F19 之上）
- 本轮目标: F20 锁定/解锁 + 删除 + 刷新组件（issue #273）。
- 开工前先读现状：删除（wm-delete）与刷新（wm-refresh/wm-refresh-unavailable，基于
  isReloadable/embed 哨兵）在 F10/F13 已完整实现（单选+多选删除、刷新计数徽标），本轮未重做，
  只补了删除遇到锁定对象的交叉分支 + 一条刷新基线复验。真正新写的只有锁定/解锁。
- 已完成（锁定/解锁核心实现）:
  - 持久化：延续 color 字段 `|k=v` 哨兵编码，新增 `|locked=1` 段（board-canvas.tsx 的
    getLocked/toggleLocked，复用 F12/F19 建立的 withStyle/styleGet/applyColors 管线），未新增
    持久化列。
  - 不可移动：fabric-canvas.tsx 的 styleInteractive 新增 locked 参数，locked=true 时等价于
    canEdit=false 处理 lockMovementX/Y（单选对象源头挡住）；object:moving 事件处理器额外加了
    一道防线专门覆盖多选 ActiveSelection 场景（fabric 的 ActiveSelection 整体拖拽不读子对象
    的 lockMovementX/Y，必须在 reconcile 时把「任一成员锁定」映射到整组的 lockMovementX/Y）。
  - 不可缩放/旋转：styleInteractive 在 locked 时把 hasControls 设为 false（缩放控制点不可见），
    lockScalingX/Y 同步锁定；lockRotation 本就恒为 true（现有画布未开放旋转，非本轮改动）；
    object:scaling 事件处理器加了防御性 guard（正常路径下已经不会被触发，双保险）。
  - 不可编辑：onEditRequest（board-canvas.tsx）在 setEditingId 前检查 getLocked，短路双击
    进入编辑态；这是唯一的 setEditingId 调用点，DOM textarea 覆盖层不会为锁定对象出现。
  - Widget Menu 显示解锁：锁定态只显示 wm-unlock（不再有 wm-lock），未锁定显示 wm-lock；
    原 wm-lock-unavailable 禁用占位按钮已移除。全部选中项锁定时，颜色/字重/字体/边框/透明度/
    应用格式/转便利贴/刷新/复制等样式与编辑类入口整体隐藏（业务规则 1：锁定对象只保留锁定
    状态入口），删除入口保留但置灰。
  - 多选混合锁定态：未全部锁定（含混合）时样式入口仍展示，但 setColor/toggleBold/setBorder
    等全部 8 个样式 setter 都加了 `&& !getLocked(it)` 过滤，只对未锁定项生效；lock 按钮的
    文案取「全部已锁定 → 解锁，否则 → 锁定」（与 toggleBold 的 allX?取消:全部置真 语义一致），
    点击后把混合态统一收敛为全部锁定（uc-widget-menu-003 业务规则 6：批量锁定/解锁）。
  - 删除遇到锁定对象（uc-widget-menu-008 主流程 5）：deleteSelected 改为只删除未锁定的选中
    项，锁定项保留且保持选中（部分失败反馈）；全部选中锁定时 wm-delete disabled。
  - 键盘方向键微移（moveSelected）同样过滤锁定项，过滤后为空则整体跳过。
  - RenderItem/CanvasTestApi.getItems()/e2e helpers 的 CanvasItem 都加了 locked 字段；fabric
    reconcile 的对象重建签名（sig）加入 locked，确保锁定态切换会触发对象重建应用新的交互属性。
- 新写 e2e: `e2e/widget-lock-delete-refresh.spec.ts`（6 个用例）——锁定入口显示+持久化+刷新后
  仍锁定、不可移动/缩放/编辑（含拖拽手势 + 方向键 + 双击）、解锁恢复、多选混合锁定态、多选删除
  部分失败、全锁定禁删、刷新基线复验。均为新写（非复用已有 spec），因为原契约里锁定完全不存在。
- 顺带修复: `e2e/widgets-001-use-canvasx-widgets.spec.ts` 里断言 wm-lock-unavailable 的两行
  改为断言 wm-lock 可见 + wm-lock-unavailable 不存在（占位按钮被本轮替换）。
- 运行过的验证:
  - `docker compose -f infra/docker-compose.yml up -d`
  - `pnpm --filter @repo/data run migrate`
  - `pnpm --filter @repo/web exec playwright test e2e/widget-lock-delete-refresh.spec.ts`（6/6 通过）
  - `cd apps/web && pnpm exec tsc --noEmit -p tsconfig.json`（0 错误）
  - 回归（widgets-001 / widget-text / widget-sticky / widget-menu-framework /
    widget-menu-002-style-widget / widget-style / canvas-select / canvas-undo-redo /
    widget-menu-009-refresh-widget，共 35 条）：34 passed，1 failed
    （widgets-001 的 add-shape 断言，该文件顶部注释已声明是本分支基线即失败的既有问题，
    与本轮改动无关，未新增回归）。
  - `pnpm harness verify --sprint p6/09 --feature F20 --owner canvas-worker-1` → 门控通过，
    F20 = passing（含 verify:base 全量基础验证）。
- 已记录证据: `phases/phase-p6-canvas/sprints/sprint-09/evidence/F20.verify.log`。
- 提交记录: 见分支 `worker/canvas-worker-1-p6-f20-lock`（stacked 在
  `worker/canvas-worker-1-p6-f19-style` 之上）提交历史。
- 已知风险或未解决问题:
  - 右键上下文菜单（ctx-lock-unavailable）未改动——UC 只要求 Widget Menu 提供锁定入口，
    右键菜单的锁定占位按钮不在本 feature 契约范围内，留给后续 feature（若产品需要）处理。
  - 锁定/解锁本身不进撤销栈（与 F19 的样式变更一致，非本轮引入的新不一致）。
  - F21（多选批量对齐/整理）未做，仍是 not_started，队列后续项。
- 下一步最佳动作: F21 或阶段收尾评估；F20 建立的 locked 短路点（styleInteractive/
  onEditRequest/deleteSelected/moveSelected/8 个样式 setter）是后续任何新增编辑类入口都要
  记得同步检查的清单。
