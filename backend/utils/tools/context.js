// Per-request context for the agent. Pre-fetches user-scoped data once so
// each tool can validate ID arguments against actual rows (categoria, tarjeta,
// meta, presupuesto, recurrencia) — this is the structural defense against
// the prior agent's #1 failure mode (hallucinated category/date arguments).

async function buildAgentContext({ supabase, id_usuario }) {
  const fetches = await Promise.all([
    supabase.from('categoria').select('id_categoria, nombre, tipo'),
    supabase.from('tarjeta').select('id_tarjeta, nombre, tipo').eq('id_usuario', id_usuario),
    supabase.from('ahorro_meta').select('id_meta, nombre_meta, monto_objetivo, progreso, fecha_limite').eq('id_usuario', id_usuario),
    supabase.from('presupuesto').select('id_presupuesto, id_categoria, monto, categoria(nombre)').eq('id_usuario', id_usuario),
    supabase.from('recurrencia').select('id_recurrencia, descripcion, monto, tipo, dia_del_mes, activo').eq('id_usuario', id_usuario),
  ]);

  // Fail fast if any context fetch errored — partial context would silently
  // expose fabricated IDs as "valid" because their Set would be empty.
  const tableNames = ['categoria', 'tarjeta', 'ahorro_meta', 'presupuesto', 'recurrencia'];
  for (let i = 0; i < fetches.length; i++) {
    if (fetches[i]?.error) {
      const err = fetches[i].error;
      throw new Error(`Context fetch failed for ${tableNames[i]}: ${err.message || err}`);
    }
  }
  const [categoriasRes, tarjetasRes, metasRes, presupuestosRes, recurrenciasRes] = fetches;

  const categorias = categoriasRes.data || [];
  const tarjetas = tarjetasRes.data || [];
  const metas = metasRes.data || [];
  const presupuestos = presupuestosRes.data || [];
  const recurrencias = recurrenciasRes.data || [];

  return {
    supabase,
    id_usuario,
    categoriaIds: new Set(categorias.map(c => c.id_categoria)),
    categoriaNombres: new Map(categorias.map(c => [c.id_categoria, c.nombre])),
    categoriaByNombre: new Map(categorias.map(c => [c.nombre.toLowerCase(), c])),
    tarjetaIds: new Set(tarjetas.map(t => t.id_tarjeta)),
    tarjetaNombres: new Map(tarjetas.map(t => [t.id_tarjeta, t.nombre])),
    metasById: new Map(metas.map(m => [m.id_meta, m])),
    presupuestosById: new Map(presupuestos.map(p => [p.id_presupuesto, p])),
    recurrenciasById: new Map(recurrencias.map(r => [r.id_recurrencia, r])),
    // Plain arrays for convenient summaries
    categorias,
    tarjetas,
    metas,
    presupuestos,
    recurrencias,
  };
}

module.exports = { buildAgentContext };
