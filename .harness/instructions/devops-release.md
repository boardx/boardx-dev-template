# DevOps 发布与部署脚手架标准

> 本文件是发布/部署的脚手架契约。DevOps 不是一次性项目文档,而是随 `init.sh`、`verify:full`、harness feature verification 一起演进的仓库能力。

## 当前现状

- 本地依赖已有 `infra/docker-compose.yml`:Postgres(pgvector) + Redis。
- 本地入口已有 `init.sh`:安装依赖、安装 git hooks、生成 subagents、可选起本地 infra、运行 `verify:base`。
- CI 已有 `.github/workflows/harness-verify.yml`:基础验证、全栈 smoke、Playwright e2e。
- 完整本地验证已有 `scripts/verify-full.sh`:基础验证、web build、Docker 可用时跑 migrate + e2e。
- 运行单元已实际形成: `apps/web`(Next.js), `apps/workflow-worker`(BullMQ worker), `packages/data` migrations。
- 缺口:没有标准环境矩阵、镜像构建契约、部署 adapter、云厂商 runbook、发布后 smoke、回滚策略、密钥/变量 schema。

## 目标

DevOps 必须作为脚手架的一部分交付:

- 新项目 clone 后,开发者能用一组标准命令启动本地依赖、验证、构建镜像、部署到目标环境。
- 每个云厂商只实现 provider adapter,不改变应用代码和 feature 验证方式。
- 发布链路必须可验证:构建产物、迁移、启动、健康检查、核心 smoke、回滚入口都进仓库。
- 中国区和美国区部署使用同一套环境抽象,差异只在 provider、region、镜像仓库、域名、密钥来源。

## 推荐目录

```text
infra/
  docker-compose.yml              # 本地依赖
  env/
    development.example.env
    staging.example.env
    production.example.env
  docker/
    web.Dockerfile
    worker.Dockerfile
  deploy/
    providers/
      generic-container.md
      aws.md
      azure.md
      gcp.md
      aliyun.md
      tencent.md
      huawei.md
      cloudflare.md
    scripts/
      build-images.sh
      smoke.sh
      migrate.sh
      deploy.sh
      rollback.sh
```

## 标准命令契约

根 `package.json` 应逐步补齐这些脚本:

```bash
pnpm dev:infra          # docker compose 起本地 pg/redis
pnpm dev:infra:down     # 停本地依赖
pnpm release:check      # verify:full + env schema + migration dry-run
pnpm release:build      # 产出 web/worker OCI 镜像
pnpm release:smoke      # 对已部署 URL 跑健康与核心用户路径
pnpm deploy             # 通过 DEPLOY_PROVIDER/DEPLOY_ENV 调 adapter
pnpm rollback           # 回滚到上一个已标记 release
```

验收原则:这些脚本不能只是 echo;每条命令要么真实执行,要么明确失败并说明缺少哪个环境变量或 provider adapter。

## 环境矩阵

| 环境 | 用途 | 数据 | 入口 |
|---|---|---|---|
| development | 本地开发与 agent 验证 | 本地 Docker pg/redis | `pnpm -w run dev` |
| preview | PR/feature 临时环境 | 短生命周期托管 pg/redis 或共享测试实例 | CI/PR comment |
| staging | 发布候选 | 接近生产的托管 pg/redis | 手动或 main 分支 |
| production-us | 美国生产 | 美国区域托管数据库/缓存 | release tag |
| production-cn | 中国生产 | 中国区域托管数据库/缓存 | release tag, ICP/域名/备案单独处理 |

最低变量 schema:

```bash
APP_ENV=development|preview|staging|production
APP_REGION=us|cn
APP_BASE_URL=
DATABASE_URL=
REDIS_URL=
COOKIE_SECRET=
DEPLOY_PROVIDER=local|aws|azure|gcp|aliyun|tencent|huawei|cloudflare
IMAGE_REGISTRY=
IMAGE_TAG=
```

## 部署架构选择

默认目标是 OCI container + 托管 Postgres + 托管 Redis:

- `apps/web`:Next.js Node runtime 容器,暴露 HTTP,健康检查走 `/api/health`。
- `apps/workflow-worker`:独立 worker 容器,无公网入口,只连 Redis/Postgres。
- `packages/data`:发布前运行 migrations;生产迁移必须单独 job 执行,不要混在 web 启动里。
- 镜像 tag: `git sha` + 可选 semver release tag。
- 回滚:回滚到上一版镜像 tag,数据库迁移仅允许向后兼容;破坏性迁移必须拆成 expand/contract 两次发布。

## 云厂商 adapter

首选顺序是“容器平台优先,Kubernetes 作为规模化选项”:

| 区域 | Provider | 首选落地 | 说明 |
|---|---|---|---|
| 美国 | AWS | App Runner/ECS Fargate;规模化后 EKS | 容器、RDS Postgres、ElastiCache Redis。 |
| 美国 | Google Cloud | Cloud Run;规模化后 GKE | 容器、Cloud SQL、Memorystore。 |
| 美国 | Azure | Container Apps;规模化后 AKS | 容器、Azure Database for PostgreSQL、Azure Cache for Redis。 |
| 中国 | 阿里云 | SAE/ACK | 容器服务,配 RDS PostgreSQL、Tair/Redis。 |
| 中国 | 腾讯云 | TKE/Serverless 容器类产品 | 容器服务,配 TencentDB PostgreSQL、Redis。 |
| 中国 | 华为云 | CCE/云容器实例 | 容器服务,配 RDS PostgreSQL、DCS Redis。 |

每个 provider adapter 最少交付:

- 环境变量映射与 secret 注入方式。
- 镜像仓库地址与登录方式。
- web/worker 两个运行单元的部署命令或 IaC。
- migration job 命令。
- smoke URL 与 rollback 命令。
- region 差异说明。

## Cloudflare 支持策略

Cloudflare 不作为默认容器 provider,而是单独 adapter:

- 静态/边缘优先页面可以走 Cloudflare Workers + OpenNext。
- 当前应用依赖 Node runtime、Postgres、Redis、BullMQ worker;因此完整产品不能只靠 Pages 静态托管完成。
- 推荐形态:
  - `apps/web` 可评估 `@opennextjs/cloudflare` 适配 SSR 到 Workers。
  - `apps/workflow-worker` 仍部署到容器平台或改造成 Cloudflare Queues/Durable Objects/R2/D1 的专门 feature。
  - 数据层继续使用外部 Postgres/Redis,或新增 Cloudflare-native 数据 adapter 后再切换。
- Cloudflare adapter 的完成标准不是“能 build”,而是 `/api/health`、登录、房间/白板核心路径、worker 异步任务都有对应替代方案或明确不支持清单。

## 分阶段落地建议

1. DevOps scaffold baseline:补 env examples、Dockerfile、release scripts、smoke 脚本、provider adapter 文档。
2. Container deployment baseline:让 web/worker 镜像在本地 compose 和任一容器平台跑通。
3. US cloud adapter:优先 Cloud Run 或 AWS App Runner,证明容器抽象可用。
4. China cloud adapter:优先阿里云 SAE/ACK 或腾讯云 TKE,补国内域名、镜像仓库、网络访问约束。
5. Cloudflare adapter spike:验证 OpenNext/Workers 可覆盖的 web 能力,列出需要产品改造的 worker/data 能力。
6. IaC hardening:将成熟 adapter 固化为 Terraform/Pulumi/Helm,接入 CI/CD 环境保护与审批。

## 外部参考

- Cloudflare Workers Next.js guide: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Cloudflare Pages Next.js guide: https://developers.cloudflare.com/pages/framework-guides/nextjs/
- AWS App Runner documentation: https://docs.aws.amazon.com/apprunner/
- Google Cloud Run documentation: https://cloud.google.com/run/docs
- Azure Container Apps overview: https://learn.microsoft.com/en-us/azure/container-apps/overview
- Alibaba Cloud ACK documentation: https://www.alibabacloud.com/help/en/ack/
- Tencent Cloud TKE documentation: https://www.tencentcloud.com/document/product/457
- Huawei Cloud CCE documentation: https://support.huaweicloud.com/intl/en-us/cce/
