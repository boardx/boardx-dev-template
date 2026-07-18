// packages/data/src/survey.ts — CAP-DATA 问卷仓储（surveys / survey_questions / survey_responses，P13 F01 地基）
// Survey = team 作用域的问卷容器；question 归属某 survey，按 position 排序。
// 本 feature（F01）只覆盖创建 + 列表 + 详情；答题/发布开关/报告留给 F02-F06。
import { query, getPool } from "./index";
import { getMembership } from "./teams";
import { getRoomRole } from "./rooms";

export type SurveyScope = "private" | "team" | "room";
export type QuestionType =
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

export interface Survey {
  id: number;
  team_id: number | null;
  room_id: number | null;
  scope: SurveyScope;
  title: string;
  description: string;
  is_active: boolean;
  response_mode: "anonymous" | "identified";
  publish_start_at: string | null;
  publish_end_at: string | null;
  response_limit: number | null;
  one_response_per_user: boolean;
  confirmation_message: string;
  owner_user_id: number;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
  id: number;
  survey_id: number;
  position: number;
  title: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  category: string;
}

export interface SurveyWithQuestions extends Survey {
  questions: SurveyQuestion[];
}

export interface SurveyResponse {
  id: number;
  survey_id: number;
  respondent_user_id: number | null;
  answers: Record<string, unknown>;
  submitted_at: string;
}

export interface SurveyTemplate {
  id: number;
  team_id: number | null;
  owner_user_id: number | null;
  builtin: boolean;
  title: string;
  description: string;
  tags: string[];
  questions: NewQuestionInput[];
  created_at: string;
  updated_at: string;
  can_delete?: boolean;
}

export interface SurveyListItem extends Survey {
  response_count: string;
  generated_report_count: string;
  room_name?: string | null;
}

export interface SurveyReportTemplateInput {
  title: string;
  sections: string[];
  metrics: string[];
  chartSlots: string[];
  caveats: string[];
}

export interface SurveyReportTemplate extends SurveyReportTemplateInput {
  id: number;
  survey_id: number;
  created_at: string;
  updated_at: string;
}

export type ReportInputMode = "text" | "chat" | "chart" | "image";
export type SurveyReportOutputType = "image" | "chart" | "text";
export type SurveyReportChartTemplateId =
  | "line-simple"
  | "bar-simple"
  | "pie-simple"
  | "scatter-simple"
  | "radar"
  | "funnel"
  | "gauge"
  | "heatmap-cartesian";
export type SurveyReportChartType =
  | "bar" | "grouped_bar" | "stacked_bar" | "line" | "area" | "pie" | "doughnut" | "rose"
  | "scatter" | "radar" | "heatmap" | "treemap" | "funnel" | "gauge" | "waterfall"
  | "histogram" | "boxplot" | "matrix" | "kpi" | "text";
export type SurveyReportChartStyle = "auto" | "business" | "minimal" | "editorial" | "presentation" | "dark";

export interface SurveyReportChartConfig {
  primaryColor: string;
  maxDimensions: number;
  sort: "none" | "asc" | "desc";
  showLabels: boolean;
  showLegend: boolean;
  orientation: "vertical" | "horizontal";
}

export interface SurveyReportCategoryInput {
  id: string;
  name: string;
  description: string;
  requirement?: string;
  questionIds: number[];
  outputType: SurveyReportOutputType;
  inputModes: [SurveyReportOutputType];
  chartTemplateId?: SurveyReportChartTemplateId;
  chartType?: SurveyReportChartType;
  chartStyle?: SurveyReportChartStyle;
  chartConfig?: SurveyReportChartConfig;
  dataPrompt?: string;
  modulePrompts?: Partial<Record<ReportInputMode, string>>;
  prompt: string;
  order: number;
  isCustom: boolean;
}

export interface SurveyReportCategoryPlanInput {
  title: string;
  description: string;
  categories: SurveyReportCategoryInput[];
}

export interface SurveyReportCategoryPlan extends SurveyReportCategoryPlanInput {
  id: number;
  survey_id: number;
  created_at: string;
  updated_at: string;
}

const SURVEY_COLS =
  "id, team_id, room_id, scope, title, description, is_active, response_mode, publish_start_at, publish_end_at, response_limit, one_response_per_user, confirmation_message, owner_user_id, created_at, updated_at";
const QUESTION_COLS = "id, survey_id, position, title, type, required, options, category";
const TEMPLATE_COLS = "id, team_id, owner_user_id, builtin, title, description, tags, questions, created_at, updated_at";

export interface NewQuestionInput {
  title: string;
  type: QuestionType;
  required: boolean;
  options: string[];
  category?: string;
}

/** 标题去首尾空白后是否非空（纯函数，可单测）。 */
export function isBlank(title: string | null | undefined): boolean {
  return !(title ?? "").trim();
}

const REPORT_TEMPLATE_COLS =
  'id, survey_id, title, sections, metrics, chart_slots AS "chartSlots", caveats, created_at, updated_at';
const REPORT_CATEGORY_PLAN_COLS =
  'id, survey_id, category_plan AS "categoryPlan", created_at, updated_at';

const REPORT_OUTPUT_TYPES = new Set<SurveyReportOutputType>(["image", "chart", "text"]);
const REPORT_CHART_TEMPLATE_IDS = new Set<SurveyReportChartTemplateId>([
  "line-simple",
  "bar-simple",
  "pie-simple",
  "scatter-simple",
  "radar",
  "funnel",
  "gauge",
  "heatmap-cartesian",
]);
const REPORT_CHART_STYLES = new Set<SurveyReportChartStyle>(["auto", "business", "minimal", "editorial", "presentation", "dark"]);

function cleanReportOutputType(raw: unknown): SurveyReportOutputType {
  return REPORT_OUTPUT_TYPES.has(raw as SurveyReportOutputType)
    ? raw as SurveyReportOutputType
    : "text";
}

function cleanChartTemplateId(raw: unknown): SurveyReportChartTemplateId {
  return REPORT_CHART_TEMPLATE_IDS.has(raw as SurveyReportChartTemplateId)
    ? raw as SurveyReportChartTemplateId
    : "line-simple";
}

function chartTypeForTemplate(templateId: SurveyReportChartTemplateId): SurveyReportChartType {
  const chartTypes: Record<SurveyReportChartTemplateId, SurveyReportChartType> = {
    "line-simple": "line",
    "bar-simple": "bar",
    "pie-simple": "pie",
    "scatter-simple": "scatter",
    radar: "radar",
    funnel: "funnel",
    gauge: "gauge",
    "heatmap-cartesian": "heatmap",
  };
  return chartTypes[templateId];
}

function cleanReportChartConfig(raw: unknown): SurveyReportChartConfig {
  const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const color = String(source.primaryColor ?? "#4f6edb").trim().toLowerCase();
  const sort = ["none", "asc", "desc"].includes(String(source.sort)) ? source.sort as SurveyReportChartConfig["sort"] : "none";
  return {
    primaryColor: /^#[0-9a-f]{6}$/.test(color) ? color : "#4f6edb",
    maxDimensions: Math.min(12, Math.max(1, Number(source.maxDimensions) || 6)),
    sort,
    showLabels: source.showLabels !== false,
    showLegend: source.showLegend === true,
    orientation: source.orientation === "horizontal" ? "horizontal" : "vertical",
  };
}

function stableCategoryId(name: string, index: number): string {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");
  return slug ? `cat-${index + 1}-${slug.slice(0, 32)}` : `cat-${index + 1}`;
}

export function defaultSurveyReportCategoryPlan(title: string, questions: SurveyQuestion[] = []): SurveyReportCategoryPlanInput {
  const buckets = new Map<string, SurveyQuestion[]>();
  questions.forEach((question, index) => {
    const name = question.category.trim() || question.title.trim() || `问题 ${index + 1}`;
    buckets.set(name, [...(buckets.get(name) ?? []), question]);
  });
  return {
    title: `${title.trim() || "未命名问卷"} 专业报告`,
    description: "按问卷问题分类生成报告结构，可为每类选择图片、报表和文本输入方式。",
    categories: [...buckets.entries()].map(([name, items], index) => ({
      id: stableCategoryId(name, index),
      name: name.slice(0, 48),
      description: `围绕「${name}」下的 ${items.length} 个问题生成报告内容。`,
      requirement: `面向决策者分析「${name}」，先给结论，再展示证据、样本边界和行动建议。`,
      questionIds: items.map((question) => question.id),
      outputType: "text",
      inputModes: ["text"],
      prompt: `基于「${name}」分类下的题目和答卷数据生成专业分析。`,
      order: index + 1,
      isCustom: false,
    })),
  };
}

export function cleanSurveyReportCategoryPlan(input: unknown, surveyTitle: string, questions: SurveyQuestion[] = []): SurveyReportCategoryPlanInput {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const fallback = defaultSurveyReportCategoryPlan(surveyTitle, questions);
  const validIds = new Set(questions.map((question) => question.id));
  const raw = Array.isArray(body.categories) ? body.categories : fallback.categories;
  const categories = raw.map((value, index) => {
    const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const name = String(item.name ?? `报告分类 ${index + 1}`).trim().slice(0, 48) || `报告分类 ${index + 1}`;
    const questionIds = Array.isArray(item.questionIds)
      ? Array.from(new Set(item.questionIds.map(Number).map((id) => validIds.has(id) ? id : questions.find((question) => question.position + 1 === id)?.id).filter((id): id is number => id != null)))
      : [];
    const modulePrompts = Object.fromEntries((["text", "chat", "chart", "image"] as ReportInputMode[])
      .map((mode) => [mode, String((item.modulePrompts as Record<string, unknown> | undefined)?.[mode] ?? "").trim().slice(0, 1000)])
      .filter(([, value]) => value));
    const explicitRequirement = String(item.requirement ?? "").trim();
    const legacyRequirementParts = [
      String(item.prompt ?? "").trim(),
      String(item.dataPrompt ?? "").trim(),
      ...Object.values(modulePrompts),
    ].filter(Boolean);
    const requirementParts = explicitRequirement
      ? [explicitRequirement]
      : Array.from(new Set(legacyRequirementParts));
    const requirement = (
      requirementParts.join("\n") ||
      `面向决策者分析「${name}」，先给结论，再展示证据、样本边界和行动建议。`
    ).slice(0, 2000);
    const outputType = cleanReportOutputType(item.outputType);
    const chartTemplateId = outputType === "chart"
      ? cleanChartTemplateId(item.chartTemplateId)
      : undefined;
    return {
      id: String(item.id ?? stableCategoryId(name, index)).trim().slice(0, 80),
      name,
      description: String(item.description ?? "").trim().slice(0, 240),
      requirement,
      questionIds,
      outputType,
      inputModes: [outputType] as [SurveyReportOutputType],
      chartTemplateId,
      chartType: outputType === "chart" ? chartTypeForTemplate(chartTemplateId!) : undefined,
      chartStyle: REPORT_CHART_STYLES.has(item.chartStyle as SurveyReportChartStyle) ? item.chartStyle as SurveyReportChartStyle : "auto",
      chartConfig: cleanReportChartConfig(item.chartConfig),
      dataPrompt: String(item.dataPrompt ?? "").trim().slice(0, 1000),
      modulePrompts,
      prompt: String(item.prompt ?? requirement).trim().slice(0, 1000),
      order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
      isCustom: item.isCustom === true,
    };
  }).sort((a, b) => a.order - b.order).map((category, index) => ({ ...category, order: index + 1 }));
  const assigned = new Set(categories.flatMap((category) => category.questionIds));
  for (const question of questions) {
    if (assigned.has(question.id) || categories.length === 0) continue;
    const matching = categories.find((category) => question.category && category.name.includes(question.category)) ?? categories[0];
    matching?.questionIds.push(question.id);
  }
  return {
    title: String(body.title ?? fallback.title).trim().slice(0, 120) || fallback.title,
    description: String(body.description ?? fallback.description).trim().slice(0, 300) || fallback.description,
    categories,
  };
}

export function normalizePersistedSurveyReportCategoryPlanOutputContract(
  plan: SurveyReportCategoryPlanInput
): SurveyReportCategoryPlanInput {
  return {
    ...plan,
    categories: plan.categories.map((category) => {
      const outputType = cleanReportOutputType(category.outputType);
      const chartTemplateId = outputType === "chart"
        ? cleanChartTemplateId(category.chartTemplateId)
        : undefined;
      return {
        ...category,
        outputType,
        inputModes: [outputType],
        chartTemplateId,
        chartType: outputType === "chart" ? chartTypeForTemplate(chartTemplateId!) : undefined,
      };
    }),
  };
}

type SurveyReportCategoryPlanRow = Omit<SurveyReportCategoryPlan, "title" | "description" | "categories"> & {
  categoryPlan: SurveyReportCategoryPlanInput;
};

export async function upsertSurveyReportCategoryPlan(surveyId: number, input: SurveyReportCategoryPlanInput): Promise<SurveyReportCategoryPlan> {
  const rows = await query<SurveyReportCategoryPlanRow>(
    `INSERT INTO survey_report_templates (survey_id, title, sections, metrics, chart_slots, caveats, category_plan)
     VALUES ($1, $2, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, $3::jsonb)
     ON CONFLICT (survey_id) DO UPDATE SET category_plan = EXCLUDED.category_plan, updated_at = now()
     RETURNING ${REPORT_CATEGORY_PLAN_COLS}`,
    [surveyId, input.title.trim() || "问卷专业报告", JSON.stringify(input)]
  );
  const row = rows[0]!;
  return { id: row.id, survey_id: row.survey_id, ...row.categoryPlan, created_at: row.created_at, updated_at: row.updated_at };
}

export async function getSurveyReportCategoryPlan(surveyId: number): Promise<SurveyReportCategoryPlan | undefined> {
  const rows = await query<SurveyReportCategoryPlanRow>(`SELECT ${REPORT_CATEGORY_PLAN_COLS} FROM survey_report_templates WHERE survey_id = $1`, [surveyId]);
  const row = rows[0];
  return row ? { id: row.id, survey_id: row.survey_id, ...row.categoryPlan, created_at: row.created_at, updated_at: row.updated_at } : undefined;
}

export async function readSurveyReportCategoryPlan(
  surveyId: number,
  surveyTitle: string,
  questions: SurveyQuestion[] = []
): Promise<SurveyReportCategoryPlanInput> {
  const existing = await getSurveyReportCategoryPlan(surveyId);
  if (!existing?.categories.length) {
    return defaultSurveyReportCategoryPlan(surveyTitle, questions);
  }
  return normalizePersistedSurveyReportCategoryPlanOutputContract({
    title: existing.title,
    description: existing.description,
    categories: existing.categories,
  });
}

export async function ensureSurveyReportCategoryPlan(surveyId: number, surveyTitle: string, questions: SurveyQuestion[] = []): Promise<SurveyReportCategoryPlan> {
  const existing = await getSurveyReportCategoryPlan(surveyId);
  if (existing?.categories.length) {
    const normalized = normalizePersistedSurveyReportCategoryPlanOutputContract({
      title: existing.title,
      description: existing.description,
      categories: existing.categories,
    });
    if (JSON.stringify(normalized) === JSON.stringify({
      title: existing.title,
      description: existing.description,
      categories: existing.categories,
    })) {
      return existing;
    }
    return upsertSurveyReportCategoryPlan(surveyId, normalized);
  }
  return upsertSurveyReportCategoryPlan(surveyId, defaultSurveyReportCategoryPlan(surveyTitle, questions));
}

export function defaultSurveyReportTemplate(title: string): SurveyReportTemplateInput {
  const cleanTitle = title.trim() || "未命名问卷";
  return {
    title: `${cleanTitle} 分析报告`,
    sections: ["样本概览", "关键指标", "维度分析", "开放反馈", "风险与建议"],
    metrics: ["response_count"],
    chartSlots: ["题目回答分布", "评分分布", "开放反馈主题"],
    caveats: ["样本量低于30时仅输出方向性判断。"],
  };
}

export async function getSurveyReportTemplate(surveyId: number): Promise<SurveyReportTemplate | undefined> {
  const rows = await query<SurveyReportTemplate>(
    `SELECT ${REPORT_TEMPLATE_COLS} FROM survey_report_templates WHERE survey_id = $1`,
    [surveyId]
  );
  return rows[0];
}

export async function upsertSurveyReportTemplate(
  surveyId: number,
  input: SurveyReportTemplateInput
): Promise<SurveyReportTemplate> {
  const rows = await query<SurveyReportTemplate>(
    `INSERT INTO survey_report_templates (survey_id, title, sections, metrics, chart_slots, caveats)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb)
     ON CONFLICT (survey_id) DO UPDATE SET title = EXCLUDED.title, sections = EXCLUDED.sections,
       metrics = EXCLUDED.metrics, chart_slots = EXCLUDED.chart_slots, caveats = EXCLUDED.caveats, updated_at = now()
     RETURNING ${REPORT_TEMPLATE_COLS}`,
    [surveyId, input.title.trim() || "问卷分析报告", JSON.stringify(input.sections),
      JSON.stringify(input.metrics), JSON.stringify(input.chartSlots), JSON.stringify(input.caveats)]
  );
  return rows[0]!;
}

export async function ensureSurveyReportTemplate(
  surveyId: number,
  surveyTitle: string,
  input?: SurveyReportTemplateInput
): Promise<SurveyReportTemplate> {
  return (await getSurveyReportTemplate(surveyId)) ??
    upsertSurveyReportTemplate(surveyId, input ?? defaultSurveyReportTemplate(surveyTitle));
}

/** 创建问卷 + 题目（同一事务）。至少需要 1 道有效题目，由路由层校验后传入。
 * roomId 仅在 scope='room' 时落库；其余 scope 恒为 NULL（向后兼容存量团队/私有问卷）。 */
export async function createSurvey(
  ownerId: number,
  title: string,
  description: string,
  scope: SurveyScope,
  teamId: number | null,
  questions: NewQuestionInput[],
  roomId: number | null = null
): Promise<SurveyWithQuestions> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const surveyRows = await client.query<Survey>(
      `INSERT INTO surveys (team_id, room_id, scope, title, description, owner_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${SURVEY_COLS}`,
      [scope === "team" ? teamId : null, scope === "room" ? roomId : null, scope, title, description, ownerId]
    );
    const survey = surveyRows.rows[0]!;

    const savedQuestions: SurveyQuestion[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      const rows = await client.query<SurveyQuestion>(
        `INSERT INTO survey_questions (survey_id, position, title, type, required, options, category)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
         RETURNING ${QUESTION_COLS}`,
        [survey.id, i, q.title, q.type, q.required, JSON.stringify(q.options), q.category ?? ""]
      );
      savedQuestions.push(rows.rows[0]!);
    }

    await client.query("COMMIT");
    return { ...survey, questions: savedQuestions };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getSurvey(surveyId: number): Promise<Survey | undefined> {
  const rows = await query<Survey>(`SELECT ${SURVEY_COLS} FROM surveys WHERE id = $1`, [surveyId]);
  return rows[0];
}

export async function listQuestions(surveyId: number): Promise<SurveyQuestion[]> {
  return query<SurveyQuestion>(
    `SELECT ${QUESTION_COLS} FROM survey_questions WHERE survey_id = $1 ORDER BY position ASC`,
    [surveyId]
  );
}

export async function getSurveyWithQuestions(surveyId: number): Promise<SurveyWithQuestions | undefined> {
  const survey = await getSurvey(surveyId);
  if (!survey) return undefined;
  return { ...survey, questions: await listQuestions(surveyId) };
}

/**
 * 公开答题页读取问卷详情；不要求登录。
 * 安全修复（PR #181 review）：此前直接透传 getSurveyWithQuestions，未做任何过滤——
 * 任意 id（含草稿/已暂停/其它团队的私有问卷）都会返回完整题目/选项内容，靠遍历 id
 * 即可读到不该公开的问卷。is_active=false 时仍返回 id/title/description 供"不可答题态"
 * 展示问卷名（对齐 e2e: 未发布问卷公开链接展示不可答题态），但题目/选项清空，
 * 与 POST 提交路径的 409 门控（apps/web/app/api/surveys/[id]/responses/route.ts）对齐——
 * 未激活的问卷内容不可读，也不可答。
 */
export async function getPublicSurveyForAnswer(surveyId: number): Promise<SurveyWithQuestions | undefined> {
  const survey = await getSurveyWithQuestions(surveyId);
  if (!survey) return undefined;
  if (!survey.is_active) {
    return { ...survey, questions: [] };
  }
  return survey;
}

/** 用户可见的问卷：自己的 private 问卷，当前团队上下文内的 team 问卷，或自己所在房间的 room 问卷。
 * 按更新时间倒序；room 问卷附带 room_name 供全局列表页展示所属房间（p20/F08 scope 徽章）。 */
export async function listVisibleSurveys(userId: number, currentTeamId: number | null = null): Promise<SurveyListItem[]> {
  return query<SurveyListItem>(
    `SELECT DISTINCT s.id, s.team_id, s.room_id, s.scope, s.title, s.description, s.is_active,
            s.response_mode, s.publish_start_at, s.publish_end_at, s.response_limit,
            s.one_response_per_user, s.confirmation_message,
            s.owner_user_id, s.created_at, s.updated_at,
            (SELECT count(*)::text FROM survey_responses sr WHERE sr.survey_id = s.id) AS response_count,
            (SELECT count(*)::text
             FROM survey_ai_report_artifacts sar
             WHERE sar.survey_id = s.id AND sar.status = 'ready') AS generated_report_count,
            r.name AS room_name
     FROM surveys s
     LEFT JOIN team_members tm ON tm.team_id = s.team_id AND tm.user_id = $1
     LEFT JOIN room_members rm ON rm.room_id = s.room_id AND rm.user_id = $1
     LEFT JOIN rooms r ON r.id = s.room_id
     WHERE (s.scope = 'private' AND s.owner_user_id = $1)
        OR (
          s.scope = 'team'
          AND s.team_id = $2
          AND tm.user_id IS NOT NULL
        )
        OR (
          s.scope = 'room'
          AND rm.user_id IS NOT NULL
        )
     ORDER BY s.updated_at DESC`,
    [userId, currentTeamId]
  );
}

/** 房间 Survey tab：只列本房间问卷（scope='room' 且 room_id 匹配），不嵌入团队问卷全集。 */
export async function listRoomSurveys(roomId: number): Promise<SurveyListItem[]> {
  return query<SurveyListItem>(
    `SELECT s.id, s.team_id, s.room_id, s.scope, s.title, s.description, s.is_active,
            s.response_mode, s.publish_start_at, s.publish_end_at, s.response_limit,
            s.one_response_per_user, s.confirmation_message,
            s.owner_user_id, s.created_at, s.updated_at,
            (SELECT count(*)::text FROM survey_responses sr WHERE sr.survey_id = s.id) AS response_count,
            (SELECT count(*)::text
             FROM survey_ai_report_artifacts sar
             WHERE sar.survey_id = s.id AND sar.status = 'ready') AS generated_report_count
     FROM surveys s
     WHERE s.scope = 'room' AND s.room_id = $1
     ORDER BY s.updated_at DESC`,
    [roomId]
  );
}

/** 房间下问卷数量（scope='room'，p20/F06 删除房间确认弹窗的级联数量摘要）。 */
export async function countRoomSurveys(roomId: number): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM surveys WHERE scope = 'room' AND room_id = $1`,
    [roomId]
  );
  return Number(rows[0]?.count ?? 0);
}

/** 用户能否查看某问卷：创建者的 private，当前团队上下文内的 team 成员，或该问卷所属房间的成员。 */
export async function canViewSurvey(
  surveyId: number,
  userId: number,
  currentTeamId: number | null = null
): Promise<boolean> {
  const s = await getSurvey(surveyId);
  if (!s) return false;
  if (s.scope === "private" && Number(s.owner_user_id) === Number(userId)) return true;
  if (s.scope === "team" && s.team_id != null) {
    const teamId = Number(s.team_id);
    if (currentTeamId !== teamId) return false;
    return (await getMembership(teamId, userId)) !== undefined;
  }
  if (s.scope === "room" && s.room_id != null) {
    return (await getRoomRole(Number(s.room_id), userId)) !== undefined;
  }
  return false;
}

/**
 * 用户能否管理（改状态/删除）某问卷：
 * - private/team 问卷：仍然只有问卷 owner_user_id 本人（团队侧既有规则，不变）。
 * - room 问卷：房间 owner/admin（房间角色），而不是问卷创建者本人——对齐 uc-rr-007
 *   「房间问卷管理权属于房间」，修正 uc-room-007 把团队问卷管理权错授给房间角色的问题。
 * 房间角色对**团队问卷**发起的管理请求，这里恒为 false（不越权），由调用方转 403。
 */
export async function canManageSurveyScope(surveyId: number, userId: number): Promise<boolean> {
  const s = await getSurvey(surveyId);
  if (!s) return false;
  if (s.scope === "room" && s.room_id != null) {
    const role = await getRoomRole(Number(s.room_id), userId);
    return role === "owner" || role === "admin";
  }
  return Number(s.owner_user_id) === Number(userId);
}

export async function updateSurvey(
  surveyId: number,
  ownerId: number,
  fields: SurveyUpdateFields
): Promise<Survey | undefined> {
  const rows = await query<Survey>(
    `UPDATE surveys
     SET title = COALESCE($3, title),
         description = COALESCE($4, description),
         is_active = COALESCE($5, is_active),
         response_mode = COALESCE($6, response_mode),
         publish_start_at = CASE WHEN $7::boolean THEN $8::timestamptz ELSE publish_start_at END,
         publish_end_at = CASE WHEN $9::boolean THEN $10::timestamptz ELSE publish_end_at END,
         response_limit = CASE WHEN $11::boolean THEN $12::integer ELSE response_limit END,
         one_response_per_user = COALESCE($13, one_response_per_user),
         confirmation_message = COALESCE($14, confirmation_message),
         updated_at = now()
     WHERE id = $1 AND owner_user_id = $2
     RETURNING ${SURVEY_COLS}`,
    surveyUpdateParams(surveyId, ownerId, fields)
  );
  return rows[0];
}

/** 房间问卷版本的更新：按 surveyId 直接生效（管理权已由 canManageSurveyScope 校验），
 * 不要求 caller 是问卷的 owner_user_id——房间 admin 管理房间问卷时通常不是创建者本人。 */
export interface SurveyUpdateFields {
  title?: string;
  description?: string;
  isActive?: boolean;
  responseMode?: "anonymous" | "identified";
  publishStartAt?: string | null;
  publishEndAt?: string | null;
  responseLimit?: number | null;
  oneResponsePerUser?: boolean;
  confirmationMessage?: string;
}

function surveyUpdateParams(surveyId: number, ownerId: number | null, fields: SurveyUpdateFields): unknown[] {
  return [surveyId, ownerId, fields.title ?? null, fields.description ?? null, fields.isActive ?? null,
    fields.responseMode ?? null, Object.hasOwn(fields, "publishStartAt"), fields.publishStartAt ?? null,
    Object.hasOwn(fields, "publishEndAt"), fields.publishEndAt ?? null,
    Object.hasOwn(fields, "responseLimit"), fields.responseLimit ?? null,
    fields.oneResponsePerUser ?? null, fields.confirmationMessage ?? null];
}

export async function updateSurveyById(
  surveyId: number,
  fields: SurveyUpdateFields
): Promise<Survey | undefined> {
  const rows = await query<Survey>(
    `UPDATE surveys
     SET title = COALESCE($2, title),
         description = COALESCE($3, description),
         is_active = COALESCE($4, is_active),
         response_mode = COALESCE($5, response_mode),
         publish_start_at = CASE WHEN $6::boolean THEN $7::timestamptz ELSE publish_start_at END,
         publish_end_at = CASE WHEN $8::boolean THEN $9::timestamptz ELSE publish_end_at END,
         response_limit = CASE WHEN $10::boolean THEN $11::integer ELSE response_limit END,
         one_response_per_user = COALESCE($12, one_response_per_user),
         confirmation_message = COALESCE($13, confirmation_message),
         updated_at = now()
     WHERE id = $1
     RETURNING ${SURVEY_COLS}`,
    surveyUpdateParams(surveyId, null, fields).filter((_, index) => index !== 1)
  );
  return rows[0];
}

export async function deleteSurvey(surveyId: number, ownerId: number): Promise<boolean> {
  const rows = await query<{ id: number }>(
    "DELETE FROM surveys WHERE id = $1 AND owner_user_id = $2 RETURNING id",
    [surveyId, ownerId]
  );
  return rows.length > 0;
}

/** 房间问卷版本的删除：按 surveyId 直接生效（管理权已由 canManageSurveyScope 校验）。 */
export async function deleteSurveyById(surveyId: number): Promise<boolean> {
  const rows = await query<{ id: number }>("DELETE FROM surveys WHERE id = $1 RETURNING id", [surveyId]);
  return rows.length > 0;
}

/** 答卷提交数（供列表展示 responses 计数；F01 恒为 0，随 F03 增长）。 */
export async function countResponses(surveyId: number): Promise<number> {
  const rows = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM survey_responses WHERE survey_id = $1",
    [surveyId]
  );
  return Number(rows[0]?.count ?? 0);
}

export async function countResponsesByUser(surveyId: number, userId: number): Promise<number> {
  const rows = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM survey_responses WHERE survey_id = $1 AND respondent_user_id = $2",
    [surveyId, userId]
  );
  return Number(rows[0]?.count ?? 0);
}

export async function replaceSurveyQuestions(
  surveyId: number,
  questions: NewQuestionInput[]
): Promise<SurveyQuestion[]> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM survey_questions WHERE survey_id = $1", [surveyId]);
    const saved: SurveyQuestion[] = [];
    for (let position = 0; position < questions.length; position += 1) {
      const question = questions[position]!;
      const result = await client.query<SurveyQuestion>(
        `INSERT INTO survey_questions (survey_id, position, title, type, required, options, category)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING ${QUESTION_COLS}`,
        [surveyId, position, question.title, question.type, question.required, JSON.stringify(question.options), question.category ?? ""]
      );
      saved.push(result.rows[0]!);
    }
    await client.query("COMMIT");
    return saved;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** 某问卷的全部答卷，按提交时间倒序（供 F04 报告/汇总使用；调用方需先用 canViewSurvey 校验权限）。 */
export async function listSurveyResponses(surveyId: number): Promise<SurveyResponse[]> {
  return query<SurveyResponse>(
    "SELECT id, survey_id, respondent_user_id, answers, submitted_at FROM survey_responses WHERE survey_id = $1 ORDER BY submitted_at DESC",
    [surveyId]
  );
}

/** 提交一份匿名或登录用户答卷。answers 结构由 API 层按题型校验后传入。 */
export async function createSurveyResponse(
  surveyId: number,
  answers: Record<string, unknown>,
  respondentUserId: number | null = null
): Promise<SurveyResponse> {
  const rows = await query<SurveyResponse>(
    `INSERT INTO survey_responses (survey_id, respondent_user_id, answers)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id, survey_id, respondent_user_id, answers, submitted_at`,
    [surveyId, respondentUserId, JSON.stringify(answers)]
  );
  return rows[0]!;
}

/** 测试/运维用显式发布开关；业务权限由调用方保证。 */
export async function setSurveyActive(surveyId: number, isActive: boolean): Promise<void> {
  await query("UPDATE surveys SET is_active = $2, updated_at = now() WHERE id = $1", [surveyId, isActive]);
}

/** 用户可见模板：内置模板，或自己所在团队保存的模板。 */
export async function listVisibleSurveyTemplates(userId: number): Promise<SurveyTemplate[]> {
  return query<SurveyTemplate>(
    `SELECT DISTINCT st.${TEMPLATE_COLS.replaceAll(", ", ", st.")},
            (
              st.owner_user_id = $1 OR tm.role IN ('owner', 'admin')
            ) AS can_delete
     FROM survey_templates st
     LEFT JOIN team_members tm ON tm.team_id = st.team_id AND tm.user_id = $1
     WHERE st.builtin = true OR tm.user_id IS NOT NULL
     ORDER BY st.builtin DESC, st.updated_at DESC, st.id DESC`,
    [userId]
  );
}

export async function createSurveyTemplate(input: {
  ownerId: number;
  teamId: number;
  title: string;
  description: string;
  tags?: string[];
  questions: NewQuestionInput[];
}): Promise<SurveyTemplate> {
  const rows = await query<SurveyTemplate>(
    `INSERT INTO survey_templates (team_id, owner_user_id, builtin, title, description, tags, questions)
     VALUES ($1, $2, false, $3, $4, $5::text[], $6::jsonb)
     RETURNING ${TEMPLATE_COLS}`,
    [input.teamId, input.ownerId, input.title, input.description, input.tags ?? [], JSON.stringify(input.questions)]
  );
  return rows[0]!;
}

export async function getSurveyTemplate(templateId: number): Promise<SurveyTemplate | undefined> {
  const rows = await query<SurveyTemplate>(`SELECT ${TEMPLATE_COLS} FROM survey_templates WHERE id = $1`, [templateId]);
  return rows[0];
}

/** 可删除：创建者，或模板所属团队 owner/admin。内置模板不可删。 */
export async function canDeleteSurveyTemplate(templateId: number, userId: number): Promise<boolean> {
  const rows = await query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM survey_templates st
       LEFT JOIN team_members tm ON tm.team_id = st.team_id AND tm.user_id = $2
       WHERE st.id = $1
         AND st.builtin = false
         AND (st.owner_user_id = $2 OR tm.role IN ('owner', 'admin'))
     ) AS ok`,
    [templateId, userId]
  );
  return rows[0]?.ok === true;
}

export async function deleteSurveyTemplate(templateId: number): Promise<void> {
  await query("DELETE FROM survey_templates WHERE id = $1", [templateId]);
}
