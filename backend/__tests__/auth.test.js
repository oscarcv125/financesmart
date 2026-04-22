jest.mock('../utils/supabaseserver', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const request = require('supertest');
const express = require('express');
const authMiddleware = require('../middleware/auth');
const { supabase } = require('../utils/supabaseserver');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ usuario: req.usuario });
  });
  return app;
}

describe('authMiddleware', () => {
  let app;
  beforeEach(() => { app = makeApp(); });

  test('401 – missing Authorization header', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No autorizado');
  });

  test('401 – non-Bearer scheme', async () => {
    const res = await request(app).get('/protected').set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No autorizado');
  });

  test('401 – Supabase rejects the token', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });
    const res = await request(app).get('/protected').set('Authorization', 'Bearer badtoken');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token inválido o expirado');
  });

  test('200 – valid token with existing usuario', async () => {
    const mockUser = { id: 'uid-1', email: 'a@b.com', user_metadata: {} };
    const mockUsuario = { id_usuario: 7, nombre: 'Ana', apellido: 'López', email: 'a@b.com' };

    supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: mockUsuario, error: null }),
    };
    supabase.from.mockReturnValue(chain);

    const res = await request(app).get('/protected').set('Authorization', 'Bearer valid');
    expect(res.status).toBe(200);
    expect(res.body.usuario.nombre).toBe('Ana');
    expect(res.body.usuario.id_usuario).toBe(7);
  });

  test('200 – valid token, usuario not found → creates profile', async () => {
    const mockUser = {
      id: 'uid-2',
      email: 'new@example.com',
      user_metadata: { nombre: 'Carlos', apellido: 'García' },
    };
    const created = { id_usuario: 99, nombre: 'Carlos', apellido: 'García', email: 'new@example.com' };

    supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    let callCount = 0;
    supabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call: select existing → null
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      // Second call: insert new user
      const insertChain = {
        select: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: created, error: null }),
        then: (r, j) => Promise.resolve({ data: created, error: null }).then(r, j),
      };
      return {
        insert: jest.fn(() => insertChain),
      };
    });

    const res = await request(app).get('/protected').set('Authorization', 'Bearer valid');
    expect(res.status).toBe(200);
    expect(res.body.usuario.nombre).toBe('Carlos');
  });

  test('500 – DB error when looking up usuario', async () => {
    const mockUser = { id: 'uid-3', email: 'x@y.com', user_metadata: {} };
    supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });

    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: new Error('DB down') }),
    };
    supabase.from.mockReturnValue(chain);

    const res = await request(app).get('/protected').set('Authorization', 'Bearer valid');
    expect(res.status).toBe(500);
  });
});
