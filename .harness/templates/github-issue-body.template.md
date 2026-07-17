# GitHub Issue Body 模版规格（feature → issue 投影）

> 生成方：`.harness/scripts/sync-github.ts` 的 `buildIssueBody()`。
> **本文件是模版的规格说明**（生成逻辑在代码里）；改代码请同步改这里，反之亦然。
>
> 设计目标：一个**只拿到这个 issue、对本仓库零先验**的 agent（云端 agent /
> 新会话 / 外部协作者），不需要额外口头交代就具备开工条件。
> 边界：GitHub 是只读投影，仓库才是权威——issue 提供完整契约 + 指回权威文件的
> 链接，不复制仓库全部规则（规则以 AGENTS.md 为准）。

## 必备信息清单（一个 agent 开工需要什么）

| # | 需要知道 | issue 里的来源 section | 数据来源（feature 字段/文件） |
|---|---------|----------------------|------------------------------|
| 1 | 做成什么样才算对 | 交付契约 | `user_visible_behavior` |
| 2 | 怎么证明做完了 | 验证 + 证据落盘路径 | `verification[]`、evidence 路径约定 |
| 3 | 怎么做/踩过的坑/边界 | 实现指引 | `notes`（此前缺失——最关键的修复点） |
| 4 | 界面长什么样 | 设计参照 | `design_ref`（prototype 锚点 / 已确认 UI 组件路径） |
| 5 | 能不能现在开工 | 前置依赖 | `depends_on[]` + 各依赖的**实时状态**（passing 与否） |
| 6 | 在整体里的位置 | 元数据表 | phase / sprint / capability / priority / wave / area |
| 7 | 按什么流程干活 | 开工流程 | claim → 读上下文 → 实现 → verify 门控 → PR 规范 |
| 8 | 规则的权威在哪 | 各处链接 | feature_list.json / requirements/ / ui-signoff.md / session-handoff.md / AGENTS.md |
| 9 | 属于哪个总追踪 Issue | Parent Tracking Issue | roadmap phase 的可选 `tracking_issue` |

## Body 结构（生成顺序）

```markdown
## Parent Tracking Issue
Parent: #<tracking_issue>
https://github.com/<repo>/issues/<tracking_issue>

## 交付契约（user_visible_behavior）
<user_visible_behavior 原文>

## 验证（完成的唯一标准：每条命令退出码 0）
- [ ] `<verification[0]>`
- [ ] `<verification[1]>`
证据落盘：`phases/<phase-dir>/sprints/sprint-<MM>/evidence/<FID>.verify.log`

## 实现指引（notes）
<notes 原文；无则「（无）」>

## 设计参照
<design_ref；无则「（无 UI 或沿用现有界面）」>

## 前置依赖
- `F0x` — 已就绪 / ⚠ 未就绪（<status>），就绪前不要开工
- `pN:F0x` — 同上（跨阶段依赖读取对方 feature_list 的实时状态）

## 元数据
| phase | sprint | 能力平面 | 优先级 | wave | area |

## 开工流程（agent 必读）
> 本 issue 是仓库的只读投影；权威是 feature_list.json（链接）。不一致以仓库为准。
1. ./init.sh
2. pnpm harness claim --phase <p> --feature <F> --owner <id>
3. 读 requirements/、ui-signoff.md、session-handoff.md（均为链接）
4. 范围纪律：最小实现、不碰 active-features.json
5. 逐条跑 verification → 证据落盘 → pnpm harness verify 门控（禁止手改 status）
6. 分支/PR 规范（Closes #issue）+ 收尾 progress/handoff
```

未配置 `tracking_issue` 的 Phase 省略 `Parent Tracking Issue` section。

## 更新语义（幂等 + 收敛）

- issue 以 title（`[F0x] <title>`）做幂等键。
- **不存在 → 创建；已存在 → `gh issue edit --body` 覆盖更新**。
  文件是唯一事实来源：feature 的 notes/verification/依赖状态变了，重跑
  `pnpm harness sync --phase <p> --apply` 后投影必须收敛到文件当前状态。
  （2026-07-03 之前旧行为是「已存在则跳过」，导致模版升级刷不进存量 issue，已修。）
- labels / milestone / assignee 仅创建时设置；close 由 status_actions 驱动（见
  `.harness/config/github-sync.yaml`）。

## 刻意不放进 issue 的内容

- 完整编码规范/UIUX 规范——链接指回 `.harness/instructions/`，避免复制腐化。
- feature 的 `status`——GitHub label（`status:*`）与 issue 开闭状态承载，body 不重复。
- 其它 feature 的细节——依赖只给 id + 实时状态，细节看对方 issue / feature_list。
