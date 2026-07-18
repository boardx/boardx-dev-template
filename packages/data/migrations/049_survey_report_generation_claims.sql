CREATE TABLE IF NOT EXISTS survey_report_generation_claims (
  survey_id bigint NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  source_revision text NOT NULL REFERENCES survey_report_source_snapshots(source_revision) ON DELETE CASCADE,
  requirement_hash text NOT NULL,
  template_version text NOT NULL,
  session_id uuid NOT NULL UNIQUE REFERENCES survey_ai_sessions(id) ON DELETE CASCADE,
  artifact_id uuid REFERENCES survey_ai_report_artifacts(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('generating', 'ready')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, source_revision, requirement_hash, template_version)
);

CREATE INDEX IF NOT EXISTS idx_survey_report_generation_claims_session
  ON survey_report_generation_claims(session_id);
