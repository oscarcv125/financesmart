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

router.get('/', async (req, res) => {
  try {
    const { tarjetaId, desde, hasta, tipo, limit } = req.query;
    let q = supabase
      .from('movimiento_financiero')
      .select('id, monto, tipo, fecha, descripcion, id_tarjeta, id_categoria, categoria(nombre), tarjeta(nombre)')
      .eq('id_usuario', req.usuario.id_usuario)
      .order('fecha', { ascending: false });

    if (tarjetaId && tarjetaId !== 'null') q = q.eq('id_tarjeta', tarjetaId);
    if (desde) q = q.gte('fecha', desde);
    if (hasta) q = q.lte('fecha', hasta);
    if (tipo && TIPOS.includes(String(tipo).toLowerCase())) q = q.eq('tipo', String(tipo).toLowerCase());
    const lim = parseInt(limit, 10);
    if (Number.isFinite(lim) && lim > 0) q = q.limit(Math.min(lim, 500));

    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('movimiento_financiero')
      .select('id, fecha, tipo, monto, descripcion, categoria(nombre), tarjeta(nombre)')
      .eq('id_usuario', req.usuario.id_usuario)
      .order('fecha', { ascending: false });
    if (error) throw error;

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
    const tipo = String(req.body?.tipo || '').toLowerCase();
    const monto = parseFloat(req.body?.monto);
    const descripcion = (req.body?.descripcion || '').toString().trim();
    const id_tarjeta = parseInt(req.body?.id_tarjeta, 10);
    const id_categoria = req.body?.id_categoria ? parseInt(req.body.id_categoria, 10) : null;
    const fecha = req.body?.fecha || new Date().toISOString().split('T')[0];

    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo debe ser ingreso o gasto' });
    if (!Number.isFinite(monto) || monto <= 0) return res.status(400).json({ error: 'Monto debe ser positivo' });
    if (!descripcion) return res.status(400).json({ error: 'Descripción es requerida' });
    if (!Number.isFinite(id_tarjeta)) return res.status(400).json({ error: 'Selecciona una tarjeta' });

    const { data: tarjeta } = await supabase
      .from('tarjeta')
      .select('id_tarjeta')
      .eq('id_tarjeta', id_tarjeta)
      .eq('id_usuario', req.usuario.id_usuario)
      .maybeSingle();
    if (!tarjeta) return res.status(404).json({ error: 'Tarjeta no encontrada' });

    const montoFinal = tipo === 'gasto' ? -Math.abs(monto) : Math.abs(monto);

    const { data, error } = await supabase
      .from('movimiento_financiero')
      .insert([{
        id_usuario: req.usuario.id_usuario,
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
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    const { error } = await supabase
      .from('movimiento_financiero')
      .delete()
      .eq('id', id)
      .eq('id_usuario', req.usuario.id_usuario);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
