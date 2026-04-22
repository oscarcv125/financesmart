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

describe('POST /api/tarjetas – input validation', () => {
  test('400 when nombre is missing', async () => {
    const res = await request(app).post('/api/tarjetas').send({ tipo: 'Débito' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nombre/i);
  });

  test('400 when nombre is empty string', async () => {
    const res = await request(app).post('/api/tarjetas').send({ nombre: '  ', tipo: 'Débito' });
    expect(res.status).toBe(400);
  });

  test('400 when tipo is invalid', async () => {
    const res = await request(app).post('/api/tarjetas').send({ nombre: 'Mi tarjeta', tipo: 'Prepago' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tipo/i);
  });

  test('400 when tipo is missing', async () => {
    const res = await request(app).post('/api/tarjetas').send({ nombre: 'Mi tarjeta' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/tarjetas – happy path', () => {
  test('201 with valid Débito card', async () => {
    const created = { id_tarjeta: 10, nombre: 'Nómina', tipo: 'Débito', id_usuario: 1 };
    supabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: created, error: null }),
        }),
      }),
    });

    const res = await request(app).post('/api/tarjetas').send({ nombre: 'Nómina', tipo: 'Débito' });
    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe('Débito');
  });

  test('201 with valid Crédito card', async () => {
    const created = { id_tarjeta: 11, nombre: 'Platinum', tipo: 'Crédito', id_usuario: 1 };
    supabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: created, error: null }),
        }),
      }),
    });

    const res = await request(app).post('/api/tarjetas').send({ nombre: 'Platinum', tipo: 'Crédito' });
    expect(res.status).toBe(201);
  });
});

describe('PATCH /api/tarjetas/:id – input validation', () => {
  test('400 with non-numeric ID', async () => {
    const res = await request(app).patch('/api/tarjetas/abc').send({ nombre: 'Nueva' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/id/i);
  });

  test('400 when nombre is empty string', async () => {
    const res = await request(app).patch('/api/tarjetas/5').send({ nombre: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nombre/i);
  });

  test('400 when tipo is invalid', async () => {
    const res = await request(app).patch('/api/tarjetas/5').send({ tipo: 'Virtual' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tipo/i);
  });

  test('400 when body has no updatable fields', async () => {
    const res = await request(app).patch('/api/tarjetas/5').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/nada/i);
  });
});

describe('PATCH /api/tarjetas/:id – happy path', () => {
  test('404 when tarjeta not found for this user', async () => {
    supabase.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const res = await request(app).patch('/api/tarjetas/999').send({ nombre: 'Otro' });
    expect(res.status).toBe(404);
  });

  test('200 on successful update', async () => {
    const updated = { id_tarjeta: 5, nombre: 'Actualizada', tipo: 'Crédito', id_usuario: 1 };
    supabase.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: updated, error: null }),
      }),
    });

    const res = await request(app).patch('/api/tarjetas/5').send({ nombre: 'Actualizada' });
    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe('Actualizada');
  });
});

describe('DELETE /api/tarjetas/:id', () => {
  test('400 with non-numeric ID', async () => {
    const res = await request(app).delete('/api/tarjetas/xyz');
    expect(res.status).toBe(400);
  });

  test('409 when tarjeta has associated movimientos', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      then: (r) => Promise.resolve({ count: 3 }).then(r),
    });

    const res = await request(app).delete('/api/tarjetas/5');
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/movimientos/i);
  });

  test('200 on successful delete', async () => {
    let callCount = 0;
    supabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: (r) => Promise.resolve({ count: 0 }).then(r),
        };
      }
      return {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          then: (r) => Promise.resolve({ error: null }).then(r),
        }),
      };
    });

    const res = await request(app).delete('/api/tarjetas/5');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
