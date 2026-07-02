-- 021_presentation_revisions.sql — CAP-AI 演示文稿修订（p12-F03）
-- 复用 presentation_artifacts（p12-F02）作为「当前可查看结果」的唯一真相：修订/优化只在
-- 成功后原地更新 title/slides；处理中/失败不改动原字段（uc-presentations-002 业务规则：
-- 修订失败不破坏原可查看结果）。本表只记录修订/优化请求本身的异步状态（供前端展示处理态、
-- 失败重试、以及方案修订的“更新后方案摘要”展示），不是制品的另一份拷贝。

CREATE TABLE IF NOT EXISTS presentation_revisions (
  id                text PRIMARY KEY,
  artifact_id       text NOT NULL REFERENCES presentation_artifacts(id) ON DELETE CASCADE,
  kind              text NOT NULL CHECK (kind IN ('plan', 'page')), -- plan=整体方案修订；page=单页优化
  page_n            integer,                                        -- kind='page' 时目标页码
  instructions      text NOT NULL,
  status            text NOT NULL DEFAULT 'queued',                 -- queued | processing | ready | error
  summary           jsonb,                                          -- kind='plan' ready 后：方案变更摘要 [{label}]
  error_message     text,
  creator_user_id   bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_presentation_revisions_artifact ON presentation_revisions(artifact_id, id);
