# 团队管理 UI 补齐（P1，wave 1；P2 防护项 wave 1-2）

> 出处：gap-report.md 红行 3/4/5/7/9/10/13。源 uc：uc-team-005、uc-team-006、uc-team-007、
> uc-auth-001 主流程13、uc-team-002 主流程3。

## 背景
uc-team-005 的成员管理界面与 token 用量/权限整块、uc-team-007 的团队管理页壳在
feature_list 里被静默收窄（F09 只写 API 行为、F15 名义覆盖 uc-team-007 实际只交付
General 区）——owner/admin 在产品界面上无法完成角色管理/移除成员。

## 原始需求（按优先级）
1. **成员管理界面**（uc-team-005 主流程1-2,6-7）：成员表格（姓名/邮箱/角色/加入时间），
   owner/admin 可对成员行操作：设为 admin / 设回 member / 移除成员；对 owner 行无这些
   操作（复用既有 API 与 owner 保护逻辑，team-010-owner-protection e2e 已覆盖 API 层）。
2. **团队管理页信息架构**（uc-team-007 主流程2-6）：Manage Team 进入管理壳，分组导航
   至少含 General / Members；Knowledge Base / Memory / AI Store 分组按现有实现状态
   接入或显式占位（F16 not_started 的 Home 统计/Store 不在本阶段）。team-switcher 的
   Team Knowledge Base 菜单项（uc-team-002 主流程3，#590 缓建项）随本项一并决定归宿。
3. **删除团队防误删闸门**（uc-team-006 主流程7-8+E3）：删除须输入与团队名完全一致的
   文本才可确认，不匹配提示。
4. **团队头像**（uc-team-006 主流程2-3）：上传/移除团队头像（若 CAP-FILE 复用成本低
   则做，否则显式声明 deferred 并在 feature notes 留痕——不许再静默消失）。
5. **注册后强制团队上下文**（uc-auth-001 主流程13）：注册成功且无任何团队时自动打开
   创建团队弹窗且不可直接关闭（业务规则「注册后必须获得 Team 上下文」）。
   ※ 与邀请流程互斥：从邀请链接注册的用户不弹（uc-team-002 业务规则1）。
6. **token 用量/权限**（uc-team-005 主流程2-5）：连 API 都不存在——本阶段**只立占位
   feature 标 blocked/not_started 并写明依赖**（需要用量统计数据源，疑似依赖 AVA/AI
   平面的 token 计量），不实现；目的是让这块需求在权威清单里可见，终结「无人认领地
   消失」状态。

## 验收线索
- e2e：owner 在管理界面把 member 升 admin、降回、移除，member 视角断言无操作入口；
  删除团队输错名字被拒；注册新用户落地即见不可关闭的创建团队弹窗，建队后进入 Home。

## 范围与边界
- 不做：uc-team-008/009/010（F13/F16 已声明）、成员分页搜索超出 uc 的增强。

## 已知约束
- UI 先行关卡适用（本文档大部分是新 UI）：ui-prototyper 先做真实界面 → 人类 confirmed
  → 才定稿 feature_list（ADR-003）。
- area:team 敏感（invite/成员权限），强制 rev-security。
