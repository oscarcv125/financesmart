const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');
const logger = require('../utils/logger');
const { computeInsights } = require('./insights');

const TIPOS = ['presupuesto_excedido', 'cargo_recurrente_grande', 'meta_completada', 'salto_gasto', 'baja_saldo', 'general'];

async function emit({ id_usuario, tipo, titulo, detalle, severidad = 'media', metadata }) {
  if (!TIPOS.includes(tipo)) tipo = 'general';
  try {
    const { error } = await supabase.from('notificacion').insert([{
      id_usuario,
      tipo,
      titulo: String(titulo).slice(0, 120),
      detalle: detalle ? String(detalle).slice(0, 500) : null,
      severidad,
      metadata: metadata || null,
    }]);
    if (error) logger.warn('notificacion insert failed', { id_usuario, tipo, message: error.message });
  } catch (err) {
    logger.warn('notificacion insert threw', { id_usuario, tipo, message: err.message });
  }
}

// Run the deterministic insights pipeline and emit a notification per
// high-severity item that doesn't already exist for the same day. Idempotent
// per (user, tipo, day): we don't re-notify the same breach twice.
async function generateForUser({ id_usuario }) {
  const { insights } = await computeInsights({ supabase, id_usuario });
  const high = (insights || []).filter(i => i.severity === 'high');
  if (high.length === 0) return { generated: 0 };

  const today = new Date().toISOString().slice(0, 10);
  const { data: existing } = await supabase
    .from('notificacion')
    .select('tipo, created_at')
    .eq('id_usuario', id_usuario)
    .gte('created_at', today);
  const existingTipos = new Set((existing || []).map(n => n.tipo));

  let count = 0;
  for (const i of high) {
    const tipo = i.kind || 'general';
    if (existingTipos.has(tipo)) continue;
    await emit({
      id_usuario,
      tipo,
      titulo: i.title,
      detalle: i.detail,
      severidad: 'alta',
      metadata: { source: 'computeInsights' },
    });
    count++;
  }
  return { generated: count };
}

router.get('/', async (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  try {
    let q = supabase
      .from('notificacion')
      .select('*')
      .eq('id_usuario', req.usuario.id_usuario)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (req.query.unread === 'true') q = q.eq('leida', false);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/generate', async (req, res) => {
  try {
    const r = await generateForUser({ id_usuario: req.usuario.id_usuario });
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    const { error } = await supabase
      .from('notificacion')
      .update({ leida: true, read_at: new Date().toISOString() })
      .eq('id_notificacion', req.params.id)
      .eq('id_usuario', req.usuario.id_usuario);
    if (error) throw error;
    res.json({ updated: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.emit = emit;
module.exports.generateForUser = generateForUser;
