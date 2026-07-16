# 干净收尾检查清单(Clean State Checklist)

每次会话结束前逐项确认,确保下一轮无需人工修复即可开工:

- [ ] 标准启动路径仍可用(`pnpm -w run dev`)。
- [ ] 标准验证仍能跑(`pnpm -w run verify:base`)。
- [ ] 进度日志已更新(对应 scope 的 `progress.md`)。
- [ ] 会话交接已写(`session-handoff.md`)。
- [ ] 功能清单真实反映 passing / 未验证边界——**没有假 passing**。
- [ ] 没有半成品处于未记录状态。
- [ ] 同一时刻只有一个 feature 处于 `in_progress`。
- [ ] 关键运行输出已归档到 sprint 的 `evidence/`。
- [ ] **本 worktree 起过的 docker compose 栈已 down**（`docker compose -f infra/docker-compose.yml down`）——
  feature/PR 收尾后不需要保留一份实时可跑的数据库。跑
  `pnpm harness sweep-docker` 核实没有本会话遗留的孤儿栈（见 ADR-007）。
- [ ] **主 checkout 干净且不落后 origin/main**（`git status --porcelain` 为空、
  `git rev-list --count HEAD..origin/main` 为 0）。干活一律在 worktree 里,主 checkout
  只当 main 的镜像——它一漂,谁在里面读代码都是在读旧仓库,把现状误报成缺口。
  2026-07-15 实测:主 checkout 落后 90 个提交,working tree 里躺着 4 个**旧于 main**的
  改动(其中 `registry.yaml` 还处于 staged,内容是删掉 `portal-broker`,一次 `git commit`
  就会打挂 devportal 自助发 token)+ 一坨 117MB 的 `.next.corrupt-*` 残骸。全部是废弃
  工作流的化石,没有一件是真丢的工作——但它足以让人把已交付的功能误判成没做。
