CREATE TABLE IF NOT EXISTS survey_report_source_snapshots (
  source_revision text PRIMARY KEY,
  survey_id bigint NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  content_hash text NOT NULL,
  schema_version text NOT NULL,
  response_count integer NOT NULL,
  source_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey_id, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_survey_report_sources_survey
  ON survey_report_source_snapshots(survey_id, created_at DESC);

ALTER TABLE survey_ai_report_artifacts
  ADD COLUMN IF NOT EXISTS source_revision text,
  ADD COLUMN IF NOT EXISTS requirement_hash text,
  ADD COLUMN IF NOT EXISTS template_version text NOT NULL DEFAULT 'survey-report-v1';

CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_report_ready_artifact_key
  ON survey_ai_report_artifacts (
    survey_id,
    source_revision,
    requirement_hash,
    template_version
  )
  WHERE status = 'ready'
    AND source_revision IS NOT NULL
    AND requirement_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_survey_report_versions
  ON survey_ai_report_artifacts(survey_id, created_at DESC)
  WHERE status = 'ready' AND source_revision IS NOT NULL;
