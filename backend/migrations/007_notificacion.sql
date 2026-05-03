-- Notifications produced by the system (budget breach, large recurring charge,
-- meta milestone, etc.). The frontend polls or subscribes for unread items.

CREATE TABLE IF NOT EXISTS notificacion (
  id_notificacion BIGSERIAL PRIMARY KEY,
  id_usuario      BIGINT NOT NULL,
  tipo            TEXT NOT NULL,         -- 'presupuesto_excedido' | 'cargo_recurrente_grande' | 'meta_completada' | ...
  titulo          TEXT NOT NULL,
  detalle         TEXT,
  severidad       TEXT NOT NULL DEFAULT 'media' CHECK (severidad IN ('alta', 'media', 'baja')),
  leida           BOOLEAN NOT NULL DEFAULT FALSE,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_user_unread
  ON notificacion(id_usuario, leida, created_at DESC);
