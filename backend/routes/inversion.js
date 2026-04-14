const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver'); 

router.get('/lista', async (req, res) => {

  try {
    
    const { data, error } = await supabase
    .from("inversion")
    .select("*");

    if (error) throw error;

    //JSON para el frontend
    const respuesta = data.map(inv => ({
    nombre : inv.nombre,
    riesgo: inv.nivel_riesgo === 1 ? "Bajo" : inv.nivel_riesgo === 3 ? "Alto" : "Medio",        
    roi : inv.rendimiento_estimado,
    plazo : inv.plazo
    }));
    
    res.json(respuesta);

  } catch (error) {
    console.error("ERROR EN INVERSIONES:", error.message);
    res.status(500).json({ 
      error: "Error al obtener las inversiones", 
      detalle: error.message 
    });
  }
});

module.exports = router;