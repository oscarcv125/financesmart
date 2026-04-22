jest.mock('../utils/supabaseserver', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.usuario = { id_usuario: 1, nombre: 'Test', apellido: 'User', email: 'test@example.com' };
  next();
});

const request = require('supertest');
const app = require('../app');
const { supabase } = require('../utils/supabaseserver');

// Mirror of the pure helper function in recurrencias.js (tested independently)
function ymd(d) { return d.toISOString().split('T')[0]; }
function dueDatesSince(fechaInicio, ultimaEjecucion, dia, hoy = new Date()) {
  const startRaw = ultimaEjecucion
    ? new Date(ultimaEjecucion + 'T00:00:00')
    : new Date(fechaInicio + 'T00:00:00');
  const out = [];
  const cursor = new Date(startRaw.getFullYear(), startRaw.getMonth(), 1);
  while (cursor <= hoy) {
    const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), dia);
    if (candidate <= hoy && candidate > startRaw) out.push(ymd(candidate));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

describe('dueDatesSince – pure logic', () => {
  const JAN_15 = new Date('2025-01-15T12:00:00');

  test('no dates when execution already happened this month', () => {
    const dates = dueDatesSince('2025-01-01', '2025-01-10', 5, JAN_15);
    expect(dates).toEqual([]);
  });

  test('one date when execution is due this month (not yet executed)', () => {
    // Day 20 is due, last execution was Jan 1
    const dates = dueDatesSince('2025-01-01', '2025-01-01', 20, JAN_15);
    // Jan 20 > Jan 15? No — Jan 15 is hoy, Jan 20 is in the future → empty
    expect(dates).toEqual([]);
  });

  test('returns due date when hoy is past the due day', () => {
    const hoy = new Date('2025-01-20T12:00:00');
    const dates = dueDatesSince('2025-01-01', null, 10, hoy);
    // candidate = Jan 10, startRaw = Jan 1 → Jan 10 > Jan 1 and Jan 10 <= Jan 20 → included
    expect(dates).toContain('2025-01-10');
  });

  test('catches up multiple missed months', () => {
    const hoy = new Date('2025-03-31T12:00:00');
    const dates = dueDatesSince('2025-01-01', null, 15, hoy);
    expect(dates).toContain('2025-01-15');
    expect(dates).toContain('2025-02-15');
    expect(dates).toContain('2025-03-15');
    expect(dates.length).toBe(3);
  });

  test('does not include dates before fechaInicio', () => {
    const hoy = new Date('2025-03-01T12:00:00');
    const dates = dueDatesSince('2025-02-01', null, 15, hoy);
    expect(dates).toContain('2025-02-15');
    expect(dates).not.toContain('2025-01-15');
  });
});

describe('POST /api/recurrencias – input validation', () => {
  test('400 when tipo is invalid', async () => {
    const res = await request(app).post('/api/recurrencias').send({
      tipo: 'pago', monto: 100, descripcion: 'Netflix', id_tarjeta: 1, dia_del_mes: 5,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tipo/i);
  });

  test('400 when monto is 0', async () => {
    const res = await request(app).post('/api/recurrencias').send({
      tipo: 'gasto', monto: 0, descripcion: 'Netflix', id_tarjeta: 1, dia_del_mes: 5,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/monto/i);
  });

  test('400 when descripcion is empty', async () => {
    const res = await request(app).post('/api/recurrencias').send({
      tipo: 'gasto', monto: 200, descripcion: '', id_tarjeta: 1, dia_del_mes: 5,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/descripci/i);
  });

  test('400 when id_tarjeta is missing', async () => {
    const res = await request(app).post('/api/recurrencias').send({
      tipo: 'gasto', monto: 200, descripcion: 'Netflix', dia_del_mes: 5,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tarjeta/i);
  });

  test('400 when dia_del_mes is 0', async () => {
    const res = await request(app).post('/api/recurrencias').send({
      tipo: 'gasto', monto: 200, descripcion: 'Netflix', id_tarjeta: 1, dia_del_mes: 0,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/d[íi]a/i);
  });

  test('400 when dia_del_mes is 29 (out of range)', async () => {
    const res = await request(app).post('/api/recurrencias').send({
      tipo: 'gasto', monto: 200, descripcion: 'Netflix', id_tarjeta: 1, dia_del_mes: 29,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/d[íi]a/i);
  });
});

describe('PATCH /api/recurrencias/:id – input validation', () => {
  test('400 with non-numeric ID', async () => {
    const res = await request(app).patch('/api/recurrencias/abc').send({ activo: false });
    expect(res.status).toBe(400);
  });

  test('400 when body has no updatable fields', async () => {
    const res = await request(app).patch('/api/recurrencias/1').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nada/i);
  });

  test('400 when activo is not a boolean', async () => {
    const res = await request(app).patch('/api/recurrencias/1').send({ activo: 'si' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/recurrencias/:id', () => {
  test('400 with non-numeric ID', async () => {
    const res = await request(app).delete('/api/recurrencias/xyz');
    expect(res.status).toBe(400);
  });

  test('200 on successful delete', async () => {
    supabase.from.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        then: (r) => Promise.resolve({ error: null }).then(r),
      }),
    });

    const res = await request(app).delete('/api/recurrencias/4');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
