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

// Mirror of monthRange helper from presupuestos.js
function monthRange(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  const first = new Date(y, m, 1).toISOString().split('T')[0];
  const firstNext = new Date(y, m + 1, 1).toISOString().split('T')[0];
  return { first, firstNext };
}

describe('monthRange – pure logic', () => {
  test('first day is always the 1st', () => {
    const { first } = monthRange(new Date('2025-06-15'));
    expect(first).toBe('2025-06-01');
  });

  test('firstNext is the 1st of the following month', () => {
    const { firstNext } = monthRange(new Date('2025-06-15'));
    expect(firstNext).toBe('2025-07-01');
  });

  test('December wraps to January of next year', () => {
    const { first, firstNext } = monthRange(new Date('2025-12-20'));
    expect(first).toBe('2025-12-01');
    expect(firstNext).toBe('2026-01-01');
  });

  test('January starts at Jan 1', () => {
    const { first, firstNext } = monthRange(new Date('2025-01-10'));
    expect(first).toBe('2025-01-01');
    expect(firstNext).toBe('2025-02-01');
  });
});

describe('POST /api/presupuestos – input validation', () => {
  test('400 when id_categoria is missing', async () => {
    const res = await request(app).post('/api/presupuestos').send({ monto: 500 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/categor/i);
  });

  test('400 when id_categoria is a string', async () => {
    const res = await request(app).post('/api/presupuestos').send({ id_categoria: 'abc', monto: 500 });
    expect(res.status).toBe(400);
  });

  test('400 when monto is 0', async () => {
    const res = await request(app).post('/api/presupuestos').send({ id_categoria: 3, monto: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/monto/i);
  });

  test('400 when monto is negative', async () => {
    const res = await request(app).post('/api/presupuestos').send({ id_categoria: 3, monto: -100 });
    expect(res.status).toBe(400);
  });

  test('400 when monto is not a number', async () => {
    const res = await request(app).post('/api/presupuestos').send({ id_categoria: 3, monto: 'mucho' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/presupuestos – upsert happy path', () => {
  test('201 on successful upsert', async () => {
    const created = { id_presupuesto: 1, id_usuario: 1, id_categoria: 3, monto: 2000 };
    supabase.from.mockReturnValue({
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: created, error: null }),
      }),
    });

    const res = await request(app).post('/api/presupuestos').send({ id_categoria: 3, monto: 2000 });
    expect(res.status).toBe(201);
    expect(res.body.monto).toBe(2000);
  });
});

describe('DELETE /api/presupuestos/:id', () => {
  test('400 with non-numeric ID', async () => {
    const res = await request(app).delete('/api/presupuestos/abc');
    expect(res.status).toBe(400);
  });

  test('200 on successful delete', async () => {
    supabase.from.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        then: (r) => Promise.resolve({ error: null }).then(r),
      }),
    });

    const res = await request(app).delete('/api/presupuestos/2');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
