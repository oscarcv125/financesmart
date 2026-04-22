jest.mock('../utils/supabaseserver', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.usuario = { id_usuario: 1, nombre: 'Test', apellido: 'User', email: 'test@example.com' };
  next();
});

const request = require('supertest');
const app = require('../app');

describe('GET /api/finanzas/:periodo', () => {
  test('returns barras + pay for mensual', async () => {
    const res = await request(app).get('/api/finanzas/mensual');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.barras)).toBe(true);
    expect(Array.isArray(res.body.pay)).toBe(true);
    expect(res.body.barras.length).toBeGreaterThan(0);
  });

  test('returns data for trimestral', async () => {
    const res = await request(app).get('/api/finanzas/trimestral');
    expect(res.status).toBe(200);
    expect(res.body.barras[0].name).toBe('Q1');
  });

  test('returns data for anual', async () => {
    const res = await request(app).get('/api/finanzas/anual');
    expect(res.status).toBe(200);
  });

  test('is case-insensitive for periodo', async () => {
    const res = await request(app).get('/api/finanzas/MENSUAL');
    expect(res.status).toBe(200);
  });

  test('404 for unknown periodo', async () => {
    const res = await request(app).get('/api/finanzas/semanal');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Periodo no encontrado');
  });

  test('bar entries have name, value, and color fields', async () => {
    const res = await request(app).get('/api/finanzas/mensual');
    for (const bar of res.body.barras) {
      expect(bar).toHaveProperty('name');
      expect(bar).toHaveProperty('value');
      expect(bar).toHaveProperty('color');
    }
  });
});
