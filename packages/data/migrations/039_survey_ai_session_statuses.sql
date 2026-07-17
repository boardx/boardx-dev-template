ALTER TABLE survey_ai_sessions
  DROP CONSTRAINT IF EXISTS survey_ai_sessions_status_check;

ALTER TABLE survey_ai_sessions
  ADD CONSTRAINT survey_ai_sessions_status_check
  CHECK (status IN (
    'drafting',
    'awaiting_user',
    'generating',
    'ready',
    'open',
    'applied',
    'discarded',
    'failed',
    'cancelled'
  ));
