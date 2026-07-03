Use Case 名称：
Room Survey 入口（房间作用域）

Actor：
Room member（答题/查看）、Room owner/admin（创建/管理房间问卷）

目标：
问卷获得真正的 room 作用域（对齐原型 My/Team/Room 三 scope 与 `Room · Alpha` 样例），修正
uc-room-007 的两个错误：①房间 tab 展示的是 Team Surveys；②把团队问卷管理权授给房间角色。

系统边界：
BoardX / Room + Survey（复用 p13 已建的 surveys 能力）

前端入口：
房间详情壳的 Survey tab（uc-rr-001）。

前置条件：
- 用户已登录且是房间成员；p13 surveys 表已存在。

主流程：
1. surveys 数据模型增加可空 `room_id`（scope 判定：room_id 非空 = 房间问卷；否则维持团队问卷）。
2. 房间 Survey tab 默认只列**本房间**问卷卡片（标题/状态/回收数），不再嵌入 Team Surveys 全集。
3. owner/admin 可在 tab 内新建房间问卷（进入 p13 创建器，预置 room_id）、暂停/删除本房间问卷。
4. member 可打开问卷答题（复用 p13 公开答题页）与查看已发布结果（沿用 p13 权限规则）。
5. 全局 /surveys 列表增加 scope 过滤展示（My/Team/Room 徽章），Room 问卷标注所属房间名。

备选流程：
- A1：tab 内提供「View team surveys」链接跳转全局 /surveys（只是导航，不在房间内管理团队问卷）。

异常流程：
- E1：非房间成员访问房间问卷管理 → 403。

权限与可见性：
- 房间问卷的管理权属于**房间** owner/admin；团队问卷的管理权仍属团队侧（p13 既有规则），
  房间角色不再越权管理团队问卷。

后置条件：
- 每张问卷有唯一 scope；房间 tab 与全局列表口径一致。

不包含：
- 问卷功能本体改动（题型/答题/报告均沿用 p13）。

业务规则：
- 迁移向后兼容：存量问卷 room_id=null，全部视为团队问卷。
- tab 与卡片带 `data-testid`（room-survey-tab、room-survey-card、room-survey-create）。
