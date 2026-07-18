# ADR 002: shellTool 用 best-effort deny 筛查，硬隔离留给 OS 沙箱

- 状态: Accepted
- 适用层：方法论（可移植：随模板打包）
- 日期: 2026-06-29

## 背景

`shellTool.manifest.cannotDo` 原本只是一组人类可读字符串（「不允许网络请求」「不允许
修改 .harness/」「不允许 root」），`run()` 里没有任何执行——纯文档。而 shellTool 在
`apps/orchestrator/src/orchestrator.ts` 里真的执行 agent 给出的命令，等于约束没有演员。

## 决策

把 cannotDo 从「纯文档」升级为「有演员的护栏」，**但明确它不是安全隔离边界**：

- 引入 `DEFAULT_DENY_RULES` + `screenCommand()`，在 spawn 前对命令做前置筛查，
  命中则返回结构化 `ToolErr { code: "DENIED" }`，不执行。
- 默认 `shellTool` 内置规则，调用方无法关闭；`makeShellTool(rules)` 供受控定制。
- **诚实标注**：对 bash 做字符串/正则匹配必然可被变量/编码/间接执行绕过
  （如 `e=curl; $e ...`）。deny 层只挡诚实误操作和低级滥用。

硬保证（不可绕过）留给 OS 级沙箱，作为后续工作：
- 独立低权用户运行 orchestrator（堵 sudo/root）。
- `.harness/` 以只读方式挂载（堵控制平面写入）。
- 无网络 namespace / egress 防火墙（堵网络请求）。
- `spawnSync` 显式 `uid`/`gid` 与受限 env。

## 后果

正面：
- 低级误操作和滥用被即时挡下并结构化上报，可观测。
- 约束意图（cannotDo）与运行时行为一致，不再是假文档。

负面 / 需注意：
- 筛查可能误伤（如 localhost `curl` 健康检查）——但 shellTool 的契约本就是
  「网络走 network 工具」，e2e 验证应由 e2e-verifier 的 bash 承担，不走此工具。
- 不要把通过 deny 层当作「安全」。在 OS 沙箱落地前，shellTool 不应暴露给不可信输入。

## 备选（已否决）

- **维持纯文档 cannotDo**：约束无执行，等于没有。否决。
- **只上 OS 沙箱、不做 deny 层**：沙箱工作量大、落地周期长，期间裸奔。
  先上便宜的 deny 层止血，沙箱并行推进。两者互补，非二选一。
