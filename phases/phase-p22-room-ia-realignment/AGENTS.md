# AGENTS.md — Phase p22 (Room IA Realignment) 局部指令

> 阶段级 scoped 指令,补充根 AGENTS.md。只写本阶段特有的约束。

## 本阶段焦点
修复 Room 信息架构核心缺陷：补齐左房间列表+右详情的主从双栏布局（当前是互相跳转的两个整页）；理清 Files 在 Files-tab 与 Chat 内面板之间的职责边界；评估 Studio 独立性与 Board 面包屑回退——按 harness UI 先行确认关卡（ADR-003）交付

## 权威来源
- 功能清单:本目录 `feature_list.json`(本阶段唯一权威)。
- 进度:本目录 `progress.md`。

## 规则继承
根 `AGENTS.md` 的所有硬约束在此继续生效(尤其"完成定义"与"干净收尾")。
