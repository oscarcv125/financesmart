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

describe('POST /api/movimientos – input validation', () => {
  test('400 when tipo is invalid', async () => {
    const res = await request(app).post('/api/movimientos').send({
      tipo: 'transferencia', monto: 100, descripcion: 'Hola', id_tarjeta: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tipo/i);
  });

  test('400 when monto is 0', async () => {
    const res = await request(app).post('/api/movimientos').send({
      tipo: 'gasto', monto: 0, descripcion: 'Comida', id_tarjeta: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/monto/i);
  });

  test('400 when monto is negative', async () => {
    const res = await request(app).post('/api/movimientos').send({
      tipo: 'gasto', monto: -50, descripcion: 'Comida', id_tarjeta: 1,
    });
    expect(res.status).toBe(400);
  });

  test('400 when descripcion is empty', async () => {
    const res = await request(app).post('/api/movimientos').send({
      tipo: 'gasto', monto: 100, descripcion: '', id_tarjeta: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/descripci/i);
  });

  test('400 when id_tarjeta is not a number', async () => {
    const res = await request(app).post('/api/movimientos').send({
      tipo: 'gasto', monto: 100, descripcion: 'Test', id_tarjeta: 'abc',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/tarjeta/i);
  });
});

describe('POST /api/movimientos – tarjeta ownership', () => {
  test('404 when tarjeta not found for user', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    const res = await request(app).post('/api/movimientos').send({
      tipo: 'gasto', monto: 200, descripcion: 'Renta', id_tarjeta: 99,
    });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/tarjeta/i);
  });
});

describe('POST /api/movimientos – sign logic', () => {
  function mockTarjeta() {
    let calls = 0;
    supabase.from.mockImplementation(() => {
      calls++;
      if (calls === 1) {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { id_tarjeta: 3 }, error: null }),
        };
      }
      return {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockImplementation(() =>
            Promise.resolve({ data: lastInserted, error: null })
          ),
        }),
      };
    });
  }

  let lastInserted;

  test('gasto stores negative monto in DB', async () => {
    lastInserted = { id: 1, monto: -150, tipo: 'gasto', descripcion: 'Café' };
    mockTarjeta();

    const res = await request(app).post('/api/movimientos').send({
      tipo: 'gasto', monto: 150, descripcion: 'Café', id_tarjeta: 3,
    });
    expect(res.status).toBe(201);
    expect(res.body.monto).toBe(-150);
  });

  test('ingreso stores positive monto in DB', async () => {
    lastInserted = { id: 2, monto: 500, tipo: 'ingreso', descripcion: 'Salario' };
    mockTarjeta();

    const res = await request(app).post('/api/movimientos').send({
      tipo: 'ingreso', monto: 500, descripcion: 'Salario', id_tarjeta: 3,
    });
    expect(res.status).toBe(201);
    expect(res.body.monto).toBe(500);
  });
});

describe('GET /api/movimientos/export – CSV output', () => {
  test('returns CSV with correct content-type and headers', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [
          { id: 1, fecha: '2025-01-15', tipo: 'gasto', monto: -100, descripcion: 'Comida',
            categoria: { nombre: 'Alimentación' }, tarjeta: { nombre: 'Débito' } },
        ],
        error: null,
      }),
    });

    const res = await request(app).get('/api/movimientos/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('id,fecha,tipo,monto,descripcion,categoria,tarjeta');
    expect(res.text).toContain('Comida');
  });
});

describe('DELETE /api/movimientos/:id', () => {
  test('400 with non-numeric ID', async () => {
    const res = await request(app).delete('/api/movimientos/abc');
    expect(res.status).toBe(400);
  });

  test('200 on successful delete', async () => {
    supabase.from.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnThis(),
        then: (r) => Promise.resolve({ error: null }).then(r),
      }),
    });

    const res = await request(app).delete('/api/movimientos/7');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
