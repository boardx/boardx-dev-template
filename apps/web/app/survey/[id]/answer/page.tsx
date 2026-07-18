import { notFound } from "next/navigation";
import { countResponses, getSurveyWithQuestions } from "@repo/data";
import AnswerForm, { type SurveyAnswerView } from "./answer-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseSurveyId(raw: string): number | null {
  const surveyId = Number(raw);
  return Number.isFinite(surveyId) ? surveyId : null;
}

async function answerGate(survey: SurveyAnswerView): Promise<{ testId: string; title: string; message: string } | null> {
  if (!survey.is_active) {
    return { testId: "answer-closed", title: "暂不接受答题", message: "该问卷尚未发布或已暂停，请稍后再试。" };
  }
  const now = Date.now();
  if (survey.publish_start_at && now < new Date(survey.publish_start_at).getTime()) {
    return { testId: "answer-not-started", title: "问卷尚未开始", message: "该问卷还没有到开始回收时间，请稍后再试。" };
  }
  if (survey.publish_end_at && now > new Date(survey.publish_end_at).getTime()) {
    return { testId: "answer-ended", title: "问卷已截止", message: "该问卷已经超过截止时间，当前不再接受新的答卷。" };
  }
  if (survey.response_limit != null && (await countResponses(survey.id)) >= Number(survey.response_limit)) {
    return { testId: "answer-limit-reached", title: "答卷数量已满", message: "该问卷已达到创建者设置的答卷上限。" };
  }
  return null;
}

function ClosedState({ survey, state }: { survey: SurveyAnswerView; state: { testId: string; title: string; message: string } }) {
  return (
    <main data-testid="answer-professional-shell" className="min-h-screen bg-secondary/20 px-4 py-12">
      <section
        data-testid={state.testId}
        className="mx-auto max-w-2xl rounded-lg border border-border bg-background p-7 shadow-sm"
      >
        <p className="text-13 font-semibold uppercase tracking-wide text-muted-foreground">BoardX Survey</p>
        <h1 className="mt-3 text-22 font-bold text-foreground">{survey.title}</h1>
        {survey.description && <p className="mt-2 text-14 text-muted-foreground">{survey.description}</p>}
        <div className="mt-7 rounded-md border border-border bg-surface-1 p-4">
          <p className="text-15 font-semibold text-foreground">{state.title}</p>
          <p className="mt-1 text-13 text-muted-foreground">{state.message}</p>
        </div>
      </section>
    </main>
  );
}

export default async function SurveyAnswerPage({ params }: { params: { id: string } }) {
  const surveyId = parseSurveyId(params.id);
  if (surveyId == null) notFound();

  const survey = (await getSurveyWithQuestions(surveyId)) as SurveyAnswerView | null;
  if (!survey) notFound();

  const gate = await answerGate(survey);
  if (gate) return <ClosedState survey={survey} state={gate} />;

  return <AnswerForm survey={survey} />;
}
