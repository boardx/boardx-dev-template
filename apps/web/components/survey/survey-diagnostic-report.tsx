"use client";

import { CheckCircle2, CircleAlert, Sparkles, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SURVEY_MIN_RELIABLE_SAMPLE } from "@/lib/survey-report-evidence";

type QuestionType =
  | "short_text"
  | "text"
  | "email"
  | "number"
  | "phone"
  | "single"
  | "multiple"
  | "dropdown"
  | "rating"
  | "linear_scale"
  | "nps"
  | "date"
  | "time"
  | "file";

interface DiagnosticQuestion {
  id: number;
  title: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  category?: string;
}

interface DiagnosticResponse {
  id?: number;
  answers: Record<string, unknown>;
  submittedAt: string;
}

interface DiagnosticAiReport {
  executiveSummary: string;
  keyFindings: string[];
  recommendations: string[];
}

interface ReportTemplate {
  sections: string[];
  caveats: string[];
}

interface DimensionMetric {
  name: string;
  score: number;
  sampleSize: number;
  coverage: number;
}

function hasAnswer(value: unknown) {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return typeof value === "number" && Number.isFinite(value);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(5, value));
}

function scoreForQuestion(question: DiagnosticQuestion, value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (question.type === "nps") return clampScore(value / 2);
  if (question.type === "rating" || question.type === "linear_scale") return clampScore(value);
  return null;
}

function percent(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

function signed(value: number) {
  return value > 0 ? `+${value}` : String(value);
}

function buildDimensions(questions: DiagnosticQuestion[], responses: DiagnosticResponse[]) {
  const grouped = new Map<string, { scores: number[]; responders: Set<number>; answered: number; possible: number }>();
  for (const question of questions) {
    if (!["rating", "linear_scale", "nps"].includes(question.type)) continue;
    const name = question.category?.trim() || question.title;
    const current = grouped.get(name) ?? { scores: [], responders: new Set<number>(), answered: 0, possible: 0 };
    current.possible += responses.length;
    for (const [responseIndex, response] of responses.entries()) {
      const score = scoreForQuestion(question, response.answers[String(question.id)]);
      if (score == null) continue;
      current.scores.push(score);
      current.responders.add(responseIndex);
      current.answered += 1;
    }
    grouped.set(name, current);
  }

  const metrics: DimensionMetric[] = Array.from(grouped.entries()).map(([name, value]) => ({
    name,
    score: value.scores.length
      ? value.scores.reduce((sum, score) => sum + score, 0) / value.scores.length
      : 0,
    sampleSize: value.responders.size,
    coverage: percent(value.answered, value.possible),
  }));

  return metrics.slice(0, 5);
}

function radarPoints(metrics: DimensionMetric[], ratio: number) {
  const cx = 140;
  const cy = 118;
  const radius = 78;
  return metrics.map((metric, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / metrics.length;
    const scoreRatio = ratio >= 0 ? ratio : metric.score / 5;
    return `${cx + Math.cos(angle) * radius * scoreRatio},${cy + Math.sin(angle) * radius * scoreRatio}`;
  }).join(" ");
}

export function SurveyDiagnosticReport({
  questions,
  responses,
  aiReport,
  reportTemplate,
}: {
  questions: DiagnosticQuestion[];
  responses: DiagnosticResponse[];
  aiReport?: DiagnosticAiReport;
  reportTemplate?: ReportTemplate;
}) {
  const dimensions = buildDimensions(questions, responses);
  const overallScore = dimensions.length
    ? dimensions.reduce((sum, dimension) => sum + dimension.score, 0) / dimensions.length
    : 0;
  const answeredCells = responses.reduce(
    (sum, response) => sum + questions.filter((question) => hasAnswer(response.answers[String(question.id)])).length,
    0
  );
  const possibleCells = responses.length * questions.length;
  const completionRate = percent(answeredCells, possibleCells);
  const completeResponses = responses.filter((response) =>
    questions.every((question) => !question.required || hasAnswer(response.answers[String(question.id)]))
  ).length;
  const emptyResponses = responses.filter((response) =>
    questions.every((question) => !hasAnswer(response.answers[String(question.id)]))
  ).length;
  const partialResponses = Math.max(0, responses.length - completeResponses - emptyResponses);
  const npsQuestion = questions.find((question) => question.type === "nps");
  const npsValues = npsQuestion
    ? responses
        .map((response) => response.answers[String(npsQuestion.id)])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    : [];
  const promoters = npsValues.filter((value) => value >= 9).length;
  const passives = npsValues.filter((value) => value >= 7 && value <= 8).length;
  const detractors = npsValues.filter((value) => value <= 6).length;
  const npsScore = npsValues.length
    ? percent(promoters, npsValues.length) - percent(detractors, npsValues.length)
    : null;
  const lowResponseSample = responses.length > 0 && responses.length < SURVEY_MIN_RELIABLE_SAMPLE;
  const lowSampleDimensions = dimensions.filter((dimension) => dimension.sampleSize < SURVEY_MIN_RELIABLE_SAMPLE);
  const lowNpsSample = npsValues.length > 0 && npsValues.length < SURVEY_MIN_RELIABLE_SAMPLE;
  const hasMetricSampleLimit = lowSampleDimensions.length > 0 || lowNpsSample;
  const hasSampleLimit = lowResponseSample || hasMetricSampleLimit;
  const lowestDimensions = [...dimensions].sort((a, b) => a.score - b.score).slice(0, 3);
  const agendaItems = aiReport?.recommendations.length
    ? aiReport.recommendations.slice(0, 3)
    : lowestDimensions.map((dimension) =>
        `围绕「${dimension.name}」核对低分原因，明确一个负责人和下一步验证动作。`
      );
  const descriptiveSummary = dimensions.length
    ? `当前基于 ${responses.length} 份已提交答卷生成描述性统计。量化维度均值为 ${overallScore.toFixed(1)} / 5，平均回答完整度 ${completionRate}%。`
    : `当前基于 ${responses.length} 份已提交答卷生成描述性统计，平均回答完整度 ${completionRate}%；尚无有效量化维度，不生成量化得分。`;
  const diagnosticSummary = hasSampleLimit
    ? `${descriptiveSummary} 总答卷或部分指标的有效样本少于 ${SURVEY_MIN_RELIABLE_SAMPLE}，仅作为方向性观察，不生成样本不足指标的支持或不支持结论。${aiReport?.executiveSummary ? ` AI 摘要仅作为待验证线索：${aiReport.executiveSummary}` : ""}`
    : aiReport?.executiveSummary ?? `${descriptiveSummary} 尚未生成 AI 语义摘要。`;

  return (
    <div className="grid gap-4">
      <section data-testid="survey-ai-diagnostic-summary" className="rounded-lg border border-survey/20 bg-tag-purple px-6 py-5">
        <div className="flex items-center gap-2 text-13 font-bold text-survey">
          <Sparkles className="h-4 w-4" strokeWidth={1.7} />
          AI 诊断摘要
        </div>
        <p className="mt-2 text-14 leading-7 text-foreground">{diagnosticSummary}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
        <section data-testid="survey-sample-quality" className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-14 font-bold text-foreground">样本质量声明</h2>
          <p className="mt-1 text-12 text-muted-foreground">
            {responses.length} 份已提交答卷 · 平均完整度 {completionRate}% · {questions.length} 道题
          </p>
          {hasSampleLimit ? (
            <div
              data-testid="survey-low-sample-limit"
              className="mt-3 flex gap-2 rounded-md border border-survey/25 bg-tag-purple px-3 py-2.5 text-12 leading-5 text-foreground"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-survey" strokeWidth={1.7} />
              <span>
                {lowResponseSample
                  ? `总答卷少于 ${SURVEY_MIN_RELIABLE_SAMPLE} 份；`
                  : ""}
                {hasMetricSampleLimit
                  ? `部分指标的有效样本少于 ${SURVEY_MIN_RELIABLE_SAMPLE} 份；`
                  : ""}
                只展示描述性统计，样本不足的判断需要继续采样验证。
              </span>
            </div>
          ) : null}
          <div className="mt-3 divide-y divide-border">
            {[
              ["已提交答卷", responses.length, "已进入描述性统计", "success"],
              ["必答项完整", completeResponses, hasSampleLimit ? "不代表指标样本充分" : "达到总体样本门槛", "success"],
              ["部分作答", partialResponses, "解读时保留边界", "warning"],
              ["空白答卷", emptyResponses, emptyResponses ? "建议排除" : "未发现", "warning"],
            ].map(([label, count, note, tone]) => (
              <div key={String(label)} className="flex items-center gap-2 py-2.5 text-12">
                {tone === "success"
                  ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" strokeWidth={1.7} />
                  : <CircleAlert className="h-4 w-4 shrink-0 text-survey" strokeWidth={1.7} />}
                <span className="flex-1 font-semibold text-foreground">{label}</span>
                <span className="text-muted-foreground">{count}</span>
                <span className="w-32 text-right text-muted-foreground">{note}</span>
              </div>
            ))}
          </div>
        </section>

        <section data-testid="survey-hypothesis-validation" className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-14 font-bold text-foreground">假设验证结果</h2>
          <p className="mt-1 text-12 text-muted-foreground">
            当前问卷未存储独立假设，因此不输出支持或不支持结论；每个量化维度仅在有效样本不少于
            {" "}{SURVEY_MIN_RELIABLE_SAMPLE} 时展示相对量表中点的信号。
          </p>
          <div className="mt-3 divide-y divide-border">
            {dimensions.length ? dimensions.slice(0, 3).map((dimension) => {
              const dimensionLowSample = dimension.sampleSize < SURVEY_MIN_RELIABLE_SAMPLE;
              const verdict = dimensionLowSample
                ? "方向性"
                : dimension.score >= 3.5
                  ? "偏高"
                  : dimension.score >= 2.5
                    ? "中性"
                    : "偏低";
              return (
                <div key={dimension.name} className="flex gap-3 py-3">
                  <Badge
                    variant={verdict === "偏高" ? "success" : verdict === "偏低" ? "destructive" : "outline"}
                  >
                    {verdict}
                  </Badge>
                  <div>
                    <p className="text-13 font-semibold text-foreground">{dimension.name}</p>
                    <p className="mt-1 text-12 leading-5 text-muted-foreground">
                      证据：标准化得分 {dimension.score.toFixed(1)} / 5，覆盖 {dimension.sampleSize} 份有效答卷。
                      {dimensionLowSample ? ` 至少收集 ${SURVEY_MIN_RELIABLE_SAMPLE} 个该指标的有效回答后再形成阈值信号。` : ""}
                    </p>
                  </div>
                </div>
              );
            }) : (
              <p className="py-6 text-13 text-muted-foreground">尚无评分、量表或 NPS 数据，无法验证量化假设。</p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section data-testid="survey-dimension-analysis" className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-14 font-bold text-foreground">量化维度雷达</h2>
          <p className="mt-1 text-12 text-muted-foreground">
            量表、评分与 NPS 统一换算为 1-5 分{hasMetricSampleLimit ? "，样本不足的维度仅作方向性观察" : ""}。
          </p>
          {dimensions.length >= 3 ? (
            <svg role="img" aria-label="诊断维度雷达图" viewBox="0 0 280 236" className="mx-auto mt-2 block w-full max-w-85">
              {[0.33, 0.66, 1].map((ratio) => (
                <polygon key={ratio} points={radarPoints(dimensions, ratio)} fill="none" stroke="hsl(var(--border))" strokeWidth="1" />
              ))}
              <polygon points={radarPoints(dimensions, -1)} fill="hsl(var(--survey-accent) / 0.14)" stroke="hsl(var(--survey-accent))" strokeWidth="2" />
              {dimensions.map((dimension, index) => {
                const angle = -Math.PI / 2 + (index * Math.PI * 2) / dimensions.length;
                const x = 140 + Math.cos(angle) * 102;
                const y = 118 + Math.sin(angle) * 102;
                return (
                  <text key={dimension.name} x={x} y={y} textAnchor="middle" fontSize="11" fill="hsl(var(--foreground))">
                    {dimension.name.slice(0, 7)} {dimension.score.toFixed(1)}
                  </text>
                );
              })}
            </svg>
          ) : (
            <p className="py-12 text-center text-13 text-muted-foreground">至少需要三个可量化维度才能绘制雷达图。</p>
          )}
        </section>

        <section data-testid="survey-benchmark-analysis" className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-14 font-bold text-foreground">维度得分 vs 中性基准</h2>
          <p className="mt-1 text-12 text-muted-foreground">黑色标记为量表中点 3.0，不代表外部行业基准。</p>
          <div className="mt-5 grid gap-4">
            {dimensions.map((dimension) => (
              <div key={dimension.name}>
                <div className="flex justify-between text-12">
                  <span className="font-semibold text-foreground">{dimension.name}</span>
                  <span className={dimension.score >= 3 ? "font-semibold text-success" : "font-semibold text-destructive"}>
                    {dimension.score.toFixed(1)} <span className="text-11">{signed(Math.round((dimension.score - 3) * 10) / 10)}</span>
                  </span>
                </div>
                <div className="relative mt-2 h-2.5 rounded-full bg-muted">
                  <div className="h-2.5 rounded-full bg-survey" style={{ width: `${dimension.score * 20}%` }} />
                  <span className="absolute -top-1 left-[60%] h-4 w-0.5 bg-foreground" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section data-testid="survey-segment-analysis" className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-14 font-bold text-foreground">分层分歧对比</h2>
          <p className="mt-1 text-12 text-muted-foreground">当前答卷未提供可用于分层的身份变量。</p>
          <div className="mt-6 rounded-lg border border-dashed border-border-strong px-4 py-8 text-center">
            <Target className="mx-auto h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <p className="mt-2 text-13 font-semibold text-foreground">暂无可靠分层结果</p>
            <p className="mt-1 text-12 text-muted-foreground">报告不会用题目答案猜测受访者身份。</p>
          </div>
        </section>

        <section data-testid="survey-theme-analysis" className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-14 font-bold text-foreground">开放题证据 · 服务端聚合</h2>
          <p className="mt-1 text-12 text-muted-foreground">摘要仅展示服务端生成的聚合主题，不下发原始开放题文本。</p>
          <div className="mt-3 divide-y divide-border">
            {aiReport?.keyFindings.length ? aiReport.keyFindings.slice(0, 4).map((finding, index) => (
              <div key={`${index}-${finding}`} className="flex gap-3 py-3">
                <Badge variant="outline">主题 {index + 1}</Badge>
                <p className="text-13 leading-6 text-foreground">{finding}</p>
              </div>
            )) : (
              <p className="py-8 text-13 text-muted-foreground">
                尚未生成经过服务端聚合的开放题主题，原始回答请在授权的单份答卷视图中查看。
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section data-testid="survey-enps-analysis" className="rounded-lg border border-border bg-background p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-14 font-bold text-foreground">推荐意愿（NPS）</h2>
            <p className="text-22 font-bold text-survey">
              {npsScore == null ? "未配置" : lowNpsSample ? "样本不足" : signed(npsScore)}
            </p>
          </div>
          <p className="mt-1 text-12 text-muted-foreground">
            {npsValues.length && lowNpsSample
              ? `已收集 ${npsValues.length} 个 NPS 回答；少于 ${SURVEY_MIN_RELIABLE_SAMPLE} 个，不形成总体推荐意愿结论。`
              : npsValues.length
                ? `推荐者 ${percent(promoters, npsValues.length)}% · 中立 ${percent(passives, npsValues.length)}% · 贬损者 ${percent(detractors, npsValues.length)}%`
              : "问卷中没有 NPS 题或尚未收到有效 NPS 回答。"}
          </p>
          <div className="mt-5 grid h-28 grid-cols-11 items-end gap-1">
            {Array.from({ length: 11 }, (_, score) => {
              const count = npsValues.filter((value) => value === score).length;
              const max = Math.max(1, ...Array.from({ length: 11 }, (__, item) => npsValues.filter((value) => value === item).length));
              return (
                <div key={score} className="flex h-full flex-col justify-end gap-1 text-center">
                  <div
                    className={score >= 9 ? "min-h-1 rounded-t bg-success" : score >= 7 ? "min-h-1 rounded-t bg-foreground/50" : "min-h-1 rounded-t bg-destructive/70"}
                    style={{ height: `${Math.max(4, (count / max) * 88)}px` }}
                  />
                  <span className="text-10 text-muted-foreground">{score}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section data-testid="survey-priority-matrix" className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-14 font-bold text-foreground">议题优先级矩阵</h2>
          <p className="mt-1 text-12 text-muted-foreground">以低分程度 × 回答覆盖近似定位优先核查项。</p>
          <div className="relative mt-4 h-52 border-b border-l border-border">
            <span className="absolute right-2 top-2 text-10 font-semibold text-survey">优先核查区</span>
            <span className="absolute bottom-1/2 left-0 right-0 border-t border-dashed border-border" />
            <span className="absolute bottom-0 left-1/2 top-0 border-l border-dashed border-border" />
            {dimensions.map((dimension, index) => (
              <div
                key={dimension.name}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                style={{
                  left: `${Math.max(12, Math.min(88, dimension.coverage))}%`,
                  top: `${Math.max(14, Math.min(84, 92 - dimension.score * 16))}%`,
                }}
              >
                <span className="h-4 w-4 rounded-full bg-survey/80" style={{ transform: `scale(${1 + index * 0.08})` }} />
                <span className="max-w-24 text-center text-10 font-semibold text-foreground">{dimension.name}</span>
              </div>
            ))}
            <span className="absolute -bottom-5 right-0 text-10 text-muted-foreground">回答覆盖 →</span>
            <span className="absolute -left-3 top-0 text-10 text-muted-foreground">低分</span>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-14 font-bold text-foreground">关键发现 · 聚合证据</h2>
          <p className="mt-1 text-12 text-muted-foreground">仅展示服务端生成的聚合发现，不暴露答卷 ID 或原始引述。</p>
          <div className="mt-3 grid gap-2">
            {aiReport?.keyFindings.length ? aiReport.keyFindings.slice(0, 3).map((finding, index) => (
              <div key={`${index}-${finding}`} className="flex gap-3 bg-secondary px-4 py-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-background text-11 font-bold text-survey">
                  {index + 1}
                </span>
                <p className="text-13 leading-6 text-foreground">{finding}</p>
              </div>
            )) : (
              <p className="py-8 text-13 text-muted-foreground">生成 AI 报告后，这里会展示经过服务端聚合的关键发现。</p>
            )}
          </div>
        </section>

        <section data-testid="survey-workshop-agenda" className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-14 font-bold text-foreground">工作坊议程草案</h2>
          <p className="mt-1 text-12 text-muted-foreground">按低分维度和已有行动建议排序。</p>
          <div className="mt-4 grid gap-4">
            {(agendaItems.length ? agendaItems : reportTemplate?.sections ?? []).slice(0, 3).map((item, index) => (
              <div key={`${index}-${item}`} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-tag-purple text-12 font-bold text-survey">
                  {index + 1}
                </span>
                <div>
                  <p className="text-13 font-semibold text-foreground">{lowestDimensions[index]?.name ?? `议题 ${index + 1}`}</p>
                  <p className="mt-1 text-12 leading-5 text-muted-foreground">{item}</p>
                  <p className="mt-1 text-11 text-survey">建议时长 30 分钟 · 输出责任人与验证动作</p>
                </div>
              </div>
            ))}
            {!agendaItems.length && !(reportTemplate?.sections.length) ? (
              <p className="text-13 text-muted-foreground">暂无足够数据生成议程草案。</p>
            ) : null}
          </div>
          {reportTemplate?.caveats.length ? (
            <p className="mt-4 border-t border-border pt-3 text-11 leading-5 text-muted-foreground">
              报告边界：{reportTemplate.caveats.join("；")}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
