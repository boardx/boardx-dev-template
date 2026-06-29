-- 001_init.sql — 骨架初始表：notes(F02) + jobs(F03)
-- schema 只经 migrations 改；不在运行时 DDL。

CREATE TABLE IF NOT EXISTS notes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  text        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id          text PRIMARY KEY,
  payload     text NOT NULL,
  status      text NOT NULL DEFAULT 'queued',
  updated_at  timestamptz NOT NULL DEFAULT now()
);
