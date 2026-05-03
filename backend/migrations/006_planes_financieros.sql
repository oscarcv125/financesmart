-- Long-horizon financial plans. A "plan" wraps a multi-month / multi-year
-- objective like "save $100k for a down payment by 2028" or "pay off
-- $40k of card debt in 18 months". Plans decompose into hitos (milestones)
-- and accumulate adherencia metrics over time.

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
