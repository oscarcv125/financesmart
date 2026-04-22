jest.mock('../utils/supabaseserver', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.usuario = { id_usuario: 1, nombre: 'María', apellido: 'Pérez', email: 'test@example.com' };
  next();
});

const request = require('supertest');
const app = require('../app');
const { supabase } = require('../utils/supabaseserver');

function mockMovimientos(movimientos) {
  const result = { data: movimientos, error: null };
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: (r, j) => Promise.resolve(result).then(r, j),
    catch: (f) => Promise.resolve(result).catch(f),
  };
  supabase.from.mockReturnValue(chain);
}

describe('GET /api/dashboard', () => {
  test('returns nombreUsuario with nombre and apellido', async () => {
    mockMovimientos([]);
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.nombreUsuario).toBe('María Pérez');
  });

  test('calculates ingresos correctly', async () => {
    mockMovimientos([
      { tipo: 'ingreso', monto: '1000', categoria: { nombre: 'Salario' } },
      { tipo: 'ingreso', monto: '500', categoria: { nombre: 'Freelance' } },
    ]);
    const res = await request(app).get('/api/dashboard');
    expect(res.body.totales.ingresos).toBe(1500);
  });

  test('calculates gastos correctly (uses absolute value)', async () => {
    mockMovimientos([
      { tipo: 'gasto', monto: '-200', categoria: { nombre: 'Comida' } },
      { tipo: 'gasto', monto: '-50', categoria: { nombre: 'Transporte' } },
    ]);
    const res = await request(app).get('/api/dashboard');
    expect(res.body.totales.gastos).toBe(250);
  });

  test('calculates saldo as ingresos minus gastos', async () => {
    mockMovimientos([
      { tipo: 'ingreso', monto: '3000', categoria: null },
      { tipo: 'gasto', monto: '-800', categoria: null },
    ]);
    const res = await request(app).get('/api/dashboard');
    expect(res.body.totales.ingresos).toBe(3000);
    expect(res.body.totales.gastos).toBe(800);
    expect(res.body.totales.saldo).toBe(2200);
  });

  test('returns empty totals for new user with no movimientos', async () => {
    mockMovimientos([]);
    const res = await request(app).get('/api/dashboard');
    expect(res.body.totales).toEqual({ ingresos: 0, gastos: 0, saldo: 0 });
  });

  test('returns tarjetaSeleccionada as "Global" when no tarjetaId query param', async () => {
    mockMovimientos([]);
    const res = await request(app).get('/api/dashboard');
    expect(res.body.tarjetaSeleccionada).toBe('Global');
  });

  test('returns tarjetaSeleccionada when tarjetaId is provided', async () => {
    mockMovimientos([]);
    const res = await request(app).get('/api/dashboard?tarjetaId=42');
    expect(res.body.tarjetaSeleccionada).toBe('42');
  });

  test('returns movimientos array', async () => {
    const movs = [
      { tipo: 'gasto', monto: -100, descripcion: 'Test', categoria: { nombre: 'Ocio' } },
    ];
    mockMovimientos(movs);
    const res = await request(app).get('/api/dashboard');
    expect(Array.isArray(res.body.movimientos)).toBe(true);
    expect(res.body.movimientos.length).toBe(1);
  });

  test('500 on DB error', async () => {
    const result = { data: null, error: new Error('DB down') };
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      then: (r, j) => Promise.resolve(result).then(r, j),
      catch: (f) => Promise.resolve(result).catch(f),
    };
    supabase.from.mockReturnValue(chain);
    const res = await request(app).get('/api/dashboard');
    expect(res.status).toBe(500);
  });
});
