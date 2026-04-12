const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver'); 

router.get('/resumen', async (req, res) => {

  try {
    // ID de prueba 
    const id_usuario = 1; 
    console.log(`Buscando datos para el ID_USUARIO: ${id_usuario}`);

    const [userRes, movsRes] = await Promise.all([
      supabase.from("usuario").select("*").eq("id_usuario", id_usuario).maybeSingle(),
      supabase.from("movimiento_financiero").select("*").eq("id_usuario", id_usuario).order("fecha", { ascending: false })
    ]);

    // Verificación de errores
    if (userRes.error) console.error("Error Supabase (Usuario):", userRes.error.message);
    if (movsRes.error) console.error("Error Supabase (Movimientos):", movsRes.error.message);

    const usuario = userRes.data;
    const movimientos = movsRes.data || [];

    const ingresosArr = movimientos.filter(m => m.tipo === "Ingreso");
    const gastosArr = movimientos.filter(m => m.tipo === "Gasto");

    const ingresos = ingresosArr.reduce((acc, m) => acc + Number(m.monto), 0);
    const gastos = gastosArr.reduce((acc, m) => acc + Number(m.monto), 0);

    //JSON para el frontend
    const respuestaFinal = {
      nombreUsuario: usuario ? `${usuario.nombre} ${usuario.apellido}` : "Usuario",
      totales: {
        ingresos,
        gastos,
        saldo: ingresos - gastos
      },
      movimientos
    };
    
    res.json(respuestaFinal);

  } catch (error) {
    console.error("ERROR EN EL BACKEND:", error.message);
    res.status(500).json({ 
      error: "Error interno del servidor", 
      detalle: error.message 
    });
  }
});

module.exports = router;