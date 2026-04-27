const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

router.get('/audit', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recurrencia')
      .select('id_recurrencia, descripcion, monto, tipo, dia_del_mes, activo, categoria(nombre)')
      .eq('id_usuario', req.usuario.id_usuario)
      .eq('activo', true);
    if (error) throw error;

    const items = (data || []).map(r => {
      const monthly = Math.abs(Number(r.monto));
      return {
        id: r.id_recurrencia,
        descripcion: r.descripcion,
        tipo: r.tipo,
        dia_del_mes: r.dia_del_mes,
        categoria: r.categoria?.nombre || 'Sin categoría',
        monthly,
        annual: monthly * 12,
      };
    });

    const gastos = items.filter(i => i.tipo?.toLowerCase() === 'gasto');
    const totalMonthly = gastos.reduce((a, i) => a + i.monthly, 0);
    const totalAnnual = totalMonthly * 12;

    res.json({
      items: gastos.sort((a, b) => b.annual - a.annual),
      totalMonthly,
      totalAnnual,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
