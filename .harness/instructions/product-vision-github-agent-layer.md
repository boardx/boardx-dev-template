# Product Vision：GitHub 缺失的 Agent 协调层（对外产品化北极星）

- 状态：Proposed（人类发起并要求成文，2026-07-09；未立项，不占用当前 sprint 资源）
- 定位：本文回答"如果把 coord-service + Developer Portal 这套东西做成**任何开源项目
  都能用的标准 GitHub 增强 AI 工具**，产品该长什么样、先卖什么、护城河在哪"。
- 关系：这是**北极星文档**，不是实现规格。它约束的是方向感——ADR-011 P2、Portal
  Phase A 等在建项做 API/架构决策时，顺带照顾本文 §7 的产品化预留，不为它加急。
- 关联：ADR-009（协调权威）/ ADR-010（组织模型）/ ADR-011（身份权威）/
  developer-portal-design.md（门户 IA）/ developer-portal-use-cases.md（用例）。

## 0. 一句话定位

> **Air traffic control for AI agents on your repo.**
> GitHub 时代的 agent 空管系统——GitHub 是为人类协作设计的；当一支 AI agent
> 车队进驻仓库，它会在五个地方精确地坏掉，我们就卖那五块补丁。

## 1. 为什么是现在：GitHub 在 agent 时代的五个结构性缺口

每一条都不是推演，是本仓库多 agent 开发（27 个注册身份、单日合并 25 PR）亲身
踩过、并已在 coord-service 里修完的事故：

| # | 缺口 | GitHub 的现状 | 踩过的事故 | 我们已建的答案 |
|---|---|---|---|---|
| 1 | **并发认领无原子性** | label/评论认领有竞态，两个 agent 相隔数秒抢同一 issue，不报错 | 多次重复认领/孤儿任务（ADR-001/006 的起因） | D1 原子租约：`uq_active_claim` 唯一索引 + heartbeat + TTL + sweeper 自动回收（ADR-009） |
| 2 | **"做完了"不可信** | PR 描述里的"测试通过"只能选择信或逐个查 | 多起假 passing / 复述式验证被独立复核推翻（F21 状态回退、#460 掉能力等） | evidence 纪律："没有证据 = 没有完成"；verification 命令门控；双门禁独立复核 |
| 3 | **信号被噪音淹没** | agent 活动灌满 issue/PR 评论，维护者漏掉真正要拍板的 2 条 | 协调叙述 issue 数百条评论中混着关键决策请求 | "待人类拍板"提取 + 分级降噪（portal 板块④的核心设计） |
| 4 | **身份不可问责** | bot 账号背后是谁、权限多大，无从追溯 | 匿名 registry id 无法归因；token 分发全人工 | 身份权威 + GitHub 账号绑定 + pending/转正分级 + issue 审批留痕（ADR-011） |
| 5 | **停不下来** | main 挂了没有机制让 N 个 agent 同时停手 | 需要停线时只能逐个通知 | andon 停线信号（coordinator 层专属，D1 events，防伪造） |

**品类判断**：这五块合起来是一个 GitHub 没有、而 agent 车队刚需的**协调层
（coordination layer）**。它不与 GitHub 的任何现有产品（Projects/Actions/Copilot）
竞争——它填的是"多 agent 并发开发"这个 GitHub 设计时不存在的场景。

## 2. 产品原则（四条，违反任何一条都会失去 GitHub 老手）

1. **零迁移，GitHub 永远是权威。** 产品是 GitHub App 一键安装 + 侧车服务；
   绝不要求把 issue/PR/讨论搬进我们系统。"装了就增强、删了不损失"。
   （本仓库已验证此原则可行：ADR-009 的"GitHub 是底座"+ portal 的"呈现层不产生新权威"。）
2. **价值长在他已有的工作流里，不在我们的新页面里。** 把协调原语**投影成
   GitHub 原生物件**：租约 → issue/PR 上的 status check（"已被 agent-X 持有，
   租约 fresh"）；证据复核 → PR check run（"声称 12 项测试通过 → 独立复核 ✓/⚠"）；
   待拍板 → GitHub 通知/Slack 推送；andon → commit status 阻断合并。
   Dashboard 只是可选全景，不是必经之路。
3. **用"防住的事故"和"省下的时间"说话，不用功能列表。** 首页展示：
   "本周防止 3 次 agent 撞车（并发认领被 409 拒绝）""47 条 agent 评论中只有
   2 条需要你决策——在这里""25 个 PR 中 6 个的'测试通过'声明被独立复核推翻"。
   我们自己的 dogfood 数字（27 agent、日合 25 PR、flow-time 0.9h 基线减半）
   就是最好的 demo 素材。
4. **反锁定是卖点，不是妥协。** 所有状态可导出；审计史留在用户自己的 git
   （ADR-011 的派生快照模式直接复用为产品特性）；协调协议开放规格——目标是
   像 LSP 之于编辑器那样成为**事实标准**，而不是私有围栏。

## 3. 目标用户与"5 分钟价值"路径

**首要画像**：已经在用（或正要用）AI agent 写代码的仓库维护者/小团队 TL——
GitHub 老手，对"又一个平台"免疫，对竞态/信任/噪音三痛有切身体感。

5 分钟价值路径（产品必须按这条打磨首次体验）：
1. GitHub App 安装到仓库（1 分钟，只要 checks/issues 读写权限起步）
2. 装完立刻在最近的 agent PR 上看到第一条 check run："此 PR 的验证声明未经
   独立复核 ⚠"——**不用打开我们任何页面就看到了新信息**
3. 跑一次 `npx <cli> claim issue:123`——第二个会话再 claim 同一资源得到 409，
   撞车防护眼见为实（3 分钟）
4. 收到第一条"待你拍板"通知——发现自己不用再爬评论流（首日内）

## 4. 采纳阶梯：L0-L3，每级独立有用（别一口气卖方法论）

| 级 | 产品 | 用户心智 | 对应已建资产 | 定价直觉 |
|---|---|---|---|---|
| **L0** | 只读观测：agent 在我仓库干什么 | "先看看，零风险" | coord-dashboard（develop.boardx.us）+ /status API | 免费 / OSS |
| **L1** | **租约原语**：CLI/SDK + GitHub App，原子认领 + TTL + 回收 | "这个 GitHub 真做不到" ← **楔子** | coord-service claims 全套（ADR-009） | 免费额度 + 量费 |
| **L2** | **证据门**：verification manifest + PR check run 独立复核 | "我终于敢合 agent 的 PR 了" | harness verify 门控 + 双门禁纪律（产品化=把复核跑在我们的 runner/用户的 Actions 里） | 付费 |
| **L3** | **决策收件箱 + 车队管理**：待拍板提取、身份/审批、per-agent 性能归因 | "维护者注意力产品" | portal 板块④⑤⑥ + ADR-010/011 | 团队订阅 |

- **L1 是楔子**：一个下午能接入，小而硬——"用 label 也行"的反驳被竞态事实
  击穿（label 更新不是原子的，没有 TTL，没有身份绑定）。
- **L2 是护城河**：**信任是 agent 时代所有开发工具的终局竞争维度**。谁先把
  "AI 的声明可被独立复核"做成标准件（manifest 格式 + check run 语义），谁定义品类。
- L3 面向公司团队，是收入主体；L0/L1 对 OSS 免费换生态占位与公开案例。
- **明确不卖的**：ADR-010 那套三级 coordinator + 3h 周期组织方法论是我们的内功，
  产品只暴露它产出的数字。方法论做成可选 playbook（内容营销），不做成产品必选项。

## 5. 竞争与窗口（诚实评估）

- **最大的竞争对手是 GitHub 自己**。它迟早做 agent 原生功能（且有分发优势）。
  我们的窗口与对策：
  1. **供应商中立**：Claude/GPT/开源模型的 agent 都能接——GitHub 有动机偏向
     Copilot 系，中立性是结构性差异；
  2. **开放协议**：把租约/证据/andon 的 wire format 做成公开规格，先成为
     多 agent 框架（各家 SDK/harness）默认对接的事实标准，GitHub 后做也得兼容；
  3. **速度**：这五个缺口今天就在痛，先占住"agent ops for GitHub"的心智。
- **邻近玩家**：CI 厂商（复核天然贴近 CI，但没有租约/身份/收件箱的全链）、
  agent 框架自带的编排（绑定单一供应商，且不投影回 GitHub）。我们的差异是
  **仓库中立 + 供应商中立 + GitHub 原生投影**三者同时成立。

## 6. 风险（如实记录）

- **平台风险**：GitHub App 权限模型/费率变化；GitHub 自做同类功能（§5 对策）。
- **多租户是全新工程**：现 coord-service 是单租户单库；对外要过账号体系、
  配额、隔离、滥用防护这一整关（§7 预留降低将来改造成本，但不消除工作量）。
- **免费层成本**：/status 轮询与 check run 写入在大仓库有真实 Cloudflare 成本，
  免费额度要设计好。
- **"证据复核"责任边界**：L2 的复核结论影响合并决策，误报/漏报的责任表述
  要法务级谨慎（"辅助信号"而非"担保"）。

## 7. 对当前建设的具体影响（唯一有当下执行力的一节）

不立项、不加急，但以下在建项做设计决策时**顺带**照顾产品化预留（成本≈0，
将来省一次重构）：

1. **ADR-011 P2（GitHub OAuth）**：OAuth 回调/会话设计按"未来多 GitHub org"
   预留（org id 进身份模型，而不是假设单一 boardx org 写死）。
2. **身份 API（ADR-011 P1）**：CRUD 端点的资源路径带上仓库/租户维度的余地
   （哪怕当前恒等于默认值），避免将来 breaking change。
3. **Portal Phase A**：数据读取层做成"数据源适配器"形状（feature_list 读取器、
   gh 读取器、coord-service 读取器分离）——将来换成"任意仓库"只换适配器。
   宿主拍板（#495 留言的 a/b/c）建议选 **(a) 独立 Pages**：与"产品独立于
   被协调项目"的产品原则一致。
4. **投影接口**：coord-service 未来加"投影到 GitHub check/status"的能力时，
   作为独立模块（projection worker）而非揉进 claims 路由——它就是将来 L1/L2
   产品的 GitHub App 后端。
5. **协议即规格**：claims/events/verdicts 的 wire format 变更从现在起记录
   changelog（`packages/coord-service/` 内），为将来开放规格铺路。

## 8. 需要人类拍板的岔路（本文合并≠立项）

1. **是否立项**：本文只是北极星；真正立项（投入 agent 产能做 L0/L1 对外版）
   需要人类决定时机与优先级（相对 BoardX 产品本身的开发）。
2. **开源策略**：coord-service 核心是否开源（利于协议标准化与信任，但影响
   商业闭环设计）——建议立项时再拍。
3. **命名与主体**：产品名、是否独立仓库/组织运营——立项时再拍。

## 9. 一句话总结

把我们为了造 BoardX 而被迫发明的 agent 协调层，卖给所有正在经历同样五种
疼痛的仓库——**GitHub 负责人类协作的部分，我们负责 agent 车队的部分，
接缝处是 check run 和一个原子租约。**
