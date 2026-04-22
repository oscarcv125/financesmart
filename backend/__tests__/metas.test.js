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

describe('POST /api/metas – input validation', () => {
  test('400 when nombre is missing', async () => {
    const res = await request(app).post('/api/metas').send({ meta: 1000 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nombre/i);
  });

  test('400 when nombre is empty string', async () => {
    const res = await request(app).post('/api/metas').send({ nombre: '   ', meta: 1000 });
    expect(res.status).toBe(400);
  });

  test('400 when meta is 0', async () => {
    const res = await request(app).post('/api/metas').send({ nombre: 'Viaje', meta: 0 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/monto/i);
  });

  test('400 when meta is negative', async () => {
    const res = await request(app).post('/api/metas').send({ nombre: 'Viaje', meta: -200 });
    expect(res.status).toBe(400);
  });

  test('400 when meta is not a number', async () => {
    const res = await request(app).post('/api/metas').send({ nombre: 'Viaje', meta: 'mucho' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/metas – happy path', () => {
  test('201 creates meta and returns it', async () => {
    const created = { id_meta: 5, nombre_meta: 'Viaje', monto_objetivo: 3000, progreso: 0, fecha_limite: null, id_usuario: 1 };
    supabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [created], error: null }),
      }),
    });

    const res = await request(app).post('/api/metas').send({ nombre: 'Viaje', meta: 3000 });
    expect(res.status).toBe(200);
    expect(res.body.nombre_meta).toBe('Viaje');
    expect(res.body.progreso).toBe(0);
  });
});

describe('PATCH /api/metas/:id/aportar – input validation', () => {
  test('400 when id_tarjeta is missing', async () => {
    const res = await request(app).patch('/api/metas/1/aportar').send({ monto: 200 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tarjeta/i);
  });

  test('400 when id_tarjeta is null', async () => {
    const res = await request(app).patch('/api/metas/1/aportar').send({ monto: 200, id_tarjeta: null });
    expect(res.status).toBe(400);
  });

  test('400 when monto is 0', async () => {
    const res = await request(app).patch('/api/metas/1/aportar').send({ monto: 0, id_tarjeta: 3 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/monto/i);
  });

  test('400 when monto is negative', async () => {
    const res = await request(app).patch('/api/metas/1/aportar').send({ monto: -50, id_tarjeta: 3 });
    expect(res.status).toBe(400);
  });

  test('400 when monto is not a number', async () => {
    const res = await request(app).patch('/api/metas/1/aportar').send({ monto: 'abc', id_tarjeta: 3 });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/metas/:id', () => {
  test('200 on successful delete', async () => {
    supabase.from.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        then: (r) => Promise.resolve({ error: null }).then(r),
      }),
    });

    const res = await request(app).delete('/api/metas/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
