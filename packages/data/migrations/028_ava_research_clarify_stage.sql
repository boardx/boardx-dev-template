-- 028_ava_research_clarify_stage.sql — Deep Research 两步交互确认（P18 F04）
-- F04 要求「澄清确认（research-clarify）」与「计划确认（confirm-research-plan）」是两个
-- 独立的、必须显式确认的步骤，不能从提交主题直接跳到可确认计划/执行。此前的状态机只有
-- draft → running 两级（027_ava_research_sessions.sql），draft 阶段澄清和计划一起展示、
-- 一起可确认，没有体现"两步"。新增 'clarified' 中间状态：
--   draft      — 刚生成，只能确认澄清问题（confirm-research-clarify）。
--   clarified  — 澄清已确认，计划变为可确认（confirm-research-plan）。
--   running    — 计划已确认，后端真实推进执行阶段。
--   complete / error — 不变。
ALTER TABLE ava_research_sessions DROP CONSTRAINT IF EXISTS ava_research_sessions_status_check;
ALTER TABLE ava_research_sessions
  ADD CONSTRAINT ava_research_sessions_status_check
  CHECK (status IN ('draft', 'clarified', 'running', 'complete', 'error'));
