---
name: mod-board
description: >
  激活条件：接到 Board（白板文档） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# Board（白板文档） — 模块知识库

> 本文件是 board 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
白板实体的 CRUD/列表/封面/标签/备份，以及 board 页面骨架（header/menu/statistics）——画布本体归 canvas 模块。

## 代码地图
- 页面：`apps/web/app/(app)/boards/`、`apps/web/app/(board)/boards/[id]/`；
  房间侧的 boards 列表页在 room 模块地界（`apps/web/app/(app)/rooms/[id]/boards/page.tsx`），
  但复制/收藏/建板走的是本模块的 API。
- 组件：`apps/web/components/board/`（canvas-viewport 属 canvas 域）、`components/board-list/`
- API：`apps/web/app/api/boards/`
- 数据层：`packages/data/src/board.ts`（CRUD/列表/收藏/复制/移动）、
  `packages/data/src/ids.ts`（`generateId`/`isValidPublicId`，board/room 共用）；
  备份表 031_board_backups.sql

## 关键契约与不变量（改代码前必读）
- More 面板层级契约 + Esc 关闭（#488/#512）；e2e 禁止硬编码坐标。
- boards.public_id 同 room 的约定（#471 阶段1 起）：`generateId("brd"/"rm")` 是唯一生成入口
  （`packages/data/src/ids.ts`），SQL 层禁止自己拼；`resolveBoardId`/`resolveRoomId` 是路由层
  唯一解析入口，两种格式都认，查不到统一落哨兵 id `-1`（交给既有 `if (!board) 404` 分支接管，
  不新增错误处理路径）。**任何在 `boards`/`rooms` 表新增 INSERT 语句的地方，必须显式写
  `public_id` 列**——该列现在是 NOT NULL（#530），没有 DB 默认值，漏写会让那条创建路径
  直接 500（#586 是活的教训：#583 收紧约束时漏了 3 处 INSERT）。
- 地址栏规范化到 public_id：board 详情页用 `window.history.replaceState`（不是
  `router.replace`），room 详情页用 `router.replace`——两者不能互换，见下方经验条目。
- 封面上传走 storage 包（S3/R2 兼容层），不直连。

## 关联阶段 / ADR / 文档
phases/phase-p5-board（roadmap 已标 done）、p7-board-shell、p24-room-board-management

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-12：地址栏规范化旧数字 URL → public_id 时，board 详情页**必须**用
  `window.history.replaceState`，不能用 `router.replace`（出处：#591）。根因：
  `router.replace` 会让 Next 感知 `params.id` 变化、重新渲染整棵页面树，而
  `components/board/board-canvas.tsx` 内部的协作 WebSocket 连接 effect 是
  `useEffect(..., [boardId])`——`boardId` prop 一变就被当成"切换到另一块白板"，
  触发多余的连接重建。真实回归：`widget-shape.spec.ts` 等 e2e 在 `goto` 数字 URL
  后立刻操作画布，撞上这个重连窗口，`window.__canvasTestApi` 短暂不可用，表现为
  间歇性失败（一开始以为是别的竞态，反复重跑才定位到是这个）。`history.replaceState`
  只改浏览器地址栏，不触发任何 React/Next 重新渲染，彻底避开这类下游 effect。
  房间详情页（`rooms/[id]/layout.tsx`）没有实时连接，用 `router.replace` 没问题
  （反而是优点：`roomId` 级联更新后其余 tab 链接自动跟着变成 public_id，不用逐个改）。
  **推论**：给任何 client component 页面加"改地址栏但不想触发重渲染"的逻辑前，
  先查页面树里有没有子组件的 effect 依赖了会变化的那个 route param 值。
- 2026-07-10：Widget Menu（浮动 context toolbar）算选区包围盒时，connector 类型
  不能直接用它自己落库的 `x/y/w/h`——那是创建时刻的初始包围盒，端点一旦绑定到别的
  组件，组件移动后这个值就陈旧了（出处：PR #525，coord-main review 抓出）。正确做法：
  和 `fabric-canvas.tsx` 里 `getItemScreenRect` 同一套口径，调
  `resolveConnectorEndpoints` 按当前绑定组件的实时位置重算最近锚点。已把这个函数
  从 `fabric-canvas.tsx` 导出（参数收窄成只含实际用到的字段，不要求完整
  `RenderItem`），board-canvas.tsx 可以直接复用，不用另起一套端点解析逻辑。
- 2026-07-10：改 `apps/web/app/(app)/rooms/[id]/boards/page.tsx` 之类的列表页前，
  先 grep 一遍某个看起来该有的函数（如 `dupButton`）**是否真的在 JSX 里被调用**——
  别的 PR 重构过一次列表 UI（挪到"更多操作"下拉菜单），留下一个定义了但从未渲染的
  死函数，对应 e2e 测试一直在等一个永远不会出现的元素，起初以为是自己的改动引入的
  回归，查了很久才发现是历史遗留（出处：#584 开发过程中撞见，follow-up 待修）。
- 2026-07-11：cover/board/rooms-boards 路由曾把 String(err) 回传给客户端（#539 修复）——错误信息只进日志，响应给稳定错误码。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
