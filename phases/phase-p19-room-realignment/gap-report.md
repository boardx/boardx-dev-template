# Room 功能 Gap 调研报告（2026-07-03）

> 对照四方来源：UI Prototype（`phases/requirements/BoardX UI Prototype V1.html`）、
> oldcode（`phases/requirements/oldcode/`）、权威需求（`phases/requirements/room*/`）、
> 当前实现（apps/web + packages/data）。本报告是 Phase p19 的立项依据。

## 结论

Room 骨架（Team → Room → 多 Board → Widget、owner/admin/member、多聊天线程）与设计意图一致。
问题集中在：文件/Survey 的 scope 建模偏离原型与旧代码、房间详情壳缺失、F14 依赖的能力平面
（p10 CAP-FILE）已建成却未回接房间。

## 设计意图（原型 + oldcode 共识）

- 层级：Team → Room → Board → Widget。Board 带必填 `roomId`（oldcode boards.schema.ts:49）；
  删房级联删 subscriptions → boards（含 widgets）→ room（oldcode rooms.service.ts:72-82）。
- 原型 Room Detail 六 tab：Boards→Members→Files→Chat→Survey→Studio（roomTabDefs）；
  New Room 弹窗带 Private/Public 可见性卡片；Settings 弹窗含邀请、角色徽章（owner locked）、
  Danger Zone（"and its boards"）。
- 旧前端最终落地 3 tab（Board/Chat/Survey），File/Studio 折进 Chat 三栏侧栏
  （oldcode RoomTabsContainer.tsx:29、ROOM_CHAT_REFACTOR_DESIGN.md）；Room Chat 100% 复用 AVA。
- 旧 Room 实体带 description/aiInstruction/memories；成员表含 favorite；Room Files 是房间级，
  chatThreadId 仅可选过滤（oldcode room-file.schema.ts:44）。

## 领域模型错误（最关键）

1. **Room Files 被建模成聊天线程附属**（uc-room-005:58,67 绑定「当前打开的聊天线程」，
   前置条件要求先开线程）→ 一房 N 线程 = N 套互不可见文件集。原型/旧代码均为房间级。
2. **Survey room 维度丢失 + 权限域错位**（uc-room-007:28,63 房间 tab 展示 Team Surveys、
   房间角色管理团队问卷）；当前实现房间内无任何 survey 入口。
3. **双画布模型并存**：005_canvas 的「房间=单画布」路由（/api/rooms/[id]/items、
   rooms/[id]/board/page.tsx）与 007/012 的多 board 模型同为活路由。
4. **权限口径三处打架**：数据层 canManageRoom=owner∨admin（rooms.ts:98）vs phase-04 F12
   描述「仅 owner」vs role-diagrams 里 owner=admin。
5. **删除级联无契约**：uc-room-004:59 回避清理策略，DB 实际全 ON DELETE CASCADE，UI 无告知。

## 需求 vs 原型 gap

- 创建时不能选可见性（uc-room-001:60）却要求列表 Private 徽章（uc-room-002:27）——需求内部矛盾。
- 六 tab → 三 tab；Board 能力在 room 需求集内无 UC 承接（room-interaction-diagram.md:9-12 断链）。
- 角色图 owner/admin 节点相同且缺 Survey/Studio 节点。
- Studio 产物不再导出 Board Widget（uc-room-006:57 排除）。

## 实现 vs 需求 gap

- F14（文件/Studio 入口/问卷）整块 deferred；p10 已建 CAP-FILE 但 feature_list 0 处提 room；
  聊天左栏是占位文案（rooms/[id]/chats/[chatId]/page.tsx:367-370）。
- 无房间详情壳：rooms/[id]/ 下无 page.tsx，boards/members/chats 是散页
  （boardx-prototype-mapping.md:89 自认「❌ 新建」）。
- 收藏房间未实现（uc-002:31 要求；board 有 009_board_favorites，room 无）。
- Room 实体丢 description/aiInstruction/memories。
- 邀请未注册用户半成品（token 不持久化、不发邮件；旧后端有完整 inviteNewUserToRoomByEmail）。
- p4 F05 标 blocked 但桩实现+e2e 俱在（追踪失真）；虚拟线程语义未实现（010_room_chat.sql:3）。

## 修复方案

→ 本阶段 `requirements/uc-rr-001..010.md` 与 `feature_list.json` F01-F11。
不在本阶段：room-chat 真实 AI 回复/虚拟线程（p9/p4）、RAG 注入（p10）、Studio 产物落 Board（后续）。
