# 会话交接 — Sprint p25/11

## 当前已验证
- F09、F10、F11 已 passing；F11 证据位于 `evidence/F11.verify.log`。
- 最新 Survey 创建器来自源仓 `stash@{0}:apps/web/app/(app)/surveys/page.tsx`。
- `pnpm -w run verify:base` 通过，Web design lint 仅保留不阻断的语言混用警告。

## 本轮改动
- 替换简化版 Survey 页面为源仓最新版五步工作流和完整创建器。
- 增加报告导出、分类计划、报告规划模块及 ECharts。
- 保持目标仓库已有 API、认证、Room 权限边界，不覆盖后端实现。
- 增加 URL 恢复与旧 F10 验收兼容层。

## 下一步最佳动作
- 认领 F12 后，先补报告分类和 AI 报告的失败测试，再实现缺失的 `ai-report` GET/生成链路。
- 不要把 F12-F14 标为 passing，必须分别运行对应 Harness verification。

## 命令
- 启动：`pnpm -w run dev`
- F11 验证：`pnpm harness verify --sprint p25/11`
- 基础验证：`pnpm -w run verify:base`
