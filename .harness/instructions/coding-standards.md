# 编码规范

- 语言:TypeScript,`strict` + `noUncheckedIndexedAccess`。
- 模块:ESM;包间只通过公开导出依赖,禁止深路径 import。
- 错误处理:可恢复错误返回结构化 Result,不可恢复才抛异常。
- 命名:文件 kebab-case,类型 PascalCase,变量/函数 camelCase。
- 每个包必须提供:`build`、`test`、`lint`、`typecheck` 四个 turbo 任务。
- 提交前 `pnpm -w run verify:base` 必须通过。
