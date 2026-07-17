# Survey 首页导航精简证据

## 用户可见行为
- 左侧四个 Survey 菜单项使用统一尺寸和描边的 Lucide 图标。
- 首页不再显示“组织”和“顾问社区”占位信息。
- WHY / HOW / THEN 三个方法入口分别进入模板中心、AI 新建问卷和分析报告工作流；新用户没有可分析答卷时回到“我的问卷”，不展示虚假示例报告。

## 验证
```bash
E2E_PORT=62620 COLLAB_WS_PORT=62621 pnpm exec playwright test e2e/survey-p25-008-source-stash-ui.spec.ts --grep "BoardX Survey home|home method cards"
# 2 passed

pnpm --filter @repo/web typecheck
# exit 0

bash apps/web/scripts/lint-design.sh
# exit 0（仅仓库既有 LABEL-LANG-MIX 警告）

git diff --check
# exit 0
```

## 证据文件
- `survey-home-desktop-legacy.png`（该轮实现截图，不是参考源截图）
- `apps/web/e2e/survey-p25-008-source-stash-ui.spec.ts`

## 最终补充
- 本文件保留该轮导航精简的历史证据；最终首页已按指定 HTML 再次重构。
- 当前截图、参考/实现并排对比和差异分级以 `2026-07-17-survey-html-fidelity.md` 与 `comparison-home.webp` 为准。
