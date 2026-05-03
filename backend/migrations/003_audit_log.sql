-- Audit log for chatbot write actions and other privileged operations.
-- Append-only; never UPDATE or DELETE rows. Useful for incident review,
-- compliance, and debugging "the bot did what?" reports from users.

CREATE TABLE IF NOT EXISTS audit_log (
  id_audit       BIGSERIAL PRIMARY KEY,
  id_usuario     BIGINT NOT NULL,
  action         TEXT NOT NULL,                  -- e.g. 'aporte_meta', 'crear_presupuesto'
  source         TEXT NOT NULL DEFAULT 'chatbot', -- 'chatbot' | 'ui' | 'api' | 'cron'
  status         TEXT NOT NULL,                  -- 'success' | 'failed'
  params         JSONB,
  result_summary TEXT,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_created
  ON audit_log(id_usuario, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_action_created
  ON audit_log(action, created_at DESC);
