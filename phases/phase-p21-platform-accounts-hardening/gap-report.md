# Platform/Accounts Gap 调研报告（2026-07-05）

> coord-platform 立项前调研。对照四方来源：oldcode（`phases/requirements/oldcode/boardx-web-develop`
> + `boardx-backend-develop`）、权威需求（phase-04 auth/team、phase-p1、phase-p2、phase-p14）、
> 权威功能清单（对应 `feature_list.json`）、当前实现（apps/web + packages/*）+ e2e/单测。
> 覆盖 auth、team、profile、home、billing/credits 五个域，只读调研，未改代码。

## 结论

Platform/Accounts 不是"功能缺失"问题，是**证据诚信 + 两处真实可利用的安全漏洞**问题：

1. **Auth 域 F01-F05 全部标 `passing`，但 evidence 字段指向的 5 个 verify log 文件在仓库任何位置都不存在**（`git ls-tree` 核实）。其中 **F05（社交登录）的 user_visible_behavior/verification 描述"返回 501 占位"，但实际代码是任何人 POST 一个白名单 provider 名字就能免密登录进 demo 账号**——这是一个被"passing"标签掩盖的认证绕过后门，且没有生产环境 gate。
2. **Team 域存在真实越权漏洞**：`apps/web/app/api/teams/[id]/members/[userId]/route.ts` 改角色/移除成员只校验操作者角色，不校验目标角色——任何 admin 可以把 owner 降级或移除；邀请接口也不禁止签发 `role:"owner"` 的邀请链接，可绕过前一个缺口另造一个 owner 实现团队接管。room 域（p20）已经修过同一类漏洞，team 域没跟进，两域权限校验规则不一致。
3. **Team F06-F09 同样 evidence 缺失**（底层代码是真的，commit 可查，但不满足"没有证据=没有完成"）；F13 的 DEFERRED 理由对 3/4 个子用例已经过时（依赖的 AI Store/AI 平面早已 passing）。
4. **Billing F04 是"半真半假"的 passing**：订阅弹窗和 credits 模式 tab 切换真实存在，但**"额度不足触发升级弹窗"这条因果链在代码里根本不存在**——402 错误只会显示错误文字，不会打开弹窗；那个看起来相关的"额度提示"横幅其实是无条件常驻展示的静态 UI，与真实额度判断无关。
5. **p2/p14 两个 phase 的 requirements 文件夹是从未填写的空模板**——意味着这两个阶段的 feature_list.json 是绕开"原始需求→requirement-author"流水线直接产出的，且 p1 的 README 关于 oldcode 字段来源的描述本身是错的（oldcode 没有 displayName/aiModel/privacy 字段，这是全新设计而非移植）。
6. 全域**零速率限制、零 CSRF token、session cookie 缺 secure 标志**——auth/team/billing 都受影响。

不需要推倒重来，需要一个**聚焦补救的 hardening phase**：证据补齐 + 两处安全漏洞热修 + billing F04 拉齐 + 若干需求/追踪文档同步。

## 分域证据摘要

### Auth（详见两轮独立审计，结论一致且互补）
- 核心安全实践本身是对的：bcrypt(10轮)、密码重置 token 一次性+30分钟、邮箱枚举防护（登录+忘记密码都统一报错）、社交登录 provider 集合与需求一致。**当前实现在"防枚举"和"重置 token 一次性"两点上比 oldcode 更安全**，值得保留。
- 遗漏：`callback`/`returnTo` 回跳完全没实现（需求主流程步骤，oldcode 有完整实现）；`confirm-email` 是硬编码 `Set(["demo"])` 的内存桩，从未接入已经存在、reset-password 在用的同一套 `email_tokens` 表；`uc-auth-005` 完全没有 `feature_list.json` 条目在追踪；条款/隐私政策链接不可点击；微信登录不是真二维码面板。
- 冲突：F05 三个字段（user_visible_behavior/verification/notes）互相矛盾，同一条目里"501 占位"和"demo 自动登录"两种描述不可能同时为真；F01-F05 evidence 全部缺失。
- 安全缺口：零速率限制（登录可无限重试穷举、忘记密码可无限触发发信）、零 CSRF、cookie 缺 `secure`、`/api/auth/social` 无生产环境 gate（对比 `/api/dev/reset-token` 已有 `NODE_ENV==='production'` 保护）。

### Team
- **越权核心**：`packages/auth/src/index.ts:95-97` 定义的 `canManageTeam` 只管操作者能不能动手，`teams/[id]/members/[userId]/route.ts` PATCH/DELETE 与 `packages/data/src/teams.ts` 的 `updateMemberRole`/`removeMember` 全程不检查被操作对象是不是 owner，`teams/[id]/invites/route.ts` 的角色校验也不禁止生成 owner 邀请。room 域权限矩阵统一后已有等价保护，team 域是更早期实现，未跟进。
- F06-F09 evidence 缺失（`sprint-02/evidence/` 只有空 `.gitkeep`），底层代码真实存在（commit `7e58dce`）。
- F13 复核：uc-007（团队改名/描述/删除）事实上已经在 commit `f603f45` 单独实现并配 e2e，但从未回写 `feature_list.json`；uc-008/010 依赖的 AI/AI Store 平面已 passing；只有 uc-009（团队 Memory）仍缺数据模型。
- `team_invites`（003_team.sql）比 `room_invites`（025_room_invites.sql，p20-F09 新做）功能弱一整代：无 email 绑定、无 status 枚举、无 invited_by、无索引，两套 CRUD 各自独立实现。

### Profile + Home
- 严重程度低于 auth/team，主要是**文档/追踪与真实实现脱节**：p2-F04（`/recent` 占位页）标 passing，但 verification 指向的 `e2e/recent-placeholder.spec.ts` 不存在；真实存在的 `home-004-view-recent-page.spec.ts` 测的是一个真实填充的最近列表，与 F04 的"占位页"描述直接相反。
- p1 README 声称 aiModel/privacy 字段来自 oldcode——核实后 oldcode User 实体没有这些字段，是全新设计，溯源描述本身有误；aiModel/privacy 偏好目前也没有被任何下游（AVA/Board）消费，是孤立设置项。
- F03/F06 的 blocked-on 表述过时：p9/p11 的基础能力已经 passing，真正卡住的是 p11:F03（Agent→AVA 桥接），不是笼统的"p9/p11 未接通"。
- oldcode 首页有"最近使用 Agent 遥测""Tutorials 轮播""Onboarding 导览""团队仪表盘"四项能力，p2 的 requirements/feature_list 完全没规划；当前首页的搜索框/快捷对话按钮视觉上具备欺骗性（`filterAgents` 有单测但从未被页面引用）。

### Billing/Credits
- F04 真实完成度：订阅弹窗（`billing-plan-dialog.tsx`）真实接入两处页面；"credits 模式路由"只是弹窗内手动 tab 切换，`billingMode` 在 `api/billing/route.ts` 里是硬编码字符串 `"subscription"`，没有任何配置驱动的路由逻辑；**"额度不足触发"确认不存在**——`ava/page.tsx` 的 402 处理只 `setSendError`，`setBillingOpen` 只在静态横幅的手动点击里被调用，横幅本身无条件渲染，与真实额度状态无关（本结论已用 Read 直接核实两版本分歧后确认）。
- 支付安全基建质量高于文字描述给人的印象：webhook 用 `timingSafeEqual` 共享密钥校验（fail-closed）、订单状态机幂等、e2e 覆盖了重复回调/金额篡改/密钥错误等失败态。
- 并发缺口：`packages/data/src/credits.ts` 的 `recordTransaction`（F02/F04 发放路径用）是 check-then-act，无 `balance>=0` 防透支条件；oldcode 对应逻辑有 `$gte` 原子防透支。AI 消费扣减钩子尚未接入，一旦 p9/p12 接入即是真实竞态/透支风险。`019_credit_transaction_idempotency.sql` 的历史回填脚本证明团队真的踩过一次这类竞态坑。
- `phases/phase-p14-credits-billing/requirements/*.md` 是从未填写的空模板——F01-F05 绕开了标准需求录入流水线。
- oldcode 参考：双轨计费（Stripe 订阅 + 微信积分，部署期二选一），**微信支付回调验签代码写好了但被注释禁用**（历史安全债，供未来任何迁移参考时注意，不代表当前系统受影响，当前 webhook 走的是不同机制）；无发票/退款实现（两边一致，非新增遗漏）。

## 建议：开 Phase p21 platform-accounts-hardening

不是推倒重来，是聚焦：证据补齐 + 两处安全漏洞热修 + billing F04 拉齐 + 若干需求/追踪文档同步。
具体切分见 `requirements/*.md` 与最终 `feature_list.json`。
