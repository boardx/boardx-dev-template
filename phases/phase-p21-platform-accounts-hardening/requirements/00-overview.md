# 原始需求（概览）— platform-accounts-hardening（Phase p21）

## 背景 / 为什么做

coord-platform（Platform/Accounts 模块协调者）对 auth/team/profile/home/billing 五个域做了一次
oldcode↔需求↔feature_list.json↔实际实现↔测试的纵向审计（详见同目录上级 `../gap-report.md`）。
发现的不是零星小问题，是两类地基级问题：

1. **证据诚信坍塌**：auth 域 F01-F05、team 域 F06-F09 全部标 `passing`，但引用的 evidence 日志文件
   在仓库里都不存在，违反 AGENTS.md"没有证据=没有完成"的硬约束。
2. **两处可利用的真实安全漏洞**被 passing 状态掩盖：auth 的社交登录是免密后门（F05 文字说是
   501 占位，实际是任何人可登录的 demo 账号）；team 的成员角色接口不检查目标是不是 owner
   （任何 admin 可降级/移除 owner，甚至能签发 owner 邀请另造一个 owner）。

此外还有一批优先级更低但值得顺带解决的问题：billing F04 的"额度不足触发升级弹窗"因果链不存在
（只是标签写的和代码做的不一样）；p2/p14 的 requirements 文件夹是空模板（流水线从未真正跑过）；
若干 blocked/deferred 状态已经过时。

这是一个**补救/加固 phase**，不是新功能 phase。目标是让 feature_list.json 的 `passing` 重新变得
可信，并消灭两处真实安全漏洞。

## 范围与边界

**本阶段要做**：
- 修复 team 成员角色接口的越权漏洞（owner 保护），对齐 room 域已有的权限矩阵模式。
- 修复/明确 auth 社交登录路由：要么加生产环境 gate + 如实改写 F05 描述，要么补齐 demo 账号
  的边界声明，总之不能让"免密登录"继续顶着"501 占位/passing"的标签。
- 补齐 auth F01-F05、team F06-F09 的 verify 证据（重新跑验证，日志真实落盘），证据无法补齐的
  一律打回 `in_progress`，不允许继续挂着假 `passing`。
- 补一条 `uc-auth-005`（confirm-email）对应的 feature，并把 confirm-email 从内存桩改接真实
  `email_tokens` 表（复用 reset-password 已验证过的机制）。
- 修复 billing F04：让"额度不足"真的能触发升级弹窗，或者如实改写 notes/verification 声明当前
  只是手动 tab 切换（产品需要拍板要哪种，若选择"补真实因果链"则本阶段实现；若选择"如实降级描述"
  则只改文档+verification，工作量小很多——具体见 billing.md 的切分提示）。
- 给 login / forgot-password 加最小速率限制；session cookie 补 `secure`（至少生产环境）。
- 更新过时的状态：team F13 拆分（007 回填 passing，009 单独建模）；p2 F03/F06 的 blocked_on
  更新为准确的上游 feature 编号；p1 README 的 oldcode 溯源描述纠错。

**明确不做（留到后续）**：
- CSRF token 全面接入（当前 `sameSite: lax` 提供部分防护，本阶段只做前述最小项，完整 CSRF
  方案留给后续安全专项）。
- 微信登录真二维码流程、callback/returnTo 回跳、条款链接可点击化——这些是真实遗漏但非安全类，
  优先级低于本阶段的证据+安全主线，可拆到下一个 p22 或按 backlog 处理。
- team_invites 表结构向 room_invites 对齐（是真实技术债，但不阻塞安全/证据主线，可独立立项）。
- billing 的 credit 扣减防透支 guard——AI 消费扣减钩子还没接入（p9/p12 的事），本阶段只记录风险，
  不提前实现用不到的防护。
- p2 首页 oldcode 里有但当前完全没规划的能力（最近使用 Agent 遥测/Tutorials/Onboarding/团队仪表盘）
  ——这是新功能范畴，不是 hardening，需要产品单独排期，不放进本阶段。

## 已知约束 / 依赖
- 依赖的能力平面：CAP-AUTH（`packages/auth`）、CAP-DATA（`packages/data`）、CAP-PAYMENT。
- 安全相关 feature（auth 越权修复、team 越权修复）必须过 rev-security 门禁，不能因为"看起来简单"
  就跳过。
- 所有 worker 用独立 git worktree；只派 Claude 系 worker（不用 codex）。

## 切分提示（给 requirement-author 的建议）
- 按 `auth.md` / `team.md` / `billing.md` 三份领域原始需求切 feature，profile/home 的追踪修正
  可以合并成一个小 feature（工作量小，不需要单独一份大文件）。
- 安全类 feature（team 越权修复、auth F05 修正）优先级最高、依赖最少，建议 wave 0。
- 证据补齐类（重新跑 verify）可以和对应的代码修复合并成同一个 feature（比如"修复越权 + 补齐
  F06-F09 证据"算一个 feature），不必强行拆成"先修代码再补证据"两个 feature。
