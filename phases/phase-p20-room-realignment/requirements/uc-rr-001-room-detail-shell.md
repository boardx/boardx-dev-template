Use Case 名称：
房间详情壳与 Tab 导航

Actor：
Room member、Room admin、Room owner

目标：
用户进入一个房间后有统一的详情页外壳：面包屑、房间名、可见性标识、成员头像堆叠、Invite 入口，
以及 `Boards / Members / Files / Chat / Survey` 五个 tab 之间的常驻导航，不再是互不相通的散页。

系统边界：
BoardX / Room

前端入口：
1. 房间列表卡片点击 → `/rooms/[id]`（默认落在 Boards tab）。
2. 任何 `/rooms/[id]/boards|members|files|chats|surveys` 直链。

前置条件：
- 用户已登录且是该房间成员。

主流程：
1. 用户点击房间卡片进入 `/rooms/[id]`，系统默认展示 Boards tab。
2. 页头展示：面包屑（Rooms / 房间名）、房间名、可见性 pill（🔒 Private / 🌐 Team）、
   成员头像堆叠（最多 N 个 + "+X"）、Invite 按钮（owner/admin 可见，打开成员管理）。
3. tab 条展示 Boards / Members / Files / Chat / Survey 五项，当前 tab 高亮。
4. 切换 tab 时 URL 同步变化（`/rooms/[id]/boards` 等），支持直链分享定位到具体 tab。
5. Boards tab 复用现有 boards 列表页内容；Members tab 复用现有成员管理页内容；
   Chat tab 复用现有聊天列表/工作区；Files、Survey tab 内容由 uc-rr-003 / uc-rr-007 定义。

备选流程：
- A1：用户直接打开 `/rooms/[id]/members` 直链，壳与 tab 高亮正确呈现。
- A2：Chat tab 内进入具体线程三栏工作区后，页头壳可收敛为紧凑形态，但保留返回房间与 tab 导航能力。

异常流程：
- E1：非房间成员访问 → 403 页或跳回 `/rooms`，与现有行为一致。
- E2：房间不存在 → 404。

权限与可见性：
- 五个 tab 对 owner/admin/member 均可见；Invite 按钮仅 owner/admin。

后置条件：
- 房间内任意功能页共享同一外壳；旧的无壳散页路由 301/内部重定向到新结构。

不包含：
- Studio 不做顶级 tab（维持聊天工作区右栏面板，p12 已实现）。

业务规则：
- tab 顺序固定：Boards → Members → Files → Chat → Survey（对齐原型 roomTabDefs，去掉 Studio）。
- 所有 tab 与页头关键元素需带稳定 `data-testid`（room-shell、room-tab-boards 等），供 e2e 锚定。
