// M1 /me 跨项目工作台（p30 UI 先行原型，ADR-003）：mock 数据、不接后端。
// D4：登录默认落点将迁到这里；本批次仅交付可核对的界面，路由切换在 feature 实现时做。
import type { Metadata } from "next";
import { MeWorkbench } from "@/components/p30/me-workbench";

export const runtime = "edge";

export const metadata: Metadata = { title: "我的工作台 · Developer Portal" };

export default function MePage() {
  return <MeWorkbench />;
}
