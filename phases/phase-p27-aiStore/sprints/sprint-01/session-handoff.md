# 会话交接 - Sprint p27/01

## 当前已验证

- F06、F01、F02 均为 `not_started`，没有 passing 声明或 evidence。
- Sprint 工作集由 harness 生成，未手改 `active-features.json`。
- `harness doctor --phase p27` 最终通过（0 FAIL / 0 WARN）。

## 本轮改动

- 建立 Team 租户边界、Skills 数据迁移与 API 兼容三个 feature。
- 固定 `skill` + `config.skillKind=text|image` 契约和旧类型映射。

## 仍损坏或未验证

- `./init.sh` 在沙箱内写 `.git/hooks/pre-commit` 时失败，提权执行随后被中断；基础状态未证实。
- 尚未创建迁移、实现代码或验证测试；预跑 verify 因目标测试文件不存在而失败。

## 下一步最佳动作

1. `cd /Users/shenyangjun/boardx/boardx-dev-template && ./init.sh`
2. 确认基线通过后，只领取 F06。
3. 先写 `packages/data/src/aiStore.teamIsolation.test.ts`，覆盖强制 Team 归属、跨 Team 隔离和无法归属记录的审计清单。
4. 实现后运行 `pnpm harness verify --sprint p27/01 --feature F06`。

## 命令

- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p27/01`
- 数据测试:`pnpm --filter @repo/data test -- src/aiStore.skills.test.ts`
- Team 隔离测试:`pnpm --filter @repo/data test -- src/aiStore.teamIsolation.test.ts`
