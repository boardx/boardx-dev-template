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
