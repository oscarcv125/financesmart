const { buildToolRegistry } = require('../utils/tools');
const proposalStore = require('../utils/agent/proposalStore');

function fakeSupabase({
  categorias = [{ id_categoria: 1, nombre: 'Restaurantes', tipo: 'gasto' }],
  tarjetas = [{ id_tarjeta: 10, nombre: 'Visa', tipo: 'Crédito' }],
  metas = [{ id_meta: 5, nombre_meta: 'Cancun', monto_objetivo: 25000, progreso: 5000 }],
  presupuestos = [],
  recurrencias = [],
} = {}) {
  return {
    from(table) {
      const rows = ({
        categoria: categorias,
        tarjeta: tarjetas,
        ahorro_meta: metas,
        presupuesto: presupuestos,
        recurrencia: recurrencias,
      })[table] || [];
      const chain = {};
      ['select', 'eq', 'gte', 'lt', 'order', 'limit', 'ilike', 'not'].forEach(k => { chain[k] = () => chain; });
      chain.then = (r) => Promise.resolve({ data: rows, error: null }).then(r);
      return chain;
    },
  };
}

describe('Write tools — proposal-only execution', () => {
  beforeEach(() => proposalStore._resetAll());

  test('write tools NOT exposed when includeWrites=false (default)', async () => {
    const reg = await buildToolRegistry({ supabase: fakeSupabase(), id_usuario: 1 });
    expect(reg.names).not.toContain('proponer_aporte_meta');
    expect(reg.names).not.toContain('proponer_crear_presupuesto');
  });

  test('write tools exposed when includeWrites=true', async () => {
    const reg = await buildToolRegistry({ supabase: fakeSupabase(), id_usuario: 1, opts: { includeWrites: true } });
    expect(reg.names).toEqual(expect.arrayContaining([
      'proponer_aporte_meta', 'proponer_crear_presupuesto', 'proponer_modificar_presupuesto',
      'proponer_toggle_recurrencia', 'proponer_crear_meta',
    ]));
  });

  test('proponer_aporte_meta emits proposal, does NOT mutate', async () => {
    const supa = fakeSupabase();
    const fromSpy = jest.spyOn(supa, 'from');
    const events = [];
    const send = (type, payload) => events.push({ type, ...payload });
    const reg = await buildToolRegistry({ supabase: supa, id_usuario: 1, opts: { includeWrites: true, send } });
    const callsBefore = fromSpy.mock.calls.length;

    const r = await reg.exec('proponer_aporte_meta', { id_meta: 5, monto: 500 });
    expect(r.ok).toBe(true);
    expect(r.data.status).toBe('proposal_emitted');
    expect(r.data.proposal_id).toMatch(/^ap_/);

    // No additional from() calls since context was already built — nothing
    // was queried/mutated by the write tool itself.
    expect(fromSpy.mock.calls.length).toBe(callsBefore);

    // SSE event was emitted
    const evt = events.find(e => e.type === 'action_proposal');
    expect(evt).toBeDefined();
    expect(evt.action).toBe('proponer_aporte_meta');
    expect(evt.summary_es).toMatch(/Aportar/);
    expect(evt.summary_es).toMatch(/Cancun/);
    expect(evt.needs).toContain('id_tarjeta'); // missing id_tarjeta → UI must collect
  });

  test('proponer_aporte_meta with id_tarjeta has empty needs', async () => {
    const events = [];
    const reg = await buildToolRegistry({
      supabase: fakeSupabase(), id_usuario: 1,
      opts: { includeWrites: true, send: (t, p) => events.push({ type: t, ...p }) },
    });
    await reg.exec('proponer_aporte_meta', { id_meta: 5, monto: 500, id_tarjeta: 10 });
    const evt = events.find(e => e.type === 'action_proposal');
    expect(evt.needs).toEqual([]);
  });

  test('rejects fabricated id_meta with META_NO_ENCONTRADA before any proposal', async () => {
    const events = [];
    const reg = await buildToolRegistry({
      supabase: fakeSupabase(), id_usuario: 1,
      opts: { includeWrites: true, send: (t, p) => events.push({ type: t, ...p }) },
    });
    const r = await reg.exec('proponer_aporte_meta', { id_meta: 999, monto: 100 });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('META_NO_ENCONTRADA');
    expect(events.find(e => e.type === 'action_proposal')).toBeUndefined();
  });

  test('caps monto at 200000', async () => {
    const reg = await buildToolRegistry({
      supabase: fakeSupabase(), id_usuario: 1,
      opts: { includeWrites: true, send: () => {} },
    });
    const r = await reg.exec('proponer_aporte_meta', { id_meta: 5, monto: 1000000 });
    expect(r.ok).toBe(false);
  });

  test('proponer_crear_meta proposal contains nombre + monto in summary', async () => {
    const events = [];
    const reg = await buildToolRegistry({
      supabase: fakeSupabase(), id_usuario: 1,
      opts: { includeWrites: true, send: (t, p) => events.push({ type: t, ...p }) },
    });
    await reg.exec('proponer_crear_meta', { nombre: 'Coche nuevo', monto_objetivo: 50000 });
    const evt = events.find(e => e.type === 'action_proposal');
    expect(evt.summary_es).toMatch(/Coche nuevo/);
    expect(evt.summary_es).toMatch(/50000/);
  });

  test('proposal store enforces max-per-user when many writes proposed', async () => {
    const events = [];
    const reg = await buildToolRegistry({
      supabase: fakeSupabase(), id_usuario: 1,
      opts: { includeWrites: true, send: (t, p) => events.push({ type: t, ...p }) },
    });
    let lastResult;
    for (let i = 0; i < proposalStore.MAX_PER_USER + 2; i++) {
      lastResult = await reg.exec('proponer_aporte_meta', { id_meta: 5, monto: 10 + i });
    }
    // Last result should be rejected
    expect(lastResult.ok).toBe(true);
    expect(lastResult.data.status).toBe('proposal_rejected');
    expect(lastResult.data.error).toBe('TOO_MANY_PROPOSALS');
  });
});
