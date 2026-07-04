# 原始需求 — Auth 域加固（Phase p21）

## 背景 / 为什么做
Auth 域的 6 个用例需求文档齐全、核心安全实践（bcrypt、一次性重置 token、防邮箱枚举）也做对了，
但 `feature_list.json` 的 F01-F05 全部标 `passing`，其 evidence 字段指向的 5 个 verify log 文件
在仓库任何地方都不存在（`git ls-tree HEAD evidence/` 核实）。其中 F05 更严重：文字描述是
"GET /api/auth/social/:provider 返回 501 占位"，但实际代码是 `POST /api/auth/social` 只要
provider 在白名单里（google/facebook/wechat）就直接创建/复用 demo 账号并登录成功——是一个
被"passing"标签掩盖的认证绕过后门，且没有任何生产环境 gate（对比 `/api/dev/reset-token` 已有
`NODE_ENV==='production'` 时 404 的保护）。

## 原始需求（用户故事 / 大白话都行）
- 作为安全审计者，我想要 F01-F05 的 passing 状态背后有真实可查的验证日志，以便信任这个状态不是
  编造的。
- 作为平台方，我想要 `/api/auth/social` 这个 demo 登录桩不可能在生产环境被意外触发，以便不会
  出现"任何人 POST 一下就能免密登录"的账号伪造漏洞。
- 作为产品/工程负责人，我想要 feature_list.json 里 F05 的文字描述（501 占位）和它的验证命令、
  它的实际代码行为三者一致，以便下一个读这份清单的人不会被误导。
- 作为用户，我想要邮箱确认（uc-auth-005）是一个真实生效的功能而不是硬编码 `Set(["demo"])`
  的桩，并且这个用例本身要出现在权威功能清单里被追踪。
- 作为用户，我想要连续多次输错密码或反复触发忘记密码邮件时系统有基本的节流保护，而不是可以被
  无限次穷举/骚扰。

## 验收线索（可观察的成功是什么样）
- F01-F05 各自的 verification 命令重新跑一遍能拿到真实退出码 0 的输出，日志文件真实落盘在
  `evidence/` 目录并能被 `git ls-tree` 找到；跑不通的条目状态诚实地打回 `in_progress`，不再挂
  假 `passing`。
- `/api/auth/social` 在 `NODE_ENV==='production'` 时要么直接拒绝（如 404/403），要么必须配置真实
  provider secret 才可用；F05 的 `user_visible_behavior`/`verification`/`notes` 三者互相一致，
  如实描述"demo 登录桩 + 生产环境 gate"这个真实行为，不再自称"501 占位"。
- `feature_list.json` 里出现一条对应 `uc-auth-005-confirm-email` 的 feature（当前完全没有），
  且其实现改为真实读写 `packages/data/src/auth.ts` 已有的 `email_tokens` 表（`type` 字段已支持
  任意值，只需新增 `confirm_email` 类型的调用方，复用 reset-password 验证过的同一套机制），
  不再是 `Set(["demo"])` 的内存桩。
- 登录失败和忘记密码请求有可观察的节流效果（比如短时间内多次失败后返回节流提示，而不是无限
  放行）；`apps/web/lib/session.ts` 写 cookie 时在生产环境下带 `secure: true`。

## 范围与边界
- 本阶段要做：F01-F05 证据补齐（或诚实降级）、F05 的描述/gate 修正、uc-auth-005 补 feature +
  接真实 email_tokens、登录/忘记密码最小限流、session cookie secure 标志。
- 明确不做：`callback`/`returnTo` 回跳、微信登录真二维码面板、条款链接可点击化、完整 CSRF token
  方案、社交账号邮箱冲突合并逻辑——这些是真实遗漏但非本阶段安全/证据主线，留到后续。

## 已知约束 / 依赖
- 依赖的能力平面：CAP-AUTH（`packages/auth/src/index.ts`）、CAP-DATA（`packages/data/src/auth.ts`
  的 `email_tokens` 表）。
- `/api/auth/social` 的 gate 修正必须过 rev-security 审查，不能因为"只是 demo"就降低标准。
- 现有 e2e（`auth-003-social-login.spec.ts` 等）依赖当前 demo 登录行为，改动 gate 时要同步调整
  测试而不是让测试假装绿灯。

## 切分提示（给 requirement-author 的建议）
- 建议切两个 feature：(1) F05 安全修正 + 生产 gate（最高优先级，wave 0，需要 rev-security）；
  (2) F01-F04 证据补齐 + uc-auth-005 补 feature/真实实现（可与限流/cookie secure 合并成同一个
  feature，工作量都不大）。
- 每个 feature 的粒度控制在"一次会话能完成并验证"，不要把证据补齐和新功能实现强行拆成两个
  必须串行的 feature。
