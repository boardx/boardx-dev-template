# ADR 003: DevOps 发布能力纳入脚手架

- 状态: Proposed
- 日期: 2026-06-30

## 背景

当前仓库已经具备 monorepo、harness 控制平面、本地依赖 compose、基础 CI、`verify:full` 和应用运行单元。缺口在发布侧:没有统一环境矩阵、镜像构建契约、provider adapter、密钥/变量 schema、发布后 smoke 和回滚入口。

这个项目的目标是 agentic 系统模板。若 DevOps 只是后置文档,每个新项目都会重新发明部署方式,也无法把“可发布”纳入 feature 的完成定义。用户明确要求支持开发环境部署标准/脚本,并研究中国和美国主流云提供商以及 Cloudflare。

## 决策

将 DevOps 发布能力作为脚手架的一等能力纳入仓库:

- 默认发布产物采用 OCI container: `apps/web` 和 `apps/workflow-worker` 分别构建、部署和回滚。
- 数据与队列采用环境变量注入: `DATABASE_URL`、`REDIS_URL`、secret 与 region/provider 变量统一由 `infra/env/*.example.env` 定义。
- 云厂商只作为 `infra/deploy/providers/*` adapter 存在,不得把厂商逻辑写进业务代码。
- 发布必须有标准命令: `release:check`、`release:build`、`release:smoke`、`deploy`、`rollback`。
- Cloudflare 作为独立 adapter 研究:优先验证 Workers + OpenNext 覆盖 web SSR;worker/data 能力必须明确替代方案或限制。

## 后果

正面影响:

- DevOps 成为模板能力,新项目继承一套可验证的发布路径。
- 中国区和美国区共享相同应用产物,差异被限制在 provider adapter、region、secret、镜像仓库和域名层。
- CI/CD、smoke、回滚与 harness verification 可以逐步收敛,避免“本地 passing 但无法发布”。

负面影响:

- 初期会增加仓库脚手架复杂度:需要维护 Dockerfile、env schema、provider 文档和脚本。
- Cloudflare 不是容器平台,完整支持可能需要额外产品改造,尤其是 BullMQ worker、Redis、Postgres 连接和长任务模型。
- 多云 adapter 容易变成过度抽象;必须先保持“文档 + 脚本契约”,待一个 provider 真实跑通后再沉淀 IaC。

## 备选

- 只支持单一云厂商。否决原因:不能满足中美双区域和模板复用目标,也会过早绑定厂商服务。
- 先写 Terraform/Pulumi 全量 IaC。否决原因:当前发布契约尚未稳定,过早 IaC 会把错误抽象固化。
- Cloudflare 优先。否决原因:现有系统包含 Next.js Node runtime、Postgres、Redis 和 BullMQ worker;Cloudflare 需要专项适配,不应阻塞容器基线。
- 只写部署文档不进脚本。否决原因:不符合“DevOps 必须是脚手架的一部分”,也无法被 CI/harness 验证。
