# 会话交接 — Sprint p16/01

## 当前已验证
- F03「Design lint 覆盖扩大到新增页面」：实现完成，PR #225 已开（worker `wrk-lint-1`，
  分支 `worker/wrk-lint-1-p16-f03-lint-coverage`）。首轮 feature-evaluator review 给了
  Revise（10/16），指出 verification 命令是自证式的（只匹配到脚本自己的说明性 echo，
  不是规则真实输出）——**已修复并重新验证**，等待复审。
  **未标 passing**（只有 `pnpm harness verify` 门控可以转移状态，worker 无权限自标）。
  F03 新版 verification 命令本地跑通：
  `cd apps/web && bash scripts/lint-design.sh 2>&1 | tee /tmp/lint-design-out.txt; grep 'LABEL-LANG-MIX:' /tmp/lint-design-out.txt | grep -qiE 'ava|ai-store|surveys|admin'` → exit 0，
  且已用"临时删掉 §7 规则"的反证法确认：规则真被删掉时这条命令会 exit 1（证明不是自证式）。

## 本轮改动
- `apps/web/scripts/lint-design.sh`：
  - 新增开头一行日志，明确列出扫描范围含 ava/ai-store/surveys/admin/studio/presentations。
  - 新增 §7 规则：文案语言一致性检测（警告级，不拦截 `verify:base`，理由见 progress.md），
    拆成"同文件内中英混用"和"跨文件中英混用"两个子规则，所有真实命中都带 `LABEL-LANG-MIX:`
    前缀 + 真实 `文件:行号:源码`，可被 grep 精确锚定、不与脚本自身说明文案混淆。
  - 修复评审发现的自证式验证问题（详见 progress.md 本轮追加记录），顺带修了一个
    `grep -E` 遇到路径里 `(app)` 括号被当正则捕获组导致空匹配 + `set -e` 拖垮全脚本的 bug。
- `phases/phase-p16-ui-nav-alignment/feature_list.json`：F03.verification 从匹配任意输出
  改成锚定 `LABEL-LANG-MIX:` 前缀；`evidence` 从空字符串补成
  `phases/phase-p16-ui-nav-alignment/sprints/sprint-01/evidence/F03.verify.log`。
- `phases/phase-p16-ui-nav-alignment/sprints/sprint-01/evidence/F03.verify.log`：新增，
  存了完整 lint 输出 + 验证命令 + exit 结果。

## 仍损坏或未验证
- **真实发现且未修复**：`components/board/board-canvas.tsx` 画布工具条为中文 label
  （选择/平移/连接线/便利贴/手绘/文本/形状/资源/嵌入/模板），与 `components/app-shell/sidebar.tsx`
  （Home/Rooms）等英文 label 模块不一致；进一步看，这个语言混用是**项目级**的，不止 Board 一处
  （P0-P4 reskin 页面多英文 label，harness pipeline 新建的 Ava/Admin/Rooms/Studio 等模块多中文
  label）。**故意不修**——这是 phase-p17 reskin round2 的范围，本 feature 只负责"让 lint 能检测到"。
- `@repo/auth` 包的 `password > hash 不等于明文，verify 正确匹配` 测试在 `pnpm -w run verify:base`
  全量并发跑时有 flaky timeout（5000ms），单独跑 `pnpm --filter @repo/auth test` 稳定通过。
  与本次改动无关，未处理，如果后续频繁复现建议单独开 issue。

## 下一步最佳动作
- 等 F03 PR #225 复审通过、合并、跑 `pnpm harness verify --sprint p16/01` 转 passing。
- 后续（phase-p17 范围）：统一全项目 UI 文案语言后，把 `lint-design.sh` §7 的
  `echo "⚠ ..."` 改回 `err()`（转硬门禁），防止语言混用问题再劣化。
- 不要现在去改 `components/board/board-canvas.tsx` 的文案——不在本 sprint / 本 feature 范围。

## 命令
- 启动:`pnpm -w run dev`
- 验证:`pnpm harness verify --sprint p16/01`
- 调试:`cd apps/web && bash scripts/lint-design.sh`（直接看 design lint 输出，含新的语言一致性警告）
