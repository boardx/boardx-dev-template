# F21 追加修复证据 — applyColors itemsRef 竞态（passing 后发现）

harness verify 状态：F21 已 passing 不可逆，本次 verify 调用为 no-op：
```

> boardx-dev-template@ harness /Users/shenyanbin/Documents/projects/boardx-dev-next/.claude/worktrees/p6-09-multiselect
> tsx .harness/scripts/cli.ts "verify" "--sprint" "p6/09" "--feature" "F21" "--owner" "canvas-worker-1"

F21 已 passing，跳过（不可逆）
完成：0 个升级为 passing，0 个未通过。
```

widget-style.spec.ts:102（应用格式）单独跑 4 次：
```
/tmp/f21-rep-1.log:  1 passed (12.6s)
/tmp/f21-rep-3.log:  1 passed (9.4s)
/tmp/f21-spec-run.log:  1 passed (13.8s)
/tmp/f21-rep-2.log:  1 passed (8.5s)
```

widget-active-selection.spec.ts 全量套件：
```
  8 passed (20.0s)
```
