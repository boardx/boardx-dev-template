# 编码规范

- 语言:TypeScript,`strict` + `noUncheckedIndexedAccess`。
- 模块:ESM;包间只通过公开导出依赖,禁止深路径 import。
- 错误处理:可恢复错误返回结构化 Result,不可恢复才抛异常。
- 命名:文件 kebab-case,类型 PascalCase,变量/函数 camelCase。
- 文件规模:业务源文件原则上不超过 2000 行。页面只负责路由装配和数据编排;子界面、领域类型、纯函数、请求适配器和复杂状态分别拆到独立模块。超过 2000 行必须在同一变更中拆分,或记录临时豁免、负责人和移除期限。
- 每个包必须提供:`build`、`test`、`lint`、`typecheck` 四个 turbo 任务。
- 提交前 `pnpm -w run verify:base` 必须通过。

## Feature 与 Delivery PR

- **Delivery PR** 是实现一个 Feature 交付契约的 PR,范围包括必要的代码、测试、证据和 review 返工。
- 每个 Feature 同时只能有一个 open Delivery PR,最终只能通过一个 merged Delivery PR 完成交付;每个 Delivery PR 也只能交付一个 Feature。
- Delivery PR 正文必须且只能用一条 `Closes #<feature issue>` 绑定唯一 Feature;其它关联 issue 使用 `Refs #<issue>`。
- review 返工继续提交到原 Delivery PR,不得另开 PR。
- Feature 大到无法在单个可评审 PR 内完成时,必须先拆分 Feature,不得把多个 Feature 合并到同一个 Delivery PR。
- 异常情况下需要替换 Delivery PR 时,先关闭旧 PR,在新旧 PR 中双向关联,再由新 PR 成为该 Feature 唯一的 open Delivery PR。
- `docs`、`harness`、`chore`、`fix`、`deps` 等非 Feature PR 可豁免一一对应约束,但必须在 PR 正文中明确类型与范围,不得夹带 Feature 交付内容或关闭 Feature issue。
