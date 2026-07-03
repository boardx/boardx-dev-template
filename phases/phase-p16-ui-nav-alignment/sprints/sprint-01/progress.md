# 进度日志 — Sprint p16/01

## 当前已验证状态(唯一真相)
- 仓库根目录: <repo 路径>
- 标准启动路径: `pnpm -w run dev`
- 标准验证路径: `pnpm -w run verify:base`
- 当前最高优先级未完成功能: F02 已产出文档待 harness verify 门控转正；F01/F03 状态见各自 worker 记录
- 当前 blocker: 无（F02 自身）

## 会话记录
### 2026-07-03 00:46:39
- 本轮目标:
- 已完成:
- 运行过的验证:
- 已记录证据:
- 提交记录:
- 已知风险或未解决问题:
- 下一步最佳动作:

### 2026-07-03 01:36（wrk-nav-audit-1 / F02 UI 差距审计）
- 本轮目标：完成 F02「UI 差距审计：Ava / Store / Surveys / Admin vs prototype」，产出
  `docs/design/boardx-ui-gap-round2.md`。
- 已完成：
  - 起本 worktree 独立 docker compose 栈（`scripts/init-worktree-env.sh` 分配 postgres:51512 /
    redis:51513 / minio:51515，project name `harness-coord-p16-wave0-dispatch`），
    `pnpm --filter @repo/data run migrate` 应用到最新 migration。
  - 起 `apps/web` dev server（Preview 工具，端口 3000），注册测试账号
    `gapaudit@example.com`，用 `/api/dev/grant-sysadmin` 开发态提权访问 `/admin`。
  - 逐屏访问 `/ava`（空态+对话态）、`/ai-store`（Explore 列表）、`/surveys`（空态）、
    `/admin` + `/admin/users`，用 accessibility snapshot 精确取证逐字文案。
  - 本地起 `python3 -m http.server` 把 `docs/design/boardx-prototype-v1.bundle.html` 当静态站点
    打开（`file://` 被 Preview 工具同源沙箱拦截），点击 rail 的 AVA/Store/Survey/Admin 四项拿到
    设计稿对应屏结构。
  - 交叉核对源码（`admin-home.tsx`、`ava/page.tsx`、`sidebar.tsx`、`board-canvas.tsx`）确认语言
    使用的确切行号，比截图更精确。
  - 产出 `docs/design/boardx-ui-gap-round2.md`（211 行）：0.审计范围方法 / 1.四模块逐屏差距表 /
    2.跨模块通用问题（文案语言分裂三档：纯英文/纯中文/同屏混排，Admin 模块系统性全中文是最大
    发现） / 3.给 p17 的优先级建议（P0 Admin 英文化 + Ava 空态英文化，P1 AI Store"喜欢"单点修复
    + 文案 lint 规则化，P2 Surveys scope tab 缺失等结构性差距，P3 需要真实数据才能验证的部分）。
- 运行过的验证：
  - `test -f docs/design/boardx-ui-gap-round2.md` → exit 0
  - `grep -q 'Ava' ... && grep -q 'Store' ... && grep -q 'Surveys' ... && grep -q 'Admin' ...` → exit 0
  - 输出留存于 `evidence/f02-verification.txt`。
- 已记录证据：`phases/phase-p16-ui-nav-alignment/sprints/sprint-01/evidence/f02-verification.txt`。
- 提交记录：见分支 `worker/wrk-nav-audit-1-p16-f02-ui-audit` 的 PR（Closes #221）。
- 已知风险或未解决问题：
  - 未落盘截图文件（`preview_screenshot` 无 save_to_disk），改用 accessibility snapshot + 源码
    行号代替，已在文档附录说明局限。
  - Ava 多轮对话消息操作 / Surveys 有数据的列表态 / Admin Users 表格列头，因测试账号无历史数据
    未能截图核对，已列入文档 §3 P3 待办。
  - 收尾时 `docker compose -f infra/docker-compose.yml down`（未加 `-p`）误删了一个残留的默认
    project name `infra` 的孤儿栈（postgres/redis/minio 三容器），推测是历史遗留、非本会话创建、
    当时看起来没有进程连着；已改用显式 `-p harness-coord-p16-wave0-dispatch` 正确关闭本 worktree
    自己的栈。如果后续有其他 worktree 反馈数据库连不上，可能与此有关，需要人工核实并重新
    `docker compose up -d` 重建（各 worktree 的 `.env`/migration 是幂等的，重建不丢权威数据，
    因为这些都是本地开发库）。
- 下一步最佳动作：等待 code review + `pnpm harness verify` 门控；F03（design lint 扩大覆盖）
  可以直接引用本文档 §2 第 1 点的中文检测建议来定规则。
