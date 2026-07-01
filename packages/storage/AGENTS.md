# AGENTS.md — packages/storage 局部指令

> 包级 scoped 指令（渐进披露第 2 层），补充根 AGENTS.md。

## 本包职责
CAP-FILE：S3 兼容对象存储客户端封装（本地 MinIO，生产可换真实 S3，同一 SDK）。
被 p10 知识库文件上传复用；未来 AVA 附件（p9-F08）、Studio/演示读文件（p12）复用同一层，
不要在这些消费方里各自再造一个 S3 client。

## 局部约束
- **只暴露 key 级操作**（putObject/getObjectStream/deleteObject/presignGetUrl），不泄露 SDK 类型到调用方。
- **对象 key 命名规范**：`kb/{scope}/{ownerId}/{fileId}/{原始文件名}`，避免跨 scope/owner 冲突或越权。
- **连接配置走环境变量**（`S3_ENDPOINT`/`S3_ACCESS_KEY`/`S3_SECRET_KEY`/`S3_BUCKET`），单一来源、可覆盖。
- 桶不存在时启动期自动创建（本地开发体验；生产由运维预建）。
