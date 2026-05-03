const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

const TIPOS = ['ingreso', 'gasto'];

function ymd(d) { return d.toISOString().split('T')[0]; }

function dueDatesSince(fechaInicio, ultimaEjecucion, dia, hoy = new Date()) {
  const startRaw = ultimaEjecucion ? new Date(ultimaEjecucion + 'T00:00:00') : new Date(fechaInicio + 'T00:00:00');
  const out = [];
  const cursor = new Date(startRaw.getFullYear(), startRaw.getMonth(), 1);
  while (cursor <= hoy) {
    const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), dia);
    if (candidate <= hoy && candidate > startRaw) out.push(ymd(candidate));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

// Per-user throttle on materializar runs. Recurring charges only need to
// materialize when a `dia_del_mes` has passed since `ultima_ejecucion`, which
// is at most once per user per day. Without this, opening the dashboard or
// hitting GET /api/recurrencias N times in an hour issued N reads + writes for
// no new movements. In-memory cache survives only the process lifetime, which
// is fine — the worst case after a cold start is one extra materialize.
const lastMaterializedAt = new Map();
const MATERIALIZE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function materializar({ supabase, id_usuario }) {
  const cached = lastMaterializedAt.get(id_usuario);
  if (cached && Date.now() - cached < MATERIALIZE_TTL_MS) return;

  const { data: recs, error } = await supabase
    .from('recurrencia')
    .select('*')
    .eq('id_usuario', id_usuario)
    .eq('activo', true);
  if (error) throw error;

  // Cheap pre-check: if no active recurrencia is due, don't fire any inserts.
  const anyDue = (recs || []).some(r => dueDatesSince(r.fecha_inicio, r.ultima_ejecucion, r.dia_del_mes).length > 0);
  if (!anyDue) {
    lastMaterializedAt.set(id_usuario, Date.now());
    return;
  }

  for (const r of recs || []) {
    const fechas = dueDatesSince(r.fecha_inicio, r.ultima_ejecucion, r.dia_del_mes);
    if (fechas.length === 0) continue;

    const rows = fechas.map(fecha => ({
      id_usuario,
      id_tarjeta: r.id_tarjeta,
      id_categoria: r.id_categoria,
      monto: r.tipo === 'gasto' ? -Math.abs(Number(r.monto)) : Math.abs(Number(r.monto)),
      tipo: r.tipo,
      descripcion: r.descripcion,
      fecha,
    }));

    const { error: insErr } = await supabase.from('movimiento_financiero').insert(rows);
    if (insErr) continue;

    await supabase
      .from('recurrencia')
      .update({ ultima_ejecucion: fechas[fechas.length - 1] })
      .eq('id_recurrencia', r.id_recurrencia);
  }
  lastMaterializedAt.set(id_usuario, Date.now());
}

async function listRecurrencias({ supabase, id_usuario }, opts = {}) {
  // Materialization is now opt-in (only the explicit GET /api/recurrencias
  // route triggers it). The agent's obtener_recurrencias tool passes
  // materialize:false to keep chatbot turns fast and side-effect-free.
  if (opts.materialize === true) {
    await materializar({ supabase, id_usuario });
  }
  let q = supabase
    .from('recurrencia')
    .select('id_recurrencia, descripcion, monto, tipo, dia_del_mes, activo, fecha_inicio, ultima_ejecucion, id_tarjeta, id_categoria, tarjeta(nombre), categoria(nombre)')
    .eq('id_usuario', id_usuario);
  if (opts.solo_activas) q = q.eq('activo', true);
  q = q.order('id_recurrencia', { ascending: false });
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function createRecurrencia({ supabase, id_usuario }, body) {
  const tipo = String(body?.tipo || '').toLowerCase();
  const monto = parseFloat(body?.monto);
  const descripcion = (body?.descripcion || '').toString().trim();
  const id_tarjeta = parseInt(body?.id_tarjeta, 10);
  const id_categoria = body?.id_categoria ? parseInt(body.id_categoria, 10) : null;
  const dia_del_mes = parseInt(body?.dia_del_mes, 10);
  const fecha_inicio = body?.fecha_inicio || new Date().toISOString().split('T')[0];

  if (!TIPOS.includes(tipo)) return { ok: false, status: 400, error: 'Tipo inválido' };
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, status: 400, error: 'Monto debe ser positivo' };
  if (!descripcion) return { ok: false, status: 400, error: 'Descripción requerida' };
  if (!Number.isFinite(id_tarjeta)) return { ok: false, status: 400, error: 'Tarjeta requerida' };
  if (!Number.isFinite(dia_del_mes) || dia_del_mes < 1 || dia_del_mes > 28) {
    return { ok: false, status: 400, error: 'Día debe estar entre 1 y 28' };
  }

  const { data, error } = await supabase
    .from('recurrencia')
    .insert([{
      id_usuario,
      id_tarjeta, id_categoria,
      descripcion, monto, tipo,
      dia_del_mes, fecha_inicio,
      activo: true,
    }])
    .select()
    .maybeSingle();
  if (error) throw error;
  return { ok: true, data };
}

async function togglearRecurrencia({ supabase, id_usuario }, { id, activo }) {
  const parsedId = parseInt(id, 10);
  if (!Number.isFinite(parsedId)) return { ok: false, status: 400, error: 'ID inválido' };
  if (typeof activo !== 'boolean') return { ok: false, status: 400, error: 'Nada para actualizar' };
  const { data, error } = await supabase
    .from('recurrencia')
    .update({ activo })
    .eq('id_recurrencia', parsedId)
    .eq('id_usuario', id_usuario)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404, error: 'No encontrado' };
  return { ok: true, data };
}

async function deleteRecurrencia({ supabase, id_usuario }, id) {
  const parsedId = parseInt(id, 10);
  if (!Number.isFinite(parsedId)) return { ok: false, status: 400, error: 'ID inválido' };
  const { error } = await supabase
    .from('recurrencia')
    .delete()
    .eq('id_recurrencia', parsedId)
    .eq('id_usuario', id_usuario);
  if (error) throw error;
  return { ok: true };
}

router.get('/', async (req, res) => {
  try {
    const data = await listRecurrencias(
      { supabase, id_usuario: req.usuario.id_usuario },
      { materialize: true },
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await createRecurrencia({ supabase, id_usuario: req.usuario.id_usuario }, req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const result = await togglearRecurrencia(
      { supabase, id_usuario: req.usuario.id_usuario },
      { id: req.params.id, activo: req.body?.activo },
    );
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await deleteRecurrencia({ supabase, id_usuario: req.usuario.id_usuario }, req.params.id);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.listRecurrencias = listRecurrencias;
module.exports.createRecurrencia = createRecurrencia;
module.exports.togglearRecurrencia = togglearRecurrencia;
module.exports.deleteRecurrencia = deleteRecurrencia;
module.exports.materializar = materializar;
