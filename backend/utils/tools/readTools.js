const { listMovimientos } = require('../../routes/movimientos');
const { listMetas } = require('../../routes/metas');
const { listPresupuestos } = require('../../routes/presupuestos');
const { listRecurrencias } = require('../../routes/recurrencias');
const { computeInsights } = require('../../routes/insights');
const { listPlanes, computeAdherencia } = require('../../routes/planes');

const MAX_RESULT_BYTES = 25 * 1024;

function maybeTruncate(rows, label = 'rows') {
  const json = JSON.stringify(rows);
  if (json.length <= MAX_RESULT_BYTES) return rows;
  // Cut to a sample plus a marker so the model knows.
  const sample = rows.slice(0, Math.max(1, Math.floor(rows.length / 4)));
  return { __truncated: true, total: rows.length, sample, hint: `Resultado truncado: ${rows.length} ${label} > 25KB. Usa filtros más específicos.` };
}

function monthBoundsFromEnum(mes) {
  const offsetMap = { actual: 0, anterior: -1, hace_2: -2, hace_3: -3 };
  const offset = offsetMap[mes] ?? 0;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  const first = new Date(y, m, 1).toISOString().split('T')[0];
  const firstNext = new Date(y, m + 1, 1).toISOString().split('T')[0];
  return { first, firstNext };
}

function buildReadTools(ctx) {
  return {
    async obtener_resumen_mes({ mes }) {
      const { first, firstNext } = monthBoundsFromEnum(mes);
      const { data, error } = await ctx.supabase
        .from('movimiento_financiero')
        .select('monto, tipo')
        .eq('id_usuario', ctx.id_usuario)
        .gte('fecha', first)
        .lt('fecha', firstNext);
      if (error) throw error;
      const ingresos = (data || []).filter(m => m.tipo?.toLowerCase() === 'ingreso')
        .reduce((acc, m) => acc + Number(m.monto), 0);
      const gastos = (data || []).filter(m => m.tipo?.toLowerCase() === 'gasto')
        .reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);
      return { mes, ingresos, gastos, saldo: ingresos - gastos, periodo: { desde: first, hasta_excl: firstNext } };
    },

    async obtener_resumen_periodo({ fecha_inicio, fecha_fin }) {
      // hasta_incl is treated as inclusive — model thinks of `fecha_fin` as the last day to include
      const { data, error } = await ctx.supabase
        .from('movimiento_financiero')
        .select('monto, tipo, fecha')
        .eq('id_usuario', ctx.id_usuario)
        .gte('fecha', fecha_inicio)
        .lte('fecha', fecha_fin);
      if (error) throw error;
      const rows = data || [];
      const ingresos = rows.filter(m => m.tipo?.toLowerCase() === 'ingreso')
        .reduce((acc, m) => acc + Number(m.monto), 0);
      const gastos = rows.filter(m => m.tipo?.toLowerCase() === 'gasto')
        .reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);
      // Per-month breakdown for trend analysis
      const byMonth = new Map();
      for (const m of rows) {
        const key = m.fecha.slice(0, 7); // YYYY-MM
        const e = byMonth.get(key) || { mes: key, ingresos: 0, gastos: 0 };
        if (m.tipo?.toLowerCase() === 'ingreso') e.ingresos += Number(m.monto);
        else if (m.tipo?.toLowerCase() === 'gasto') e.gastos += Math.abs(Number(m.monto));
        byMonth.set(key, e);
      }
      return {
        periodo: { desde: fecha_inicio, hasta_incl: fecha_fin },
        ingresos_total: ingresos,
        gastos_total: gastos,
        saldo: ingresos - gastos,
        movimientos_count: rows.length,
        por_mes: [...byMonth.values()].sort((a, b) => a.mes.localeCompare(b.mes)),
      };
    },

    async obtener_movimientos(args) {
      const rows = await listMovimientos(
        { supabase: ctx.supabase, id_usuario: ctx.id_usuario },
        {
          desde: args.fecha_inicio,
          hasta: args.fecha_fin,
          tipo: args.tipo,
          tarjetaId: args.id_tarjeta,
          categoriaId: args.id_categoria,
          limit: args.limite,
        }
      );
      return maybeTruncate(rows, 'movimientos');
    },

    async obtener_gastos_por_categoria({ mes }) {
      const { first, firstNext } = monthBoundsFromEnum(mes);
      const { data, error } = await ctx.supabase
        .from('movimiento_financiero')
        .select('monto, tipo, id_categoria, categoria(nombre)')
        .eq('id_usuario', ctx.id_usuario)
        .gte('fecha', first)
        .lt('fecha', firstNext);
      if (error) throw error;
      const acc = new Map();
      for (const m of data || []) {
        if (m.tipo?.toLowerCase() !== 'gasto') continue;
        const k = m.categoria?.nombre || 'Otros';
        acc.set(k, (acc.get(k) || 0) + Math.abs(Number(m.monto)));
      }
      return [...acc.entries()]
        .map(([categoria, total]) => ({ categoria, total }))
        .sort((a, b) => b.total - a.total);
    },

    async obtener_gastos_por_categoria_periodo({ fecha_inicio, fecha_fin }) {
      const { data, error } = await ctx.supabase
        .from('movimiento_financiero')
        .select('monto, tipo, id_categoria, categoria(nombre)')
        .eq('id_usuario', ctx.id_usuario)
        .gte('fecha', fecha_inicio)
        .lte('fecha', fecha_fin);
      if (error) throw error;
      const acc = new Map();
      for (const m of data || []) {
        if (m.tipo?.toLowerCase() !== 'gasto') continue;
        const k = m.categoria?.nombre || 'Otros';
        acc.set(k, (acc.get(k) || 0) + Math.abs(Number(m.monto)));
      }
      return {
        periodo: { desde: fecha_inicio, hasta_incl: fecha_fin },
        categorias: [...acc.entries()]
          .map(([categoria, total]) => ({ categoria, total }))
          .sort((a, b) => b.total - a.total),
      };
    },

    async obtener_metas_ahorro() {
      const data = await listMetas({ supabase: ctx.supabase, id_usuario: ctx.id_usuario });
      return (data || []).map(m => ({
        id_meta: m.id_meta,
        nombre: m.nombre_meta,
        monto_objetivo: Number(m.monto_objetivo),
        progreso: Number(m.progreso),
        pct: m.monto_objetivo > 0 ? Math.round((Number(m.progreso) / Number(m.monto_objetivo)) * 100) : 0,
        fecha_limite: m.fecha_limite,
      }));
    },

    async obtener_presupuestos() {
      return await listPresupuestos({ supabase: ctx.supabase, id_usuario: ctx.id_usuario });
    },

    async obtener_recurrencias({ solo_activas }) {
      const all = await listRecurrencias(
        { supabase: ctx.supabase, id_usuario: ctx.id_usuario },
        { materialize: false, solo_activas },
      );
      return (all || []).map(r => ({
        id_recurrencia: r.id_recurrencia,
        descripcion: r.descripcion,
        monto: Math.abs(Number(r.monto)),
        tipo: r.tipo,
        dia_del_mes: r.dia_del_mes,
        activo: r.activo,
        categoria: r.categoria?.nombre,
        tarjeta: r.tarjeta?.nombre,
      }));
    },

    async obtener_tarjetas() {
      return ctx.tarjetas.map(t => ({ id_tarjeta: t.id_tarjeta, nombre: t.nombre, tipo: t.tipo }));
    },

    async obtener_salud_financiera() {
      // Prefer a refactored computeScore if available; otherwise compute inline.
      let computeScore;
      try { computeScore = require('../../routes/health').computeScore; } catch { /* */ }
      if (typeof computeScore === 'function') {
        return await computeScore({ supabase: ctx.supabase, id_usuario: ctx.id_usuario });
      }
      // Fallback: minimal score based on saldo positivity (placeholder).
      const resumen = await this.obtener_resumen_mes({ mes: 'actual' });
      return {
        score: resumen.saldo > 0 ? 70 : 30,
        breakdown: { ahorro: resumen.saldo > 0 ? 28 : 0, presupuestos: 25, metas: resumen.saldo > 0 ? 17 : 5 },
        nota: 'Cálculo simplificado; consulta /api/health para detalle.',
      };
    },

    async obtener_insights_automaticos() {
      const result = await computeInsights({ supabase: ctx.supabase, id_usuario: ctx.id_usuario });
      return result.insights || [];
    },

    async obtener_planes({ estado } = {}) {
      const planes = await listPlanes({ supabase: ctx.supabase, id_usuario: ctx.id_usuario }, { estado });
      return planes || [];
    },

    async obtener_adherencia_plan({ id_plan }) {
      return await computeAdherencia({
        supabase: ctx.supabase,
        id_usuario: ctx.id_usuario,
        id_plan,
      });
    },
  };
}

module.exports = { buildReadTools, monthBoundsFromEnum, maybeTruncate };
