# Phase p21 — platform-accounts-hardening

- **slug**: platform-accounts-hardening
- **状态**: not_started
- **创建于**: 2026-07-04 19:48:15

## 目标
Platform/Accounts(auth/team/profile/home/billing)地基级 gap 修复:证据造假清零、两处越权/免密安全漏洞修复、billing F04 真实闭环、需求-实现-测试三方对齐

## 范围与边界
- 本阶段交付:auth 社交登录后门 gate 修正(F01)、team 成员角色越权修复(F02)、auth 证据补齐+
  confirm-email 真实实现(F03)、team 证据补齐+F13 拆分(F04)、billing F04 如实改写(F05)、
  profile/home 文档追踪同步(F06)。详见 `gap-report.md` 与 `requirements/*.md`。
- 明确不做:CSRF 全面接入、微信登录真二维码、callback/returnTo 回跳、team_invites 表结构
  对齐 room_invites、credit 扣减防透支 guard、p2 首页新功能(最近使用 Agent 遥测/Tutorials/
  Onboarding/团队仪表盘)——均为真实存在但非本阶段(证据+安全主线)范畴的项,留待后续排期。

## 需求 → 功能清单 流水线
1. **原始需求**写进同目录的 `requirements/` 文件夹（可按领域放多份 `*.md`，人类语言、可模糊）。
2. 调 **requirement-author** 智能体：读 `requirements/` 全部 `*.md` → 生成/更新 `feature_list.json`
   （每个 feature 带可执行 `verification`）。
3. `requirements/` 是输入/上下文,**不是权威**;权威永远是 `feature_list.json`。

## 权威功能清单
本阶段的唯一权威功能来源是同目录的 `feature_list.json`。
sprint 通过 `feature.sprint` 字段领取功能;`active-features.json` 是脚本派生的只读视图。

## 退出条件(Definition of Done for this Phase)
- `feature_list.json` 中本阶段所有 feature 均为 `passing`。
- `.harness/state/quality-document.md` 相关领域评级未下降。
- 阶段 `progress.md` 已收尾,无未记录的半成品。
