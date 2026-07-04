#!/usr/bin/env bash
# init-worktree-env.sh — 给当前 worktree 分配一套独占的 docker compose 端口 + project name。
# 动机：多个 agent worktree 并行跑 `docker compose -f infra/docker-compose.yml up -d` 时，
# 默认端口(5432/6379)和默认 project name(取 compose 文件所在目录名 "infra"，各 worktree 相同)
# 会互相抢占，导致 "port is already allocated"（quality-document #先前观测到的并发翻车）。
#
# 也顺带修复 apps/web/playwright.config.ts 硬编码 3000 端口的问题：多个 worktree 并行跑
# e2e 时，Playwright 的 reuseExistingServer 会复用到别的 worktree 的 server（测错代码），
# verify-full.sh 的清理步骤也会误杀别的 worktree 的 dev server。E2E_PORT 就是为此加的。
#
# 用法：在 worktree 根目录跑一次 `bash scripts/init-worktree-env.sh`，再 `docker compose up -d`。
# 幂等：已存在的 apps/web/.env.local 只会被更新 DATABASE_URL/REDIS_URL/E2E_PORT 三个 key，
# 不动其它内容（比如 worker 自己加的 AI provider key）；根 .env 和 infra/.env 写 compose project/port。
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# 项目名：优先当前分支名（去掉非法字符），没有分支信息则退化用目录 basename。
branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || basename "$repo_root")"
project_name="$(printf '%s' "$branch" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' | sed -E 's/-+/-/g; s/^-|-$//g' | cut -c1-40)"
[ -n "$project_name" ] || project_name="wt-$$"

free_port() {
  python3 - <<'PY'
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
}

# 找一个当前没有任何 docker network 在用的 172.x.0.0/24 第三段八位组，写进
# COMPOSE_SUBNET。之前 infra/docker-compose.yml 曾把子网硬编码成固定的
# 172.61.0.0/24，导致两个 worktree 同时 up 时子网冲突（"Pool overlaps with
# other one on this address space"）——比端口冲突更隐蔽，因为报错看着像是地址池
# 耗尽，实际是同一个子网被复用。这里跟端口分配用一样的思路：每个 worktree 启动时
# 现查一个当下空闲的八位组，而不是写死一个值。
free_subnet_octet() {
  local used candidate
  used="$(docker network inspect $(docker network ls -q) --format '{{range .IPAM.Config}}{{.Subnet}}{{"\n"}}{{end}}' 2>/dev/null | grep -oE '^172\.[0-9]+\.' | grep -oE '[0-9]+' || true)"
  for candidate in $(seq 20 250); do
    if ! printf '%s\n' "$used" | grep -qx "$candidate"; then
      echo "$candidate"
      return
    fi
  done
  echo 61
}

pg_port="$(free_port)"
redis_port="$(free_port)"
web_port="$(free_port)"
collab_ws_port="$(free_port)"
minio_port="$(free_port)"
minio_console_port="$(free_port)"
# P18 F02：e2e/ava-real-model-failure.spec.ts 自建的假 Anthropic 兼容 server 监听的端口。
fake_anthropic_port="$(free_port)"
# 避免几次 free_port 撞到同一个端口（极小概率），撞了就再要一个
if [ "$pg_port" = "$redis_port" ]; then redis_port="$(free_port)"; fi
if [ "$web_port" = "$pg_port" ] || [ "$web_port" = "$redis_port" ]; then web_port="$(free_port)"; fi
if [ "$collab_ws_port" = "$pg_port" ] || [ "$collab_ws_port" = "$redis_port" ] || [ "$collab_ws_port" = "$web_port" ]; then collab_ws_port="$(free_port)"; fi
if [ "$minio_port" = "$pg_port" ] || [ "$minio_port" = "$redis_port" ] || [ "$minio_port" = "$web_port" ] || [ "$minio_port" = "$collab_ws_port" ]; then minio_port="$(free_port)"; fi
if [ "$minio_console_port" = "$pg_port" ] || [ "$minio_console_port" = "$redis_port" ] || [ "$minio_console_port" = "$web_port" ] || [ "$minio_console_port" = "$collab_ws_port" ] || [ "$minio_console_port" = "$minio_port" ]; then minio_console_port="$(free_port)"; fi
if [ "$fake_anthropic_port" = "$pg_port" ] || [ "$fake_anthropic_port" = "$redis_port" ] || [ "$fake_anthropic_port" = "$web_port" ] || [ "$fake_anthropic_port" = "$collab_ws_port" ] || [ "$fake_anthropic_port" = "$minio_port" ] || [ "$fake_anthropic_port" = "$minio_console_port" ]; then fake_anthropic_port="$(free_port)"; fi

subnet_octet="$(free_subnet_octet)"
compose_subnet="172.${subnet_octet}.0.0/24"

env_local="apps/web/.env.local"
mkdir -p "$(dirname "$env_local")"
touch "$env_local"
compose_env="infra/.env"
touch "$compose_env"

upsert() {
  local key="$1" val="$2" file="$3"
  grep -v "^${key}=" "$file" > "$file.tmp" 2>/dev/null || true
  mv "$file.tmp" "$file"
  printf '%s=%s\n' "$key" "$val" >> "$file"
}

upsert "DATABASE_URL" "postgresql://boardx:boardx@localhost:${pg_port}/boardx" "$env_local"
upsert "REDIS_URL" "redis://localhost:${redis_port}" "$env_local"
upsert "E2E_PORT" "${web_port}" "$env_local"
upsert "COLLAB_WS_PORT" "${collab_ws_port}" "$env_local"
# packages/storage/src/index.ts 读 S3_ENDPOINT（默认 localhost:9090），不读 MINIO_PORT——
# 之前只写了 MINIO_PORT/MINIO_CONSOLE_PORT，导致上传接口连去默认端口/无人监听的 9090，
# 在这个 worktree 隔离出的 MinIO 容器上传全部 502（kb-004 RAG e2e 门控验证时发现）。
upsert "S3_ENDPOINT" "http://localhost:${minio_port}" "$env_local"
# P18 F02（e2e/ava-real-model-failure.spec.ts）：把 anthropicProvider 的请求路由到本
# worktree 独占的假 Anthropic 兼容 server（同一 spec 文件里起的 http.createServer），
# 覆盖 429/网络错误/超时/停止生成四个真实故障场景，不消耗真实供应商额度。
# ANTHROPIC_BASE_URL 在 anthropicProvider 模块加载时读一次 env（见该文件顶部注释），
# 必须在 next dev（playwright webServer）启动前就写好。ANTHROPIC_API_KEY 用不校验真实性
# 的占位值（请求根本不会到达真实 Anthropic）。ANTHROPIC_TIMEOUT_MS 调小，e2e 验证请求级
# 超时熔断时不用真等默认的 60s。
upsert "ANTHROPIC_API_KEY" "e2e-fake-key-not-a-real-credential" "$env_local"
upsert "ANTHROPIC_BASE_URL" "http://127.0.0.1:${fake_anthropic_port}" "$env_local"
upsert "ANTHROPIC_TIMEOUT_MS" "5000" "$env_local"

touch .env
upsert "COMPOSE_PROJECT_NAME" "$project_name" ".env"
upsert "PG_PORT" "${pg_port}" ".env"
upsert "REDIS_PORT" "${redis_port}" ".env"
# 根 .env 也带上 DATABASE_URL/REDIS_URL/E2E_PORT，方便直接在根目录跑脚本时继承。
upsert "DATABASE_URL" "postgresql://boardx:boardx@localhost:${pg_port}/boardx" ".env"
upsert "REDIS_URL" "redis://localhost:${redis_port}" ".env"
upsert "E2E_PORT" "${web_port}" ".env"
upsert "COLLAB_WS_PORT" "${collab_ws_port}" ".env"
upsert "MINIO_PORT" "${minio_port}" ".env"
upsert "MINIO_CONSOLE_PORT" "${minio_console_port}" ".env"
upsert "S3_ENDPOINT" "http://localhost:${minio_port}" ".env"

# `docker compose -f infra/docker-compose.yml ...` uses the compose file's directory as
# project directory, so it reads infra/.env（= $compose_env）rather than the repo root .env.
touch "$compose_env"
upsert "COMPOSE_PROJECT_NAME" "$project_name" "$compose_env"
upsert "PG_PORT" "${pg_port}" "$compose_env"
upsert "REDIS_PORT" "${redis_port}" "$compose_env"
upsert "MINIO_PORT" "${minio_port}" "$compose_env"
upsert "MINIO_CONSOLE_PORT" "${minio_console_port}" "$compose_env"
upsert "COMPOSE_SUBNET" "${compose_subnet}" "$compose_env"
upsert "COMPOSE_SUBNET" "${compose_subnet}" ".env"

echo "worktree env 已就绪："
echo "  project name : $project_name"
echo "  postgres     : localhost:${pg_port}"
echo "  redis        : localhost:${redis_port}"
echo "  minio        : localhost:${minio_port} / console localhost:${minio_console_port}"
echo "  web/e2e      : localhost:${web_port}（next dev -p \$E2E_PORT，playwright.config.ts 已读这个变量）"
echo "  collab ws    : localhost:${collab_ws_port}"
echo "  docker 子网  : ${compose_subnet}"
echo "  已写入        : ${env_local}, .env, ${compose_env}（都已 gitignore，机器级/worktree 级覆盖）"
echo "接下来正常跑: docker compose -f infra/docker-compose.yml up -d"
