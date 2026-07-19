---
name: mod-devportal
description: >
  激活条件：接到 DevPortal（协作平面门户，develop.boardx.us） 模块的 feature/bug/review/勘探任务时，动手前先读本 skill。
  这是该模块的活知识库（定位/代码地图/契约/经验），由每个在此干活的开发者与 agent
  持续回流迭代（规则见文末）。
---

# DevPortal（协作平面门户，develop.boardx.us） — 模块知识库

> 本文件是 devportal 模块的**单一经验沉淀点**（人类拍板 2026-07-12：每模块一个 skill，
> 让任何开源开发者都能持续迭代模块的 SOP/技巧/知识结构）。读完你应该知道：
> 代码在哪、什么不能破坏、前人踩过什么坑。

## 一句话定位
独立自包含 app（apps/devportal）：Cloudflare Pages + Access 门禁，展示本仓开发状态（P23 五板块的协作面版本）。

## 代码地图
- 全部代码：`apps/devportal/`（零 @repo 依赖、零越界 import——刻意自包含）
- 适配层：`lib/access.ts`（Access JWT 验签）、`lib/repo-files.ts`（GitHub Contents 替代 fs）、`lib/portal-fetch.ts`（401 自动重认证）、`lib/coord-gateway.ts`（协调面读的唯一入口：gateway claims/events，ADR-017）
- 数据源：GitHub Contents/REST + coord-gateway（RepoHub DO；`COORD_GATEWAY_URL`+`GITHUB_REPO` vars，`COORD_API_TOKEN`/`COORD_GATEWAY_ADMIN_TOKEN` 加密 secret）——旧 coord-service（COORD_SERVICE_*）已于 2026-07-18 退役
- 部署：`wrangler.toml`（唯一配置事实源）+ CD deploy-devportal.yml

## 关键契约与不变量（改代码前必读）
- 与产品面 portal 是**有意的双份**（数据源/门禁不同），不共享代码。
- 必须验 Access JWT，不能裸信 email 头（pages.dev 直连可伪造）。
- **compatibility_date ≥ 2024-11-11**（fetch cache 选项门槛，2026-07-12 全站事故）。
- 云端 env 变更与部署必须原子（先加后删/同 PR），CD 活跃时先删后合会被踩中。

## 关联阶段 / ADR / 文档
issue #523/#543；wrangler.toml 头注；apps/devportal/README.md

## 模块 SOP
1. 动手前：读本文件 + 对应 feature 的 `user_visible_behavior`/`verification`；跑 `pnpm harness doctor --phase <相关 phase>` 确认没接手一个带审计债的现场。
2. 开发中：独立 worktree（ADR-005）；UI 改动跑 `lint-design.sh`；敏感 area（auth/billing/admin/share/invite）主动挂 rev-security。
3. 交付：`verify --sprint` 门控；PR 描述里写清对上述契约的影响面。
4. 收尾：有新经验 → 按下方规则回流本文件。

## 踩坑与经验（append-only，最新在上）
- 2026-07-19：p30-F05 /onboard 接真——GitHub App 安装流的 CSRF 防护与 OAuth 登录流
  同构：安装链接（`https://github.com/apps/<slug>/installations/new?state=<nonce>`）
  与登录 authorize 一样只需一次性 nonce 签入 HttpOnly cookie，回调核对 query.state
  与 cookie 解出的 nonce 一致即可，直接复用 `lib/oauth.ts` 的 signState/verifyState
  （新增 `lib/onboard.ts` 只是包了一层不同的 cookie 名/Path，未重新发明）；GitHub App
  的「Setup URL」必须指到一个 **Route Handler**（`/api/coord/onboard/callback`）而不是
  页面本身——RSC 页面组件无法在渲染时清 cookie，回调必须走能返回带 header 的 Response
  的路由，校验完再 302 到 `/onboard?installation_id=`（同 F02 OAuth callback 模式）。
  `/onboard` 因为需要发起人真实 GitHub 身份判定 admin 权限，从"批次 3 无身份读取"的
  原型假设转为 middleware matcher 内的受保护路由（出处：p30-F05 PR）。
- 2026-07-19：p30/F02 灰度期跟进（#769，rev-security 非阻断项收尾）——session cookie
  TTL 7d→24h + `__Host-` 前缀（要求 Secure+Path=/+无 Domain，本 cookie 三者已满足，
  只改名不改属性）+ middleware 静默续期（剩余寿命 < 半程 TTL 时重签 Set-Cookie，
  `lib/session.ts` 新增 `resolveSession`，`getSessionUser` 降级为薄封装）；
  `lib/access.ts` 的 Access JWT 回退栈 `CF_ACCESS_AUD` 从"配置了才校验"补上"未配置
  时每进程 warn 一次"（向后兼容：仍不强制拒绝，只是从静默变可观测）；「轮换
  SESSION_SECRET = 紧急全员登出」写进 README.md 运维小节——这是当前唯一现成的服务端
  session 吊销手段（无黑名单，Access 回退通道不受影响）。
- 2026-07-19：p30-F02 D3 阶段 2 灰度落地——`middleware.ts` 是「谁需要登录」的唯一事实源
  （matcher 只含 /me*、/p/*；公开层四路由零鉴权）；身份读取统一走 `lib/session.ts` 的
  getSessionUser（OAuth session cookie 优先，Access JWT 回退，灰度期双栈）；公开层防回退
  由 `tests/public-layer-static.test.ts` 静态断言把守（import 闭包内禁 lib/access /
  next/headers / cookie 读取，改公开层组件先看它）。新增 Pages secret：SESSION_SECRET、
  GITHUB_OAUTH_CLIENT_SECRET（原子纪律：先 put 再合）。Access 收缩到治理面是人类 dashboard
  操作，代码侧不删任何 Access 配置（出处：p30-F02 PR）。
- 2026-07-18：p29 全周期三条协调层经验（出处：p29 sprint01-05 evidence + PR #697-#737）：
  ①「全部合并了」类转述必须逐 PR 锚定核验（gh pr view --json state），#733 曾被误当已合并，
  差点造成协调层双权威窗口（P23 postmortem §9 的跨会话版）；②vitest 2 不认 --grep，
  verification 契约里写 --grep 的要么走翻译层（coord-gateway scripts/run-tests.mjs）要么用
  -t/全量包测试；③agent API 与人类门户有意分域：webhook/MCP/REST 走 workers.dev
  （coord-gateway.boardx.workers.dev），develop.boardx.us 整站 Access 门禁挡非交互客户端。
- 2026-07-18：协调层割接 coord-gateway（p29-F10 stage-2，ADR-017）——COORD_SERVICE_URL var、COORD_BROKER_TOKEN/COORD_DISPATCH_TOKEN secret 全部退役；my-tokens 只剩 coord-gateway 按仓 scoped 通道（响应不再有 broker_configured 字段）；coordination/agents/my-home/pulse 的租约读面统一走 `lib/coord-gateway.ts`（gateway /claims+/events 需 bearer，不再有公开 /status）。Pages 侧残留的两个旧 secret 由人类在 dashboard 删除，代码已不读。
- 2026-07-12：compatibility_date 2024-11-01 < cache 选项门槛 → 所有出站 fetch 抛异常，全数据源 unreachable（#593）。toml 入仓沿用项目现值，别抄模板。
- 2026-07-11：先删 secrets 等 toml 接管，被 CD 中途部署踩中断供——env 变更原子性（记忆已固化）。
- 2026-07-12：Access 会话过期（24h）曾被渲染成"数据源不可达"（#588 修复：401 自动整页重认证）。

## 知识回流规则（本文件怎么迭代——这是这个 skill 存在的意义）

1. **谁干活谁回流**：在本模块交付 feature/修 bug/做 review 时，踩到新坑、建立新做法、
   推翻旧假设 → 在同一个 PR（或紧随的小 PR）往下方"踩坑与经验"**追加**一条：
   `- YYYY-MM-DD：一句话结论（出处：PR/issue/postmortem 链接）`。append-only，不删旧条目
   （被推翻的旧经验标 ~~删除线~~ 并注明被哪条取代）。
2. **module coordinator 每 C-cycle 复盘**：检查本周期内本模块合并的 PR，有值得沉淀而
   没回流的，补写（这是 ADR-010 "SOP 持续迭代"的落点）。
3. **结构变更**（新增章节/重组）走正常 review；追加"踩坑与经验"条目可随任意 PR 顺带。
4. 开源贡献者同权：任何人对本模块的经验修订都走 PR，以可验证事实为准，不看资历。
