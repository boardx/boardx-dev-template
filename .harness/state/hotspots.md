# 热点文件清单（hotspots）

> 来源：work-cycle-proposal.md §2「热点文件协作规约」（PR #443）。
> 动这里列出的文件的 PR，必须在 cycle-plan 里申报；同周期两个 PR 申报同一热点 →
> coord-main 排序，后者等前者合并后 rebase 再提。合并热点文件 PR 前，本地 merge
> main + 重跑受影响包 typecheck（coordinator-sop.md L1「合并队列」热点文件额外一步，
> PR #429 先例）。
>
> 维护规则：新增/移除条目走 PR（这是协调协议的一部分，不是随手笔记）；每个条目带
> 入选理由，理由消失（如文件被拆分/重构）后移除。

| 文件 | 入选理由 |
|---|---|
| `apps/web/components/board/board-canvas.tsx` | 三次合并碰撞、两次伤及 main（#415/#417 TS2451 事故 + hotfix #427），画布相关 feature 的必经之路 |
| `apps/web/app/(app)/rooms/[id]/members/page.tsx` | room 与 invite 两个域同时会碰（multi-agent-coordination.md 跨模块热点先例） |
| `.harness/state/PROGRESS.md` | 自动聚合文件，几乎每个 PR 都会碰一行时间戳/计数（#422 曾因此 CONFLICTING 搁浅一天） |
