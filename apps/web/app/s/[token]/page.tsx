import { notFound } from "next/navigation";
import { PublicSurveyForm } from "@/components/survey/PublicSurveyForm";
import { getSurveyByToken, getSurveyStore } from "@/lib/survey/survey-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PublicSurveyPage({ params }: { params: { token: string } }) {
  const lookup = await getSurveyByToken(getSurveyStore(), params.token);
  if (!lookup || lookup.shareLink.status !== "active" || lookup.record.survey.status !== "published") {
    notFound();
  }

  return <PublicSurveyForm survey={lookup.record} token={params.token} />;
}
