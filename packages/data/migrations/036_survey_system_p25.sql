-- Phase p25 Survey system: publishing controls, professional report templates and AI artifacts.

ALTER TABLE surveys ADD COLUMN IF NOT EXISTS response_mode text NOT NULL DEFAULT 'anonymous';
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS publish_start_at timestamptz;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS publish_end_at timestamptz;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS response_limit integer;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS one_response_per_user boolean NOT NULL DEFAULT false;
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS confirmation_message text NOT NULL DEFAULT '感谢填写，您的答卷已成功提交。';

ALTER TABLE surveys DROP CONSTRAINT IF EXISTS surveys_response_mode_check;
ALTER TABLE surveys ADD CONSTRAINT surveys_response_mode_check
  CHECK (response_mode IN ('anonymous', 'identified'));
ALTER TABLE surveys DROP CONSTRAINT IF EXISTS surveys_response_limit_check;
ALTER TABLE surveys ADD CONSTRAINT surveys_response_limit_check
  CHECK (response_limit IS NULL OR response_limit > 0);

CREATE TABLE IF NOT EXISTS survey_report_templates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey_id bigint NOT NULL UNIQUE REFERENCES surveys(id) ON DELETE CASCADE,
  title text NOT NULL,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  chart_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  caveats jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_report_templates_survey
  ON survey_report_templates(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_respondent
  ON survey_responses(survey_id, respondent_user_id)
  WHERE respondent_user_id IS NOT NULL;
