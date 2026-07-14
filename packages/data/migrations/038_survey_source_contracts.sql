ALTER TABLE survey_questions
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT '';

ALTER TABLE survey_templates
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE survey_report_templates
  ADD COLUMN IF NOT EXISTS category_plan jsonb NOT NULL
  DEFAULT '{"title":"","description":"","categories":[]}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_survey_report_templates_category_plan_gin
  ON survey_report_templates USING gin (category_plan);
