CREATE TABLE IF NOT EXISTS presupuesto (
  id_presupuesto SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_categoria INT NOT NULL REFERENCES categoria(id_categoria) ON DELETE CASCADE,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  UNIQUE (id_usuario, id_categoria)
);

CREATE INDEX IF NOT EXISTS idx_presupuesto_usuario ON presupuesto(id_usuario);

CREATE TABLE IF NOT EXISTS recurrencia (
  id_recurrencia SERIAL PRIMARY KEY,
  id_usuario INT NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_tarjeta INT NOT NULL REFERENCES tarjeta(id_tarjeta) ON DELETE CASCADE,
  id_categoria INT REFERENCES categoria(id_categoria) ON DELETE SET NULL,
  descripcion TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto > 0),
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','gasto')),
  dia_del_mes INT NOT NULL CHECK (dia_del_mes BETWEEN 1 AND 28),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  ultima_ejecucion DATE
);

CREATE INDEX IF NOT EXISTS idx_recurrencia_usuario ON recurrencia(id_usuario);
