# 进度日志 — Phase 04 identity-and-spaces

## 当前已验证状态（唯一真相）
12 个可实现 feature 全部 **passing**（auth F01-F05 / team F06-F09 / room F10-F12），
各经 `harness verify` 门控 + Playwright e2e，证据在各 sprint 的 `evidence/`。
2 个 **DEFERRED**（F13 团队 AI/Memory/Store、F14 房间文件/Studio/问卷）未排入 sprint，
依赖尚未搭建的 CAP-AI / CAP-FILE / CAP-CANVAS 平面。

## 交付内容
- 自建认证（bcrypt + session 表 + httpOnly cookie），不依赖第三方 auth 库。
- 新增包 `@repo/auth`（纯逻辑 + 12 单测）；`@repo/data` 加 002/003/004 迁移与仓储。
- `apps/web`：auth/teams/rooms 全套 API + UI 页面 + 25 个 Playwright e2e。
- 三层测试：unit(@repo/auth) + integration(API↔pg) + e2e(Playwright 真浏览器)。
- 流程严格走 harness：feature_list → GitHub issue(#1-#21) → claim/in_progress →
  verify 留证据 → passing → 关闭 issue → 逐域提交。

## 本轮修复的真实问题
- sync-github：创建 issue 前先建 label；幂等（含 closed）避免重复开 issue。
- pg bigint 序列化为 string：当前团队标记比较需类型一致。

## 边界 / 待接入（deferred）
- 社交登录仅骨架（501），真 OAuth 需 provider secret。
- 找回密码用 dev 邮件（控制台日志 + DB 令牌），真 SMTP/Resend 待接。
- F13/F14 等其能力平面搭好再做。

## 下一步（如何继续）
- 评审本分支 `feat/phase-04-features`（已开 PR）；满意则合并 main。
- 不满意可回退到 tag `checkpoint-scaffold-v1`（脚手架就绪点）。
- 推进下一能力平面（建议 canvas+collab）或接 deferred 项。

## 本地起服务（验证用）
```bash
PG_PORT=5433 REDIS_PORT=6380 docker compose -f infra/docker-compose.yml up -d
DATABASE_URL=postgresql://boardx:boardx@localhost:5433/boardx pnpm --filter @repo/data run migrate
DATABASE_URL=postgresql://boardx:boardx@localhost:5433/boardx pnpm --filter @repo/web dev
# e2e：DATABASE_URL=... pnpm --filter @repo/web exec playwright test
```
