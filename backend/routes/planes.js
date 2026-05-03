const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');
const logger = require('../utils/logger');

async function listPlanes({ supabase, id_usuario }, opts = {}) {
  let q = supabase
    .from('plan_financiero')
    .select('*, plan_hito(id_hito, fecha_objetivo, descripcion, monto_esperado, cumplido, fecha_cumplido)')
    .eq('id_usuario', id_usuario)
    .order('created_at', { ascending: false });
  if (opts.estado) q = q.eq('estado', opts.estado);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function createPlan({ supabase, id_usuario }, body) {
  const nombre = (body?.nombre || '').toString().trim();
  const tipo = (body?.tipo || '').toString();
  if (!nombre) return { ok: false, status: 400, error: 'nombre requerido' };
  if (!['ahorro', 'liquidacion_deuda', 'meta_compuesta'].includes(tipo)) {
    return { ok: false, status: 400, error: 'tipo inválido' };
  }
  const { data, error } = await supabase
    .from('plan_financiero')
    .insert([{
      id_usuario,
      nombre: nombre.slice(0, 120),
      tipo,
      fecha_objetivo: body?.fecha_objetivo || null,
      estado_inicial: body?.estado_inicial || null,
      parametros: body?.parametros || null,
      notas: typeof body?.notas === 'string' ? body.notas.slice(0, 1000) : null,
    }])
    .select()
    .maybeSingle();
  if (error) throw error;
  return { ok: true, data };
}

async function computeAdherencia({ supabase, id_usuario, id_plan }) {
  const { data: hitos, error } = await supabase
    .from('plan_hito')
    .select('cumplido, fecha_objetivo')
    .eq('id_plan', id_plan);
  if (error) throw error;
  const today = new Date().toISOString().slice(0, 10);
  const past = (hitos || []).filter(h => h.fecha_objetivo <= today);
  if (past.length === 0) return { adherencia_pct: null, hitos_pasados: 0, cumplidos: 0 };
  const cumplidos = past.filter(h => h.cumplido).length;
  return {
    adherencia_pct: Math.round((cumplidos / past.length) * 100),
    hitos_pasados: past.length,
    cumplidos,
  };
}

router.get('/', async (req, res) => {
  try {
    const data = await listPlanes({ supabase, id_usuario: req.usuario.id_usuario }, req.query);
    res.json(data);
  } catch (err) {
    logger.warn('planes list failed', { id_usuario: req.usuario.id_usuario, message: err.message });
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const r = await createPlan({ supabase, id_usuario: req.usuario.id_usuario }, req.body);
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    res.status(201).json(r.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/adherencia', async (req, res) => {
  try {
    const adherencia = await computeAdherencia({
      supabase,
      id_usuario: req.usuario.id_usuario,
      id_plan: parseInt(req.params.id, 10),
    });
    res.json(adherencia);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.listPlanes = listPlanes;
module.exports.createPlan = createPlan;
module.exports.computeAdherencia = computeAdherencia;
