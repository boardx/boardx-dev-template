# 进度日志 — Sprint p27/10

## 当前已验证状态(唯一真相)
- 仓库根目录: `/Users/shenyangjun/boardx/boardx-dev-template/.worktrees/codex-p27-ai-store-control-plane`
- 标准启动路径: `RUN_INFRA=1 ./init.sh` 后执行 `pnpm --filter @repo/web exec next dev -p 3050`
- 标准验证路径: `pnpm harness verify --sprint p27/10 --feature F17`
- 当前最高优先级未完成功能: 无，F17 已 passing
- 当前 blocker: 无

## 会话记录
### 2026-07-17 13:51:54
- 本轮目标: 修复 Compose 重启后 PostgreSQL 挂载新匿名卷，导致 `sessions` 等 schema 和 AI Store 测试数据不可见的问题。
- 已完成:
  - 从未挂载的旧 PostgreSQL 卷恢复 64 条 migration、192 个 AI Store 资源和 4 个 p27 测试用户。
  - PostgreSQL、Redis、MinIO 改用按 `COMPOSE_PROJECT_NAME` 隔离的命名卷。
  - `RUN_INFRA=1 ./init.sh` 等待依赖健康后自动执行 repository migrations。
  - Chrome 重新加载原错误 URL，恢复为 2 条 Research Synthesis Agent 结果。
- 运行过的验证:
  - `pnpm harness verify --sprint p27/10 --feature F17`
  - 真实执行 `docker compose down` / `up -d --wait` 后再次核对 migration、资源和用户数量。
  - `pnpm --filter @repo/data exec vitest run src/dockerComposePersistence.test.ts`
- 已记录证据: `evidence/F17.verify.log`
- 提交记录: 待本轮收尾 commit。
- 已知风险或未解决问题: 首次人工恢复创建的 PostgreSQL 命名卷缺少 Compose 标签，启动时有一次非阻断 warning；数据和后续持久化不受影响。
- 下一步最佳动作: 更新 Issue #679 和 PR #676 后提交推送，保持 localhost:3050 供人工复测。
