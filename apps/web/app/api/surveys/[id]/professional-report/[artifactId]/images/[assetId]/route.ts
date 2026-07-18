import { NextResponse } from "next/server";
import {
  canViewSurvey,
  findReadySurveyReportArtifactById,
} from "@repo/data";
import { presignGetUrl } from "@repo/storage";
import { currentTeamId, currentUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string): number | null {
  const surveyId = Number(raw);
  return Number.isInteger(surveyId) && surveyId > 0 ? surveyId : null;
}

function reportImageAsset(
  report: Record<string, unknown>,
  assetId: string
): { assetKey: string } | undefined {
  const chapters = Array.isArray(report.chapters) ? report.chapters : [];
  for (const chapter of chapters) {
    if (!chapter || typeof chapter !== "object") continue;
    const candidate = chapter as Record<string, unknown>;
    if (
      candidate.outputType === "image"
      && candidate.assetId === assetId
      && typeof candidate.assetKey === "string"
      && candidate.assetKey.startsWith("survey-reports/")
    ) {
      return { assetKey: candidate.assetKey };
    }
  }
  return undefined;
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: { id: string; artifactId: string; assetId: string };
  }
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const surveyId = parseSurveyId(params.id);
  if (!surveyId) {
    return NextResponse.json({ error: "问卷不存在" }, { status: 404 });
  }
  if (!(await canViewSurvey(surveyId, user.id, currentTeamId()))) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const artifact = await findReadySurveyReportArtifactById(
    surveyId,
    params.artifactId
  );
  const image = artifact
    ? reportImageAsset(artifact.report, params.assetId)
    : undefined;
  if (!image) {
    return NextResponse.json({ error: "报告图片不存在" }, { status: 404 });
  }

  const signedUrl = await presignGetUrl(image.assetKey, 300);
  return NextResponse.redirect(signedUrl, 307);
}
