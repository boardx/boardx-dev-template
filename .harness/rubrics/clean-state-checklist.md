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
