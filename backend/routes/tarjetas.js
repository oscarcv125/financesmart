const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

const TIPOS_VALIDOS = ['Débito', 'Crédito'];

router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tarjeta')
      .select(`
        id_tarjeta,
        nombre,
        tipo,
        movimiento_financiero (
          monto,
          tipo,
          fecha,
          descripcion,
          categoria (nombre)
        )
      `)
      .eq('id_usuario', req.usuario.id_usuario);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const nombre = (req.body?.nombre || '').toString().trim();
    const tipo = (req.body?.tipo || '').toString().trim();
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' });
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return res.status(400).json({ error: `Tipo debe ser ${TIPOS_VALIDOS.join(' o ')}` });
    }

    const { data, error } = await supabase
      .from('tarjeta')
      .insert([{ nombre, tipo, id_usuario: req.usuario.id_usuario }])
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
    if (typeof req.body?.nombre === 'string') {
      const n = req.body.nombre.trim();
      if (!n) return res.status(400).json({ error: 'Nombre no puede estar vacío' });
      patch.nombre = n;
    }
    if (typeof req.body?.tipo === 'string') {
      if (!TIPOS_VALIDOS.includes(req.body.tipo)) {
        return res.status(400).json({ error: `Tipo debe ser ${TIPOS_VALIDOS.join(' o ')}` });
      }
      patch.tipo = req.body.tipo;
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'Nada para actualizar' });
    }

    const { data, error } = await supabase
      .from('tarjeta')
      .update(patch)
      .eq('id_tarjeta', id)
      .eq('id_usuario', req.usuario.id_usuario)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Tarjeta no encontrada' });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });

    const { count } = await supabase
      .from('movimiento_financiero')
      .select('id', { count: 'exact', head: true })
      .eq('id_tarjeta', id)
      .eq('id_usuario', req.usuario.id_usuario);

    if ((count || 0) > 0) {
      return res.status(409).json({
        error: 'La tarjeta tiene movimientos asociados. Elimina los movimientos primero.',
      });
    }

    const { error } = await supabase
      .from('tarjeta')
      .delete()
      .eq('id_tarjeta', id)
      .eq('id_usuario', req.usuario.id_usuario);

    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;