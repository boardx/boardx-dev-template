#!/usr/bin/env bash
# init-worktree-env.sh — 给当前 worktree 分配一套独占的 docker compose 端口 + project name。
# 动机：多个 agent worktree 并行跑 `docker compose -f infra/docker-compose.yml up -d` 时，
# 默认端口(5432/6379)和默认 project name(取 compose 文件所在目录名 "infra"，各 worktree 相同)
# 会互相抢占，导致 "port is already allocated"（quality-document #先前观测到的并发翻车）。
#
# 用法：在 worktree 根目录跑一次 `bash scripts/init-worktree-env.sh`，再 `docker compose up -d`。
# 幂等：已存在的 apps/web/.env.local 只会被更新 DATABASE_URL/REDIS_URL 两个 key，不动其它内容
#（比如 worker 自己加的 AI provider key）；根 .env 只写 COMPOSE_PROJECT_NAME。
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

pg_port="$(free_port)"
redis_port="$(free_port)"
# 避免两次 free_port 撞到同一个端口（极小概率），撞了就再要一个
if [ "$pg_port" = "$redis_port" ]; then redis_port="$(free_port)"; fi

env_local="apps/web/.env.local"
mkdir -p "$(dirname "$env_local")"
touch "$env_local"

upsert() {
  local key="$1" val="$2" file="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    # macOS/BSD sed 需要 -i ''；用临时文件方式兼容 GNU/BSD 两种 sed
    sed "s#^${key}=.*#${key}=${val}#" "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$val" >> "$file"
  fi
}

upsert "DATABASE_URL" "postgresql://boardx:boardx@localhost:${pg_port}/boardx" "$env_local"
upsert "REDIS_URL" "redis://localhost:${redis_port}" "$env_local"

touch .env
upsert "COMPOSE_PROJECT_NAME" "$project_name" ".env"

echo "worktree env 已就绪："
echo "  project name : $project_name"
echo "  postgres     : localhost:${pg_port}"
echo "  redis        : localhost:${redis_port}"
echo "  已写入        : $env_local, .env（都已 gitignore，机器级/worktree 级覆盖）"
echo "接下来正常跑: docker compose -f infra/docker-compose.yml up -d"
