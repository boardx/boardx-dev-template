# 原始需求（概览）— Platform/Accounts 差距修复第二轮（Phase p25）

## 背景 / 为什么做
2026-07-14 五维差距审计（见 `../gap-report.md`，含方法论与探针复用注意）确认：
p21 那轮 feature 级审计之后仍有约 65 个需求行级红点，80% 集中在异常流/备选流/入口
接线。最严重的是邀请闭环三连断（受邀者路径整条断裂）与团队钱包不可达。

## 需求文档（按域拆分）
- `invite-loop.md` — P0：邀请闭环三连断修复（join 落地页 + 真实令牌 + next 回跳）。
- `team-management.md` — P1：成员管理 UI / 团队管理页壳 / 删除闸门 / 注册强制团队
  上下文 / token 块占位声明。
- `entries-and-feedback.md` — P0-P3：孤岛路由入口接线（/credits /recent）、/billing
  声明废弃、错误反馈补齐、under-verification 补测、11 条证据补救。

## 切分提示（给 requirement-author）
- wave 0 = invite-loop 全部 + /credits 入口；wave 1 = team-management 1/2/3/5；
  wave 2 = 其余 P2-P3 与证据补救。
- 「存疑」三项（gap-report.md 末节）不生成 feature，等人类拍板。
- 本阶段 has_ui：ui-prototyper 需先做 成员管理界面 / 团队管理壳 / join 落地页 三块
  真实 UI 供人类确认；入口接线与错误反馈类小改动锚定既有界面，不属于 signoff 范围。

## 已知约束 / 依赖
- auth/team/invite 属敏感 area，强制 rev-security（尤其 next 回跳的开放重定向防护）。
- token 用量块只立占位不实现（依赖 AI 平面计量数据源）。
