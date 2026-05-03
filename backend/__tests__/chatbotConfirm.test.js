jest.mock('express-rate-limit', () => () => (req, res, next) => next());
jest.mock('../utils/supabaseserver', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.usuario = { id_usuario: 1, nombre: 'Ana', apellido: 'García', email: 'ana@test.com' };
  next();
});
jest.mock('../utils/aiProvider', () => {
  const { mockProvider } = require('./helpers/mockProvider');
  return mockProvider('ok');
});

const request = require('supertest');
const app = require('../app');
const { supabase } = require('../utils/supabaseserver');
const proposalStore = require('../utils/agent/proposalStore');

function fakeChain(responseFn) {
  // responseFn takes a path object {table, calls, terminator} and returns {data, error}.
  // terminator is 'array' (.then on a finished chain) or 'single' / 'maybeSingle'.
  return jest.fn((table) => {
    const chain = {};
    const path = { table, calls: [], terminator: 'array' };
    ['select', 'eq', 'gte', 'lt', 'order', 'limit', 'ilike', 'not'].forEach(k => {
      chain[k] = jest.fn((...args) => { path.calls.push({ method: k, args }); return chain; });
    });
    chain.then = (r) => { path.terminator = 'array'; return Promise.resolve(responseFn(path)).then(r); };
    chain.maybeSingle = jest.fn(() => { path.terminator = 'maybeSingle'; return Promise.resolve(responseFn(path)); });
    chain.single = jest.fn(() => { path.terminator = 'single'; return Promise.resolve(responseFn(path)); });
    ['insert', 'update', 'delete', 'upsert'].forEach(k => {
      chain[k] = jest.fn((...args) => {
        path.calls.push({ method: k, args });
        const inner = {
          select: jest.fn(() => inner),
          eq: jest.fn(() => inner),
          maybeSingle: jest.fn(() => { path.terminator = 'maybeSingle'; return Promise.resolve(responseFn(path)); }),
          single: jest.fn(() => { path.terminator = 'single'; return Promise.resolve(responseFn(path)); }),
          then: (r) => { path.terminator = 'array'; return Promise.resolve(responseFn(path)).then(r); },
        };
        return inner;
      });
    });
    return chain;
  });
}

beforeEach(() => {
  proposalStore._resetAll();
});

function defaultDb() {
  // Returns reasonable rows for the context-fetch + executor calls.
  // The executor (`aportarMeta`) does .single() to read the meta, then .update()
  // (which we ignore — reaches the inner chain), then a category lookup
  // (.maybeSingle), then an insert into movimiento_financiero.
  supabase.from.mockImplementation(fakeChain((path) => {
    const t = path.table;
    const meta = { id_meta: 5, nombre_meta: 'Cancun', monto_objetivo: 25000, progreso: 5000, fecha_limite: null, id_usuario: 1 };
    if (t === 'categoria') {
      const arr = [{ id_categoria: 1, nombre: 'Restaurantes', tipo: 'gasto' }, { id_categoria: 2, nombre: 'Ahorro', tipo: 'gasto' }];
      if (path.terminator === 'maybeSingle' || path.terminator === 'single') return { data: arr[1], error: null };
      return { data: arr, error: null };
    }
    if (t === 'tarjeta') {
      const arr = [{ id_tarjeta: 10, nombre: 'Visa', tipo: 'Crédito' }];
      if (path.terminator !== 'array') return { data: arr[0], error: null };
      return { data: arr, error: null };
    }
    if (t === 'ahorro_meta') {
      if (path.terminator === 'single' || path.terminator === 'maybeSingle') return { data: meta, error: null };
      return { data: [meta], error: null };
    }
    if (t === 'presupuesto') return { data: [], error: null };
    if (t === 'recurrencia') return { data: [], error: null };
    if (t === 'movimiento_financiero') return { data: { id: 1 }, error: null };
    return { data: [], error: null };
  }));
}

describe('POST /api/chatbot/confirm-action', () => {
  test('400 when proposal_id missing', async () => {
    const res = await request(app).post('/api/chatbot/confirm-action').send({});
    expect(res.status).toBe(400);
  });

  test('404 when proposal_id unknown', async () => {
    defaultDb();
    const res = await request(app).post('/api/chatbot/confirm-action').send({ proposal_id: 'ap_missing' });
    expect(res.status).toBe(404);
  });

  test('403 when proposal belongs to a different user', async () => {
    defaultDb();
    const created = proposalStore.create({
      id_usuario: 99, action: 'proponer_aporte_meta',
      params: { id_meta: 5, monto: 500, id_tarjeta: 10 }, summary_es: 'aporte',
    });
    const res = await request(app).post('/api/chatbot/confirm-action').send({ proposal_id: created.proposal_id });
    expect(res.status).toBe(403);
  });

  test('happy path: executes proposal and returns executed:true', async () => {
    defaultDb();
    const created = proposalStore.create({
      id_usuario: 1, action: 'proponer_aporte_meta',
      params: { id_meta: 5, monto: 500, id_tarjeta: 10 },
      summary_es: 'Aportar $500 a Cancun',
    });
    const res = await request(app).post('/api/chatbot/confirm-action').send({ proposal_id: created.proposal_id });
    expect(res.status).toBe(200);
    expect(res.body.executed).toBe(true);
    expect(res.body.action).toBe('proponer_aporte_meta');
  });

  test('replay returns 404 (proposal removed on first consume to prevent races)', async () => {
    defaultDb();
    const created = proposalStore.create({
      id_usuario: 1, action: 'proponer_aporte_meta',
      params: { id_meta: 5, monto: 500, id_tarjeta: 10 }, summary_es: 'aporte',
    });
    const first = await request(app).post('/api/chatbot/confirm-action').send({ proposal_id: created.proposal_id });
    expect(first.status).toBe(200);
    const second = await request(app).post('/api/chatbot/confirm-action').send({ proposal_id: created.proposal_id });
    expect(second.status).toBe(404);
  });

  test('additional_params can supply id_tarjeta when proposal lacks it', async () => {
    defaultDb();
    const created = proposalStore.create({
      id_usuario: 1, action: 'proponer_aporte_meta',
      params: { id_meta: 5, monto: 500 }, // no id_tarjeta
      summary_es: 'aporte',
      needs: ['id_tarjeta'],
    });
    const res = await request(app).post('/api/chatbot/confirm-action').send({
      proposal_id: created.proposal_id,
      additional_params: { id_tarjeta: 10 },
    });
    expect(res.status).toBe(200);
    expect(res.body.executed).toBe(true);
  });

  test('400 when re-validation rejects bogus additional_params', async () => {
    defaultDb();
    const created = proposalStore.create({
      id_usuario: 1, action: 'proponer_aporte_meta',
      params: { id_meta: 5, monto: 500 }, summary_es: 'aporte', needs: ['id_tarjeta'],
    });
    const res = await request(app).post('/api/chatbot/confirm-action').send({
      proposal_id: created.proposal_id,
      additional_params: { id_tarjeta: 9999 }, // not in user's tarjetas
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Validation/);
  });
});

describe('POST /api/chatbot/cancel-action', () => {
  test('200 when cancelled successfully', async () => {
    defaultDb();
    const created = proposalStore.create({
      id_usuario: 1, action: 'proponer_aporte_meta',
      params: { id_meta: 5, monto: 500 }, summary_es: 'a',
    });
    const res = await request(app).post('/api/chatbot/cancel-action').send({ proposal_id: created.proposal_id });
    expect(res.status).toBe(200);
    expect(res.body.cancelled).toBe(true);
  });

  test('404 when cancelling unknown proposal', async () => {
    const res = await request(app).post('/api/chatbot/cancel-action').send({ proposal_id: 'ap_nope' });
    expect(res.status).toBe(404);
  });

  test('403 when cancelling another user\'s proposal', async () => {
    const created = proposalStore.create({
      id_usuario: 99, action: 'proponer_aporte_meta',
      params: { id_meta: 5, monto: 500 }, summary_es: 'a',
    });
    const res = await request(app).post('/api/chatbot/cancel-action').send({ proposal_id: created.proposal_id });
    expect(res.status).toBe(403);
  });

  test('after cancel, confirm returns 404 (proposal is gone)', async () => {
    defaultDb();
    const created = proposalStore.create({
      id_usuario: 1, action: 'proponer_aporte_meta',
      params: { id_meta: 5, monto: 500, id_tarjeta: 10 }, summary_es: 'a',
    });
    await request(app).post('/api/chatbot/cancel-action').send({ proposal_id: created.proposal_id });
    const confirm = await request(app).post('/api/chatbot/confirm-action').send({ proposal_id: created.proposal_id });
    expect(confirm.status).toBe(404);
  });
});
