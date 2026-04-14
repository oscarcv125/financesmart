const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

const ID_USUARIO = 1;

// Obtener tarjetas
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
      .eq('id_usuario', ID_USUARIO);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;