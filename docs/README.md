# docs/ — 文档分层标准（2026-07-18 起）

> 为把本仓的工程方法论打包成可复用模板（`agentic-harness-template`），全仓文档按
> 「现行标准 / 决策记录 / 历史档案」三层归位。**放错层的文档会在打包时把噪音带出去，
> 或把该带走的标准漏掉。**

## 分层规则（新文档落笔前先对号入座）

| 层 | 位置 | 判据 | 打包 |
|---|---|---|---|
| **现行标准** | `.harness/instructions/` | 今天开工要照着做的规范。过时即删或迁档案层 | ✅ 通用部分随模板走 |
| **项目事实单点** | `.harness/instructions/project/` | 本项目专属事实（域名/URL/模块清单/凭据路径） | ❌ 新项目替换同名文件 |
| **决策记录** | `docs/adr/` | 为什么这样定。头部标注`适用层`：方法论（可移植）/ 项目实现（专属） | ✅ 仅方法论层 |
| **设计文档** | `docs/design/` | 产品愿景/界面设计等一次性设计输入 | ❌ |
| **提案档案** | `docs/proposals/` | 已被 ADR/标准吸收或搁置的 proposal 原文 | ❌ |
| **事故复盘** | `docs/postmortems/` | postmortem 全文（结论应已回流到标准/ADR/skill） | ❌ |

## 判据一句话版
- 「照着做」→ instructions/；「为什么」→ adr/；「当时怎么想的」→ proposals/、design/；
  「烧过什么」→ postmortems/。
- instructions/ 里**不允许**出现 proposal/postmortem/vision——它们的**结论**回流成标准，
  **原文**归档到 docs/。

## 已知待办
- `work-cycle-proposal.md` 实为现行标准（C-cycle），名字带 proposal 是历史遗留；
  因被 cli.ts / cycle-report.ts / devportal 线上 doc 路由按路径引用，改名需连动，
  留待模板抽取时一并处理。
