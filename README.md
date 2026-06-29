# boardx-dev-template

基于 **Harness Engineering** 原则组织的 turbo monorepo:用文件作为唯一事实来源,
按阶段(phase=项目)→ sprint → feature 推进开发,再单向同步到 GitHub。

## 三个平面
- **代码平面** `apps/` `packages/`:被构建的 agentic 系统本体。
- **控制平面** `.harness/`:harness 大脑(指令 / 模板 / 状态 / 脚本)。
- **交付平面** `phases/`:阶段 → sprint → feature 的时间线。

## 快速上手
```bash
nvm use            # 用 .nvmrc 指定的 Node
pnpm install       # 安装依赖(含 tsx/turbo/yaml)
./init.sh          # bootstrap + 基础验证
```

## Harness 工作流
```bash
# 1) 从 roadmap 起一个新阶段
pnpm harness new-phase  --id 02 --name agent-runtime --goal "智能体运行时"

# 2) 在阶段下切一个 sprint,并把若干 feature 分配进去
pnpm harness new-sprint --phase 02 --id 01 --goal "打通编排回路" --features F01,F02

# 3) agent 开发后,跑验证门控 feature 状态(只有这一步能把 feature 标 passing)
pnpm harness verify     --sprint 02/01

# 4) 单向投影到 GitHub(只对当前/近期 sprint 开 Issue)
pnpm harness sync       --phase 02 --apply
```

详见 `AGENTS.md`(agent 工作规则)与 `.harness/`(机制实现)。
