const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

function monthBounds() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1).toISOString().split('T')[0];
  const firstNext = new Date(y, m + 1, 1).toISOString().split('T')[0];
  return { first, firstNext };
}

function computeScore(ingresos, gastos, presupuestos, gastosPorCat, metas) {
  // 1. Savings rate (40 pts) — hitting a 20% savings rate earns the full 40
  let savings = 0;
  if (ingresos > 0) {
    const rate = (ingresos - gastos) / ingresos;
    savings = Math.max(0, Math.min(40, (rate / 0.20) * 40));
  }

  // 2. Budget adherence (35 pts) — neutral 17.5 when no budgets are configured
  let budget = 17.5;
  if (presupuestos.length > 0) {
    const adherences = presupuestos.map(p => {
      const limite = Number(p.monto);
      const gastado = gastosPorCat[p.categoria?.nombre || ''] || 0;
      return limite > 0 ? Math.max(0, Math.min(1, 1 - gastado / limite)) : 1;
    });
    budget = (adherences.reduce((a, b) => a + b, 0) / adherences.length) * 35;
  }

  // 3. Goal progress (25 pts) — 0 when no goals exist, to encourage creating them
  let goals = 0;
  if (metas.length > 0) {
    const progresses = metas.map(m =>
      m.monto_objetivo > 0 ? Math.min(1, Number(m.progreso) / Number(m.monto_objetivo)) : 0
    );
    goals = (progresses.reduce((a, b) => a + b, 0) / progresses.length) * 25;
  }

  const score = Math.round(savings + budget + goals);

  let grade, color;
  if (score >= 80)      { grade = 'Excelente';          color = 'green';  }
  else if (score >= 60) { grade = 'Bueno';               color = 'yellow'; }
  else if (score >= 40) { grade = 'Regular';             color = 'orange'; }
  else                  { grade = 'Necesita atención';   color = 'red';    }

  return {
    score,
    grade,
    color,
    breakdown: {
      ahorro:       Math.round(savings),
      presupuestos: Math.round(budget),
      metas:        Math.round(goals),
    },
  };
}

router.get('/', async (req, res) => {
  try {
    const id_usuario = req.usuario.id_usuario;
    const { first, firstNext } = monthBounds();

    const [movsRes, presupuestosRes, metasRes] = await Promise.all([
      supabase
        .from('movimiento_financiero')
        .select('monto, tipo, categoria(nombre)')
        .eq('id_usuario', id_usuario)
        .gte('fecha', first)
        .lt('fecha', firstNext),

      supabase
        .from('presupuesto')
        .select('monto, id_categoria, categoria(nombre)')
        .eq('id_usuario', id_usuario),

      supabase
        .from('ahorro_meta')
        .select('monto_objetivo, progreso')
        .eq('id_usuario', id_usuario),
    ]);

    if (movsRes.error) throw movsRes.error;
    if (presupuestosRes.error) throw presupuestosRes.error;
    if (metasRes.error) throw metasRes.error;

    const movs = movsRes.data || [];
    const ingresos = movs
      .filter(m => m.tipo?.toLowerCase() === 'ingreso')
      .reduce((a, m) => a + Number(m.monto), 0);
    const gastos = movs
      .filter(m => m.tipo?.toLowerCase() === 'gasto')
      .reduce((a, m) => a + Math.abs(Number(m.monto)), 0);

    const gastosPorCat = {};
    movs
      .filter(m => m.tipo?.toLowerCase() === 'gasto')
      .forEach(m => {
        const cat = m.categoria?.nombre || '';
        gastosPorCat[cat] = (gastosPorCat[cat] || 0) + Math.abs(Number(m.monto));
      });

    res.json(computeScore(
      ingresos,
      gastos,
      presupuestosRes.data || [],
      gastosPorCat,
      metasRes.data || []
    ));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.computeScore = computeScore;
