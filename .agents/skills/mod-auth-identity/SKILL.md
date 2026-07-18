---
name: mod-auth-identity
description: >
  激活条件：接到 Auth / Identity（认证与身份） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# Auth / Identity（认证与身份） — 模块知识库

> 本文件是 auth-identity 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
注册/登录/会话/邮箱确认/团队与个人资料——敏感 area；协作平面的身份（ADR-011）是另一条线但共享概念。

## 代码地图
- 包：`packages/auth`；组件 `apps/web/components/auth/`
- 页面：login/register、`(app)/account/`、`(app)/teams/`、profile（p1-profile-common）
- 邮箱确认：029_email_confirmation 迁移

## 关键契约与不变量（改代码前必读）
- **auth/invite/share 是敏感 area**：强制 rev-security。
- 会话/密码处理绝不进日志；错误响应不区分"用户不存在/密码错"（防枚举）。
- 协作平面身份权威是 coord-gateway（按仓 RepoHub DO 的 agent_tokens，ADR-011/ADR-017），产品身份别和它混用。

## 关联阶段 / ADR / 文档
phases/phase-04-identity-and-spaces、p1-profile-common；ADR-011

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-10：uc-team-002 明确指定的「左侧团队头像菜单」入口在 F07 标 passing 时整行被丢，只交付了 /teams 整页 Switch 按钮——feature 级验收不够，要做需求**行级**映射（主流程/前端入口每行都有 e2e 锚点）；oldcode 的 TeamSelector.tsx 是该入口的设计参照（出处：issue #589 / PR #590）。
- 2026-07-09：p2 Home 工作台全部 passing 却建在从未接入导航的 /home，登录落地页一直是旧占位页——「建成」不等于「可达」，交付时要验证入口接线真的指到新页面（出处：issue #481 / PR #482）。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
