const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver'); 

router.get('/resumen', async (req, res) => {
  try {
    const id_usuario = req.usuario.id_usuario;
    const { periodo } = req.query; // 'Mensual', 'Trimestral', 'Anual'

    //Calculo de fechas
    let fechaInicio = new Date();
    if (periodo === 'Trimestral') {
      fechaInicio.setMonth(fechaInicio.getMonth() - 3);
    } else if (periodo === 'Anual') {
      fechaInicio.setFullYear(fechaInicio.getFullYear() - 1);
    } else {
      fechaInicio.setMonth(fechaInicio.getMonth() - 1); // Mensual
    }

    //Consulta a Supabase
    const { data: movimientos, error } = await supabase
      .from("movimiento_financiero")
      .select(`
        monto,
        fecha,
        tipo,
        categoria (nombre)
      `)
      .eq("id_usuario", id_usuario)
      .gte("fecha", fechaInicio.toISOString().split('T')[0])
      .order('fecha', { ascending: true });

    if (error) throw error;

    //Proceso de datos para Gráfica de Área
    const mesesNombres = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    const flujoAgrupado = {};

    movimientos.forEach(m => {
      let etiqueta = (periodo === 'Mensual') 
        ? m.fecha.split('-')[2] 
        : mesesNombres[parseInt(m.fecha.split('-')[1]) - 1];

      if (!flujoAgrupado[etiqueta]) {
        flujoAgrupado[etiqueta] = { label: etiqueta, gasto: 0, ingreso: 0, fechaRef: m.fecha };
      }
      
      if (m.tipo === 'Gasto') flujoAgrupado[etiqueta].gasto += Number(m.monto);
      else flujoAgrupado[etiqueta].ingreso += Number(m.monto);
    });

    const gastosDiarios = Object.values(flujoAgrupado);

    //Proceso de datos para Gráfica de Pie
    const catAgrupadas = {};
    movimientos.filter(m => m.tipo === 'Gasto').forEach(m => {
      const nombreCat = m.categoria?.nombre || 'Otros';
      catAgrupadas[nombreCat] = (catAgrupadas[nombreCat] || 0) + Number(m.monto);
    });
    const categorias = Object.keys(catAgrupadas).map(name => ({
      name,
      value: catAgrupadas[name]
    }));

    //Tendencia Mensual
    const tendenciaAgrupada = {};
    movimientos.filter(m => m.tipo === 'Gasto').forEach(m => {
      const mesNombre = mesesNombres[parseInt(m.fecha.split('-')[1]) - 1];
      if (!tendenciaAgrupada[mesNombre]) {
        tendenciaAgrupada[mesNombre] = { mes: mesNombre, gasto: 0, mesNum: parseInt(m.fecha.split('-')[1]) };
      }
      tendenciaAgrupada[mesNombre].gasto += Number(m.monto);
    });
    const gastosMensuales = Object.values(tendenciaAgrupada).sort((a, b) => a.mesNum - b.mesNum);

    res.json({
      gastosDiarios,
      categorias,
      gastosMensuales
    });

  } catch (error) {
    console.error("ERROR EN ANÁLISIS:", error.message);
    res.status(500).json({ error: "Error al procesar análisis" });
  }
});

module.exports = router;