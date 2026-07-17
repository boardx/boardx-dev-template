# 邀请闭环修复（P0，wave 0）

> 出处：gap-report.md 红行 1。源 uc：phase-04 requirements/team/uc-team-003、uc-team-004、
> auth/uc-auth-001、uc-auth-002。现状挂在 passing 的 phase-04 F08/F01/F02 名下。

## 背景 / 为什么做
受邀者从「点开邀请链接」到「进入团队」的整条路径当前是断的，且三处断点互相叠加：
1. `/teams` 页「Copy Invitation Link」复制出的 `/teams/join?token=...` 没有对应页面——
   受邀者打开即 404（`apps/web/app/(app)/teams/` 下无 join/page.tsx）。
2. 仓库里唯一的邀请落地页 `app/invite/[token]/page.tsx` 依赖 in-memory stub API，只认
   硬编码令牌 `demo`，不认 `POST /api/teams/:id/invites` 签发的真实令牌。
3. `login/register` 页完全忽略 `next` 参数（invite 页明明会带 `/login?next=...` 跳过去），
   登录成功固定 `router.push("/")`——未注册受邀者登录后邀请上下文丢失。

## 原始需求
- 作为受邀者，我点开别人发我的邀请链接，能看到「谁邀请我加入哪个团队」的落地页；
  已登录则一键接受入队并切换当前团队；未登录则先去登录/注册，**完成后自动回到
  这个邀请页**继续接受流程（uc-team-004 主流程 + A1/A2）。
- 作为团队 owner/admin，我复制的邀请链接必须真实可用（uc-team-003 主流程 8）。
- 接受成功后进入该团队上下文（切换当前团队），失败（令牌过期/已用/团队已删）给明确
  提示（uc-team-004 E1-E3）。

## 验收线索
- e2e：A 建团队→签发邀请→B（未注册）打开链接→注册→自动回到邀请页→接受→当前团队
  变为 A 的团队。全程点 UI，不允许 goto 直达中间页。
- 旧 `/invite/demo` stub 路径与真实令牌路径二选一收敛（建议真实化 `/teams/join`，
  stub 页与 stub API 废弃删除，相关 e2e 改写）。
- login/register 支持 `next` 白名单回跳（仅站内相对路径，防开放重定向——**安全审查点**）。

## 范围与边界
- 本阶段做：join 落地页、真实令牌校验/消费打通、next 回跳（login+register 双入口）。
- 不做：邮件真实发送（F04 已声明 deferred 维持）、跨账号团队切换。

## 已知约束 / 依赖
- area:auth + team 属敏感 area，强制 rev-security（开放重定向、令牌枚举防护）。
- 复用既有 `POST /api/teams/join` 与 invites 签发 API，不重做后端。
