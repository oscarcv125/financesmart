const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');


//Obtener las metas
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
  
  try {
    const { data, error } = await supabase
      .from('ahorro_meta')
      .insert([{ 
        nombre_meta: nombre, 
        monto_objetivo: parseFloat(meta), 
        progreso: 0, 
        fecha_limite: fecha, 
        id_usuario: req.usuario.id_usuario
      }])
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Aporte a las metas con cobro a tarjeta
router.patch('/:id/aportar', async (req, res) => {
  const { monto, id_tarjeta } = req.body;
  const { id } = req.params;

  // Validación de seguridad
  if (!id_tarjeta) {
    return res.status(400).json({ error: "No hay una tarjeta seleccionada para realizar el cobro." });
  }

  try {
    //Consulta de la meta actual
    const { data: metaActual, error: getError } = await supabase
      .from('ahorro_meta')
      .select('progreso, nombre_meta')
      .eq('id_meta', id)
      .single();

    if (getError) throw getError;

    const montoAporte = parseFloat(monto) || 0;
    const nuevoProgreso = (metaActual.progreso || 0) + montoAporte;

    //Actualizacion del progreso
    const { error: updateError } = await supabase
      .from('ahorro_meta')
      .update({ progreso: nuevoProgreso })
      .eq('id_meta', id);

    if (updateError) throw updateError;

    //Registro del movimiento con ID 29
    const { error: movError } = await supabase
      .from('movimiento_financiero')
      .insert([{
        id_usuario: req.usuario.id_usuario,
        id_tarjeta: id_tarjeta,
        id_categoria: 29, 
        monto: -montoAporte,
        tipo: 'Gasto',
        descripcion: `Ahorro: ${metaActual.nombre_meta}`,
        fecha: new Date().toISOString()
      }]);

    if (movError) throw movError;
    
    res.json({ success: true, nuevoProgreso });
  } catch (error) {
    console.error("Error en aporte:", error.message);
    res.status(500).json({ error: error.message });
  }
});

//Eliminar meta
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('ahorro_meta')
      .delete()
      .eq('id_meta', req.params.id);
      
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;