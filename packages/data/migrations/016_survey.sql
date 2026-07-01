-- 016_survey.sql — CAP-DATA 问卷地基（P13 F01）：surveys / survey_questions / survey_responses
-- Survey = 团队作用域的问卷容器；question 归属某 survey，按 position 排序；
-- response 存答题人一次提交的整份答卷（answers 为 jsonb，公开答题页在 F03 接入时写入）。
-- scope: private（仅创建者）| team（team_id 所属团队可见，需引用 teams）。

CREATE TABLE IF NOT EXISTS surveys (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id       bigint REFERENCES teams(id) ON DELETE SET NULL,  -- scope=team 时归属团队；私有为 NULL
  scope         text NOT NULL DEFAULT 'private',                 -- private | team
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  is_active     boolean NOT NULL DEFAULT false,                  -- 发布开关随 F06 接入；本 feature 创建即为草稿(false)
  owner_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_surveys_owner ON surveys(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_surveys_team ON surveys(team_id);

CREATE TABLE IF NOT EXISTS survey_questions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id   bigint NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  position    integer NOT NULL,                 -- 0-based 展示顺序
  title       text NOT NULL,
  type        text NOT NULL DEFAULT 'text',     -- text | single | multiple | rating
  required    boolean NOT NULL DEFAULT false,
  options     jsonb NOT NULL DEFAULT '[]'::jsonb, -- single/multiple 的选项文案数组
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey ON survey_questions(survey_id, position);

CREATE TABLE IF NOT EXISTS survey_responses (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id    bigint NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  respondent_user_id bigint REFERENCES users(id) ON DELETE SET NULL, -- 答题人可能是访客（NULL，随 F03 接入）
  answers      jsonb NOT NULL DEFAULT '{}'::jsonb, -- { [question_id]: value }
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey ON survey_responses(survey_id, submitted_at DESC);
