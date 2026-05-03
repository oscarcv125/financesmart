-- Bundle of migrations 003-007. Idempotent (CREATE TABLE IF NOT EXISTS).
-- Apply in Supabase Dashboard → SQL Editor → New query → paste → Run.
-- Or:  psql "$DB_URL" -f apply_003_to_007.sql

-- =================================================================
-- 003 — audit_log
-- =================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id_audit       BIGSERIAL PRIMARY KEY,
  id_usuario     BIGINT NOT NULL,
  action         TEXT NOT NULL,
  source         TEXT NOT NULL DEFAULT 'chatbot',
  status         TEXT NOT NULL,
  params         JSONB,
  result_summary TEXT,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_created ON audit_log(id_usuario, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_created ON audit_log(action, created_at DESC);

-- =================================================================
-- 004 — proactive_insights_cache
-- =================================================================
CREATE TABLE IF NOT EXISTS proactive_insights_cache (
  id_usuario   BIGINT PRIMARY KEY,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload      JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proactive_cache_generated_at ON proactive_insights_cache(generated_at);

-- =================================================================
-- 005 — chat_message
-- =================================================================
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
CREATE INDEX IF NOT EXISTS idx_chat_message_user_created ON chat_message(id_usuario, created_at DESC);

-- =================================================================
-- 006 — planes_financieros (3 tables)
-- =================================================================
CREATE TABLE IF NOT EXISTS plan_financiero (
  id_plan          BIGSERIAL PRIMARY KEY,
  id_usuario       BIGINT NOT NULL,
  nombre           TEXT NOT NULL,
  tipo             TEXT NOT NULL CHECK (tipo IN ('ahorro', 'liquidacion_deuda', 'meta_compuesta')),
  fecha_objetivo   DATE,
  estado           TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'pausado', 'completado', 'cancelado')),
  estado_inicial   JSONB,
  parametros       JSONB,
  notas            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plan_user_estado ON plan_financiero(id_usuario, estado);

CREATE TABLE IF NOT EXISTS plan_hito (
  id_hito          BIGSERIAL PRIMARY KEY,
  id_plan          BIGINT NOT NULL REFERENCES plan_financiero(id_plan) ON DELETE CASCADE,
  fecha_objetivo   DATE NOT NULL,
  descripcion      TEXT,
  monto_esperado   NUMERIC(14, 2),
  cumplido         BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_cumplido   DATE
);
CREATE INDEX IF NOT EXISTS idx_hito_plan_fecha ON plan_hito(id_plan, fecha_objetivo);

CREATE TABLE IF NOT EXISTS plan_revision (
  id_revision      BIGSERIAL PRIMARY KEY,
  id_plan          BIGINT NOT NULL REFERENCES plan_financiero(id_plan) ON DELETE CASCADE,
  fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
  adherencia_pct   NUMERIC(5, 2),
  observaciones    TEXT,
  metricas         JSONB
);
CREATE INDEX IF NOT EXISTS idx_revision_plan_fecha ON plan_revision(id_plan, fecha DESC);

-- =================================================================
-- 007 — notificacion
-- =================================================================
CREATE TABLE IF NOT EXISTS notificacion (
  id_notificacion BIGSERIAL PRIMARY KEY,
  id_usuario      BIGINT NOT NULL,
  tipo            TEXT NOT NULL,
  titulo          TEXT NOT NULL,
  detalle         TEXT,
  severidad       TEXT NOT NULL DEFAULT 'media' CHECK (severidad IN ('alta', 'media', 'baja')),
  leida           BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notif_user_unread ON notificacion(id_usuario, leida, created_at DESC);

-- Done. Verify with:
--   SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
