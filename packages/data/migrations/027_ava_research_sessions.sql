-- 027_ava_research_sessions.sql — CAP-DATA AVA Deep Research 持久化（P18 F03）
-- 此前 Deep Research 的澄清/计划/时间线/报告全部只存在于前端内存 state（researchRun），
-- 刷新页面即丢失，用户必须从头开始。本表持久化每次研究的结构化 payload + 实时阶段状态，
-- 使 GET 可在线程重新打开时把 research-card 恢复到中断前的正确阶段与内容。
-- 一个线程可有多次研究（先后发起）；恢复时只取最近一条（见 getLatestAvaResearchSession）。
CREATE TABLE IF NOT EXISTS ava_research_sessions (
  id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  thread_id            bigint NOT NULL REFERENCES ava_threads(id) ON DELETE CASCADE,
  topic                text   NOT NULL,
  audience             text   NOT NULL,
  status               text   NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft', 'running', 'complete', 'error')),
  -- research_payload：buildResearch() 产出的静态结构（clarifyingQuestions/plan/report），
  -- 生成后不再变化；真实生成（F04）落地后由真实引擎产出同形状的对象。
  research_payload     jsonb,
  -- timeline：实时阶段状态数组（每项 {phase,task,status}），confirm/advance 过程中更新，
  -- 是"中断前处于哪个阶段"的权威字段。
  timeline             jsonb NOT NULL DEFAULT '[]',
  assistant_message_id bigint REFERENCES ava_messages(id) ON DELETE SET NULL,
  error                text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ava_research_sessions_thread
  ON ava_research_sessions(thread_id, created_at DESC);
