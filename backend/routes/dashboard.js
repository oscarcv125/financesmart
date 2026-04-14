const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver'); 

router.get('/', async (req, res) => {
  try {
    const id_usuario = 1; 
    const { tarjetaId } = req.query;

    //Datos del usuario
    const userQuery = supabase.from("usuario").select("*").eq("id_usuario", id_usuario).maybeSingle();
    
    //Movimientos filtrables
    let movsQuery = supabase
      .from("movimiento_financiero")
      .select("*, categoria(nombre)")
      .eq("id_usuario", id_usuario)
      .order("fecha", { ascending: false });

    if (tarjetaId && tarjetaId !== 'null' && tarjetaId !== 'undefined') {
      movsQuery = movsQuery.eq("id_tarjeta", tarjetaId);
    }

    const [userRes, movsRes] = await Promise.all([userQuery, movsQuery]);

    if (userRes.error) throw userRes.error;
    if (movsRes.error) throw movsRes.error;

    const movimientos = movsRes.data || [];

    //Totales
    const ingresos = movimientos
      .filter(m => m.tipo === "Ingreso")
      .reduce((acc, m) => acc + Number(m.monto), 0);

    const gastos = movimientos
      .filter(m => m.tipo === "Gasto")
      .reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);

    res.json({
      nombreUsuario: userRes.data ? `${userRes.data.nombre} ${userRes.data.apellido}` : "Usuario",
      totales: { ingresos, gastos, saldo: ingresos - gastos },
      movimientos,
      tarjetaSeleccionada: tarjetaId || "Global"
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;