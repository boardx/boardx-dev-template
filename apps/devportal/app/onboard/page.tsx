// /onboard 项目接入向导（p30/F05，UC-01）：真实 GitHub App 安装 + 自动体检接真。
// 发起人 = repo admin 视角；middleware 已要求会话（admin 权限判定需要真实 GitHub 身份）。
// installation_id 由 /api/coord/onboard/callback 校验 state 后转交（见该路由注释）。
import type { Metadata } from "next";
import { OnboardWizard } from "@/components/p30/onboard-wizard";

export const runtime = "edge";

export const metadata: Metadata = { title: "项目接入向导 · Developer Portal" };

export default async function OnboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params["installation_id"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const installationId = value && /^\d+$/.test(value) ? Number(value) : null;
  return <OnboardWizard installationId={installationId} />;
}
