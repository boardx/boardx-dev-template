# 会话交接 - Sprint p27/01

## 当前已验证

- Parent Issue: [#662](https://github.com/boardx/boardx-dev-template/issues/662)
- F01 已通过两条目标测试和全仓基础验证。
- Evidence: `evidence/F01.verify.log`。
- 数据库迁移 `039_ai_store_team_tenancy.sql` 已在本机开发库成功应用。

## 下一步

- 首个 Feature: F02 Skills model and live versioning。
- Claim: `pnpm harness claim --phase p27 --feature F02 --owner <agent-id>`。
- 首个失败测试: `packages/data/src/aiStore.skillsVersioning.test.ts`。
- F02 门控: `pnpm harness verify --sprint p27/01 --feature F02`。
- 不要运行整个 Sprint verify 来“探测”尚不存在的测试，也不要手改 status 或 `active-features.json`。

## 已知实现边界

- 本机旧平台 seed 无 owner/Team，12 条均按规则隔离并写审计；不得为恢复演示数据猜测来源 Team。
- active 资源和订阅的规范 Team 字段均已非空。
- F02 的 approved 实时更新必须保持审核状态并用 version 处理并发。
