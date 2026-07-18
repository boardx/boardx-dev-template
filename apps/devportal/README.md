# devportal — Developer Portal @ develop.boardx.us（协作平面）

P23 Developer Portal 的 Cloudflare 原生部署（#523 Track A）。**自包含项目**：
零跨目录 import、零内部包依赖；与 `apps/web` 的产品面 portal 是有意的双份
（数据源/门禁不同，共享代码会把两平面重新缠住，见 ADR-013 姊妹决策 #523）。

- 数据：GitHub Contents API（phases/registry）+ coord-service `/status` + GitHub REST
- 门禁：Cloudflare Access（GitHub 登录），`lib/access.ts` 对 `Cf-Access-Jwt-Assertion`
  验签（团队证书端点）；**pages.dev 直连无 Access 上下文 → API 一律 401**

## 部署

配置的唯一事实源 = 本目录 `wrangler.toml`（nodejs_compat、非敏感 vars）。

**日常**：合并到 main 且触碰 `apps/devportal/**` → CI `deploy-devportal.yml` 自动
构建发布（构建链 `next build` → `@cloudflare/next-on-pages` → `wrangler pages deploy`）。

**首次/新环境复现**：
```bash
pnpm install
cd apps/devportal
npx wrangler pages project create devportal --production-branch main   # 仅首次
pnpm exec wrangler pages secret put GITHUB_TOKEN --project-name devportal  # 细粒度只读 PAT
pnpm build && pnpm exec next-on-pages
pnpm exec wrangler pages deploy .vercel/output/static --branch main
# 域名绑定（仅首次）：Pages → devportal → Custom domains → develop.boardx.us
# Access 应用作用于该主机名，换绑项目不影响门禁
```

**冒烟标准**（CI 已内置断言）：`develop.boardx.us` → 302（Access 门禁在前）；
`*.pages.dev` 直连 API → 401（验签拒绝无凭据请求）。

## Access aud 校验

`CF_ACCESS_AUD` 配置后 JWT 验证将同时校验 audience（防团队域下多 Access 应用互通）。
aud tag 在 Zero Trust dashboard 的应用详情页；当前部署 API token 无 Access 读权限，
待人类提供后在 wrangler.toml 取消注释即启用，无需改代码。
