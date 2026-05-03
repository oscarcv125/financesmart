const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

function monthRange(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const first = new Date(y, m, 1).toISOString().split('T')[0];
  const firstNext = new Date(y, m + 1, 1).toISOString().split('T')[0];
  return { first, firstNext };
}

async function listPresupuestos({ supabase, id_usuario }) {
  const { data: presupuestos, error } = await supabase
    .from('presupuesto')
    .select('id_presupuesto, id_categoria, monto, categoria(nombre, tipo)')
    .eq('id_usuario', id_usuario);
  if (error) throw error;

  const { first, firstNext } = monthRange();
  const { data: movs, error: mErr } = await supabase
    .from('movimiento_financiero')
    .select('monto, tipo, id_categoria, fecha')
    .eq('id_usuario', id_usuario)
    .gte('fecha', first)
    .lt('fecha', firstNext);
  if (mErr) throw mErr;

  const gastosPorCat = {};
  for (const m of movs || []) {
    if (String(m.tipo).toLowerCase() !== 'gasto') continue;
    gastosPorCat[m.id_categoria] = (gastosPorCat[m.id_categoria] || 0) + Math.abs(Number(m.monto));
  }

  return (presupuestos || []).map(p => {
    const gastado = gastosPorCat[p.id_categoria] || 0;
    const pct = p.monto > 0 ? Math.min(999, Math.round((gastado / Number(p.monto)) * 100)) : 0;
    return {
      id_presupuesto: p.id_presupuesto,
      id_categoria: p.id_categoria,
      categoria: p.categoria?.nombre || 'Sin categoría',
      monto: Number(p.monto),
      gastado,
      pct,
      excedido: gastado > Number(p.monto),
    };
  });
}

async function upsertPresupuesto({ supabase, id_usuario }, body) {
  const id_categoria = parseInt(body?.id_categoria, 10);
  const monto = parseFloat(body?.monto);
  if (!Number.isFinite(id_categoria)) return { ok: false, status: 400, error: 'Categoría inválida' };
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, status: 400, error: 'Monto debe ser positivo' };

  const { data, error } = await supabase
    .from('presupuesto')
    .upsert([{ id_usuario, id_categoria, monto }], {
      onConflict: 'id_usuario,id_categoria',
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return { ok: true, data };
}

async function deletePresupuesto({ supabase, id_usuario }, id) {
  const parsedId = parseInt(id, 10);
  if (!Number.isFinite(parsedId)) return { ok: false, status: 400, error: 'ID inválido' };
  const { error } = await supabase
    .from('presupuesto')
    .delete()
    .eq('id_presupuesto', parsedId)
    .eq('id_usuario', id_usuario);
  if (error) throw error;
  return { ok: true };
}

router.get('/', async (req, res) => {
  try {
    const data = await listPresupuestos({ supabase, id_usuario: req.usuario.id_usuario });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await upsertPresupuesto({ supabase, id_usuario: req.usuario.id_usuario }, req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await deletePresupuesto({ supabase, id_usuario: req.usuario.id_usuario }, req.params.id);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.listPresupuestos = listPresupuestos;
module.exports.upsertPresupuesto = upsertPresupuesto;
module.exports.deletePresupuesto = deletePresupuesto;
