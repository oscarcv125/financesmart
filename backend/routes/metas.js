const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ahorro_meta')
      .select('*')
      .eq('id_usuario', req.usuario.id_usuario)
      .order('id_meta', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  const { nombre, meta, fecha } = req.body;

  if (!nombre || typeof nombre !== 'string' || nombre.trim().length === 0) {
    return res.status(400).json({ error: 'El nombre de la meta es requerido' });
  }
  const montoObjetivo = parseFloat(meta);
  if (isNaN(montoObjetivo) || montoObjetivo <= 0) {
    return res.status(400).json({ error: 'El monto objetivo debe ser un número positivo' });
  }

  try {
    const { data, error } = await supabase
      .from('ahorro_meta')
      .insert([{
        nombre_meta: nombre.trim(),
        monto_objetivo: montoObjetivo,
        progreso: 0,
        fecha_limite: fecha || null,
        id_usuario: req.usuario.id_usuario
      }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/aportar', async (req, res) => {
  const { monto, id_tarjeta } = req.body;
  const { id } = req.params;

  if (!id_tarjeta) {
    return res.status(400).json({ error: 'No hay una tarjeta seleccionada para realizar el cobro.' });
  }
  const montoAporte = parseFloat(monto);
  if (isNaN(montoAporte) || montoAporte <= 0) {
    return res.status(400).json({ error: 'El monto del aporte debe ser un número positivo' });
  }

  try {
    const { data: metaActual, error: getError } = await supabase
      .from('ahorro_meta')
      .select('progreso, nombre_meta, id_usuario')
      .eq('id_meta', id)
      .single();

    if (getError) throw getError;
    if (metaActual.id_usuario !== req.usuario.id_usuario) {
      return res.status(403).json({ error: 'No autorizado' });
    }

    const nuevoProgreso = (metaActual.progreso || 0) + montoAporte;

    const { error: updateError } = await supabase
      .from('ahorro_meta')
      .update({ progreso: nuevoProgreso })
      .eq('id_meta', id);

    if (updateError) throw updateError;

    // Resolve savings category ID dynamically
    const { data: categoriaSave } = await supabase
      .from('categoria')
      .select('id_categoria')
      .ilike('nombre', '%ahorro%')
      .limit(1)
      .maybeSingle();

    const { error: movError } = await supabase
      .from('movimiento_financiero')
      .insert([{
        id_usuario: req.usuario.id_usuario,
        id_tarjeta,
        id_categoria: categoriaSave?.id_categoria || null,
        monto: -montoAporte,
        tipo: 'gasto',
        descripcion: `Ahorro: ${metaActual.nombre_meta}`,
        fecha: new Date().toISOString()
      }]);

    if (movError) throw movError;

    res.json({ success: true, nuevoProgreso });
  } catch (error) {
    console.error('Error en aporte:', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('ahorro_meta')
      .delete()
      .eq('id_meta', req.params.id)
      .eq('id_usuario', req.usuario.id_usuario);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
