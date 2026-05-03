-- Persistent cache for proactive insights so the 6h TTL survives Vercel cold
-- starts. Without this, each new function instance (very frequent on serverless)
-- starts with an empty Map and re-burns Gemini quota.

CREATE TABLE IF NOT EXISTS proactive_insights_cache (
  id_usuario   BIGINT PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload      JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_proactive_cache_generated_at
  ON proactive_insights_cache(generated_at);
