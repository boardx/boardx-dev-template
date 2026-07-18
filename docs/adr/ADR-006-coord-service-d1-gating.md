# ADR 006: coord-service（Cloudflare D1）作为可选的原子认领权威，GitHub 保留为默认与兜底

- 状态: Accepted
- 适用层：项目实现（BoardX 专属：模板只带模式引用）
- 日期: 2026-07-05
- 关联: 接续 ADR-004（issues as coordination bus）；不推翻它对"GitHub issue+label
  是协调平面权威"的定位，而是给最容易发生真实竞态的那一小块（认领/心跳/交还）
  补一层可选的、更强的原子性保证。

## 背景

ADR-004 把协调权威钉在 GitHub issue+label 上，理由是"issue/label 经 API 变更是
并发安全的"。这句话经不起推敲：`gh issue edit --add-label` 没有 compare-and-swap，
两个 agent 抢同一个 issue 完全可能都"成功"——这正是本仓库里已经发生过的问题
（共享 checkout 被并发踩踏、一次并发认领导致提交被静默替换，见
`docs/adr/ADR-005-shared-checkout-isolation.md` 背景段）。

同时，`.harness/scripts/lib/lock.ts` 的顶层 coordinator 文件锁只解决单机场景
（防同一台机器上多个 `/loop` 会话互踩），module-coordinator 的租约干脆没有任何
文件锁，纯靠人手打 `gh issue comment` 达成"认领/心跳/退位"的社会约定。

## 决策

新增 `packages/coord-service`：一个 Cloudflare Workers + D1 服务，`claims` 表的
`uq_active_claim`（`resource_id` 上的 partial unique index，条件
`status='in_progress'`）给"认领"这个动作一个真正的原子 compare-and-swap——
一次 `INSERT`，撞了索引就是"已被占用"，不是 GitHub label 那种竞态。

**这不是把 ADR-004 推倒重来，是分层：**

1. **规范/叙述层不变**：feature 是什么、验收标准是什么，仍然是
   `feature_list.json` + GitHub issue 的事，ADR-004 这部分结论继续成立。
2. **认领/心跳/交还这个具体动作，多了一层可选的更强保证**：
   - `.harness/scripts/coordinator-lock.ts`（顶层 coordinator 文件锁）：
     `COORD_SERVICE_URL`/`COORD_SERVICE_TOKEN` 都配置了时，`lock-acquire`
     会先问 D1 "有没有人已经占着且没过期"，问不到/查询失败就静默降级为只看
     本地文件——本地文件锁永远是兜底，未配置这两个环境变量时是唯一权威。
   - `.harness/scripts/module-lock.ts`（module-coordinator 租约）：把"发规范
     格式评论"这件事从手打 `gh issue comment` 固化成一条命令，GitHub 评论
     依然是**唯一**权威（module-coordinator 没有本地文件锁可言，dual-write
     纯粹是影子写，不参与任何门禁判断）。
3. **谁都没有被强制切过去**：这两个环境变量目前只在本会话自己配置过，没有
   机制把它们注入到其它正在跑的 coordinator/module-coordinator 会话——所以
   "cutover"在这里的准确含义是**机制已经建好、经过验证、随时可以打开**，
   而不是"今晚所有会话的行为被静默改变"。这是刻意的保守：真要让全部现役
   会话切过去，需要把凭据分发给每一个会话的实际运行环境，这件事本身应该是
   显式的、被记录在总线上的操作，不该是这次改动的副作用。

## 后果

正面：
- 认领这个动作有了真正的原子性保证，不再是 GitHub label 的竞态；D1 不可达时
  优雅降级为原有行为，不引入新的单点故障。
- 完全可选、完全向后兼容——没有配置这两个环境变量的既有工作流（当前绝大多数
  会话）行为逐字不变，已经在 Phase 1-5 的实测里逐条验证过。
- 为将来"真正的全量 cutover"（把 D1 变成唯一权威、GitHub 变回纯只读投影）
  铺好了机制基础，但那是一次需要人类/coord-main 显式决定"现在切"的独立操作，
  不隐含在本 ADR 里。

负面 / 需注意：
- **多了一套需要维护的基础设施**：Cloudflare 账号、D1 数据库、Worker 部署、
  token 轮换——这是真实的运维负担，不是免费的。
- **两套机制并存期间的认知负担**：读 `coordinator-lock.ts` 的人现在要理解
  "文件锁 + 可选的 D1 查询"这两层，而不是单一心智模型。
- **`role:coord-main` 的冲突判定分支未在共享的真实 staging 库上做端到端实测**——
  直接往这个共享资源 id 里插入一条伪造的 `in_progress` 记录来验证"检测到冲突
  就拒绝"这条分支，被判定为对共享协调存储的风险高于验证价值（这个决定本身
  也是本 ADR 想固化的纪律：不拿共享协调资源做实验）。这条分支的正确性目前由
  代码审查 + `packages/coord-service` 自己测试套件里已经验证过的
  "资源被占用时查询会返回该行"这条底层行为共同担保，不是完全没有验证，但
  确实没有对着真实部署走过这一条特定路径的端到端验证。
- **module-coordinator 侧的 dual-write 是纯影子写**，coord-service 目前不参与
  module-coordinator 的任何门禁判断——真要让 D1 在这一侧也变成权威，需要单独
  评估（module-coordinator 没有本地文件锁，"D1 不可达时降级到什么"这个问题在
  这一侧还没有答案，留给下一次迭代）。

## 备选（已否决）

- **不做任何改动，继续接受 GitHub label 的竞态**：ADR-005 已经证明这类竞态会
  真实发生并造成损失（哪怕这次靠 reflog 全须全尾找回）。否决。
- **一次性强制全量切换，不做 opt-in**：技术上最"干净"，但意味着要在没有
  跟其它正在运行的会话协调的情况下，单方面改变它们下一次调用
  `pnpm harness lock-*`/`module-lock-*` 时的行为——这正是 ADR-005 想消除的
  那类"共享基础设施被单个会话的动作影响到不知情的其它会话"问题的变种。否决，
  改用 opt-in + 优雅降级。
- **把 GitHub 评论也从 module-coordinator 的流程里去掉，只留 D1**：会让
  `coordination:lease:<module>` issue 失去"人类可读的协调历史"这个既有价值
  （见 ADR-004 对规范/叙述层的定位），且 module-coordinator 目前完全没有
  D1 不可达时的降级路径。否决，保留 GitHub 评论为唯一权威，D1 纯影子写。
