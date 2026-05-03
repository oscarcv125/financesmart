const { buildAgentContext } = require('../utils/tools/context');

function fakeSupabase(tables) {
  return {
    from(name) {
      const data = tables[name] || [];
      const builder = {
        select: () => builder,
        eq: () => Promise.resolve({ data, error: null }),
      };
      // Plain awaitable for the tables fetched without .eq() (categoria).
      builder.then = (resolve) => resolve({ data, error: null });
      return builder;
    },
  };
}

describe('buildAgentContext', () => {
  test('builds Sets and Maps from each table', async () => {
    const supabase = fakeSupabase({
      categoria: [
        { id_categoria: 1, nombre: 'Restaurantes', tipo: 'gasto' },
        { id_categoria: 2, nombre: 'Transporte', tipo: 'gasto' },
      ],
      tarjeta: [
        { id_tarjeta: 10, nombre: 'Banorte Crédito', tipo: 'credito' },
      ],
      ahorro_meta: [
        { id_meta: 100, nombre_meta: 'Cancún', monto_objetivo: 25000, progreso: 9000 },
      ],
      presupuesto: [
        { id_presupuesto: 1000, id_categoria: 1, monto: 2500, categoria: { nombre: 'Restaurantes' } },
      ],
      recurrencia: [
        { id_recurrencia: 5000, descripcion: 'Netflix', monto: 139, tipo: 'gasto', dia_del_mes: 5, activo: true },
      ],
    });

    const ctx = await buildAgentContext({ supabase, id_usuario: 67 });

    expect(ctx.id_usuario).toBe(67);
    expect(ctx.categoriaIds.has(1)).toBe(true);
    expect(ctx.categoriaIds.has(999)).toBe(false);
    expect(ctx.categoriaNombres.get(1)).toBe('Restaurantes');
    expect(ctx.categoriaByNombre.get('restaurantes').id_categoria).toBe(1);
    expect(ctx.tarjetaIds.has(10)).toBe(true);
    expect(ctx.tarjetaIds.has(11)).toBe(false);
    expect(ctx.metasById.get(100).nombre_meta).toBe('Cancún');
    expect(ctx.presupuestosById.get(1000).monto).toBe(2500);
    expect(ctx.recurrenciasById.get(5000).descripcion).toBe('Netflix');
  });

  test('throws when any context fetch errors (defense against partial validation)', async () => {
    const supabase = {
      from(name) {
        const builder = {
          select: () => builder,
          eq: () => Promise.resolve({ data: null, error: { message: `boom ${name}` } }),
        };
        builder.then = (resolve) => resolve({ data: null, error: { message: `boom ${name}` } });
        return builder;
      },
    };
    await expect(buildAgentContext({ supabase, id_usuario: 1 })).rejects.toThrow(/Context fetch failed/);
  });
});
