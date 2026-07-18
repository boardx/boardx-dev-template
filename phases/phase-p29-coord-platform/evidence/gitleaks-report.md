# F01 密钥历史审计报告（gitleaks 全历史扫描）

- 扫描时间：2026-07-18
- 工具：gitleaks v8.30.1（官方 release 二进制，sha256 校验通过）
- 范围：boardx/boardx-dev-template 全部 git 历史，1039 commits / ~29.4 MB
- 命令：`gitleaks git <repo> --report-format json`（默认规则集）
- 原始 JSON：本目录 `gitleaks-full-history.json`

## 结论：0 个高危活凭据；3 处命中全部核验完毕

| # | 位置 | 规则 | 核验判定 |
|---|---|---|---|
| 1、2 | `apps/web/e2e/collab-transport-skeleton.spec.ts`（commit 4b6021db / a10ec974） | generic-api-key | **假阳性**。`Sec-WebSocket-Key: "dGhlIHNhbXBsZSBub25jZQ=="` 是 RFC 6455 §1.3 的标准示例 nonce（base64 of "the sample nonce"），WebSocket 握手测试固定值，非凭据 |
| 3 | `packages/storage/src/index.ts:33`（da972e37 引入，main 现存） | generic-api-key | **非泄漏但需处置**：`secretAccessKey: env.S3_SECRET_KEY ?? "boardx123"`——MinIO 本地开发默认口令作为代码回退值，同值亦在 `.env.example`、`infra/docker-compose.yml`（本地 compose 栈，语义一致） |

## 第 3 项的风险评估与处置建议

- 性质：**公开仓中的弱默认凭据**，不是被误提交的生产密钥；本地 dev（localhost:9090 MinIO）用途。
- 真实风险面：若任何**非本地环境**（如 devapp 单机部署）起 MinIO/S3 时未显式设置
  `S3_SECRET_KEY`，将以公开的默认口令运行。
- 建议（不阻塞 F01，转独立处置）：
  1. 运维核对 devapp 上 MinIO 实际凭据是否为默认值；是则轮换。
  2. 代码加固：`NODE_ENV=production` 下缺 `S3_SECRET_KEY` 应 fail-fast 报错，
     而不是静默回退默认值。
- **不需要重写 git 历史**：该值本就是公开的示例默认值，历史清理无意义。

## 纪律回执

- multi-agent-coordination §7.1（public 仓敏感信息纪律）自查：扫描未发现
  token/连接串/账单/隐私类内容入库。
- 本报告即 F01 verification 第 3 条（`test -s evidence/gitleaks-report.md`）的证据本体；
  按承诺已先交人类过目再关闭 feature。
