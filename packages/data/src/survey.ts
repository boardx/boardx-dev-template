// packages/data/src/survey.ts — CAP-DATA 问卷仓储（surveys / survey_questions / survey_responses，P13 F01 地基）
// Survey = team 作用域的问卷容器；question 归属某 survey，按 position 排序。
// 本 feature（F01）只覆盖创建 + 列表 + 详情；答题/发布开关/报告留给 F02-F06。
import { query, getPool } from "./index";
import { getMembership } from "./teams";

export type SurveyScope = "private" | "team";
export type QuestionType = "text" | "single" | "multiple" | "rating";

export interface Survey {
  id: number;
  team_id: number | null;
  scope: SurveyScope;
  title: string;
  description: string;
  is_active: boolean;
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
  questions: NewQuestionInput[];
  created_at: string;
  updated_at: string;
  can_delete?: boolean;
}

export interface SurveyListItem extends Survey {
  response_count: string;
}

const SURVEY_COLS =
  "id, team_id, scope, title, description, is_active, owner_user_id, created_at, updated_at";
const QUESTION_COLS = "id, survey_id, position, title, type, required, options";
const TEMPLATE_COLS = "id, team_id, owner_user_id, builtin, title, description, questions, created_at, updated_at";

export interface NewQuestionInput {
  title: string;
  type: QuestionType;
  required: boolean;
  options: string[];
}

/** 标题去首尾空白后是否非空（纯函数，可单测）。 */
export function isBlank(title: string | null | undefined): boolean {
  return !(title ?? "").trim();
}

/** 创建问卷 + 题目（同一事务）。至少需要 1 道有效题目，由路由层校验后传入。 */
export async function createSurvey(
  ownerId: number,
  title: string,
  description: string,
  scope: SurveyScope,
  teamId: number | null,
  questions: NewQuestionInput[]
): Promise<SurveyWithQuestions> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const surveyRows = await client.query<Survey>(
      `INSERT INTO surveys (team_id, scope, title, description, owner_user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${SURVEY_COLS}`,
      [scope === "team" ? teamId : null, scope, title, description, ownerId]
    );
    const survey = surveyRows.rows[0]!;

    const savedQuestions: SurveyQuestion[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]!;
      const rows = await client.query<SurveyQuestion>(
        `INSERT INTO survey_questions (survey_id, position, title, type, required, options)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         RETURNING ${QUESTION_COLS}`,
        [survey.id, i, q.title, q.type, q.required, JSON.stringify(q.options)]
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

/** 用户可见的问卷：自己的 private 问卷，或当前团队上下文内的 team 问卷。按更新时间倒序。 */
export async function listVisibleSurveys(userId: number, currentTeamId: number | null = null): Promise<SurveyListItem[]> {
  return query<SurveyListItem>(
    `SELECT DISTINCT s.id, s.team_id, s.scope, s.title, s.description, s.is_active,
            s.owner_user_id, s.created_at, s.updated_at,
            count(sr.id)::text AS response_count
     FROM surveys s
     LEFT JOIN survey_responses sr ON sr.survey_id = s.id
     LEFT JOIN team_members tm ON tm.team_id = s.team_id AND tm.user_id = $1
     WHERE (s.scope = 'private' AND s.owner_user_id = $1)
        OR (
          s.scope = 'team'
          AND s.team_id = $2
          AND tm.user_id IS NOT NULL
        )
     GROUP BY s.id, s.team_id, s.scope, s.title, s.description, s.is_active,
              s.owner_user_id, s.created_at, s.updated_at
     ORDER BY s.updated_at DESC`,
    [userId, currentTeamId]
  );
}

/** 用户能否查看某问卷：创建者的 private，或当前团队上下文内的 team 成员。 */
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
  return false;
}

export async function updateSurvey(
  surveyId: number,
  ownerId: number,
  fields: { title?: string; description?: string; isActive?: boolean }
): Promise<Survey | undefined> {
  const rows = await query<Survey>(
    `UPDATE surveys
     SET title = COALESCE($3, title),
         description = COALESCE($4, description),
         is_active = COALESCE($5, is_active),
         updated_at = now()
     WHERE id = $1 AND owner_user_id = $2
     RETURNING ${SURVEY_COLS}`,
    [surveyId, ownerId, fields.title ?? null, fields.description ?? null, fields.isActive ?? null]
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

/** 答卷提交数（供列表展示 responses 计数；F01 恒为 0，随 F03 增长）。 */
export async function countResponses(surveyId: number): Promise<number> {
  const rows = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM survey_responses WHERE survey_id = $1",
    [surveyId]
  );
  return Number(rows[0]?.count ?? 0);
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
  questions: NewQuestionInput[];
}): Promise<SurveyTemplate> {
  const rows = await query<SurveyTemplate>(
    `INSERT INTO survey_templates (team_id, owner_user_id, builtin, title, description, questions)
     VALUES ($1, $2, false, $3, $4, $5::jsonb)
     RETURNING ${TEMPLATE_COLS}`,
    [input.teamId, input.ownerId, input.title, input.description, JSON.stringify(input.questions)]
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
