# 会话交接 — Sprint p6/08

## 已完成
- **F14 passing**：packages/canvas 字段级 patch 命令运行时（见上一轮记录）。
- **F13 passing**（verify 门控翻的，evidence/F13.verify.log）：画布渲染引擎
  切换 Fabric.js（官方 npm fabric@6.9.1）。
  - `apps/web/components/board/fabric-canvas.tsx`：渲染适配器。item 渲染 +
    选中框/拖拽（object:moving 吸附、object:modified 提交可逆 move）/Shift 多选/
    双击编辑/右键 都在 <canvas> 上；React 状态仍是数据权威，reconcile 单向同步。
  - 视口方案（混合）：CanvasViewport 保留 CSS transform surface（DOM 覆盖层：
    alignment-guide / item-edit-<id> textarea / widget-reloaded 徽标 + collab
    data-vp-* 锚点），fabric canvas 1:1 铺满视口、viewportTransform 镜像 pan/zoom。
  - e2e 锚点按**策略 2**（issue #269，人类批准）迁移：`e2e/helpers/canvas.ts` +
    `window.__canvasTestApi`（getItems/getSelectedIds/getItemScreenRect/
    getFabricObjectCount，仅非生产环境）。断言意图逐条保留。
  - 新增 `e2e/canvas-fabric-engine.spec.ts`。

## 已知预置失败（非 F13 引入，基线留档 evidence/F13.baseline-e2e.log）
- board-menu-001 用例 1：断言形状含「矩形」文本；widgets-001 用例 1 与
  widgets-004 两用例：点击 `add-shape` testid。这些是 main 上 F01（board-ai
  工具坞）的锚点，本分支源码没有该入口，**基线即红、迁移后失败点一致**。
  与 main 合并时随 F01 代码自然转绿（或在合并时对齐）。

## 环境注意
- 本 worktree 的 node_modules 已从「指向主 checkout 的 symlink」切换为**真实
  pnpm install**（为装 fabric 依赖）；`.gitignore` 现在正常匹配。
- docker project `worker-canvas-p6-sprint08`（pg:65380/redis:65381/web:65382）。
- e2e 并行时 canvas-select 偶发 flaky 的旧提示仍适用；单跑为准。

## 下一个 feature：F07（对齐参考线增强）或 F12（文本组件）
- 两者都应在 fabric 对象模型上做（F13 已铺好），不要回到 DOM div。
- 参考线如需更丰富样式，可以直接画进 fabric（新建覆盖对象）或继续用 DOM
  覆盖层（当前实现，canvas-007 断言锚定 DOM `alignment-guide`）。
- 文本组件（F12）注意：现有「文本」是 note + color:"text" 哨兵（服务端只放行
  note/rect），fabric 侧渲染分支见 fabric-canvas.tsx 的 kind:"text"。

## 复现路径
```bash
cd .claude/worktrees/canvas-p6-sprint08
docker compose -f infra/docker-compose.yml up -d
pnpm harness verify --sprint p6/08 --feature F13 --owner canvas-worker-1  # F13 已 passing，幂等跳过
pnpm --filter @repo/web exec playwright test e2e/canvas-fabric-engine.spec.ts
```
