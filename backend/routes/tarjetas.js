const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');


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
      .eq('id_usuario', req.usuario.id_usuario);

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;