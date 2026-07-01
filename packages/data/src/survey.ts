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

const SURVEY_COLS =
  "id, team_id, scope, title, description, is_active, owner_user_id, created_at, updated_at";
const QUESTION_COLS = "id, survey_id, position, title, type, required, options";

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

/** 用户可见的问卷：自己创建的（含 private/team），或 scope=team 且自己是该团队成员。按更新时间倒序。 */
export async function listVisibleSurveys(userId: number): Promise<Survey[]> {
  return query<Survey>(
    `SELECT DISTINCT s.id, s.team_id, s.scope, s.title, s.description, s.is_active,
            s.owner_user_id, s.created_at, s.updated_at
     FROM surveys s
     LEFT JOIN team_members tm ON tm.team_id = s.team_id AND tm.user_id = $1
     WHERE s.owner_user_id = $1 OR (s.scope = 'team' AND tm.user_id IS NOT NULL)
     ORDER BY s.updated_at DESC`,
    [userId]
  );
}

/** 用户能否查看某问卷：创建者，或 scope=team 且是该团队成员。 */
export async function canViewSurvey(surveyId: number, userId: number): Promise<boolean> {
  const s = await getSurvey(surveyId);
  if (!s) return false;
  if (s.owner_user_id === userId) return true;
  if (s.scope === "team" && s.team_id != null) {
    return (await getMembership(s.team_id, userId)) !== undefined;
  }
  return false;
}

/** 答卷提交数（供列表展示 responses 计数；F01 恒为 0，随 F03 增长）。 */
export async function countResponses(surveyId: number): Promise<number> {
  const rows = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM survey_responses WHERE survey_id = $1",
    [surveyId]
  );
  return Number(rows[0]?.count ?? 0);
}
