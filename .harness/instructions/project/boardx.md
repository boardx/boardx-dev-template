# BoardX 项目事实单点（project facts）

> **这份文件存在的原因**：`.harness/instructions/` 里的其余文档是**可移植的方法论标准**
> （将打包进 agentic-harness 模板给任何项目复用）；而域名、URL、部署目标这类
> **本项目专属事实**全部收拢到这里。通用文档要引用专属事实时指向本文件，
> 不再各自硬编码——模板抽取时本文件整体替换为新项目的同名文件即可。
> 凭据永远不放这里（也不放任何进 git 的文件），只放"凭据文件的路径"。

## 身份
- GitHub org/repo：`boardx/boardx-dev-template`（main 为默认分支，禁止直接 push）
- 模板抽取目标仓：`boardx/agentic-harness-template`（private 起步，2026-07-18 拍板）

## 两平面部署
| 平面 | 域名 | 载体 | CD |
|---|---|---|---|
| 协作平面（devportal） | develop.boardx.us | Cloudflare Pages（next-on-pages），Cloudflare Access 门禁 | `deploy-devportal.yml` |
| 应用平面（全栈） | devapp.boardx.us | 单机 Ubuntu ARM64（/opt/boardx，systemd+Caddy） | `deploy-devapp.yml` |

## 协调服务
- 现行权威：`coord-service-staging.boardx.workers.dev`（Workers+D1，ADR-008/009）
- **迁移中**：p29 按 ADR-017 重建为 RepoHub DO，`coord-gateway.boardx.workers.dev`；
  coord-service 冻结退役中，tasks/派工割接（p29-F10）是其删除前置。
- CD：`deploy-coord-service.yml` / `deploy-coord-gateway.yml`——**协调权威绝不手动部署**
  （coordinator-sop 铁律 §11）。

## 凭据（只列路径，值永不入 git/聊天/issue）
- 本机缓存目录：`.harness/state/.cache/`（已 gitignore）：deploy-target.json（部署机
  SSH/RDP）、coord-credentials.json（协调服务 token）、github-pat-devportal.txt、SSH 密钥对。
- CI：repo secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` / `DEVAPP_SSH_KEY`。
- 运行时：devportal 的 Pages secrets（`COORD_BROKER_TOKEN` 等）。

## 模块清单（15 个，对应 .agents/skills/mod-*）
room / board / canvas / collab / ava / knowledge-base / ai-store / studio / survey /
credits-billing / admin / auth-identity / platform / devportal / harness

## 尚存硬编码的通用文档（抽取模板前的清洗清单）
以下现行标准仍嵌有上述专属事实，模板抽取时逐份替换为对本文件的引用：
agent-bootstrap.md、coordinator-sop.md、multi-agent-coordination.md、
human-developer-onboarding.md、architecture.md、observability.md、
agent-onboarding-checklist.md（以 `git grep -l "boardx" .harness/instructions/` 为准）。
