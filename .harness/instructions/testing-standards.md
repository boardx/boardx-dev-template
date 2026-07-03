# 端到端验证标准

> 对应 L10「跑通完整流程才算真正验证」。feature 的 verification 命令应是**可执行的端到端检查**,
> 而不是"代码无语法错误"这类宽松判据。

## 验证分层(测试金字塔)
- 单元:纯逻辑,快;不算 feature 的完成判据,只是基础门槛。
- 集成:跨包/跨服务的真实交互。
- 端到端:从用户可见入口走到可见结果,**这才是 feature passing 的判据**。

## feature.verification 的写法
- 每条是一个 shell 命令,退出码 0 = 通过。
- 优先断言**用户可见行为**(HTTP 状态、输出内容、UI 可达),而非内部实现。
- 例:`curl -sf localhost:3000/api/health | jq -e '.ok==true'`

## 新增顶层页面必须验证"能被导航到"，不能只验证"URL 直达能用"

`pnpm harness verify` 通过只证明"给定这个 URL/接口，行为符合预期"，**不证明用户能从
产品里走到这个 URL**。这个盲区曾导致 Ava/Surveys/Admin 等多个已 passing 的顶层功能
在全站没有任何导航入口——功能存在，但对真实用户等于不存在（e2e 里都是 `page.goto()`
直达 URL，没人断言过入口本身）。

因此：**任何新增的顶层页面/路由（sidebar 一级入口、首页卡片、account 菜单项等），
其 feature 的 e2e verification 至少要有一条走"真实点击路径"的场景**，而不是全部
`page.goto(url)` 直达：

```ts
// 不够：只证明 URL 能用
await page.goto("/ai-store");
await expect(page.getByTestId("store-grid")).toBeVisible();

// 要加一条：证明用户能从已有入口点到这里
await page.goto("/home");
await page.getByTestId("enter-store-recentlyUsed").click();
await expect(page).toHaveURL(/\/ai-store/);
```

如果这个页面按设计就是"暂无独立入口、只能从别处间接进入"（比如 room-chat 内嵌的
Studio 面板），在 feature 的 `notes` 里显式写清楚这是故意的，而不是漏掉。

## 假阳性防护
- 避免只检查"进程没崩";要检查"产出符合预期"。
- 验证脚本失败时保留输出到 sprint 的 `evidence/`,便于复盘。

## 全栈验证（CAP-WEB / CAP-DATA / CAP-WORKFLOW）

> 全栈 feature 的 verification 要起真实服务、走真实路径。起服务前先
> `docker compose -f infra/docker-compose.yml up -d`（pg + redis），收尾要把起的进程收掉。

**CAP-WEB（Next.js 渲染 + API）**
- 渲染：`curl -s localhost:3000 | grep -q BoardX`（断言页面含标记文本）。
- API：`curl -sf localhost:3000/api/health | jq -e '.ok==true'`。
- 涉及交互/视觉的 UI，交给 e2e-verifier 用浏览器走真实路径，截图归 `evidence/`。

**CAP-DATA（API ↔ Postgres round-trip）**
- 先 `pnpm --filter @repo/data run migrate`。
- 写读闭环：`curl -X POST .../api/notes -d '{"text":"hi"}'` → `curl .../api/notes | jq -e '.notes[0].text=="hi"'`。
- schema 只经 migrations 改，验证里不要临时 DDL。

**CAP-WORKFLOW（BullMQ 入队 → worker → 状态回写）**
- 起 worker：`pnpm --filter @repo/workflow-worker dev &`。
- 异步轮询（不要假设瞬时完成）：入队拿到 id 后轮询
  `until curl -s .../api/jobs/$id | jq -e '.job.status=="done"'; do sleep 1; done`，带超时上限防卡死。

**收尾**：验证脚本结束前 kill 掉起的 web/worker 进程；`docker compose ... down` 可选。
