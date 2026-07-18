# BoardX 产品单机部署手册（devapp.boardx.us 实例即按本文部署）

> 适用：**BoardX 产品平面**（apps/web 完整栈）自托管到一台独立主机——阿里云/任意云/私有机房
> 通用（#523 人类拍板：产品平面 = 独立主机；协作平面 develop.boardx.us = 全 Cloudflare，另行部署）。
> 本文既是新机器的部署步骤，也是 devapp.boardx.us 现役实例的运维 runbook。
> 敏感信息纪律：本文**不含任何**真实 IP/密码/token；接入信息在部署会话的
> gitignored 配置（`.harness/state/.cache/deploy-target.json`）。

## 1. 机器要求

| 档位 | 配置 | 适用 |
|---|---|---|
| 最低 | 4 vCPU / 8GB / 100GB SSD | 演示、<20 并发 |
| **推荐** | 8 vCPU / 16GB+ / 200GB NVMe | 小团队生产（devapp 现役：ARM64 8C/30G） |

- OS：Ubuntu 22.04/24.04，x86_64 与 ARM64 均可（全部镜像有双架构）。
- 无需 GPU（AI 负载全部走 Anthropic API，只耗网络出口）。
- 安全组入方向：80/443（公网）+ SSH 端口。**注意**：若部署侧网络封锁出站 22
  （devapp 部署时真实遇到），让 sshd 多听一个高位端口——Ubuntu 24.04 的 sshd 是
  socket 激活，要写 `/etc/systemd/system/ssh.socket.d/listen.conf` 且必须
  `ListenStream=0.0.0.0:<port>` 显式 IPv4（裸 `ListenStream=<port>` 只绑 `[::]`，
  IPv4 连接会被拒——devapp 踩过）。

## 2. 基础环境（root）

```bash
apt-get update && apt-get install -y git rsync curl jq ca-certificates
curl -fsSL https://get.docker.com | sh                      # Docker + compose 插件
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -   # Node 版本对齐 .nvmrc
apt-get install -y nodejs && corepack enable
corepack prepare pnpm@9.0.0 --activate                      # 对齐 package.json packageManager
```

## 3. 代码与配置

**代码同步用 rsync（不在服务器上 clone**——私有仓免去发 deploy key，且和 CI 无耦合）。
**永远从 origin/main 的干净 worktree 同步**，不要用本地 main（可能落后/有未提交改动）：

```bash
git worktree add /tmp/deploy-src --detach origin/main
rsync -az --delete -e "ssh -i <部署密钥> -p <SSH端口>" \
  --exclude node_modules --exclude '.next*' --exclude .git \
  --exclude '.claude/worktrees' --exclude '.harness/state/.cache' \
  --exclude '.env.local' --exclude '.env' --exclude '*.log' \
  --exclude 'infra/compose.prod.yml' \
  /tmp/deploy-src/ root@<host>:/opt/boardx/
```

（`--exclude infra/compose.prod.yml` 保护服务器本地的生产 override 不被删。）

服务器上两份生成一次的配置（都 mode 600，绝不进 git）：

1. **`/opt/boardx/infra/compose.prod.yml`**：override 三个数据容器——生产密码、
   `ports:` 全部改绑 `127.0.0.1`（公网只暴露 Caddy）、`restart: unless-stopped`、
   命名持久卷（pgdata/redisdata/miniodata）。
2. **`/opt/boardx/apps/web/.env.local`**（migrate 脚本也读它）：`DATABASE_URL`
   `REDIS_URL` `S3_*`（指向 127.0.0.1 的对应端口）、`WEBHOOK_SECRET`（openssl
   rand 生成，勿用 dev 占位值）、`COLLAB_WS_PORT=3001`、
   `COLLAB_WS_PUBLIC_URL=wss://<域名>/api/collab/ws`（见 PR #537）、
   `ANTHROPIC_API_KEY`（缺省 = AI 功能诚实降级，不影响其它功能）。

## 4. 启动栈

```bash
cd /opt/boardx
docker compose -f infra/docker-compose.yml -f infra/compose.prod.yml -p boardx up -d --wait
pnpm install --frozen-lockfile
pnpm --filter @repo/data run migrate        # 大表迁移注意 #530 的加固流程
cd apps/web && NODE_ENV=production pnpm build
```

四个 systemd 服务（`EnvironmentFile=/opt/boardx/apps/web/.env.local`，
`Restart=always`）：

| 服务 | WorkingDirectory | ExecStart |
|---|---|---|
| boardx-web | apps/web | `pnpm start`（:3000） |
| boardx-collab | apps/web | `node server/collab-gateway.mjs`（:3001） |
| boardx-workflow | apps/workflow-worker | `pnpm exec tsx src/main.ts` |
| ~~boardx-orchestrator~~ | — | **不要注册**：它是跑完即退的 CLI，当服务会无限重启 |

反代 + TLS（Caddy，自动 Let's Encrypt）：

```
<域名> {
    handle /api/collab/ws* {
        reverse_proxy 127.0.0.1:3001
    }
    handle {
        reverse_proxy 127.0.0.1:3000
    }
}
```

## 5. 冒烟验收（部署完成的定义）

```bash
curl https://<域名>/api/health          # {"ok":true,"service":"web"}
curl -o /dev/null -w '%{http_code}' https://<域名>/           # 200
curl -o /dev/null -w '%{http_code}' https://<域名>/portal     # 200
curl -o /dev/null -w '%{http_code}' https://<域名>/api/portal/pulse  # 401（未登录被正确拦截）
```

## 6. 日常更新（≈3 分钟）

```bash
# 本地：刷新 deploy worktree 到最新 main → rsync（同 §3 命令）
# 服务器：
cd /opt/boardx && pnpm install --frozen-lockfile \
  && pnpm --filter @repo/data run migrate \
  && cd apps/web && NODE_ENV=production pnpm build \
  && systemctl restart boardx-web boardx-collab boardx-workflow
curl -s http://127.0.0.1:3000/api/health   # 重启后本机确认
```

## 7. 备份与恢复

- **每日 03:15（北京时间）**：`/usr/local/bin/boardx-backup.sh`（cron:
  `/etc/cron.d/boardx-backup`）→ `pg_dump --format=custom` + minio 卷 tar 到
  `/opt/boardx-backups/`，本机保留 7 天，日志 `/var/log/boardx-backup.log`。
- 恢复：`pg_restore -U boardx -d boardx --clean <dump>`（docker exec 进
  boardx-postgres-1）；minio 卷 tar 解回 `boardx_miniodata`。
- 异地副本（建议 R2 私有 bucket）：**待人类确认后开通**（#523 拍板项）。

## 8. 已知事项 / 故障速查

| 现象 | 原因/处置 |
|---|---|
| ping 通但所有 TCP 端口不通 | 云安全组没放行——先查实例绑定的是哪个安全组 |
| SSH 连不上但服务器监听正常 | 部署侧网络封出站 22 → 用高位端口（§1）；`[::]` 只绑 IPv6 → 显式 `0.0.0.0` |
| 协作白板不同步 | `COLLAB_WS_PUBLIC_URL` 未配或 Caddy 缺 WS 路由（§3/§4） |
| AI 功能不可用 | `ANTHROPIC_API_KEY` 未配——设计上的诚实降级，非故障 |
| build OOM（8GB 档） | 构建时临时 `systemctl stop boardx-workflow` 或加 swap |
