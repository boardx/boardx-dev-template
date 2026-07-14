CREATE TABLE IF NOT EXISTS survey_ai_sessions (
  id uuid PRIMARY KEY,
  actor_user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  goal text NOT NULL,
  survey_id bigint REFERENCES surveys(id) ON DELETE CASCADE,
  team_id bigint REFERENCES teams(id) ON DELETE SET NULL,
  status text NOT NULL,
  selected_model_id text NOT NULL,
  provider text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_ai_model_traces (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES survey_ai_sessions(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model_id text NOT NULL,
  prompt jsonb NOT NULL,
  response jsonb,
  status text NOT NULL,
  error_message text,
  latency_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_ai_report_artifacts (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES survey_ai_sessions(id) ON DELETE CASCADE,
  survey_id bigint NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  response_count integer NOT NULL,
  filter_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  report jsonb NOT NULL,
  status text NOT NULL,
  model_id text NOT NULL,
  provider text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_ai_sessions_survey ON survey_ai_sessions(survey_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_ai_reports_survey ON survey_ai_report_artifacts(survey_id, created_at DESC);
