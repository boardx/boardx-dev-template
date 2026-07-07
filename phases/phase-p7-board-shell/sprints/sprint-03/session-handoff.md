# 会话交接 — Sprint p7/03

## 当前已验证
- F11（Board Menu 工具栏框架 + 组件创建入口）：passing。
  验证命令：`docker compose -f infra/docker-compose.yml up -d` /
  `pnpm --filter @repo/data run migrate` /
  `pnpm --filter @repo/web exec playwright test e2e/board-menu.spec.ts`（10/10）+
  `pnpm -w run verify:base`（harness verify 自动跑，通过）。
  证据：`phases/phase-p7-board-shell/sprints/sprint-03/evidence/F11.verify.log`。

## 本轮改动
- `apps/web/components/board/board-canvas.tsx`：
  - 新增 chart 工具占位态（`notice` state + "C" 键切换图表模式，点击画布给出"即将上线"
    反馈，不创建真实对象）与 eraser 入口占位态（点击给出"暂不可用"反馈），均不越界实现
    p6:F17/F18 本身。
  - **修复真实回归（非本轮引入但压测暴露）**：`addShape`/`addText`/`addEmbed` 在
    POST 创建 + PATCH color 哨兵成功后，新增 `upsertItem(docRef.current, item.id, {...})`
    直写 collab doc，规避 `packages/collab` 的 `seedItems()` 对已知 id 永久跳过导致的
    竞态（详见 issue #432）。这不是完整修复——完整修复需要 `packages/collab` 加版本号
    裁决，超出 coord-board 的 area。
- `apps/web/e2e/board-menu.spec.ts`（新增）：10 条测试，覆盖 uc-board-menu-001~007+012。
  其中 uc-board-menu-004 用 `expect.poll` 容忍上述已知竞态的收敛窗口（不是弱化断言，
  断言意图不变，只是给一个合理等待窗口）。

## 仍损坏或未验证
- issue #432（packages/collab 竞态）未关闭，coord-board 已就地缓解但未根治，交给
  coord-collab。`board-menu.spec.ts` 的 uc-board-menu-004 理论上仍有低概率因此偶发失败
  （已知、已记录，不是本次遗漏）。
- F17（手绘）、F18（图表）尚未实现，F11 里对应入口是占位态，待这两个 feature 落地后
  需要回来把占位态换成真实创建逻辑。

## 下一步最佳动作
- 下一个可以直接派工的是 F12（链接组件），依赖 F11 已就位。
- 不要碰：`apps/web/app/api/board-items/[itemId]/route.ts` 与
  `apps/web/app/api/boards/[id]/items/route.ts` 的白名单（已确认不可扩展，color 是唯一
  可扩展的透传字段）。
- 跟进 issue #432（不属于 coord-board area，只需要关注 coord-collab 的处理进度，不必
  自己动手深挖）。

## 命令
- 启动: `pnpm -w run dev`
- 验证: `pnpm harness verify --phase p7 --sprint p7/03 --feature F11 --owner canvas-worker-1`
- 调试: `pnpm --filter @repo/web exec playwright test e2e/board-menu.spec.ts --reporter=list`
