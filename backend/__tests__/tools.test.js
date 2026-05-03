const { buildToolRegistry } = require('../utils/tools');

function fakeSupabase({
  categorias = [{ id_categoria: 1, nombre: 'Restaurantes', tipo: 'gasto' }, { id_categoria: 2, nombre: 'Transporte', tipo: 'gasto' }],
  tarjetas = [{ id_tarjeta: 10, nombre: 'Visa', tipo: 'Crédito' }],
  metas = [{ id_meta: 5, nombre_meta: 'Cancun', monto_objetivo: 25000, progreso: 5000, fecha_limite: null }],
  presupuestos = [],
  recurrencias = [],
  movimientos = [],
} = {}) {
  return {
    from(table) {
      const rows = ({
        categoria: categorias,
        tarjeta: tarjetas,
        ahorro_meta: metas,
        presupuesto: presupuestos,
        recurrencia: recurrencias,
        movimiento_financiero: movimientos,
      })[table] || [];
      const chain = {};
      ['select', 'eq', 'gte', 'lt', 'order', 'limit', 'ilike', 'not'].forEach(k => { chain[k] = () => chain; });
      chain.then = (r) => Promise.resolve({ data: rows, error: null }).then(r);
      chain.maybeSingle = () => Promise.resolve({ data: rows[0] || null, error: null });
      chain.single = () => Promise.resolve({ data: rows[0] || null, error: null });
      return chain;
    },
  };
}

describe('Tool registry — context + validation', () => {
  test('lists all expected tool names', async () => {
    const reg = await buildToolRegistry({ supabase: fakeSupabase(), id_usuario: 1 });
    expect(reg.names).toEqual(expect.arrayContaining([
      'obtener_resumen_mes',
      'obtener_movimientos',
      'obtener_gastos_por_categoria',
      'obtener_metas_ahorro',
      'obtener_presupuestos',
      'obtener_recurrencias',
      'obtener_tarjetas',
      'obtener_salud_financiera',
      'obtener_insights_automaticos',
    ]));
  });

  test('builds Gemini function declarations with proper shape', async () => {
    const reg = await buildToolRegistry({ supabase: fakeSupabase(), id_usuario: 1 });
    const decl = reg.geminiDeclaration('obtener_movimientos');
    expect(decl.name).toBe('obtener_movimientos');
    expect(decl.description).toMatch(/movimientos/i);
    expect(decl.parameters.type).toBe('object');
    expect(decl.parameters.properties.fecha_inicio).toBeDefined();
    expect(decl.parameters.properties.fecha_inicio.pattern).toBe('^\\d{4}-\\d{2}-\\d{2}$');
  });

  test('rejects malformed dates with INVALID_DATE_FORMAT (no DB call)', async () => {
    const supa = fakeSupabase();
    const fromSpy = jest.spyOn(supa, 'from');
    const reg = await buildToolRegistry({ supabase: supa, id_usuario: 1 });
    const callsBefore = fromSpy.mock.calls.length;

    const r = await reg.exec('obtener_movimientos', { fecha_inicio: 'abril 2026' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('INVALID_DATE_FORMAT');
    // No additional supabase.from() calls happened — validation rejected before query.
    expect(fromSpy.mock.calls.length).toBe(callsBefore);
  });

  test('rejects fabricated category IDs with CATEGORIA_NO_VALIDA', async () => {
    const reg = await buildToolRegistry({ supabase: fakeSupabase(), id_usuario: 1 });
    const r = await reg.exec('obtener_movimientos', { id_categoria: 9999 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('CATEGORIA_NO_VALIDA');
  });

  test('rejects inverted date range with RANGO_INVERTIDO', async () => {
    const reg = await buildToolRegistry({ supabase: fakeSupabase(), id_usuario: 1 });
    const r = await reg.exec('obtener_movimientos', { fecha_inicio: '2026-05-01', fecha_fin: '2026-01-01' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('RANGO_INVERTIDO');
  });

  test('caps limite at 500 (raised from 100 to support year-long pulls)', async () => {
    const reg = await buildToolRegistry({ supabase: fakeSupabase(), id_usuario: 1 });
    const ok = await reg.exec('obtener_movimientos', { limite: 500 });
    expect(ok.ok).toBe(true);
    const tooBig = await reg.exec('obtener_movimientos', { limite: 9999 });
    expect(tooBig.ok).toBe(false);
  });

  test('returns ok with derived metas data', async () => {
    const reg = await buildToolRegistry({ supabase: fakeSupabase(), id_usuario: 1 });
    const r = await reg.exec('obtener_metas_ahorro', {});
    expect(r.ok).toBe(true);
    expect(r.data[0].nombre).toBe('Cancun');
    expect(r.data[0].pct).toBe(20); // 5000 / 25000
  });

  test('returns TOOL_NO_ENCONTRADA for unknown tool', async () => {
    const reg = await buildToolRegistry({ supabase: fakeSupabase(), id_usuario: 1 });
    const r = await reg.exec('hack_database', {});
    expect(r.ok).toBe(false);
    expect(r.error).toBe('TOOL_NO_ENCONTRADA');
  });

  test('catches executor errors and returns INTERNAL', async () => {
    const supa = fakeSupabase();
    // Override the from() for movimiento_financiero to throw
    const origFrom = supa.from;
    supa.from = (t) => {
      if (t === 'ahorro_meta') {
        return {
          select: () => ({ eq: () => ({ order: () => Promise.reject(new Error('DB exploded')) }) }),
        };
      }
      return origFrom(t);
    };
    const reg = await buildToolRegistry({ supabase: supa, id_usuario: 1 });
    const r = await reg.exec('obtener_metas_ahorro', {});
    expect(r.ok).toBe(false);
    expect(r.error).toBe('INTERNAL');
    expect(r.mensaje).toMatch(/DB exploded/);
  });
});
