const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

function monthBounds(offset = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const first = new Date(y, m, 1).toISOString().split('T')[0];
  const firstNext = new Date(y, m + 1, 1).toISOString().split('T')[0];
  return { first, firstNext };
}

router.get('/', async (req, res) => {
  try {
    const id_usuario = req.usuario.id_usuario;
    const insights = [];

    const { first: thisFirst, firstNext: thisNext } = monthBounds(0);
    const { first: lastFirst, firstNext: lastNext } = monthBounds(-1);

    const [movsThisRes, movsLastRes, presupuestosRes, recurrenciasRes] = await Promise.all([
      supabase
        .from('movimiento_financiero')
        .select('monto, tipo, descripcion, fecha, id_categoria, categoria(nombre)')
        .eq('id_usuario', id_usuario)
        .gte('fecha', thisFirst)
        .lt('fecha', thisNext),
      supabase
        .from('movimiento_financiero')
        .select('monto, tipo, id_categoria, categoria(nombre)')
        .eq('id_usuario', id_usuario)
        .gte('fecha', lastFirst)
        .lt('fecha', lastNext),
      supabase
        .from('presupuesto')
        .select('monto, id_categoria, categoria(nombre)')
        .eq('id_usuario', id_usuario),
      supabase
        .from('recurrencia')
        .select('descripcion, monto, tipo, dia_del_mes')
        .eq('id_usuario', id_usuario)
        .eq('activo', true),
    ]);

    if (movsThisRes.error) throw movsThisRes.error;
    if (movsLastRes.error) throw movsLastRes.error;

    const thisMovs = movsThisRes.data || [];
    const lastMovs = movsLastRes.data || [];

    const today = new Date();
    const day = today.getDate();
    const totalDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const monthFraction = day / totalDays;

    // 1. Budget overrun warnings
    const gastosThisByCat = {};
    thisMovs.filter(m => m.tipo?.toLowerCase() === 'gasto').forEach(m => {
      const k = m.id_categoria;
      gastosThisByCat[k] = (gastosThisByCat[k] || 0) + Math.abs(Number(m.monto));
    });
    for (const p of presupuestosRes.data || []) {
      const gastado = gastosThisByCat[p.id_categoria] || 0;
      const limite = Number(p.monto);
      const pct = limite > 0 ? gastado / limite : 0;
      if (pct >= 1) {
        insights.push({
          severity: 'high',
          icon: '🚨',
          title: `Excediste el presupuesto de ${p.categoria?.nombre || 'una categoría'}`,
          detail: `Gastaste $${gastado.toFixed(0)} de $${limite.toFixed(0)} (${Math.round(pct * 100)}%).`,
        });
      } else if (pct >= 0.85 && monthFraction < 0.85) {
        insights.push({
          severity: 'medium',
          icon: '⚠️',
          title: `Cerca del límite en ${p.categoria?.nombre || 'una categoría'}`,
          detail: `Llevas ${Math.round(pct * 100)}% del presupuesto y aún quedan ${totalDays - day} días del mes.`,
        });
      }
    }

    // 2. Category spending jumps vs last month (>50% increase, min $300 absolute)
    const gastosLastByCat = {};
    lastMovs.filter(m => m.tipo?.toLowerCase() === 'gasto').forEach(m => {
      const k = m.id_categoria;
      gastosLastByCat[k] = (gastosLastByCat[k] || 0) + Math.abs(Number(m.monto));
    });
    const catNames = {};
    for (const m of [...thisMovs, ...lastMovs]) {
      if (m.id_categoria && m.categoria?.nombre) catNames[m.id_categoria] = m.categoria.nombre;
    }
    for (const [catId, thisAmt] of Object.entries(gastosThisByCat)) {
      const lastAmt = gastosLastByCat[catId] || 0;
      const projected = monthFraction > 0 ? thisAmt / monthFraction : thisAmt;
      if (lastAmt > 0 && projected >= lastAmt * 1.5 && (projected - lastAmt) >= 300) {
        const pct = Math.round(((projected - lastAmt) / lastAmt) * 100);
        insights.push({
          severity: 'medium',
          icon: '📈',
          title: `Gastas mucho más en ${catNames[catId] || 'una categoría'}`,
          detail: `Vas un ${pct}% arriba del mes pasado (proyectado $${projected.toFixed(0)} vs $${lastAmt.toFixed(0)}).`,
        });
      }
    }

    // 3. Upcoming recurrencias in next 5 days
    const recsList = recurrenciasRes.data || [];
    const upcomingRecs = recsList.filter(r => {
      const d = r.dia_del_mes;
      return d >= day && d <= day + 5;
    });
    if (upcomingRecs.length > 0) {
      const total = upcomingRecs.reduce((acc, r) => acc + Math.abs(Number(r.monto)), 0);
      insights.push({
        severity: 'low',
        icon: '📅',
        title: `${upcomingRecs.length} cargo${upcomingRecs.length > 1 ? 's' : ''} recurrente${upcomingRecs.length > 1 ? 's' : ''} en los próximos días`,
        detail: `Total: $${total.toFixed(0)}. Incluye: ${upcomingRecs.map(r => r.descripcion).slice(0, 3).join(', ')}.`,
      });
    }

    insights.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return (order[a.severity] || 99) - (order[b.severity] || 99);
    });

    res.json({ insights: insights.slice(0, 5) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
