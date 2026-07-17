# 入口接线 + 错误反馈补齐（P0 团队钱包入口；P2/P3 其余，wave 0-2）

> 出处：gap-report.md 红行 2/8/11/12/14 及「声明废弃」两条。
> 源 uc：uc-credits-001、uc-home-004、uc-profile-001/005、uc-auth-001/002。

## A. 孤岛路由入口（D2 探针确认零引用）
1. **/credits（P0）**：uc-credits-001 前端入口1「Team 设置页面 > Credits」；oldcode
   参照 team-menu.tsx:109（isCreditsBilling && isTeamAdmin 时显示）。现状 team admin
   完全无法发现团队钱包整页。做法：teams 页（或 team-management.md 的管理壳）对
   owner/admin 露出 Credits 入口 → /credits?scope=team；个人 scope 由用户菜单弹窗
   继续承担（不动）。
2. **/recent（P2）**：uc-home-004 前端入口2「导航或首页中的 Recent 入口」。最低成本：
   Home 的 recent-boards 区块加「View all →/recent」；页面本身四态实现完好不用动。
3. **/billing（声明废弃）**：需求与 oldcode 均为弹窗方案且弹窗已实现有 e2e——移除
   /billing 整页或显式标注测试专用，billing-001 前两个 test 改走弹窗路径。**不补入口**。
4. **/payment-test（处置）**：开发测试页在生产路由暴露——加 NODE_ENV 门（复用
   p21-F01 的 dev/reset-token 模式）或移除。

## B. 错误反馈与会话边界（P2-P3）
5. **Settings 保存失败静默**（uc-profile-005 主流程10+E3/E4）：save() 非 ok 分支加错误
   提示（对照同页 PersonalInfo 的 err 模式）；非法值阻止保存并提示。
6. **加载失败卡死**（uc-profile-001/005 E2）：PersonalInfo/Settings 的 fetch 加失败分支
   （错误提示+重试），不再永久「加载中…」。
7. **已登录访问 login/register 重定向**（uc-auth-001 A4 / uc-auth-002 权限2）。
8. **登录↔注册互跳保留查询参数**（uc-auth-001/002 主流程4；与 invite-loop.md 的 next
   机制同一条实现线）。
9. **Terms/Privacy 假链接**（uc-auth-001 主流程2）：span 改真实链接（目标页可先占位）。
10. **无密码用户的改密表单**（uc-auth-006 权限2）：Security 区按 provider 隐藏或替换
    提示（API 兜底已存在）。

## C. 纯补测 / 补声明（P3，不改产品行为）
11. p2/p14 under-verification 分支补 e2e 断言：加载态（p2-F01）、error+retry（p2-F04）、
    支付失败页 UI + refresh-status（p14-F05）、页面级 403 forbidden（p14-F01）、
    最近白板日期（p2-F05——先定夺：补日期渲染 or 修剪行为文本）。
12. **p2-F02 行为文本与实现对齐**（红行 6，中高）：卡片声明的使用次数/最近使用/浏览量/
    喜欢数与「更多」滚动——要么随 p11 数据接入排期实现，要么修剪 user_visible_behavior
    并在 notes 声明裁剪。不允许维持现状（文本超出实现且无声明）。
13. p2-F06 notes 说「禁用态占位」但按钮实际无 disabled——一行对齐。

## D. 证据补救（P3，wave 2）
14. 11 条 passing 条目 evidence 指向不存在文件：p1 F01-F03、p2 F01/F02/F05/F07、
    phase-04 F05、p14 F01/F04/F05。重跑各自 verification、真实输出落盘、更新 evidence
    字段（p21-F06 对 p2-F04 的同款操作扩到全部；p14-F04 那条是 verify CLI 只写了
    时间戳，补跑落盘即可）。

## 验收线索
- 每条入口接线有「从 UI 点击到达」的 e2e（不许 goto 直达）；错误反馈项有对应失败
  分支断言；证据补救以 evidence 文件真实入库为完成标准。

## 范围与边界
- 存疑三项（Settings 选项集语义漂移 / sidebar 头像 / 登录统一话术 vs uc 专属提示）
  **不进本阶段**，等产品拍板后另行立项。
