const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

function monthBounds(offsetMonths = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offsetMonths;
  const first = new Date(y, m, 1).toISOString().split('T')[0];
  const firstNext = new Date(y, m + 1, 1).toISOString().split('T')[0];
  return { first, firstNext };
}

async function fetchUserFinancialData(id_usuario) {
  const { first: thisFirst, firstNext: thisNext } = monthBounds(0);
  const { first: lastFirst, firstNext: lastNext } = monthBounds(-1);

  const [movsRes, movsLastRes, metasRes, presupuestosRes, recurrenciasRes, tarjetasRes] = await Promise.all([
    supabase
      .from('movimiento_financiero')
      .select('monto, fecha, tipo, descripcion, categoria(nombre)')
      .eq('id_usuario', id_usuario)
      .gte('fecha', thisFirst)
      .lt('fecha', thisNext)
      .order('fecha', { ascending: false }),

    supabase
      .from('movimiento_financiero')
      .select('monto, tipo, id_categoria, categoria(nombre)')
      .eq('id_usuario', id_usuario)
      .gte('fecha', lastFirst)
      .lt('fecha', lastNext),

    supabase
      .from('ahorro_meta')
      .select('id_meta, nombre_meta, monto_objetivo, progreso, fecha_limite')
      .eq('id_usuario', id_usuario)
      .order('id_meta', { ascending: true }),

    supabase
      .from('presupuesto')
      .select('monto, id_categoria, categoria(nombre)')
      .eq('id_usuario', id_usuario),

    supabase
      .from('recurrencia')
      .select('descripcion, monto, tipo, dia_del_mes')
      .eq('id_usuario', id_usuario)
      .eq('activo', true)
      .order('dia_del_mes', { ascending: true }),

    supabase
      .from('tarjeta')
      .select('id_tarjeta, nombre')
      .eq('id_usuario', id_usuario),
  ]);

  const lista = movsRes.data || [];
  const listaLast = movsLastRes.data || [];

  const ingresos = lista
    .filter(m => m.tipo?.toLowerCase() === 'ingreso')
    .reduce((acc, m) => acc + Number(m.monto), 0);
  const gastos = lista
    .filter(m => m.tipo?.toLowerCase() === 'gasto')
    .reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);

  const ingresosLast = listaLast
    .filter(m => m.tipo?.toLowerCase() === 'ingreso')
    .reduce((acc, m) => acc + Number(m.monto), 0);
  const gastosLast = listaLast
    .filter(m => m.tipo?.toLowerCase() === 'gasto')
    .reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);

  const gastosPorCat = {};
  lista
    .filter(m => m.tipo?.toLowerCase() === 'gasto')
    .forEach(m => {
      const cat = m.categoria?.nombre || 'Otros';
      gastosPorCat[cat] = (gastosPorCat[cat] || 0) + Math.abs(Number(m.monto));
    });

  const topCategorias = Object.entries(gastosPorCat)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([nombre, monto]) => `- ${nombre}: $${monto.toFixed(2)}`)
    .join('\n');

  const movRecientes = lista.slice(0, 10).map(m =>
    `| ${m.fecha?.split('T')[0]} | ${m.descripcion || '-'} | ${m.tipo} | $${Math.abs(Number(m.monto)).toFixed(2)} |`
  ).join('\n');

  const metasRaw = metasRes.data || [];
  const metas = metasRaw.map(m => {
    const pct = m.monto_objetivo > 0
      ? Math.round((Number(m.progreso) / Number(m.monto_objetivo)) * 100)
      : 0;
    const vence = m.fecha_limite ? ` · vence ${m.fecha_limite}` : '';
    return `- ${m.nombre_meta}: $${Number(m.progreso).toFixed(2)} / $${Number(m.monto_objetivo).toFixed(2)} (${pct}%)${vence}`;
  }).join('\n');

  const recurrenciasRaw = recurrenciasRes.data || [];
  const recurrencias = recurrenciasRaw.map(r =>
    `- ${r.descripcion}: $${Math.abs(Number(r.monto)).toFixed(2)} (${r.tipo}, día ${r.dia_del_mes} de cada mes)`
  ).join('\n');

  const presupuestosRaw = presupuestosRes.data || [];
  const presupuestoTotal = presupuestosRaw.reduce((acc, p) => acc + Number(p.monto), 0);
  const presupuestos = presupuestosRaw.map(p => {
    const catNombre = p.categoria?.nombre || 'Sin categoría';
    const gastado = gastosPorCat[catNombre] || 0;
    const limite = Number(p.monto);
    const pct = limite > 0 ? Math.round((gastado / limite) * 100) : 0;
    const alerta = pct >= 100 ? ' ⚠️ EXCEDIDO' : pct >= 80 ? ' ⚠️ cerca del límite' : '';
    return `- ${catNombre}: $${gastado.toFixed(2)} gastados / $${limite.toFixed(2)} presupuestado (${pct}%)${alerta}`;
  }).join('\n');

  const tarjetasRaw = tarjetasRes.data || [];

  return {
    saldo: ingresos - gastos,
    ingresos,
    gastos,
    ingresosLast,
    gastosLast,
    topCategorias,
    movRecientes,
    metas,
    presupuestos,
    recurrencias,
    metasRaw,
    tarjetasRaw,
    recurrenciasRaw,
    presupuestoTotal
  };
}

function calculateForecast(data) {
  const now = new Date();
  const today = now.getDate();
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  const daysPassed = Math.max(1, today);
  const daysRemaining = totalDays - today;
  
  // Daily average based on current month spend
  const dailyAvg = data.gastos / daysPassed;
  const projectedVariable = dailyAvg * daysRemaining;
  
  // Fixed costs remaining (upcoming recurrences)
  const upcomingRecurrencias = (data.recurrenciasRaw || [])
    .filter(r => r.dia_del_mes > today)
    .reduce((acc, r) => acc + Math.abs(Number(r.monto)), 0);
    
  const totalProjected = data.gastos + projectedVariable + upcomingRecurrencias;
  const vsBudget = data.presupuestoTotal > 0 
    ? Math.round((totalProjected / data.presupuestoTotal) * 100) 
    : 0;

  return {
    dailyAvg,
    projectedVariable,
    upcomingRecurrencias,
    totalProjected,
    daysRemaining,
    vsBudget
  };
}

// Generates contextual action suggestions for coach mode based on real financial data
function suggestCoachActions(data) {
  const actions = [];
  const { metasRaw, tarjetasRaw, saldo } = data;

  // Need at least one tarjeta to make contributions
  if (tarjetasRaw.length > 0) {
    const incompletas = metasRaw
      .filter(m => Number(m.progreso) < Number(m.monto_objetivo))
      .sort((a, b) => {
        const pa = a.monto_objetivo > 0 ? a.progreso / a.monto_objetivo : 0;
        const pb = b.monto_objetivo > 0 ? b.progreso / b.monto_objetivo : 0;
        return pb - pa; // closest to completion first
      });

    for (const meta of incompletas.slice(0, 2)) {
      const faltante = Number(meta.monto_objetivo) - Number(meta.progreso);
      // Suggest ~10% of remaining, rounded up to nearest $50, min $50
      let sugerido = Math.ceil((faltante * 0.1) / 50) * 50;
      sugerido = Math.max(50, Math.min(sugerido, faltante));

      actions.push({
        type: 'aportar',
        label: `Aportar $${sugerido.toFixed(0)} a ${meta.nombre_meta}`,
        id_meta: meta.id_meta,
        nombre_meta: meta.nombre_meta,
        monto: sugerido,
      });
    }
  }

  // Suggest creating a goal if none exist and there's a positive balance
  if (metasRaw.length === 0 && saldo > 0) {
    actions.push({
      type: 'nav',
      label: 'Crear mi primera meta de ahorro',
      path: '/metas',
    });
  }

  return actions.slice(0, 3);
}

const CHART_RE = /\[CHART\]\s*([\s\S]*?)\s*\[\/CHART\]/;
const VALID_CHART_TYPES = new Set(['pie', 'bar']);

function extractChart(text) {
  const match = text.match(CHART_RE);
  if (!match) return { text, chart: null };

  const cleanText = text.replace(CHART_RE, '').trim();
  try {
    const raw = JSON.parse(match[1].trim());
    if (!VALID_CHART_TYPES.has(raw.type)) return { text: cleanText, chart: null };
    if (!raw.title || typeof raw.title !== 'string') return { text: cleanText, chart: null };
    if (!Array.isArray(raw.data) || raw.data.length === 0 || raw.data.length > 8) return { text: cleanText, chart: null };
    if (!raw.data.every(d => typeof d.name === 'string' && typeof d.value === 'number')) return { text: cleanText, chart: null };
    return { text: cleanText, chart: raw };
  } catch {
    return { text: cleanText, chart: null };
  }
}

function pct(current, previous) {
  if (previous === 0) return current > 0 ? '+100%' : '0%';
  const delta = ((current - previous) / previous) * 100;
  return (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%';
}

function buildSystemPrompt(mode, nombre, data) {
  const now = new Date();
  const mesActual = now.toLocaleString('es-MX', { month: 'long', year: 'numeric' });

  const contexto = `
=== ESTADO FINANCIERO – ${mesActual.toUpperCase()} ===
- Ingresos: $${data.ingresos.toFixed(2)} MXN (${pct(data.ingresos, data.ingresosLast)} vs mes anterior)
- Gastos:   $${data.gastos.toFixed(2)} MXN (${pct(data.gastos, data.gastosLast)} vs mes anterior)
- Saldo:    $${data.saldo.toFixed(2)} MXN

=== MOVIMIENTOS RECIENTES (este mes) ===
| Fecha | Descripción | Tipo | Monto |
|-------|-------------|------|-------|
${data.movRecientes || '(sin movimientos)'}

=== TOP CATEGORÍAS DE GASTO ===
${data.topCategorias || 'Sin gastos registrados'}

=== PRESUPUESTOS (avance del mes) ===
${data.presupuestos || 'Sin presupuestos configurados'}

=== METAS DE AHORRO ===
${data.metas || 'Sin metas configuradas'}

=== CARGOS RECURRENTES ACTIVOS ===
${data.recurrencias || 'Sin recurrencias activas'}

=== PROYECCIÓN DE FIN DE MES ===
- Gasto proyectado total: $${data.forecast.totalProjected.toFixed(2)} MXN
- Basado en: $${data.forecast.dailyAvg.toFixed(2)}/día de gasto variable + $${data.forecast.upcomingRecurrencias.toFixed(2)} de pagos fijos pendientes.
- Días restantes: ${data.forecast.daysRemaining}
- Estado vs presupuesto total: ${data.forecast.vsBudget}% consumido proyectado.
`;

  const chartInstructions = `
=== INSTRUCCIÓN DE GRÁFICAS ===
Cuando tu respuesta muestre un desglose, comparación o distribución de datos financieros, añade AL FINAL de tu respuesta un bloque con este formato exacto:
[CHART]
{"type":"pie","title":"Título corto","data":[{"name":"Categoría","value":1234}]}
[/CHART]
Tipos válidos: "pie" (distribuciones/desgloses), "bar" (comparaciones entre periodos o categorías).
Para barras con dos series usa "value" y "value2". Máx 7 elementos. Nombres máx 12 caracteres. JSON en una sola línea.
NO incluyas gráfica para saludos, consejos generales o preguntas simples de saldo.`;

  if (mode === 'analyst') {
    return `Eres FinanceSmart AI en modo ANALISTA FINANCIERO para el usuario ${nombre}.
Responde SIEMPRE en español, de forma objetiva, precisa y profesional.
No des consejos no solicitados a menos que el usuario los pida explícitamente.
Mantén un tono neutro. No inventes datos fuera del contexto financiero proporcionado.
Si el usuario no ha enviado mensajes aún (primera interacción), proporciona un resumen financiero breve y objetivo: saldo, variación vs mes anterior, presupuestos cerca del límite o excedidos, y metas con progreso destacable. Sin opiniones.
${contexto}${chartInstructions}`;
  }

  return `Eres FinanceSmart AI en modo COACH FINANCIERO para el usuario ${nombre}.
Responde SIEMPRE en español, de forma motivadora y cercana.
Usa los datos financieros reales del usuario para proponer acciones concretas y alcanzables.
Relaciona siempre tus consejos con sus metas de ahorro, sus presupuestos y sus cargos recurrentes.
No inventes datos fuera del contexto financiero proporcionado.
${contexto}${chartInstructions}`;
}

router.post('/', async (req, res) => {
  const { message, history = [], mode = 'coach' } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }
  if (message.length > 1000) {
    return res.status(400).json({ error: 'Mensaje demasiado largo (máx 1000 caracteres)' });
  }
  if (!Array.isArray(history) || history.length > 50) {
    return res.status(400).json({ error: 'Historial inválido' });
  }

  try {
    const nombre = `${req.usuario.nombre} ${req.usuario.apellido}`;
    const financialData = await fetchUserFinancialData(req.usuario.id_usuario);
    financialData.forecast = calculateForecast(financialData);
    const systemPrompt = buildSystemPrompt(mode, nombre, financialData);

    const newHistory = [...history, { role: 'user', parts: [{ text: message }] }];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: newHistory,
        }),
      }
    );

    if (!geminiRes.ok) {
      throw new Error(`Gemini error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const rawReply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
    const { text: reply, chart } = extractChart(rawReply);

    const actions = mode === 'coach' ? suggestCoachActions(financialData) : [];
    const tarjetas = mode === 'coach'
      ? financialData.tarjetasRaw.map(t => ({ id: t.id_tarjeta, nombre: t.nombre }))
      : [];

    res.json({ reply, chart, actions, tarjetas });
  } catch (error) {
    console.error('Error en chatbot:', error.message);
    res.status(500).json({ error: 'Error al procesar la consulta' });
  }
});

module.exports = router;
module.exports.extractChart = extractChart;
