# F08 附件功能 — 验证证据说明

## 结论
`e2e/ava-attach-files.spec.ts`（feature_list.json 指定的 verification 命令）在**独立、无并发争用**的
情况下稳定全绿（8/8 passed，见 `F08-standalone-passing.log`，exit 0）。

## `harness verify --sprint p9/03` 未能门控为 passing 的原因
本机同时有多个 agent worktree 并行跑 `docker compose` + `next dev` + Playwright + `turbo run`
（`uptime` 观测到 load average 一度到 30~100），导致本 worktree 的 Postgres 容器反复出现
`the database system is in recovery mode` / `FATAL: 57P03` 崩溃-恢复循环（见 `F08.verify.log`
末尾的 `[WebServer]` 报错）。connect/reconnect 期间恰好落在 8 个用例中「真实发起上传 HTTP
往返」的 2 个用例（用例 1：选择图片上传；用例 2：拖拽上传）身上——这两个用例需要
`POST /api/ava/threads/:id/attachments` 在 10s 超时内完成完整往返（浏览器→Next.js→Postgres
落库暂存记录→MinIO 写对象），在数据库反复重启的窗口期请求会挂起直到超时。

不依赖数据库往返完成的 6 个纯校验/权限用例（类型/大小/数量校验、未登录 401、
服务端二次校验 400）在同一批次里稳定通过，佐证失败点是"数据库瞬时不可用"，不是应用代码缺陷。

## 复现证据
- `pnpm harness verify --sprint p9/03` 连续 4 次调用：均在同样的 2 个用例上失败，
  失败时 Postgres 容器日志（`docker logs worktree-agent-a9fd9201c72b3d88b-postgres-1`）
  均可见 `database system was interrupted` / `FATAL: the database system is in recovery mode`。
- 同一份代码、同一个 spec 文件，脱离 `harness verify` 的额外并发压力单独执行：
  连续验证中多次 8/8 全绿（`F08-standalone-passing.log`）。
- 回归证据：F01 (`ava-chat-basic.spec.ts`) 5/5 通过（`F08-regression-f01-ava-chat-basic.log`），
  证明本次改动未破坏既有聊天壳/流式回复行为。
- `packages/storage`/`packages/data`/`packages/ai`/`apps/web` 的 lint + typecheck + vitest
  单元测试全部通过（见 PR 描述里的命令记录）。

## 依据
任务说明中已提前预警本机存在"shared-machine resource contention"已知问题，并 sanction 了
"若确认是资源争用、且自身验证干净通过，可 `git push --no-verify`" 的例外路径。本记录即该例外
的书面依据；`feature_list.json` 中 F08 的 `status`/`evidence` 未被手工改动，仍如实反映
`harness verify` 未能在本机当前负载下完成门控（`in_progress`，未 `passing`）——留给负载降下来后
由 coordinator 或后续 verify 运行门控转移，不在此 PR 里假装通过。
