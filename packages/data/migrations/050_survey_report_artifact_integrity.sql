DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'survey_ai_report_artifacts_source_revision_fkey'
  ) THEN
    ALTER TABLE survey_ai_report_artifacts
      ADD CONSTRAINT survey_ai_report_artifacts_source_revision_fkey
      FOREIGN KEY (source_revision)
      REFERENCES survey_report_source_snapshots(source_revision)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END
$$;

ALTER TABLE survey_ai_report_artifacts
  VALIDATE CONSTRAINT survey_ai_report_artifacts_source_revision_fkey;

DROP INDEX IF EXISTS idx_survey_report_versions;

CREATE INDEX idx_survey_report_versions
  ON survey_ai_report_artifacts(survey_id, created_at DESC, id DESC)
  WHERE status = 'ready' AND source_revision IS NOT NULL;
