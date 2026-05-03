const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');
const aiProvider = require('../utils/aiProvider');
const { buildToolRegistry } = require('../utils/tools');
const { runAgentLoop } = require('../utils/agent/loop');
const { SYSTEM_PROMPT_TOOL_PREAMBLE, buildSystemPromptGuardrails } = require('../utils/agent/grounding');
const logger = require('../utils/logger');
const auditLog = require('../utils/auditLog');

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

  const lista = (movsRes.data || []).filter(
    m => !String(m.descripcion || '').startsWith('Ahorro:')
  );
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
  const lastExpenseDateByCat = {};
  lista
    .filter(m => m.tipo?.toLowerCase() === 'gasto')
    .forEach(m => {
      const cat = m.categoria?.nombre || 'Otros';
      gastosPorCat[cat] = (gastosPorCat[cat] || 0) + Math.abs(Number(m.monto));
      if (!lastExpenseDateByCat[cat] && m.fecha) {
        lastExpenseDateByCat[cat] = m.fecha.split('T')[0];
      }
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
    presupuestoTotal,
    lastExpenseDateByCat
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

function suggestCoachActions(data, userMessage = '') {
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

      // Detectar si el usuario mencionó un monto específico para esta meta
      const metaKeywords = meta.nombre_meta.toLowerCase().split(/\s+/).join('|');
      const montoPattern = new RegExp(`(\\$?\\d+(?:\\.\\d+)?)\\s*(?:para|a|al?|en)\\s*(?:el?\\s*)?(${metaKeywords})`, 'i');
      const montoMatch = userMessage.match(montoPattern);

      if (montoMatch) {
        const montoEspecifico = parseFloat(montoMatch[1].replace('$', ''));
        if (montoEspecifico > 0 && montoEspecifico <= faltante) {
          sugerido = montoEspecifico;
        }
      }

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

const CHART_RE = /\[?\s*(CHART|PIE|BAR|LINE)\s*\]?\s*(\{[\s\S]*?\})\s*\[?\s*\/\s*(CHART|PIE|BAR|LINE)\s*\]?/i;
const VALID_CHART_TYPES = new Set(['pie', 'bar', 'line']);

function extractChart(text) {
  const match = text.match(CHART_RE);
  if (!match) return { text, chart: null };

  const cleanText = text.replace(CHART_RE, '').trim();
  try {
    const jsonStr = extractJsonFromMatch(match[0]);
    if (!jsonStr) return { text: cleanText, chart: null };
    const raw = JSON.parse(jsonStr.trim());
    const tagType = match[1].toLowerCase();
    if (!raw.type && ['pie', 'bar', 'line'].includes(tagType)) raw.type = tagType;
    if (!VALID_CHART_TYPES.has(raw.type)) return { text: cleanText, chart: null };
    if (!raw.title || typeof raw.title !== 'string') return { text: cleanText, chart: null };
    const maxPoints = raw.type === 'line' ? 30 : 8;
    if (!Array.isArray(raw.data) || raw.data.length === 0 || raw.data.length > maxPoints) {
      return { text: cleanText, chart: null };
    }
    if (!raw.data.every(d => typeof d.name === 'string' && typeof d.value === 'number')) {
      return { text: cleanText, chart: null };
    }
    if (raw.reference && (typeof raw.reference.value !== 'number' || typeof raw.reference.label !== 'string')) {
      delete raw.reference;
    }
    return { text: cleanText, chart: raw };
  } catch {
    return { text: cleanText, chart: null };
  }
}

const VALID_SIM_TYPES = new Set(['savings_daily', 'category_reduction', 'goal_acceleration', 'compound_savings']);

/**
 * Find a tag block of the form `[TAG]{...}[/TAG]`, `TAG {...}`, `**TAG**{...}`, etc.
 * Brace-counts the JSON so nested objects inside arrays are handled correctly,
 * unlike the older non-greedy regex that truncated at the first `}`.
 * Returns { json, start, end } or null.
 */
function findTaggedBlock(text, tagName) {
  const prefixRe = new RegExp(
    `\\[?\\s*\\*?\\*?\\s*${tagName}\\s*\\*?\\*?\\s*\\]?\\s*(?=\\{)`,
    'i'
  );
  const m = prefixRe.exec(text);
  if (!m) return null;
  const jsonStart = m.index + m[0].length;
  let depth = 0;
  let end = -1;
  for (let i = jsonStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end === -1) return null;

  // Optional closing tag immediately after the JSON
  const closeRe = new RegExp(`^\\s*\\[?\\s*\\/\\s*${tagName}\\s*\\]?`, 'i');
  const closeM = closeRe.exec(text.slice(end));
  const blockEnd = closeM ? end + closeM[0].length : end;

  return { json: text.slice(jsonStart, end), start: m.index, end: blockEnd };
}

const STREAK_RE = /\[?\s*STREAKS?\s*\]?\s*(\{[\s\S]*?\})\s*\[?\s*\/\s*STREAKS?\s*\]?/i;

function extractStreak(text) {
  const match = text.match(STREAK_RE);
  if (!match) return { text, streak: null };
  const cleanText = text.replace(STREAK_RE, '').trim();
  try {
    const jsonStr = extractJsonFromMatch(match[0]);
    if (!jsonStr) return { text: cleanText, streak: null };
    const raw = JSON.parse(jsonStr.trim());
    if (typeof raw.label !== 'string' || !raw.label) return { text: cleanText, streak: null };
    if (typeof raw.current !== 'number' || raw.current < 0) return { text: cleanText, streak: null };
    if (raw.unit && typeof raw.unit !== 'string') delete raw.unit;
    if (raw.best !== undefined && typeof raw.best !== 'number') delete raw.best;
    if (raw.icon && typeof raw.icon !== 'string') delete raw.icon;
    if (raw.context && typeof raw.context !== 'string') delete raw.context;
    return { text: cleanText, streak: raw };
  } catch {
    return { text: cleanText, streak: null };
  }
}


function extractJsonFromMatch(matchStr) {
  let braceCount = 0;
  let startIdx = -1;
  for (let i = 0; i < matchStr.length; i++) {
    if (matchStr[i] === '{') {
      if (startIdx === -1) startIdx = i;
      braceCount++;
    } else if (matchStr[i] === '}') {
      braceCount--;
      if (braceCount === 0 && startIdx !== -1) {
        return matchStr.substring(startIdx, i + 1);
      }
    }
  }
  return null;
}

function extractCompare(text) {
  const block = findTaggedBlock(text, 'COMPARE');
  if (!block) return { text, compare: null };
  const cleanText = (text.slice(0, block.start) + text.slice(block.end)).trim();
  try {
    const raw = JSON.parse(block.json.trim());
    if (typeof raw.title !== 'string' || !raw.title) return { text: cleanText, compare: null };
    if (typeof raw.leftLabel !== 'string' || typeof raw.rightLabel !== 'string') {
      return { text: cleanText, compare: null };
    }
    if (!Array.isArray(raw.rows) || raw.rows.length === 0 || raw.rows.length > 8) {
      return { text: cleanText, compare: null };
    }
    const validRows = raw.rows.every(r =>
      typeof r?.label === 'string' &&
      typeof r?.left === 'number' &&
      typeof r?.right === 'number'
    );
    if (!validRows) return { text: cleanText, compare: null };
    return { text: cleanText, compare: raw };
  } catch {
    return { text: cleanText, compare: null };
  }
}

// === New widget extractors (heatmap, gauge, forecast, subs, top merchants) ===
// All share findTaggedBlock semantics so brackets, asterisks, and absent
// closing tags are tolerated.

function extractGauge(text) {
  const block = findTaggedBlock(text, 'GAUGE');
  if (!block) return { text, gauge: null };
  const cleanText = (text.slice(0, block.start) + text.slice(block.end)).trim();
  try {
    const raw = JSON.parse(block.json.trim());
    if (typeof raw.title !== 'string' || !raw.title) return { text: cleanText, gauge: null };
    if (typeof raw.value !== 'number') return { text: cleanText, gauge: null };
    if (typeof raw.max !== 'number' || raw.max <= 0) return { text: cleanText, gauge: null };
    return { text: cleanText, gauge: raw };
  } catch {
    return { text: cleanText, gauge: null };
  }
}

function extractHeatmap(text) {
  const block = findTaggedBlock(text, 'HEATMAP');
  if (!block) return { text, heatmap: null };
  const cleanText = (text.slice(0, block.start) + text.slice(block.end)).trim();
  try {
    const raw = JSON.parse(block.json.trim());
    if (typeof raw.title !== 'string' || !raw.title) return { text: cleanText, heatmap: null };
    if (!Array.isArray(raw.cells) || raw.cells.length === 0 || raw.cells.length > 70) {
      return { text: cleanText, heatmap: null };
    }
    const valid = raw.cells.every(c => typeof c?.label === 'string' && typeof c?.value === 'number');
    if (!valid) return { text: cleanText, heatmap: null };
    return { text: cleanText, heatmap: raw };
  } catch {
    return { text: cleanText, heatmap: null };
  }
}

function extractSubsBreakdown(text) {
  const block = findTaggedBlock(text, 'SUBS');
  if (!block) return { text, subs: null };
  const cleanText = (text.slice(0, block.start) + text.slice(block.end)).trim();
  try {
    const raw = JSON.parse(block.json.trim());
    if (typeof raw.title !== 'string' || !raw.title) return { text: cleanText, subs: null };
    if (!Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > 12) {
      return { text: cleanText, subs: null };
    }
    const valid = raw.items.every(it =>
      typeof it?.name === 'string' && typeof it?.monthly === 'number'
    );
    if (!valid) return { text: cleanText, subs: null };
    return { text: cleanText, subs: raw };
  } catch {
    return { text: cleanText, subs: null };
  }
}

function extractTopMerchants(text) {
  const block = findTaggedBlock(text, 'TOPMERCHANT');
  if (!block) return { text, topMerchants: null };
  const cleanText = (text.slice(0, block.start) + text.slice(block.end)).trim();
  try {
    const raw = JSON.parse(block.json.trim());
    if (typeof raw.title !== 'string' || !raw.title) return { text: cleanText, topMerchants: null };
    if (!Array.isArray(raw.items) || raw.items.length === 0 || raw.items.length > 10) {
      return { text: cleanText, topMerchants: null };
    }
    const valid = raw.items.every(it =>
      typeof it?.name === 'string' && typeof it?.total === 'number'
    );
    if (!valid) return { text: cleanText, topMerchants: null };
    return { text: cleanText, topMerchants: raw };
  } catch {
    return { text: cleanText, topMerchants: null };
  }
}

function extractSavingsRate(text) {
  const block = findTaggedBlock(text, 'SAVINGSRATE');
  if (!block) return { text, savingsRate: null };
  const cleanText = (text.slice(0, block.start) + text.slice(block.end)).trim();
  try {
    const raw = JSON.parse(block.json.trim());
    if (typeof raw.title !== 'string' || !raw.title) return { text: cleanText, savingsRate: null };
    if (typeof raw.income !== 'number' || raw.income <= 0) return { text: cleanText, savingsRate: null };
    if (typeof raw.saved !== 'number') return { text: cleanText, savingsRate: null };
    return { text: cleanText, savingsRate: raw };
  } catch {
    return { text: cleanText, savingsRate: null };
  }
}

function extractRecurringCalendar(text) {
  const block = findTaggedBlock(text, 'RECCAL');
  if (!block) return { text, recCal: null };
  const cleanText = (text.slice(0, block.start) + text.slice(block.end)).trim();
  try {
    const raw = JSON.parse(block.json.trim());
    if (typeof raw.title !== 'string' || !raw.title) return { text: cleanText, recCal: null };
    if (!Array.isArray(raw.charges)) return { text: cleanText, recCal: null };
    const valid = raw.charges.every(c =>
      typeof c?.day === 'number' && c.day >= 1 && c.day <= 31 &&
      typeof c?.name === 'string' && typeof c?.amount === 'number'
    );
    if (!valid) return { text: cleanText, recCal: null };
    return { text: cleanText, recCal: raw };
  } catch {
    return { text: cleanText, recCal: null };
  }
}

function extractCategorySparklines(text) {
  const block = findTaggedBlock(text, 'SPARKLINES');
  if (!block) return { text, sparklines: null };
  const cleanText = (text.slice(0, block.start) + text.slice(block.end)).trim();
  try {
    const raw = JSON.parse(block.json.trim());
    if (typeof raw.title !== 'string' || !raw.title) return { text: cleanText, sparklines: null };
    if (!Array.isArray(raw.categories) || raw.categories.length === 0 || raw.categories.length > 10) {
      return { text: cleanText, sparklines: null };
    }
    const valid = raw.categories.every(c =>
      typeof c?.name === 'string' &&
      Array.isArray(c?.values) && c.values.length >= 2 && c.values.length <= 24 &&
      c.values.every(v => typeof v === 'number')
    );
    if (!valid) return { text: cleanText, sparklines: null };
    return { text: cleanText, sparklines: raw };
  } catch {
    return { text: cleanText, sparklines: null };
  }
}

function extractSimulator(text) {
  const block = findTaggedBlock(text, 'SIMULATOR');
  if (!block) return { text, simulator: null };

  const cleanText = (text.slice(0, block.start) + text.slice(block.end)).trim();
  try {
    const raw = JSON.parse(block.json.trim());
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

function buildSystemPrompt(mode, nombre, data, opts = {}) {
  const useTools = !!opts.useTools;
  const guardrails = buildSystemPromptGuardrails(nombre);
  const now = new Date();
  const fechaActual = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const fechaISO = now.toISOString().split('T')[0];
  const mesActual = now.toLocaleString('es-MX', { month: 'long', year: 'numeric' });

  const ultimoGastoTexto = Object.entries(data.lastExpenseDateByCat || {})
    .map(([cat, date]) => `- ${cat}: ${date}`)
    .join('\n') || 'Sin datos recientes';

  const contexto = `
=== FECHA ACTUAL ===
Hoy es ${fechaActual} (${fechaISO}).
IMPORTANTE: TODAS tus respuestas, cálculos de rachas (streaks) y referencias de tiempo DEBEN basarse en esta fecha exacta.

=== ESTADO FINANCIERO – ${mesActual.toUpperCase()} ===
- Ingresos: $${data.ingresos.toFixed(2)} MXN (${pct(data.ingresos, data.ingresosLast)} vs mes anterior)
- Gastos:   $${data.gastos.toFixed(2)} MXN (${pct(data.gastos, data.gastosLast)} vs mes anterior)
- Saldo:    $${data.saldo.toFixed(2)} MXN

=== ÚLTIMO GASTO POR CATEGORÍA ===
(Usa esto para calcular rachas de días sin gastar con precisión)
${ultimoGastoTexto}

=== MOVIMIENTOS RECIENTES (últimos 10) ===
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
ORDEN OBLIGATORIO: PRIMERO el texto de explicación, DESPUÉS la gráfica AL FINAL.
Cuando tu respuesta muestre un desglose, comparación o distribución de datos financieros, añade AL FINAL de tu respuesta un bloque con este formato exacto:
[CHART]
{"type":"pie","title":"Título corto","data":[{"name":"Categoría","value":1234}]}
[/CHART]
Tipos válidos:
- "pie": distribuciones/desgloses.
- "bar": comparaciones entre periodos o categorías. Para barras con dos series usa "value" y "value2".
- "line": proyecciones / tendencias en el tiempo (ej. saldo a 30 días, gasto acumulado del mes). Cada elemento de "data" es un punto en el tiempo.
Máx 30 puntos para line, 7 para pie/bar. Nombres máx 12 caracteres. JSON en una sola línea.
NO incluyas gráfica para saludos, consejos generales o preguntas simples de saldo.
IMPORTANTE: Siempre explica la gráfica CON TEXTO PRIMERO (al menos 1 oración), luego la gráfica AL FINAL.

=== INSTRUCCIÓN DE SIMULADORES INTERACTIVOS ===
⚠️ CRÍTICO: DEBES generar SIMULADORES OBLIGATORIAMENTE en estos casos:
1. Usuario pregunta "qué pasaría si..." (savings_daily, category_reduction, goal_acceleration)
2. Usuario pregunta sobre inversión a largo plazo: "y si invierto X al mes por Y años" → DEBES usar compound_savings
3. Pregunta sobre "cuánto tendría en N años a tal rendimiento" → DEBES generar compound_savings

ORDEN OBLIGATORIO: PRIMERO texto, DESPUÉS [SIMULATOR]...[/SIMULATOR] AL FINAL

FORMATO EXACTO (no omitas nada):
[SIMULATOR]
{"type":"savings_daily","title":"Si ahorras todos los días","params":[{"key":"amount","label":"$ al día","value":150,"min":20,"max":500,"step":10,"unit":"MXN"},{"key":"days","label":"Días","value":30,"min":7,"max":90,"step":1}],"meta":{"name":"Meta de ahorro","target":30000,"progress":10000}}
[/SIMULATOR]

❌ NUNCA hagas esto:
  - [COMPOUND SAVINGS] (el tag incorrecto)
  - [savings_daily] (usar el nombre del tipo como tag)
  - [compound_savings] (usar el nombre del tipo como tag)
  - "Simulador" sin los tags
  - "Con este plan, podrías..." sin los tags

✅ SIEMPRE:
  - Usa [SIMULATOR] para TODOS los simuladores, sin importar el tipo
  - Explica una oración PRIMERO, luego el bloque [SIMULATOR] AL FINAL
  - El tag es SIEMPRE [SIMULATOR]...[/SIMULATOR], NUNCA otros nombres

Tipos válidos y ESTRUCTURA OBLIGATORIA de params (orden y keys EXACTAS):
- "savings_daily": [{key:"amount",unit:"MXN"},{key:"days"}]. Output = amount × days.
- "category_reduction": [{key:"currentMonthly",unit:"MXN"},{key:"reductionPct",unit:"%"},{key:"months"}]. Output = currentMonthly × (reductionPct/100) × months.
- "goal_acceleration": [{key:"extraPerMonth",unit:"MXN"}]. Requiere "meta". Output = meses para completar.
- "compound_savings": [{key:"monthly",unit:"MXN"},{key:"years"},{key:"annualRate",unit:"%"}]. Output = monto final con interés compuesto. ÚSALO SIEMPRE para preguntas como "y si invierto X al mes por Y años a Z%", "qué pasa si invierto cada mes", "cuánto tendría en N años a tal rendimiento", o cualquier pregunta de inversión recurrente a largo plazo. Es OBLIGATORIO emitirlo en estos casos, no solo describir con texto.

REGLAS DE RANGOS REALISTAS (obligatorio — sliders deben sentirse útiles):
- "amount" (MXN/día): min entre 10-50, max entre 300-800, step 5 o 10. NUNCA max > 1000.
- "days": min 7, max 90, step 1.
- "currentMonthly" (MXN/mes): min 200, max ≤ 1.5 × gasto real del usuario en esa categoría, step 50.
- "reductionPct" (%): min 5, max 60, step 5.
- "months": min 1, max 12, step 1.
- "extraPerMonth" (MXN/mes): min 100, max 5000, step 50.
- "monthly" (MXN/mes para compound_savings): min 100, max 10000, step 100.
- "years": min 1, max 30, step 1.
- "annualRate" (%): min 1, max 15, step 0.5.

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
- NO incluyas SIMULATOR para preguntas que no involucren proyección.

=== INSTRUCCIÓN DE WIDGET STREAK ===
ORDEN OBLIGATORIO: PRIMERO el texto de explicación, DESPUÉS la racha AL FINAL.
SOLO emite [STREAK] para rachas POSITIVAS y NO TRIVIALES — current debe ser ≥ 1 día/aporte/etc. Si la racha es 0 o menos, NO emitas el widget; en su lugar responde solo con texto motivacional ("apenas empieza el mes, tu primera oportunidad de marcar racha es hoy").
Casos válidos (current ≥ 1):
- Días consecutivos SIN gasto en una categoría problemática.
- Días consecutivos BAJO presupuesto en una categoría.
- Aportaciones consecutivas a una meta.
- Días consecutivos con saldo positivo.
NO uses STREAK para: "meses sin aportar a meta" (es un GAP, desmotivador), o cualquier racha = 0.
Formato:
[STREAK]
{"label":"Días sin gasto en restaurantes","current":7,"unit":"días","best":12,"icon":"🔥","context":"Tu récord histórico fue 12 días"}
[/STREAK]
- "label": frase corta y concreta que describa el comportamiento positivo. REQUERIDO.
- "current": número (ej. cuántos días lleva). REQUERIDO.
- "unit": "días", "semanas", "meses", "aportes", etc. REQUERIDO.
- "best": récord histórico (opcional, omite si no lo conoces con certeza).
- "icon": un solo emoji (opcional).
- "context": frase de contexto (opcional).
Si el usuario pregunta por una racha de una categoría que no está en "ÚLTIMO GASTO POR CATEGORÍA", dile que no tienes datos recientes suficientes para calcularla, NO la inventes.
Para calcular la racha, resta la fecha del "ÚLTIMO GASTO" de la "FECHA ACTUAL".

=== INSTRUCCIÓN DE WIDGET COMPARE (este mes vs anterior) ===
⚠️ CRÍTICO: DEBES generar COMPARE OBLIGATORIAMENTE cuando:
1. Usuario pregunta "cómo voy contra el mes pasado"
2. Usuario pregunta "compárame con mes anterior"
3. Una comparativa lado-a-lado es más clara que texto

ORDEN OBLIGATORIO: PRIMERO texto, DESPUÉS [COMPARE]...[/COMPARE] AL FINAL

FORMATO EXACTO (no omitas nada):
[COMPARE]
{"title":"Abril vs Marzo","leftLabel":"Marzo","rightLabel":"Abril","rows":[{"label":"Comida","left":4200,"right":5100},{"label":"Transporte","left":1900,"right":1500},{"label":"Saldo","left":12500,"right":14200}]}
[/COMPARE]

- "title": título corto. REQUERIDO.
- "leftLabel" / "rightLabel": nombres de las dos columnas (típicamente periodos). REQUERIDO.
- "rows": array de {label, left, right} con valores en MXN. Máx 8 filas.

❌ NUNCA hagas esto: "[Titulo] Abril vs Marzo [Izquierda Etiqueta]..." sin los tags
✅ SIEMPRE: Explica una oración PRIMERO, luego el bloque [COMPARE] AL FINAL

El frontend calcula y muestra el delta (% y absoluto) automáticamente. NO incluyas el delta en los datos.

=== INSTRUCCIÓN DE WIDGET GAUGE (velocímetro) ===
Úsalo cuando el usuario pregunte "¿voy bien con mi presupuesto?" o "¿cómo voy del mes?" — algo medible vs un objetivo. Texto PRIMERO, gauge AL FINAL.
Formato:
[GAUGE]
{"title":"Presupuesto Restaurantes","value":1830,"max":2500,"unit":"MXN","label":"73% consumido","thresholds":{"warn":80,"bad":100}}
[/GAUGE]
- "value": valor actual (número). REQUERIDO.
- "max": valor máximo / objetivo. REQUERIDO.
- "unit": "MXN", "%", "días", etc. opcional.
- "label": texto debajo del número grande, opcional.
- "thresholds": {warn: %, bad: %} opcional. value/max × 100 < warn = verde, < bad = naranja, ≥ bad = rojo.

=== INSTRUCCIÓN DE WIDGET HEATMAP (mapa de calor) ===
Úsalo para mostrar intensidad por día/categoría/etiqueta — máximo ~30 celdas. Ideal para "¿qué días gasto más?" o "gasto por día del mes".
Formato:
[HEATMAP]
{"title":"Gastos por día — abril","cells":[{"label":"L","value":150},{"label":"M","value":890},{"label":"X","value":420},{"label":"J","value":1200},{"label":"V","value":2300},{"label":"S","value":1800},{"label":"D","value":300}]}
[/HEATMAP]
- "cells": array de {label, value}. label = string corto (1-3 chars idealmente). value = intensidad numérica. REQUERIDO. Máx 70 celdas.
- Las celdas se colorean automáticamente: 0 = blanco, max = rojo intenso.

=== INSTRUCCIÓN DE WIDGET SUBS (desglose de suscripciones) ===
Úsalo cuando el usuario pregunte "lista mis suscripciones" — más visual que tabla.
Formato:
[SUBS]
{"title":"Tus suscripciones activas","items":[{"name":"Netflix","monthly":139,"annual":1668},{"name":"Gym Club","monthly":99,"annual":1188},{"name":"Spotify","monthly":12,"annual":144}],"total":250}
[/SUBS]
- "items": array de {name, monthly, annual?}. monthly REQUERIDO.
- "total": total mensual de TODAS las items, opcional pero recomendado.
- Se ordena por monthly desc automáticamente.

=== INSTRUCCIÓN DE WIDGET TOPMERCHANT (top de comercios/lugares) ===
Úsalo para "¿en qué lugares gasto más?" o "mis principales comercios".
Formato:
[TOPMERCHANT]
{"title":"Top 5 lugares — abril","items":[{"name":"Starbucks","total":890,"count":12},{"name":"Uber","total":1500,"count":8},{"name":"Walmart","total":2300,"count":4}]}
[/TOPMERCHANT]
- "items": array de {name, total, count?}. name y total REQUERIDOS, count opcional (cantidad de transacciones).
- Se ordena por total desc automáticamente.

=== INSTRUCCIÓN DE WIDGET SAVINGSRATE (tasa de ahorro) ===
Úsalo cuando el usuario pregunte "¿cuánto ahorro?", "tasa de ahorro", "qué tan bien ahorro" — muestra un anillo con el % de ingreso ahorrado vs benchmarks.
Formato:
[SAVINGSRATE]
{"title":"Tu tasa de ahorro este mes","income":54000,"saved":9000,"benchmarks":{"good":10,"great":20,"excellent":30}}
[/SAVINGSRATE]
- "income": ingreso total del periodo. REQUERIDO, > 0.
- "saved": monto ahorrado del periodo (puede ser negativo si gastó más que ingresó). REQUERIDO.
- "benchmarks": opcional, % objetivos. Por defecto: good=10, great=20, excellent=30.
- El widget calcula saved/income × 100 y colorea según benchmark alcanzado.

=== INSTRUCCIÓN DE WIDGET RECCAL (calendario de cargos recurrentes) ===
Úsalo para "¿qué cargos vienen este mes?", "calendario de pagos" — muestra un mes con marcas en los días de cargo.
Formato:
[RECCAL]
{"title":"Cargos del mes","charges":[{"day":2,"name":"Renta","amount":6000},{"day":5,"name":"Netflix","amount":139},{"day":12,"name":"Gym","amount":99}]}
[/RECCAL]
- "charges": array de {day, name, amount}. day = día del mes (1-31). REQUERIDO.
- Máximo 30 cargos.
- El widget renderiza un mini calendario y resalta los días con cargos.

=== INSTRUCCIÓN DE WIDGET SPARKLINES (mini-trends por categoría) ===
Úsalo para "tendencia por categoría", "¿cómo han evolucionado mis gastos?" — lista categorías con mini-gráfico de tendencia al lado.
Formato:
[SPARKLINES]
{"title":"Tendencia 6 meses","categories":[{"name":"Restaurantes","values":[1200,1450,1800,2100,2200,2370],"current":2370},{"name":"Transporte","values":[1900,1700,2000,2100,2150,2200],"current":2200}]}
[/SPARKLINES]
- "categories": array de {name, values[], current?}. values = serie temporal (mínimo 2, máximo 24 puntos).
- Máximo 10 categorías.
- El widget muestra cada categoría con su mini-línea, valor actual y % cambio vs primero.

REGLA FINAL: emite UN widget por respuesta. Si la pregunta podría justificar dos, elige el más útil para esa pregunta específica.`;

  const brevityRules = `
=== REGLAS DE BREVEDAD (OBLIGATORIO) ===
- Responde en MÁXIMO 120 palabras. Sé directo y específico.
- Usa máximo 3 bullets cortos cuando hagas listas.
- NO repitas datos del contexto a menos que sean esenciales para la respuesta.
- NO incluyas frases motivacionales largas, despedidas elaboradas, ni preguntas de seguimiento.
- Si el usuario quiere más detalle, lo pedirá.`;

  const noToolsClause = useTools
    ? `\nINSTRUCCIÓN DE HERRAMIENTAS:\n${SYSTEM_PROMPT_TOOL_PREAMBLE}\nEl contexto financiero abajo es solo un resumen; usa las herramientas para datos específicos o actualizados.\n${guardrails}`
    : `
IMPORTANTE - NO TIENES ACCESO A HERRAMIENTAS:
- No tienes acceso a funciones, APIs, o herramientas que ejecutar.
- No llames a funciones ni hagas llamadas a herramientas.
- Todos los datos financieros ya han sido inyectados en este contexto.
- Si necesitas información, úsala del contexto proporcionado a continuación.
- Responde basándote EXCLUSIVAMENTE en los datos financieros proporcionados, NO en herramientas o llamadas a APIs.`;

  if (mode === 'analyst') {
    return `Eres FinanceSmart AI en modo ANALISTA FINANCIERO para el usuario ${nombre}.
${noToolsClause}
Responde SIEMPRE en español, de forma objetiva, precisa y profesional.
No des consejos no solicitados a menos que el usuario los pida explícitamente.
Mantén un tono neutro. No inventes datos fuera del contexto financiero proporcionado.
Si el usuario no ha enviado mensajes aún (primera interacción), proporciona un resumen financiero breve y objetivo: saldo, variación vs mes anterior, presupuestos cerca del límite o excedidos, y metas con progreso destacable. Sin opiniones.
${brevityRules}
${contexto}${chartInstructions}`;
  }

  return `Eres FinanceSmart AI en modo COACH FINANCIERO para el usuario ${nombre}.
${noToolsClause}
Responde SIEMPRE en español, de forma motivadora y cercana, pero CONCISA.
Usa los datos financieros reales del usuario para proponer acciones concretas y alcanzables.
Relaciona siempre tus consejos con sus metas de ahorro, sus presupuestos y sus cargos recurrentes.
No inventes datos fuera del contexto financiero proporcionado.
${brevityRules}
${contexto}${chartInstructions}`;
}

const TERMINATOR_MARKERS = [
  '[CHART', '[SIMULATOR', '[STREAK', '[COMPARE',
  'CHART {', 'SIMULATOR {', 'STREAK {', 'COMPARE {',
  'PIE {', 'BAR {', 'LINE {',
  'CHART{', 'SIMULATOR{', 'STREAK{', 'COMPARE{',
  'PIE{', 'BAR{', 'LINE{',
  '\nCHART', '\nSIMULATOR', '\nSTREAK', '\nCOMPARE',
  '\nPIE', '\nBAR', '\nLINE',
  '**CHART', '**SIMULATOR', '**STREAK', '**COMPARE',
  '*CHART', '*SIMULATOR', '*STREAK', '*COMPARE',
  '**PIE', '**BAR', '**LINE',
  '*PIE', '*BAR', '*LINE'
];
const SAFE_BUFFER = 15; // Increased buffer to catch variations

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
    if (res.writableEnded || res.destroyed) return;
    try {
      res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`);
    } catch {
      // EPIPE / ECONNRESET if the socket died between the guard and the write;
      // safe to swallow because the abort handler will tear down the LLM call.
    }
  };

  const abort = new AbortController();
  // Listen on the *response* (not the request): in Express 5 / Node 20+,
  // `req.on('close')` fires immediately when the request body finishes (which
  // is right away here, since express.json() has already buffered it). We only
  // want to abort the LLM call when the *client* disconnects mid-stream, which
  // is what `res.on('close')` before `res.writableEnded` indicates.
  res.on('close', () => {
    if (!res.writableEnded) abort.abort();
  });
  // Swallow socket errors so a mid-stream client disconnect doesn't crash the
  // process with an unhandled 'error' event on the response.
  res.on('error', () => { /* */ });

  try {
    const nombre = `${req.usuario.nombre} ${req.usuario.apellido}`;
    const wantsAgent = !!(aiProvider.capabilities?.supportsTools && typeof aiProvider.generateWithTools === 'function');
    const allowWrites = !!aiProvider.capabilities?.supportsToolCalling;

    // Run prefetch + tool-context build in parallel — both hit Supabase and
    // are independent. Saves ~one round-trip vs the previous sequential await.
    // The agent path still wants the financialData to seed the system prompt
    // so simple "how much did I spend" questions can be answered without
    // calling tools at all.
    const [financialData, registry] = await Promise.all([
      fetchUserFinancialData(req.usuario.id_usuario),
      wantsAgent
        ? buildToolRegistry({
            supabase,
            id_usuario: req.usuario.id_usuario,
            opts: { includeWrites: allowWrites, send },
          })
        : Promise.resolve(null),
    ]);
    financialData.forecast = calculateForecast(financialData);

    const systemPrompt = buildSystemPrompt(mode, nombre, financialData, { useTools: wantsAgent });

    if (typeof aiProvider.generateStream !== 'function' && !wantsAgent) {
      throw new Error(`Proveedor ${aiProvider.name} no soporta streaming`);
    }

    let fullText = '';

    if (wantsAgent) {
      // Agent loop path: provider can call tools. We don't get incremental text
      // deltas (Gemini's tool-loop is request/response per turn), so we emit a
      // status event and then deliver the final text in one shot.
      send('status', { text: 'Pensando…' });
      // True streaming: each text token from Gemini is forwarded to the client
      // as a delta. Tool-call iterations don't produce text, so the user sees
      // tokens only on the final reply turn (which is what they care about).
      let streamedText = '';
      const result = await runAgentLoop({
        provider: aiProvider,
        registry,
        systemPrompt,
        history,
        message,
        send,
        signal: abort.signal,
        onTextDelta: (delta) => {
          if (!delta) return;
          streamedText += delta;
          send('delta', { text: delta });
        },
      });
      if (result.aborted) return;
      fullText = result.text || '';
      // If the streaming path yielded nothing (e.g., provider used the non-
      // streaming fallback) and we still have a final text, flush it as one
      // delta so the frontend never ends up empty.
      if (!streamedText && fullText) send('delta', { text: fullText });
    } else {
      // Streaming-only path (Ollama or any provider lacking tool calling).
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
    }

    const afterChart = extractChart(fullText);
    const afterSim = extractSimulator(afterChart.text);
    const afterStreak = extractStreak(afterSim.text);
    const afterCompare = extractCompare(afterStreak.text);
    const afterGauge = extractGauge(afterCompare.text);
    const afterHeatmap = extractHeatmap(afterGauge.text);
    const afterSubs = extractSubsBreakdown(afterHeatmap.text);
    const afterMerch = extractTopMerchants(afterSubs.text);
    const afterSav = extractSavingsRate(afterMerch.text);
    const afterRecCal = extractRecurringCalendar(afterSav.text);
    const afterSpark = extractCategorySparklines(afterRecCal.text);
    const reply = afterSpark.text;
    const chart = afterChart.chart;
    const simulator = afterSim.simulator;
    const streak = afterStreak.streak;
    const compare = afterCompare.compare;
    const gauge = afterGauge.gauge;
    const heatmap = afterHeatmap.heatmap;
    const subs = afterSubs.subs;
    const topMerchants = afterMerch.topMerchants;
    const savingsRate = afterSav.savingsRate;
    const recCal = afterRecCal.recCal;
    const sparklines = afterSpark.sparklines;

    // Build new structured widgets[] envelope alongside the legacy fields. The
    // frontend (post PR 2) consumes widgets[] preferentially; legacy fields
    // remain for back-compat until the cleanup PR.
    const widgets = [];
    if (chart) widgets.push({ kind: 'chart', chart });
    if (simulator) widgets.push({ kind: 'simulator', simulator });
    if (streak) widgets.push({ kind: 'streak', streak });
    if (compare) widgets.push({ kind: 'compare', compare });
    if (gauge) widgets.push({ kind: 'gauge', gauge });
    if (heatmap) widgets.push({ kind: 'heatmap', heatmap });
    if (subs) widgets.push({ kind: 'subs', subs });
    if (topMerchants) widgets.push({ kind: 'topMerchants', topMerchants });
    if (savingsRate) widgets.push({ kind: 'savingsRate', savingsRate });
    if (recCal) widgets.push({ kind: 'recCal', recCal });
    if (sparklines) widgets.push({ kind: 'sparklines', sparklines });

    // Legacy keyword-based intent detection. Only used on the non-agent path
    // (Ollama / providers without tool calling). With the agent loop, Gemini
    // detects intent semantically and proposes actions via `proponer_aporte_meta`
    // and emits subscription widgets via [SUBS] when relevant.
    let actions = [];
    let subscriptionAudit = null;
    if (!wantsAgent) {
      const SAVINGS_INTENT_RE = /ahorr|meta|aport|guardar|fondo|inversi|presupuest|alcanza|object/i;
      const showActions = mode === 'coach' && SAVINGS_INTENT_RE.test(message);
      actions = showActions ? suggestCoachActions(financialData, message) : [];

      const SUB_INTENT_RE = /suscrip|recurrent|cancel|netflix|spotify|cobro.*mes|cu[aá]nto.*pago.*mes|servic.*(mensual|recurrent)/i;
      if (SUB_INTENT_RE.test(message)) {
        const recs = (financialData.recurrenciasRaw || []).filter(r => r.tipo?.toLowerCase() === 'gasto');
        const items = recs
          .map(r => ({
            descripcion: r.descripcion,
            monthly: Math.abs(Number(r.monto)),
            annual: Math.abs(Number(r.monto)) * 12,
            dia_del_mes: r.dia_del_mes,
          }))
          .sort((a, b) => b.annual - a.annual);
        const totalMonthly = items.reduce((acc, i) => acc + i.monthly, 0);
        subscriptionAudit = {
          items,
          totalMonthly,
          totalAnnual: totalMonthly * 12,
        };
      }
    }
    const tarjetas = mode === 'coach'
      ? financialData.tarjetasRaw.map(t => ({ id: t.id_tarjeta, nombre: t.nombre }))
      : [];

    send('done', {
      reply, chart, simulator, streak, compare,
      gauge, heatmap, subs, topMerchants, savingsRate, recCal, sparklines,
      widgets,
      subscriptionAudit, actions, tarjetas,
      provider: aiProvider.name,
      capabilities: aiProvider.capabilities || null,
    });
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

// ─────────────────────────────────────────────────────────────────────────────
// Action proposal confirmation flow
// ─────────────────────────────────────────────────────────────────────────────
const proposalStore = require('../utils/agent/proposalStore');
const { buildAgentContext } = require('../utils/tools/context');
const { buildWriteSchemas } = require('../utils/tools/writeTools');
const { aportarMeta, createMeta } = require('./metas');
const { upsertPresupuesto } = require('./presupuestos');
const { togglearRecurrencia } = require('./recurrencias');

async function executeProposal(proposal, ctx) {
  const { action, params } = proposal;
  switch (action) {
    case 'proponer_aporte_meta':
      return await aportarMeta(
        { supabase: ctx.supabase, id_usuario: ctx.id_usuario },
        { id_meta: params.id_meta, monto: params.monto, id_tarjeta: params.id_tarjeta }
      );
    case 'proponer_crear_presupuesto':
      return await upsertPresupuesto(
        { supabase: ctx.supabase, id_usuario: ctx.id_usuario },
        { id_categoria: params.id_categoria, monto: params.monto }
      );
    case 'proponer_modificar_presupuesto': {
      const presup = ctx.presupuestosById.get(params.id_presupuesto);
      if (!presup) return { ok: false, status: 404, error: 'Presupuesto no encontrado' };
      return await upsertPresupuesto(
        { supabase: ctx.supabase, id_usuario: ctx.id_usuario },
        { id_categoria: presup.id_categoria, monto: params.monto_nuevo }
      );
    }
    case 'proponer_toggle_recurrencia':
      return await togglearRecurrencia(
        { supabase: ctx.supabase, id_usuario: ctx.id_usuario },
        { id: params.id_recurrencia, activo: params.activo }
      );
    case 'proponer_crear_meta':
      return await createMeta(
        { supabase: ctx.supabase, id_usuario: ctx.id_usuario },
        { nombre: params.nombre, meta: params.monto_objetivo, fecha: params.fecha_limite }
      );
    default:
      return { ok: false, status: 400, error: `Unknown action: ${action}` };
  }
}

router.post('/confirm-action', async (req, res) => {
  const { proposal_id, additional_params = {} } = req.body || {};
  if (!proposal_id || typeof proposal_id !== 'string') {
    return res.status(400).json({ error: 'proposal_id requerido' });
  }
  const id_usuario = req.usuario.id_usuario;

  // Synchronously claim the proposal so concurrent confirm requests for the
  // same proposal_id can't both pass validation and double-execute. Released
  // on validation failure; deleted on success.
  const claim = proposalStore.tryClaim(proposal_id, id_usuario);
  if (!claim.ok) {
    return res.status(claim.status || 400).json({ error: claim.error });
  }
  const proposal = claim.proposal;

  // Defense-in-depth: re-validate the merged params against the same zod schema
  // the write tool used at proposal time. The model can't tamper with params,
  // but the user (or a malicious client) could pass bogus additional_params
  // for fields like id_tarjeta.
  try {
    const ctx = await buildAgentContext({ supabase, id_usuario });
    const schemas = buildWriteSchemas(ctx);
    const schema = schemas[proposal.action];
    if (!schema) {
      proposalStore.release(proposal_id);
      return res.status(400).json({ error: `Schema not found for ${proposal.action}` });
    }

    const merged = { ...proposal.params, ...additional_params };
    const parsed = schema.safeParse(merged);
    if (!parsed.success) {
      proposalStore.release(proposal_id);
      const issue = parsed.error.issues[0];
      return res.status(400).json({
        error: 'Validation failed',
        detail: `${issue?.path?.join('.') || ''}: ${issue?.message || ''}`.trim(),
      });
    }
    proposal.params = parsed.data;

    const consumed = proposalStore.consume(proposal_id, id_usuario);
    if (!consumed.ok) {
      return res.status(consumed.status || 409).json({ error: consumed.error });
    }

    const result = await executeProposal(proposal, ctx);
    if (result && result.ok === false) {
      auditLog.record({
        id_usuario,
        action: proposal.action,
        status: 'failed',
        params: proposal.params,
        error_message: result.error || 'unknown',
      });
      return res.status(result.status || 500).json({ error: result.error });
    }
    auditLog.record({
      id_usuario,
      action: proposal.action,
      status: 'success',
      params: proposal.params,
      result_summary: typeof result === 'object' ? JSON.stringify(result).slice(0, 500) : String(result),
    });
    return res.json({ executed: true, action: proposal.action, result: result?.data ?? result });
  } catch (err) {
    proposalStore.release(proposal_id);
    logger.error('confirm-action failed', { id_usuario, action: proposal.action, message: err.message });
    auditLog.record({
      id_usuario,
      action: proposal.action,
      status: 'failed',
      params: proposal.params,
      error_message: err.message,
    });
    return res.status(500).json({ error: 'Error al ejecutar la acción' });
  }
});

router.post('/cancel-action', async (req, res) => {
  const { proposal_id } = req.body || {};
  if (!proposal_id || typeof proposal_id !== 'string') {
    return res.status(400).json({ error: 'proposal_id requerido' });
  }
  const r = proposalStore.cancel(proposal_id, req.usuario.id_usuario);
  if (!r.ok) return res.status(r.status || 400).json({ error: r.error });
  return res.json({ cancelled: true });
});

module.exports = router;
module.exports.extractChart = extractChart;
module.exports.extractSimulator = extractSimulator;
module.exports.extractStreak = extractStreak;
module.exports.extractCompare = extractCompare;
module.exports.executeProposal = executeProposal;
