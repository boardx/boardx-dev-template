-- 017_survey_templates.sql — P13 F05 问卷模板：内置模板 + 团队保存模板

CREATE TABLE IF NOT EXISTS survey_templates (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id       bigint REFERENCES teams(id) ON DELETE CASCADE,
  owner_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
  builtin       boolean NOT NULL DEFAULT false,
  title         text NOT NULL,
  description   text NOT NULL DEFAULT '',
  questions     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (builtin OR team_id IS NOT NULL),
  CHECK (jsonb_typeof(questions) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_survey_templates_team ON survey_templates(team_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_templates_builtin ON survey_templates(builtin, title);

INSERT INTO survey_templates (builtin, title, description, questions)
SELECT true, 'Team pulse', 'A quick weekly check-in for team mood and blockers.',
  '[
    {"title":"How are you feeling this week?","type":"rating","required":true,"options":[]},
    {"title":"What is blocking your progress?","type":"text","required":false,"options":[]},
    {"title":"What should we improve next week?","type":"text","required":false,"options":[]}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM survey_templates WHERE builtin = true AND title = 'Team pulse'
);

INSERT INTO survey_templates (builtin, title, description, questions)
SELECT true, 'Event feedback', 'Collect participant feedback after a workshop or event.',
  '[
    {"title":"How satisfied were you with the event?","type":"rating","required":true,"options":[]},
    {"title":"Which part was most valuable?","type":"single","required":true,"options":["Talks","Workshop","Networking","Q&A"]},
    {"title":"Any suggestions for next time?","type":"text","required":false,"options":[]}
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM survey_templates WHERE builtin = true AND title = 'Event feedback'
);
