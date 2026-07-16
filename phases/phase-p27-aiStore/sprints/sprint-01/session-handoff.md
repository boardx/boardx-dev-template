# 会话交接 - Sprint p27/01

## 首个工作

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- 首个 Feature: F01 Team tenancy and migration audit。
- Claim: `pnpm harness claim --phase p27 --feature F01 --owner <agent-id>`。
- 首个失败测试: `packages/data/src/aiStore.teamIsolation.test.ts`。
- F01 门控: `pnpm harness verify --sprint p27/01 --feature F01`。

## 依赖门禁

- F02 依赖 F01，F01 passing 前不得领取 F02。
- F02 首个测试为 `packages/data/src/aiStore.skillsVersioning.test.ts`。
- 不要运行整个 Sprint verify 来“探测”尚不存在的测试，也不要手改 status 或 `active-features.json`。

## 已知实现边界

- `originTeamId`/`consumerTeamId` 必须来自可信 Team 上下文。
- 无法唯一归属的迁移数据进入隔离审计，不得猜测。
- F02 的 approved 实时更新必须保持审核状态并用 version 处理并发。
