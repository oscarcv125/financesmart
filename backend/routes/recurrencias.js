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

async function materializar(id_usuario) {
  const { data: recs, error } = await supabase
    .from('recurrencia')
    .select('*')
    .eq('id_usuario', id_usuario)
    .eq('activo', true);
  if (error) throw error;

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
}

router.get('/', async (req, res) => {
  try {
    await materializar(req.usuario.id_usuario);
    const { data, error } = await supabase
      .from('recurrencia')
      .select('id_recurrencia, descripcion, monto, tipo, dia_del_mes, activo, fecha_inicio, ultima_ejecucion, id_tarjeta, id_categoria, tarjeta(nombre), categoria(nombre)')
      .eq('id_usuario', req.usuario.id_usuario)
      .order('id_recurrencia', { ascending: false });
    if (error) throw error;
    res.json(data);
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
    const dia_del_mes = parseInt(req.body?.dia_del_mes, 10);
    const fecha_inicio = req.body?.fecha_inicio || new Date().toISOString().split('T')[0];

    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido' });
    if (!Number.isFinite(monto) || monto <= 0) return res.status(400).json({ error: 'Monto debe ser positivo' });
    if (!descripcion) return res.status(400).json({ error: 'Descripción requerida' });
    if (!Number.isFinite(id_tarjeta)) return res.status(400).json({ error: 'Tarjeta requerida' });
    if (!Number.isFinite(dia_del_mes) || dia_del_mes < 1 || dia_del_mes > 28) {
      return res.status(400).json({ error: 'Día debe estar entre 1 y 28' });
    }

    const { data, error } = await supabase
      .from('recurrencia')
      .insert([{
        id_usuario: req.usuario.id_usuario,
        id_tarjeta, id_categoria,
        descripcion, monto, tipo,
        dia_del_mes, fecha_inicio,
        activo: true,
      }])
      .select()
      .maybeSingle();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    const patch = {};
    if (typeof req.body?.activo === 'boolean') patch.activo = req.body.activo;
    if (Object.keys(patch).length === 0) return res.status(400).json({ error: 'Nada para actualizar' });

    const { data, error } = await supabase
      .from('recurrencia')
      .update(patch)
      .eq('id_recurrencia', id)
      .eq('id_usuario', req.usuario.id_usuario)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'No encontrado' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });
    const { error } = await supabase
      .from('recurrencia')
      .delete()
      .eq('id_recurrencia', id)
      .eq('id_usuario', req.usuario.id_usuario);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
