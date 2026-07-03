# 会话交接 — Sprint p6/08

## 已完成
- **F14 passing**（verify 门控翻的，evidence/F14.verify.log）：packages/canvas
  命令运行时支持字段级 patch（`{kind:"patch", id, patch}`），move/edit 为别名，
  BoardItem 开放 widget 扩展字段。F15+（形状/连接线/手绘/图表）直接在此 schema
  上加专有字段，不需要再改 applyCommand 分支。

## 下一个 feature：F13（渲染引擎切 Fabric.js）— 开工前必读

**关键设计张力（开工前先决策）**：F13 的 verification 要求既有 canvas e2e 全绿，
但现有 e2e 大量断言 DOM 锚点：
- `canvas-select.spec.ts` 点击 `[data-item-id]` div、`items-layer` testid；
- `canvas-render.spec.ts` 断言 item 元素 visible。
渲染切到 `<canvas>`（Fabric 位图）后这些 DOM 锚点天然消失。三个可选策略：
1. **DOM 测试镜像层**：Fabric 负责视觉渲染，同步维护一层不可见的 DOM 镜像
   （position:absolute、opacity:0、pointer-events 透传到 fabric），testid 保留。
   e2e 不用改，但等于维护双层，长期是负担。
2. **改 e2e 断言方式**（推荐评估）：把 DOM 断言改为「同断言意图」的 canvas 兼容
   方式（页面暴露 `window.__canvasTestApi`（仅 test env）或 data-* 到 wrapper），
   同时改 feature verification 口径——需要人工同意「e2e 不回归」= 断言意图不变
   而非文件字节不变。
3. **Fabric 上层保留 DOM 交互层**：Fabric 只画视觉，选择框/拖拽仍走 DOM——
   这是假切换，违背 F13 目标，不要选。

**建议**：向人类提出策略 2 的口径确认，然后：先写 canvas-fabric-engine.spec.ts
（断言 `<canvas>` 存在 + fabric 对象数与 items 一致），再逐 spec 迁移断言，
每迁一个跑一个，不要一次全改。

## 环境注意
- 本 worktree 已跑过 `bash scripts/init-worktree-env.sh`（独占端口 pg:65380/
  redis:65381/web:65382，docker project `worker-canvas-p6-sprint08`）。
- worktree 的各包 node_modules 是指向主 checkout 的 symlink（pnpm workspace
  未在此 install）；`.gitignore` 的 `node_modules/` 不匹配 symlink，**git add
  时注意别把 symlink 提交进去**（F14 提交时踩过一次，已 amend 掉）。
- e2e 并行跑时 canvas-select 偶发 flaky（Shift 多选断言超时），单跑即绿；
  verify 门控整体跑是过的。

## 复现路径
```bash
cd .claude/worktrees/canvas-p6-sprint08
docker compose -f infra/docker-compose.yml up -d
pnpm harness verify --sprint p6/08 --feature F13 --owner canvas-worker-1
```
