# 原始需求总览 — Room IA Realignment（Phase p22）

## 背景

2026-07-07 对照 UI Prototype（`phases/requirements/BoardX UI Prototype V1.html`）、oldcode
（`phases/requirements/oldcode/`）与当前实现，对 Room 的**信息架构**（不是数据模型——p20
阶段已把 Room→Board/Files/Survey/Chat 的归属关系修对）做了复核，人类用户也给出了明确的
UI 参照截图：**Rooms 应用被点击后，内容区应该是左右两栏：左栏是房间列表，右栏是当前选中
房间的详情（含 tabs），不是"点列表跳整页详情"的模式**。

调研发现 4 个信息架构问题，按修复优先级排列（不是发现顺序）：

## 优先级 0（最核心）：缺失主从（master-detail）双栏布局

现状：`/rooms` 是独立整页列表（grid/list 卡片），卡片是 `<a href="/rooms/[id]/boards">`
普通链接跳转，会整页替换掉列表；`/rooms/[id]/layout.tsx` 的 `room-shell` 是纵向单栏
（`flex flex-col`），从面包屑到 tab 到内容占满整个内容区，完全没有房间列表侧栏。

应该是：左栏房间列表常驻可见（可搜索/筛选/收藏），右栏渲染当前选中房间的详情/tabs，
切换房间时左栏不消失、右栏内容替换——类似 Slack 频道列表 + 频道内容的复合视图。

这是路由和组件树的根本重构：`/rooms` 和 `/rooms/[id]/*` 需要从"两个可互相跳转的页面"
合并成"一个页面内的两个区域"（可以是 `/rooms` 一个路由内部用 client state 或 parallel
routes 驱动右栏，也可以保留 `/rooms/[id]/...` 的 URL 结构但把左栏做成跨这些路由共享的
persistent layout）。

## 优先级 1：Files 双入口职责边界从未定义

`/rooms/[id]/files/page.tsx`（Files tab）是全功能管理页：搜索/按线程过滤/上传队列/预览
签名 URL 刷新/二次确认删除。`chats/[chatId]` 内嵌的 `RoomFilesPanel` 组件是瘦面板：只有
勾选（作 AI 上下文）、简单上传，无搜索/预览/删除——其空态文案直接写"前往 Files tab"，
代码自曝这是权宜设计。两者各自独立请求同一个 `/api/rooms/[id]/files`，语义上是同一份
数据的两个视图，但从未有文档记录"谁是权威视图、面板缺失的能力是不是有意裁剪"这个决策。

需要显式定义：Files tab = 权威管理视图；Chat 内面板 = 只读+勾选的轻量引用视图，明确
面板不做管理操作是产品决策而非能力缺失，并在两处 UI 上体现这个关系（比如面板标题
"文件库"旁加个跳转 Files tab 的入口，而不是靠空态文案兜底）。

## 优先级 2（评估型，非确定要做）：Studio 独立性

原型 `roomTabDefs` 把 Studio 列为与 Chat 并列的顶级 tab（`isRoute:true`），但原型自己的
运行时行为对此含混——点 Chat 或点 Studio 打开的是同一张三栏画面。oldcode 后续的工程重构
（`ROOM_CHAT_REFACTOR_DESIGN.md`）出于代码去重把 Studio 面板收进了 Chat 内部，这个决策
从未有文档评估对可发现性的影响。当前实现完全跟随了这份重构文档的最终态：Studio 没有
独立路由，只在打开某条聊天线程后才可见。

本阶段先只做**评估**：UI 原型阶段人类确认时一并决定，是否要给 Studio 加一个独立入口
（哪怕只是从 Chat 三栏内跳转到一个"聚焦模式"），还是维持现状、只是在文案/视觉上让用户
更容易发现它藏在 Chat 里。不预先假定必须改。

## 优先级 3（评估型）：Board 面包屑回退

Board 数据上严格属于 Room（`boards.room_id NOT NULL`），但列表卡片跳到扁平的
`/boards/[id]`，该页面全文没有任何链接指回所属房间；这个缺口在原型和 oldcode 里也一直
存在（两边 Board 都是与 Room 平级的路由，不是嵌套），所以这不是"改坏了"，而是三代设计
都没解决的历史空白。本阶段评估是否值得现在补一个轻量的"返回房间"面包屑/链接。

## 范围与边界

- 本阶段要做：至少交付优先级 0（双栏布局）与优先级 1（Files 职责边界文案/入口）。
- 视人类 UI 确认结果决定是否连带做优先级 2/3。
- 明确不做：Board/Canvas 画布功能本体、Chat/Survey 功能本体、Studio 生成能力本体——
  只动导航/布局/入口，不碰这些领域的业务逻辑。

## 已知约束 / 依赖

- 依赖的能力平面：CAP-WEB。
- 依赖 p20 阶段已完成的 Room 数据层与 API（Room/Board/Files/Chat/Survey 归属关系），
  本阶段不改这些 API 的语义，只改前端如何组织和导航到它们。
- 双栏布局需要考虑移动端/窄屏降级（可能退化回当前的整页跳转模式）。

## 切分提示（给 requirement-author 的建议）

- 期望的 feature 粒度：F01 双栏壳（左房间列表+右详情区）单独一个 feature；F02 把现有
  Boards/Members/Files/Chat/Survey 五个 tab 内容接入右栏（复用既有页面组件，改造成不
  整页跳转）；F03 Files 职责边界（文案+入口）；F04（评估后再定）Studio 入口调整；
  F05（评估后再定）Board 面包屑。
- 优先级/先后依赖：F01 是地基，F02 依赖 F01；F03/F04/F05 互相独立，可在 F01/F02 落地
  后并行。

## UI 先行确认（本阶段 has_ui: true，见 ADR-003）

必须先由 ui-prototyper 用真实组件把双栏布局做出来（`apps/web` + mock 数据），人类核对
截图/交互后把 `ui-signoff.md` 的 `status` 改为 `confirmed`，才能生成 feature_list 进入开发。
