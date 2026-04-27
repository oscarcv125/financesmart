const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');
const aiProvider = require('../utils/aiProvider');

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

  const dailyAvg = data.gastos / daysPassed;
  const projectedVariable = dailyAvg * daysRemaining;

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

function suggestCoachActions(data) {
  const actions = [];
  const { metasRaw, tarjetasRaw, saldo } = data;

  if (tarjetasRaw.length > 0) {
    const incompletas = metasRaw
      .filter(m => Number(m.progreso) < Number(m.monto_objetivo))
      .sort((a, b) => {
        const pa = a.monto_objetivo > 0 ? a.progreso / a.monto_objetivo : 0;
        const pb = b.monto_objetivo > 0 ? b.progreso / b.monto_objetivo : 0;
        return pb - pa;
      });

    for (const meta of incompletas.slice(0, 2)) {
      const faltante = Number(meta.monto_objetivo) - Number(meta.progreso);
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

const SIMULATOR_RE = /\[SIMULATOR\]\s*([\s\S]*?)\s*\[\/SIMULATOR\]/;
const VALID_SIM_TYPES = new Set(['savings_daily', 'category_reduction', 'goal_acceleration']);

function extractSimulator(text) {
  const match = text.match(SIMULATOR_RE);
  if (!match) return { text, simulator: null };

  const cleanText = text.replace(SIMULATOR_RE, '').trim();
  try {
    const raw = JSON.parse(match[1].trim());
    if (!VALID_SIM_TYPES.has(raw.type)) return { text: cleanText, simulator: null };
    if (typeof raw.title !== 'string' || !raw.title) return { text: cleanText, simulator: null };
    if (!Array.isArray(raw.params) || raw.params.length === 0 || raw.params.length > 5) {
      return { text: cleanText, simulator: null };
    }
    const validParams = raw.params.every(p =>
      typeof p?.key === 'string' &&
      typeof p?.label === 'string' &&
      typeof p?.value === 'number' &&
      typeof p?.min === 'number' &&
      typeof p?.max === 'number' &&
      typeof p?.step === 'number' &&
      p.max > p.min &&
      p.value >= p.min && p.value <= p.max
    );
    if (!validParams) return { text: cleanText, simulator: null };
    if (raw.meta) {
      const m = raw.meta;
      if (typeof m.name !== 'string' || typeof m.target !== 'number' || typeof m.progress !== 'number') {
        delete raw.meta;
      }
    }
    return { text: cleanText, simulator: raw };
  } catch {
    return { text: cleanText, simulator: null };
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
NO incluyas gráfica para saludos, consejos generales o preguntas simples de saldo.

=== INSTRUCCIÓN DE SIMULADORES INTERACTIVOS ===
Cuando el usuario pregunte "qué pasaría si...", "y si ahorro X al día", "cuánto se acumularía...", o cuando ofrecer una simulación sea útil para coaching, añade AL FINAL de tu respuesta UN bloque con este formato exacto:
[SIMULATOR]
{"type":"savings_daily","title":"Si ahorras todos los días","params":[{"key":"amount","label":"$ al día","value":150,"min":20,"max":500,"step":10,"unit":"MXN"},{"key":"days","label":"Días","value":30,"min":7,"max":90,"step":1}],"meta":{"name":"Viaje a Japón","target":35000,"progress":8200}}
[/SIMULATOR]

Tipos válidos y ESTRUCTURA OBLIGATORIA de params (orden y keys EXACTAS):
- "savings_daily": [{key:"amount",unit:"MXN"},{key:"days"}]. Output = amount × days.
- "category_reduction": [{key:"currentMonthly",unit:"MXN"},{key:"reductionPct",unit:"%"},{key:"months"}]. Output = currentMonthly × (reductionPct/100) × months.
- "goal_acceleration": [{key:"extraPerMonth",unit:"MXN"}]. Requiere "meta". Output = meses para completar.

REGLAS DE RANGOS REALISTAS (obligatorio — sliders deben sentirse útiles):
- "amount" (MXN/día): min entre 10-50, max entre 300-800, step 5 o 10. NUNCA max > 1000.
- "days": min 7, max 90, step 1.
- "currentMonthly" (MXN/mes): min 200, max ≤ 1.5 × gasto real del usuario en esa categoría, step 50.
- "reductionPct" (%): min 5, max 60, step 5.
- "months": min 1, max 12, step 1.
- "extraPerMonth" (MXN/mes): min 100, max 5000, step 50.

OTRAS REGLAS:
- "params" array, en el ORDEN exacto listado arriba para cada tipo.
- "value" (default): SI EL USUARIO MENCIONA NÚMEROS ESPECÍFICOS en su pregunta, úsalos directamente como "value".
  Ejemplos:
  · "qué pasa si ahorro 200 al día" → amount.value=200, days.value=30 (default).
  · "200 al día por 40 días" → amount.value=200, days.value=40.
  · "y si lo hago por 60 días" → days.value=60, amount.value=default razonable (ej. 100-200).
  · "si reduzco 30% en restaurantes 3 meses" → reductionPct.value=30, months.value=3.
  Si NO menciona números, elige defaults razonables basados en el contexto financiero del usuario.
  Ajusta min/max si fuera necesario para que el "value" caiga dentro del rango (ej. si el usuario dice 800, ajusta amount.max a 1000).
- "meta" (opcional): {name, target, progress} con valores REALES tomados del contexto del usuario.
  · Si el usuario menciona una meta específica (ej. "para mi viaje", "para el iPhone"), usa ESA meta.
  · Si no menciona ninguna pero la simulación se relaciona con metas, elige la más PERTINENTE: la que el aporte simulado podría completar más rápido, o la más cercana a su monto objetivo. Varía entre las metas reales del usuario; NO copies el ejemplo del schema.
  · Si la simulación no se relaciona con metas, omite "meta".
- JSON en UNA SOLA línea (sin saltos de línea internos).
- Emite UN SOLO bloque por respuesta: CHART o SIMULATOR, nunca ambos.
- NO incluyas SIMULATOR para preguntas que no involucren proyección.`;

  const brevityRules = `
=== REGLAS DE BREVEDAD (OBLIGATORIO) ===
- Responde en MÁXIMO 120 palabras. Sé directo y específico.
- Usa máximo 3 bullets cortos cuando hagas listas.
- NO repitas datos del contexto a menos que sean esenciales para la respuesta.
- NO incluyas frases motivacionales largas, despedidas elaboradas, ni preguntas de seguimiento.
- Si el usuario quiere más detalle, lo pedirá.`;

  if (mode === 'analyst') {
    return `Eres FinanceSmart AI en modo ANALISTA FINANCIERO para el usuario ${nombre}.
Responde SIEMPRE en español, de forma objetiva, precisa y profesional.
No des consejos no solicitados a menos que el usuario los pida explícitamente.
Mantén un tono neutro. No inventes datos fuera del contexto financiero proporcionado.
Si el usuario no ha enviado mensajes aún (primera interacción), proporciona un resumen financiero breve y objetivo: saldo, variación vs mes anterior, presupuestos cerca del límite o excedidos, y metas con progreso destacable. Sin opiniones.
${brevityRules}
${contexto}${chartInstructions}`;
  }

  return `Eres FinanceSmart AI en modo COACH FINANCIERO para el usuario ${nombre}.
Responde SIEMPRE en español, de forma motivadora y cercana, pero CONCISA.
Usa los datos financieros reales del usuario para proponer acciones concretas y alcanzables.
Relaciona siempre tus consejos con sus metas de ahorro, sus presupuestos y sus cargos recurrentes.
No inventes datos fuera del contexto financiero proporcionado.
${brevityRules}
${contexto}${chartInstructions}`;
}

const TERMINATOR_MARKERS = ['[CHART]', '[SIMULATOR]'];
const SAFE_BUFFER = Math.max(...TERMINATOR_MARKERS.map(m => m.length)) - 1;

function findEarliestMarker(text) {
  let earliest = -1;
  for (const m of TERMINATOR_MARKERS) {
    const idx = text.indexOf(m);
    if (idx !== -1 && (earliest === -1 || idx < earliest)) earliest = idx;
  }
  return earliest;
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

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (type, payload = {}) => {
    res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
  };

  const abort = new AbortController();
  req.on('close', () => abort.abort());

  try {
    const nombre = `${req.usuario.nombre} ${req.usuario.apellido}`;
    const financialData = await fetchUserFinancialData(req.usuario.id_usuario);
    financialData.forecast = calculateForecast(financialData);
    const systemPrompt = buildSystemPrompt(mode, nombre, financialData);

    if (typeof aiProvider.generateStream !== 'function') {
      throw new Error(`Proveedor ${aiProvider.name} no soporta streaming`);
    }

    let fullText = '';
    let emittedUpTo = 0;
    let blockCutoff = -1;

    for await (const chunk of aiProvider.generateStream({
      systemPrompt, history, message, signal: abort.signal,
    })) {
      if (res.writableEnded || abort.signal.aborted) break;
      fullText += chunk;

      if (blockCutoff === -1) {
        const idx = findEarliestMarker(fullText);
        if (idx !== -1) {
          const toEmit = fullText.slice(emittedUpTo, idx);
          if (toEmit) send('delta', { text: toEmit });
          blockCutoff = idx;
          emittedUpTo = idx;
        } else {
          const safe = Math.max(emittedUpTo, fullText.length - SAFE_BUFFER);
          if (safe > emittedUpTo) {
            send('delta', { text: fullText.slice(emittedUpTo, safe) });
            emittedUpTo = safe;
          }
        }
      }
    }

    if (blockCutoff === -1 && emittedUpTo < fullText.length) {
      send('delta', { text: fullText.slice(emittedUpTo) });
    }

    const afterChart = extractChart(fullText);
    const afterSim = extractSimulator(afterChart.text);
    const reply = afterSim.text;
    const chart = afterChart.chart;
    const simulator = afterSim.simulator;

    const SAVINGS_INTENT_RE = /ahorr|meta|aport|guardar|fondo|inversi|presupuest|alcanza|object/i;
    const showActions = mode === 'coach' && SAVINGS_INTENT_RE.test(message);
    const actions = showActions ? suggestCoachActions(financialData) : [];
    const tarjetas = mode === 'coach'
      ? financialData.tarjetasRaw.map(t => ({ id: t.id_tarjeta, nombre: t.nombre }))
      : [];

    send('done', { reply, chart, simulator, actions, tarjetas, provider: aiProvider.name });
    res.end();
  } catch (error) {
    if (!abort.signal.aborted) {
      console.error(`Error en chatbot (${aiProvider.name}):`, error.message);
    }
    if (!res.writableEnded) {
      send('error', { error: 'Error al procesar la consulta' });
      res.end();
    }
  }
});

module.exports = router;
module.exports.extractChart = extractChart;
module.exports.extractSimulator = extractSimulator;
