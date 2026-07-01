-- 016_ai_store.sql — CAP-DATA AI Store 地基（P11 F01）：ai_store_items
-- AI Store 商品：Agent / AI 工具 / 图片工具 / 模板，可归属个人 / 团队 / 平台。
-- scope=personal → owner_user_id 为该用户；scope=team → team_id 为该团队；scope=platform → 官方精选，二者皆可为 NULL。
-- status：draft（草稿，仅 owner 可见）/ published（已发布，符合 scope 的可见范围内可浏览）/
--         pending（提交平台审核）/ approved / rejected（审核状态机，F02/F06 使用；F01 只读浏览 published）。

CREATE TABLE IF NOT EXISTS ai_store_items (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type          text NOT NULL CHECK (type IN ('agent', 'ai-tool', 'image-tool', 'template')),
  scope         text NOT NULL DEFAULT 'platform' CHECK (scope IN ('personal', 'team', 'platform')),
  owner_user_id bigint REFERENCES users(id) ON DELETE CASCADE,
  team_id       bigint REFERENCES teams(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'pending', 'approved', 'rejected')),
  name          text NOT NULL,
  description   text NOT NULL DEFAULT '',
  cover         text,
  author        text NOT NULL DEFAULT '',
  tags          text[] NOT NULL DEFAULT '{}',
  examples      text[] NOT NULL DEFAULT '{}',
  likes         integer NOT NULL DEFAULT 0,
  views         integer NOT NULL DEFAULT 0,
  featured      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_store_items_type ON ai_store_items(type);
CREATE INDEX IF NOT EXISTS idx_ai_store_items_scope ON ai_store_items(scope);
CREATE INDEX IF NOT EXISTS idx_ai_store_items_owner ON ai_store_items(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_ai_store_items_team ON ai_store_items(team_id);
CREATE INDEX IF NOT EXISTS idx_ai_store_items_status ON ai_store_items(status);

-- 种子样本（platform scope，published，供 Explore 浏览/筛选/分页联调）。
-- id 由 IDENTITY 生成，此处按插入顺序对齐 UI 原型（store-browser.tsx）曾用的样例数据。
INSERT INTO ai_store_items (type, scope, status, name, description, author, tags, examples, likes, views, featured)
VALUES
  ('agent', 'platform', 'published', 'Research Agent', 'Multi-step web research with cited summaries.', 'BoardX', ARRAY['research','featured'], ARRAY['Research the top 3 competitors for a SaaS product.', 'Summarize recent papers on a topic with citations.'], 312, 4810, true),
  ('agent', 'platform', 'published', 'Meeting Notes Agent', 'Turns transcripts into structured action items.', 'BoardX', ARRAY['meetings','productivity'], ARRAY['Paste a meeting transcript to get action items.'], 198, 3120, false),
  ('agent', 'platform', 'published', 'Sprint Planner', 'Breaks goals into sprints and tasks on the board.', 'Acme Labs', ARRAY['productivity'], ARRAY['Plan a 2-week sprint from a goal statement.'], 87, 1540, false),
  ('agent', 'platform', 'published', 'Data Analyst Agent', 'Explores a dataset and drafts findings with charts.', 'BoardX', ARRAY['research','productivity'], ARRAY['Analyze a CSV of sales data for trends.'], 145, 2260, false),
  ('ai-tool', 'platform', 'published', 'Summarize', 'Condense long docs into key points.', 'BoardX', ARRAY['writing','featured'], ARRAY['Summarize a 10-page PDF into 5 bullet points.'], 421, 7600, true),
  ('ai-tool', 'platform', 'published', 'Translate', 'Translate selected text across 30+ languages.', 'BoardX', ARRAY['writing'], ARRAY['Translate a paragraph from English to Japanese.'], 156, 2890, false),
  ('ai-tool', 'platform', 'published', 'Rewrite', 'Rephrase text for tone and clarity.', 'Acme Labs', ARRAY['writing'], ARRAY['Rewrite an email to sound more formal.'], 64, 980, false),
  ('image-tool', 'platform', 'published', 'Image Generate', 'Create illustrations from a text prompt.', 'BoardX', ARRAY['design','featured'], ARRAY['Generate a cover illustration for a blog post.'], 530, 9100, true),
  ('image-tool', 'platform', 'published', 'Image Upscale', 'Enhance and upscale board images.', 'PixelWorks', ARRAY['design'], ARRAY['Upscale a low-res logo to 4x resolution.'], 142, 2010, false),
  ('template', 'platform', 'published', 'Retro Template', 'Start, stop, continue retrospective board.', 'BoardX', ARRAY['meetings','productivity'], ARRAY['Run a sprint retro with a team of 6.'], 276, 5300, false),
  ('template', 'platform', 'published', 'Brainstorm Template', 'Diverge and converge ideation canvas.', 'Acme Labs', ARRAY['productivity'], ARRAY['Brainstorm feature ideas for a product launch.'], 188, 3400, false),
  ('template', 'platform', 'published', 'User Journey Map', 'Map stages, actions, and pain points.', 'BoardX', ARRAY['design','research'], ARRAY['Map the onboarding journey for a new user.'], 233, 4120, false)
ON CONFLICT DO NOTHING;
