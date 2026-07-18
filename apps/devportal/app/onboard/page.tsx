// P3 /onboard 项目接入向导（p30 UI 先行原型批次 3，ADR-003，UC-01）：mock 数据、不接后端。
// 发起人 = repo admin 视角；原型页无身份读取（真实实现在工作区层走 GitHub OAuth，D3）。
import type { Metadata } from "next";
import { OnboardWizard } from "@/components/p30/onboard-wizard";

export const runtime = "edge";

export const metadata: Metadata = { title: "项目接入向导 · Developer Portal" };

export default function OnboardPage() {
  return <OnboardWizard />;
}
