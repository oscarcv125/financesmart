-- Server-side persistence of chat messages so users see their history across
-- devices and sessions, and so we can debug "what did the bot say" reports.
-- Append-only from the app's perspective; bulk-cleanup happens via TTL job.

CREATE TABLE IF NOT EXISTS chat_message (
  id_message  BIGSERIAL PRIMARY KEY,
  id_usuario  BIGINT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('user', 'bot')),
  text        TEXT NOT NULL,
  widgets     JSONB,
  proposals   JSONB,
  mode        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_message_user_created
  ON chat_message(id_usuario, created_at DESC);
