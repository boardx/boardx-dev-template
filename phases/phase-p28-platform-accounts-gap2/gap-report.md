# Platform/Accounts 五维差距审计报告（2026-07-14）

> 审计人：coord-platform。基准：origin/main @ b5e52ba（审计专用干净 worktree）。
> 方法：五维诊断（本报告即 D1-D5 结论汇总）。与 p21 那轮 feature 级审计的区别：
> 本轮下钻到**需求行级**（uc 文档逐行 → feature → e2e 锚点），并加了三个自动化探针。
> 触发背景：p21 审计后仍连续暴露四类漏网缺陷（/home 未接线 #481、uc-team-002
> 侧栏入口整行被丢 #589、p14-F04 假 testid #483、admin 布局偏离设计稿 #476），
> 说明 feature 级审计粒度不足。

## 方法与探针（可复用）

| 维度 | 手段 | 本轮结果 |
|---|---|---|
| D1 需求行级覆盖 | 3 个并行 agent 逐行映射 uc → feature → e2e 锚点 | auth+team 331 单元红≈48；profile 81 单元红 9；home/billing/credits 红 8 |
| D2 可达性 | 静态探针：路由 vs 全部入口写法（href/href:/push/replace/redirect/location.href） | 3 个真孤岛路由（/recent /credits /billing） |
| D3 验证契约真实性 | 静态探针：e2e getByTestId ↔ 代码 data-testid 双向 diff（含模板字面量归一化 + 灵敏度对照） | 我域 0 悬空；board/room/widgets 域 8 悬空（已转交，见 issue） |
| D4 设计稿/oldcode 平行对照 | 并入 D1/D2 的 oldcode 考古（TeamSelector/team-menu/UserMenu） | 见各红行出处 |
| D5 证据完整性 | 静态探针：passing 条目 evidence 路径存在性（phase/sprint 双候选） | 我域 30 passing 中 11 条证据指向空气 |

探针脚本使用注意（本轮踩过的探针自身的坑，防复用翻车）：
- testid 探针必须做**灵敏度对照**（注入已知假 id 验证能抓到）——初版曾因模板前缀
  含 `?` 通配符导致全部漏报（0 悬空假象）。
- evidence 探针要同时试 `phases/<phase>/` 与 `phases/<phase>/sprints/*/` 两级路径，
  否则 24/30 误报。
- 可达性探针要覆盖 `href:` 对象属性写法（RAIL_ITEMS 等），否则 /ava、/ai-store 误报。

## 红行总表（按优先级，出处见 requirements/ 各文档）

### P0 — 用户核心路径断裂（wave 0）
1. **邀请闭环三连断**（uc-team-003/004 + uc-auth-001/002，挂在 passing 的 F08/F01/F02 名下）：
   a) 复制的邀请链接指向不存在的 `/teams/join` 页 → 受邀者 404；
   b) 唯一邀请页 `/invite/[token]` 是只认硬编码 `demo` 令牌的 stub，不认真实令牌；
   c) login/register 完全忽略 `next`/returnTo → 未登录受邀者登录后被丢回首页，上下文丢失。
2. **团队钱包不可达**（uc-credits-001 前端入口1 + oldcode team-menu.tsx:109）：/credits
   整页（团队余额/摘要/流水，全部 passing）在 teams 相关页面零链接，team admin 无法发现。

### P1 — 整块需求无声明消失（wave 1）
3. **成员管理 UI 缺失**（uc-team-005 主流程1-2,6-7）：设 admin/降级/移除只有 API+e2e，
   产品界面无任何成员管理组件，owner 无替代路径。
4. **token 用量/权限整块消失**（uc-team-005 主流程2-5+E5）：连 API 都没有，feature_list
   无条目无声明。
5. **团队管理页壳缺失**（uc-team-007 主流程2-6）：F15 名义覆盖实际只交付 /teams General
   区；Members/Memory/KB 分组导航无声明。（Home 统计/Store 由 F16 声明 not_started，不算红）
6. **p2-F02 行为文本超出实现**：卡片声明的使用次数/最近使用时间/浏览量/喜欢数在 Agent
   类型上就不存在，「更多」横向滚动无实现；notes 只声明了数据源等 p11，没声明字段缺失。

### P2 — 防护/反馈缺失（wave 1-2）
7. 删除团队缺「输入团队名确认」闸门（uc-team-006 主流程7-8+E3）。
8. Settings 保存失败 UI 完全静默（uc-profile-005 主流程10+E3/E4）；资料/设置加载失败
   永久卡「加载中」（uc-profile-001/005 E2）。
9. 注册后无团队时应自动打开创建团队弹窗且不可直接关闭（uc-auth-001 主流程13）——未实现。
10. 团队头像上传/移除（uc-team-006 主流程2-3）——未实现无声明。
11. /recent 无入口（uc-home-004 前端入口2 明确要求导航/首页入口；Home recent 区块加
    View all 链接即可）。
12. 已登录访问 login/register 不重定向（uc-auth-001 A4/uc-auth-002 权限2）。
13. team-switcher 缺 Team Knowledge Base 菜单项（uc-team-002 主流程3；#590 时因无团队级
    KB 显式缓建——归并入 #5 团队管理页时一起决定）。

### P3 — 低危/文案/纯补测（wave 2）
14. 登录↔注册互跳不保留查询参数；Terms/Privacy 是假链接（span）；确认邮箱成功后跳转
    与 uc 不符；无密码用户仍见改密表单；p2/p14 一批 under-verification 分支
    （失败页 UI、骨架、error+retry、日期字段）——详见 requirements/。
15. **证据补救**：11 条 passing 的 evidence 指向不存在文件（p1×3、p2×4、phase-04 F05、
    p14 F01/F04/F05）——重跑 verification 落盘（p21-F06 对 p2-F04 的同款补救，扩到全部）。

### 处置为「声明废弃」而非补入口
- **/billing 整页**：需求与 oldcode 均为弹窗方案（已实现且有 e2e），整页是实现期多余
  产物——建议移除或显式标注测试专用，billing-001 前两个 test 改走弹窗。**不补入口**，
  避免双入口双实现漂移。
- **/payment-test**：开发测试页，生产路由暴露需单独评估（本 phase 内处置）。

### 存疑（需产品/人类拍板，不进 feature_list）
- Settings 选项集语义漂移：需求写部署模式（Auto/Local first/BoardX cloud）+5 级隐私，
  实现是 3 个模型名 + private/team 两级——从未声明偏差。
- sidebar 账号菜单不渲染已保存头像（头像整体是文本 seed 占位）。
- 登录错误统一话术 vs uc 的「无密码账号专属提示」（疑似有意防枚举，方向冲突）。

## 跨域移交（不在本 phase）
- D3 探针在 board/room/widgets 域发现 8 个悬空 testid（board-ai-overlay、
  room-board-p24-management、room-rr-005-favorite、widgets-001/004 五个 spec）——
  已开 issue 移交 coord-board/coord-room。

## 统计
- D1 审计单元合计 ≈493：绿 ≈353 / 已声明缺口 ≈70 / 红 ≈65 / 存疑 ≈11
- 共性结论：主流程与权限覆盖扎实；红行 80% 集中在**异常流/备选流/入口接线**；
  p14 的 e2e 质量显著高于 p1/p2（快乐路径模式）。
