# 原始需求总览 — Room Realignment（Phase p20）

## 背景（为什么有这个阶段）

2026-07-03 的 Room gap 调研（对照 `phases/requirements/BoardX UI Prototype V1.html`、
`phases/requirements/oldcode/`、`phases/requirements/room/uc-room-*.md`、当前实现）发现：
Room 的骨架（Team → Room → 多 Board、owner/admin/member 三角色、多聊天线程）与设计意图一致，
但存在一批结构性 gap，其中三个属于**领域模型错误**：

1. **Room Files 被建模成聊天线程附属**（uc-room-005 把文件绑死「当前打开的聊天线程」），
   而原型是房间级 Files tab，旧后端 `room-file.schema.ts` 的 `chatThreadId` 只是可选过滤。
   后果：一个房间 N 个线程 = N 套互不可见的文件集，没有统一文件库。
2. **Survey 的 room 维度丢失 + 权限域错位**（uc-room-007 让房间 tab 展示 Team Surveys、
   把团队问卷管理权授给房间角色），原型是 My/Team/Room 三 scope。
3. **双画布模型残留**：`005_canvas.sql` 的「房间=单画布」旧路由（`/api/rooms/[id]/items`、
   `rooms/[id]/board/page.tsx`）与「房间含多 board」新模型并存，未下线。

其余 gap：无房间详情壳/tab 导航（散页）、创建时不能选可见性（与列表 Private 徽章矛盾）、
收藏房间未实现、删除级联无契约（DB 全 CASCADE 但 UI 无告知）、owner/admin 权限三处口径打架、
邀请未注册用户半成品、Room 实体丢失 description/aiInstruction/memories AI 上下文字段。

## 本阶段交付（对应各 uc-rr-*.md）

- uc-rr-001 房间详情壳与 tab 导航
- uc-rr-002 创建房间时选择可见性
- uc-rr-003 房间级文件库（核心修正）
- uc-rr-004 收藏房间
- uc-rr-005 删除房间的级联契约
- uc-rr-006 房间权限矩阵统一
- uc-rr-007 Room Survey 入口（房间作用域）
- uc-rr-008 邀请未注册用户完整流
- uc-rr-009 下线 legacy 单画布模型
- uc-rr-010 Room AI 上下文字段回补

## 明确不做（留给其他阶段）

- room-chat 真实 AI 回复与虚拟线程语义 → phase-p9 / phase-p4 F05。
- 文件内容进入 AI 上下文的 RAG 细节 → phase-p10（本阶段只做房间文件库与 sources 勾选 UI 契约）。
- Studio 产物导出为 Board Widget → 后续阶段（依赖 p6 canvas widget 能力稳定）。

## 权威设计参照

- 原型：`phases/requirements/BoardX UI Prototype V1.html`（ROOM DETAIL 六 tab、ROOM WORKSPACE 三栏、
  New Room dialog 可见性卡片、Room Settings dialog / Danger Zone）。
- 旧代码：`phases/requirements/oldcode/boardx-backend-develop/src/{rooms,room-files,rooms-subscription,room-chat}`、
  `oldcode/boardx-web-develop/docs/ROOM_*.md`。
- 本阶段 UI 先行确认按 p17 模式：核对 prototype 对应屏（见 `../ui-signoff.md`）。

## 关键取舍（已在 UC 中落定，UI 签核时请重点核对）

- **Tab 结构**：采用 `Boards / Members / Files / Chat / Survey` 五 tab（原型六 tab 中的 Studio
  不做顶级 tab，维持 p12 已实现的「聊天工作区右栏 Studio 面板」——与旧前端最终落地一致）。
- **可见性词汇**：沿用现有 DB 的 `private | team`（team = 原型的 public「团队内可发现加入」）。
- **文件存储**：复用 p10 CAP-FILE 平面（R2 预签名 + confirm），新增房间作用域，不另造上传栈。

## 依赖的能力平面

CAP-DATA（迁移）、CAP-WEB、CAP-FILE（p10 已建）、CAP-AI（p9 in_progress，仅 uc-rr-010 的注入部分）。
