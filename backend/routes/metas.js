const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

async function listMetas({ supabase, id_usuario }) {
  const { data, error } = await supabase
    .from('ahorro_meta')
    .select('*')
    .eq('id_usuario', id_usuario)
    .order('id_meta', { ascending: true });
  if (error) throw error;
  return data;
}

async function createMeta({ supabase, id_usuario }, body) {
  const { nombre, meta, fecha } = body || {};
  if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
    return { ok: false, status: 400, error: 'El nombre de la meta es requerido' };
  }
  const montoObjetivo = parseFloat(meta);
  if (isNaN(montoObjetivo) || montoObjetivo <= 0) {
    return { ok: false, status: 400, error: 'El monto objetivo debe ser un número positivo' };
  }
  const { data, error } = await supabase
    .from('ahorro_meta')
    .insert([{
      nombre_meta: nombre.trim(),
      monto_objetivo: montoObjetivo,
      progreso: 0,
      fecha_limite: fecha || null,
      id_usuario,
    }])
    .select();
  if (error) throw error;
  return { ok: true, data: data[0] };
}

async function aportarMeta({ supabase, id_usuario }, { id_meta, monto, id_tarjeta }) {
  if (!id_tarjeta) {
    return { ok: false, status: 400, error: 'No hay una tarjeta seleccionada para realizar el cobro.' };
  }
  const montoAporte = parseFloat(monto);
  if (isNaN(montoAporte) || montoAporte <= 0) {
    return { ok: false, status: 400, error: 'El monto del aporte debe ser un número positivo' };
  }

  const { data: tarjetaCheck, error: tarjetaErr } = await supabase
    .from('tarjeta')
    .select('id_tarjeta')
    .eq('id_tarjeta', id_tarjeta)
    .eq('id_usuario', id_usuario)
    .maybeSingle();
  if (tarjetaErr) throw tarjetaErr;
  if (!tarjetaCheck) {
    return { ok: false, status: 403, error: 'Tarjeta no válida o no autorizada' };
  }

  const { data: metaActual, error: getError } = await supabase
    .from('ahorro_meta')
    .select('progreso, nombre_meta, id_usuario')
    .eq('id_meta', id_meta)
    .single();
  if (getError) throw getError;
  if (metaActual.id_usuario !== id_usuario) {
    return { ok: false, status: 403, error: 'No autorizado' };
  }

  const progresoAnterior = metaActual.progreso || 0;
  const nuevoProgreso = progresoAnterior + montoAporte;
  const { error: updateError } = await supabase
    .from('ahorro_meta')
    .update({ progreso: nuevoProgreso })
    .eq('id_meta', id_meta);
  if (updateError) throw updateError;

  const { data: categoriaSave } = await supabase
    .from('categoria')
    .select('id_categoria')
    .ilike('nombre', '%ahorro%')
    .limit(1)
    .maybeSingle();

  const { error: movError } = await supabase
    .from('movimiento_financiero')
    .insert([{
      id_usuario,
      id_tarjeta,
      id_categoria: categoriaSave?.id_categoria || null,
      monto: -montoAporte,
      tipo: 'gasto',
      descripcion: `Ahorro: ${metaActual.nombre_meta}`,
      fecha: new Date().toISOString(),
    }]);
  if (movError) {
    // Manual rollback — Supabase JS client has no native transactions.
    // We restore progreso so the meta isn't ahead of recorded movements.
    await supabase
      .from('ahorro_meta')
      .update({ progreso: progresoAnterior })
      .eq('id_meta', id_meta);
    throw movError;
  }

  return { ok: true, data: { success: true, nuevoProgreso } };
}

async function deleteMeta({ supabase, id_usuario }, id) {
  const { error } = await supabase
    .from('ahorro_meta')
    .delete()
    .eq('id_meta', id)
    .eq('id_usuario', id_usuario);
  if (error) throw error;
  return { ok: true };
}

router.get('/', async (req, res) => {
  try {
    const data = await listMetas({ supabase, id_usuario: req.usuario.id_usuario });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const result = await createMeta({ supabase, id_usuario: req.usuario.id_usuario }, req.body);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/aportar', async (req, res) => {
  try {
    const result = await aportarMeta(
      { supabase, id_usuario: req.usuario.id_usuario },
      { id_meta: req.params.id, monto: req.body?.monto, id_tarjeta: req.body?.id_tarjeta },
    );
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json(result.data);
  } catch (error) {
    console.error('Error en aporte:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deleteMeta({ supabase, id_usuario: req.usuario.id_usuario }, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.listMetas = listMetas;
module.exports.createMeta = createMeta;
module.exports.aportarMeta = aportarMeta;
module.exports.deleteMeta = deleteMeta;
