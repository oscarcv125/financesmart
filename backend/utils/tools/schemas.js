const { z } = require('zod');

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// JavaScript's Date constructor coerces invalid days (e.g. 2026-02-30 →
// 2026-03-02). To reject the original string strictly, round-trip it via
// toISOString and require an exact match.
function isCalendarValid(s) {
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const isoDate = () => z.string().regex(ISO_DATE_RE, { message: 'INVALID_DATE_FORMAT' })
  .refine(isCalendarValid, { message: 'INVALID_CALENDAR_DATE' })
  .refine(s => {
    const y = Number(s.slice(0, 4));
    const d = new Date(s + 'T00:00:00Z');
    return y >= 2020 && d <= new Date(Date.now() + 86400000);
  }, { message: 'INVALID_DATE_RANGE' });

const mesEnum = z.enum(['actual', 'anterior', 'hace_2', 'hace_3']);

// Build per-request schemas that use ctx for ID enums. This is what makes
// hallucinated category/card/meta IDs structurally rejectable.
function buildToolSchemas(ctx) {
  const idCategoria = z.number().int().refine(id => ctx.categoriaIds.has(id), { message: 'CATEGORIA_NO_VALIDA' });
  const idTarjeta   = z.number().int().refine(id => ctx.tarjetaIds.has(id),   { message: 'TARJETA_NO_VALIDA' });
  const idMeta      = z.number().int().refine(id => ctx.metasById.has(id),    { message: 'META_NO_ENCONTRADA' });
  const idPresupuesto = z.number().int().refine(id => ctx.presupuestosById.has(id), { message: 'PRESUPUESTO_NO_VALIDO' });
  const idRecurrencia = z.number().int().refine(id => ctx.recurrenciasById.has(id), { message: 'RECURRENCIA_NO_VALIDA' });

  return {
    obtener_resumen_mes: z.object({
      mes: mesEnum.default('actual'),
    }),

    obtener_resumen_periodo: z.object({
      fecha_inicio: isoDate(),
      fecha_fin: isoDate(),
    }).refine(o => o.fecha_inicio <= o.fecha_fin, { message: 'RANGO_INVERTIDO' }),

    obtener_movimientos: z.object({
      fecha_inicio: isoDate().optional(),
      fecha_fin: isoDate().optional(),
      tipo: z.enum(['ingreso', 'gasto']).optional(),
      id_categoria: idCategoria.optional(),
      id_tarjeta: idTarjeta.optional(),
      limite: z.number().int().min(1).max(500).default(50),
    }).refine(o => !o.fecha_inicio || !o.fecha_fin || o.fecha_inicio <= o.fecha_fin, { message: 'RANGO_INVERTIDO' }),

    obtener_gastos_por_categoria: z.object({
      mes: mesEnum.default('actual'),
    }),

    obtener_gastos_por_categoria_periodo: z.object({
      fecha_inicio: isoDate(),
      fecha_fin: isoDate(),
    }).refine(o => o.fecha_inicio <= o.fecha_fin, { message: 'RANGO_INVERTIDO' }),

    obtener_metas_ahorro: z.object({}),

    obtener_presupuestos: z.object({}),

    obtener_recurrencias: z.object({
      solo_activas: z.boolean().default(true),
    }),

    obtener_tarjetas: z.object({}),

    obtener_salud_financiera: z.object({}),

    obtener_insights_automaticos: z.object({}),

    obtener_planes: z.object({
      estado: z.enum(['activo', 'pausado', 'completado', 'cancelado']).optional(),
    }),

    obtener_adherencia_plan: z.object({
      id_plan: z.number().int().positive(),
    }),
  };
}

const TOOL_DESCRIPTIONS_ES = {
  obtener_resumen_mes: 'Devuelve ingresos, gastos y saldo del mes indicado. mes: actual | anterior | hace_2 | hace_3. Para meses más antiguos o periodos personalizados usa obtener_resumen_periodo.',
  obtener_resumen_periodo: 'Devuelve ingresos, gastos y saldo agregados sobre un rango de fechas arbitrario (YYYY-MM-DD), CON desglose por_mes (lista de {mes, ingresos, gastos}). Útil para detectar TENDENCIAS de ingreso o gasto: cambios de salario, evolución mensual, totales anuales. Sin límite de antigüedad. Para preguntas sobre "cambios en mi salario" o "evolución de mis ingresos", llama esta función con fecha_inicio = hace 6-12 meses, fecha_fin = hoy, y revisa el array por_mes.',
  obtener_movimientos: 'Lista movimientos individuales filtrados por fecha (YYYY-MM-DD), tipo (ingreso|gasto), categoría o tarjeta. Hasta 500 por llamada. PATRONES DE USO: (1) Para "cambios en mi salario" → tipo:"ingreso", fecha_inicio:hace 6 meses, agrupa los resultados por mes y compara montos. (2) Para "aportes a meta X" → filtra por descripción que contenga "Ahorro:" + nombre de la meta, o por id_categoria de Ahorro. (3) Para agregados puros (totales/sumas) prefiere obtener_resumen_periodo.',
  obtener_gastos_por_categoria: 'Suma de gastos agrupados por categoría para el mes indicado (actual | anterior | hace_2 | hace_3).',
  obtener_gastos_por_categoria_periodo: 'Suma de gastos agrupados por categoría sobre un rango de fechas arbitrario. Útil para "en qué categorías gasté más en los últimos 12 meses".',
  obtener_metas_ahorro: 'Lista las metas con id_meta, nombre, monto_objetivo, progreso, pct y fecha_limite. PATRÓN PARA PROYECCIONES: para "en cuántos meses termino la meta X", combina (a) esta función para conseguir progreso/objetivo/faltante, con (b) obtener_movimientos filtrando por descripción "Ahorro: <nombre>" para calcular el ritmo histórico de aportes ($/mes promedio). Faltante / ritmo = meses restantes. NO te rindas — los datos sí están disponibles si haces ambas llamadas.',
  obtener_presupuestos: 'Lista los presupuestos del usuario con porcentaje gastado y bandera de excedido del mes en curso.',
  obtener_recurrencias: 'Lista los cargos recurrentes del usuario. solo_activas=true por defecto.',
  obtener_tarjetas: 'Lista las tarjetas del usuario.',
  obtener_salud_financiera: 'Devuelve el score de salud financiera (0-100) con desglose por componente.',
  obtener_insights_automaticos: 'Devuelve hasta 5 alertas automáticas (presupuestos excedidos, saltos de gasto, próximos cargos).',
  obtener_planes: 'Lista los planes financieros de largo plazo del usuario (ahorro, liquidación de deuda, meta_compuesta) con sus hitos. Filtro opcional por estado.',
  obtener_adherencia_plan: 'Devuelve el porcentaje de adherencia (hitos cumplidos / hitos pasados) de un plan específico. Llama obtener_planes primero para conseguir id_plan.',
};

module.exports = {
  isoDate, mesEnum,
  buildToolSchemas,
  TOOL_DESCRIPTIONS_ES,
};
