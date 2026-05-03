const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

const TIPOS = ['ingreso', 'gasto'];

function toCsvField(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function listMovimientos({ supabase, id_usuario }, opts = {}) {
  const { tarjetaId, categoriaId, desde, hasta, tipo, limit } = opts;
  let q = supabase
    .from('movimiento_financiero')
    .select('id, monto, tipo, fecha, descripcion, id_tarjeta, id_categoria, categoria(nombre), tarjeta(nombre)')
    .eq('id_usuario', id_usuario)
    .order('fecha', { ascending: false });

  if (tarjetaId && tarjetaId !== 'null') q = q.eq('id_tarjeta', tarjetaId);
  if (categoriaId && categoriaId !== 'null') q = q.eq('id_categoria', categoriaId);
  if (desde) q = q.gte('fecha', desde);
  if (hasta) q = q.lte('fecha', hasta);
  if (tipo && TIPOS.includes(String(tipo).toLowerCase())) q = q.eq('tipo', String(tipo).toLowerCase());
  const lim = parseInt(limit, 10);
  if (Number.isFinite(lim) && lim > 0) q = q.limit(Math.min(lim, 500));

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function exportMovimientos({ supabase, id_usuario }) {
  const { data, error } = await supabase
    .from('movimiento_financiero')
    .select('id, fecha, tipo, monto, descripcion, categoria(nombre), tarjeta(nombre)')
    .eq('id_usuario', id_usuario)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return data;
}

async function createMovimiento({ supabase, id_usuario }, body) {
  const tipo = String(body?.tipo || '').toLowerCase();
  const monto = parseFloat(body?.monto);
  const descripcion = (body?.descripcion || '').toString().trim();
  const id_tarjeta = parseInt(body?.id_tarjeta, 10);
  const id_categoria = body?.id_categoria ? parseInt(body.id_categoria, 10) : null;
  const fecha = body?.fecha || new Date().toISOString().split('T')[0];

  if (!TIPOS.includes(tipo)) return { ok: false, status: 400, error: 'Tipo debe ser ingreso o gasto' };
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, status: 400, error: 'Monto debe ser positivo' };
  if (!descripcion) return { ok: false, status: 400, error: 'Descripción es requerida' };
  if (!Number.isFinite(id_tarjeta)) return { ok: false, status: 400, error: 'Selecciona una tarjeta' };

  const { data: tarjeta } = await supabase
    .from('tarjeta')
    .select('id_tarjeta')
    .eq('id_tarjeta', id_tarjeta)
    .eq('id_usuario', id_usuario)
    .maybeSingle();
  if (!tarjeta) return { ok: false, status: 404, error: 'Tarjeta no encontrada' };

  const montoFinal = tipo === 'gasto' ? -Math.abs(monto) : Math.abs(monto);

  const { data, error } = await supabase
    .from('movimiento_financiero')
    .insert([{
      id_usuario,
      id_tarjeta,
      id_categoria,
      monto: montoFinal,
      tipo,
      descripcion,
      fecha,
    }])
    .select()
    .maybeSingle();
  if (error) throw error;
  return { ok: true, data };
}

async function deleteMovimiento({ supabase, id_usuario }, id) {
  const parsedId = parseInt(id, 10);
  if (!Number.isFinite(parsedId)) return { ok: false, status: 400, error: 'ID inválido' };
  const { error } = await supabase
    .from('movimiento_financiero')
    .delete()
    .eq('id', parsedId)
    .eq('id_usuario', id_usuario);
  if (error) throw error;
  return { ok: true };
}

router.get('/', async (req, res) => {
  try {
    const data = await listMovimientos(
      { supabase, id_usuario: req.usuario.id_usuario },
      req.query,
    );
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const data = await exportMovimientos({ supabase, id_usuario: req.usuario.id_usuario });
    const header = ['id', 'fecha', 'tipo', 'monto', 'descripcion', 'categoria', 'tarjeta'];
    const lines = [header.join(',')];
    for (const m of data || []) {
      lines.push([
        m.id, m.fecha, m.tipo, m.monto, m.descripcion,
        m.categoria?.nombre || '', m.tarjeta?.nombre || '',
      ].map(toCsvField).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="movimientos_${Date.now()}.csv"`);
    res.send(lines.join('\n'));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await createMovimiento({ supabase, id_usuario: req.usuario.id_usuario }, req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(201).json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await deleteMovimiento({ supabase, id_usuario: req.usuario.id_usuario }, req.params.id);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.listMovimientos = listMovimientos;
module.exports.exportMovimientos = exportMovimientos;
module.exports.createMovimiento = createMovimiento;
module.exports.deleteMovimiento = deleteMovimiento;
