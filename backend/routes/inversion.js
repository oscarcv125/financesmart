const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

router.get('/lista', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('inversion')
      .select('*');

    if (error) throw error;

    const respuesta = data.map(inv => ({
      id: inv.id_inversion,
      nombre: inv.nombre,
      riesgo: inv.nivel_riesgo === 1 ? 'Bajo' : inv.nivel_riesgo === 3 ? 'Alto' : 'Medio',
      roi: inv.rendimiento_estimado,
      plazo: inv.plazo
    }));

    res.json(respuesta);
  } catch (error) {
    console.error('ERROR EN INVERSIONES:', error.message);
    res.status(500).json({ error: 'Error al obtener las inversiones' });
  }
});

router.post('/comprar', async (req, res) => {
  const { id_inversion, nombre_inversion, monto, id_tarjeta } = req.body;

  if (!id_tarjeta) {
    return res.status(400).json({ error: 'Selecciona una tarjeta para realizar la inversión' });
  }
  const montoInv = parseFloat(monto);
  if (isNaN(montoInv) || montoInv <= 0) {
    return res.status(400).json({ error: 'El monto debe ser un número positivo' });
  }
  if (!nombre_inversion) {
    return res.status(400).json({ error: 'Datos de inversión incompletos' });
  }

  try {
    const { data: catInv } = await supabase
      .from('categoria')
      .select('id_categoria')
      .ilike('nombre', '%invers%')
      .limit(1)
      .maybeSingle();

    const { error: movError } = await supabase
      .from('movimiento_financiero')
      .insert([{
        id_usuario: req.usuario.id_usuario,
        id_tarjeta,
        id_categoria: catInv?.id_categoria || null,
        monto: -montoInv,
        tipo: 'gasto',
        descripcion: `Inversión: ${nombre_inversion}`,
        fecha: new Date().toISOString()
      }]);

    if (movError) throw movError;

    res.json({ success: true });
  } catch (error) {
    console.error('ERROR AL COMPRAR INVERSIÓN:', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
