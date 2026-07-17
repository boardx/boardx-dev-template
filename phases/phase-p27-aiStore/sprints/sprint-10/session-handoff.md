# 会话交接 — Sprint p27/10

## 当前已验证
- F17 `Persist local AI Store runtime data across Compose restarts` 已 passing。
- 权威验证: `pnpm harness verify --sprint p27/10 --feature F17`
- 证据: `phases/phase-p27-aiStore/sprints/sprint-10/evidence/F17.verify.log`

## 本轮改动
- `infra/docker-compose.yml` 为 PostgreSQL、Redis、MinIO 声明 project-scoped named volumes。
- `init.sh` 在 `RUN_INFRA=1` 时等待 Compose 健康并执行全部数据库 migrations。
- 新增配置回归测试，防止状态服务再次退回匿名卷或漏掉 fresh database migration。
- 旧 p27 数据已复制到 `codex-p27-ai-store-control-plane_postgres_data`，真实 down/up 后保持不变。

## 仍损坏或未验证
- 无已知功能阻断。
- 不要执行 `docker compose down -v`，否则会按命令语义主动删除命名卷。

## 下一步最佳动作
- Review 并合并 PR #676；Issue #679 以 F01-F17 passing 为当前 Harness 状态。
- 保留正在运行的 localhost:3050 和 p27 Compose 栈，供人类继续验收。

## 命令
- 启动: `RUN_INFRA=1 ./init.sh` 后运行 `pnpm --filter @repo/web exec next dev -p 3050`
- 验证: `pnpm harness verify --sprint p27/10 --feature F17`
- 调试: `docker exec codex-p27-ai-store-control-plane-postgres-1 psql -U boardx -d boardx`
