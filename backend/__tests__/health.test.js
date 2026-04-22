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
const { computeScore } = require('../routes/health');

function mockDB({ movs = [], presupuestos = [], metas = [] } = {}) {
  supabase.from.mockImplementation((table) => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    };
    if (table === 'movimiento_financiero') {
      chain.then = (r) => Promise.resolve({ data: movs, error: null }).then(r);
    } else if (table === 'presupuesto') {
      chain.then = (r) => Promise.resolve({ data: presupuestos, error: null }).then(r);
    } else if (table === 'ahorro_meta') {
      chain.then = (r) => Promise.resolve({ data: metas, error: null }).then(r);
    } else {
      chain.then = (r) => Promise.resolve({ data: [], error: null }).then(r);
    }
    return chain;
  });
}

// ── computeScore unit tests ──────────────────────────────────────────────────

describe('computeScore – savings rate component', () => {
  test('0 savings score when ingresos = 0', () => {
    const { breakdown } = computeScore(0, 0, [], {}, []);
    expect(breakdown.ahorro).toBe(0);
  });

  test('full 40 pts at 20% savings rate', () => {
    // ingresos=1000, gastos=800 → 20% saved
    const { breakdown } = computeScore(1000, 800, [], {}, []);
    expect(breakdown.ahorro).toBe(40);
  });

  test('full 40 pts when savings rate exceeds 20%', () => {
    const { breakdown } = computeScore(1000, 500, [], {}, []);
    expect(breakdown.ahorro).toBe(40);
  });

  test('partial savings score below 20%', () => {
    // 10% savings rate → 20 pts
    const { breakdown } = computeScore(1000, 900, [], {}, []);
    expect(breakdown.ahorro).toBe(20);
  });

  test('0 savings score when spending exceeds income', () => {
    const { breakdown } = computeScore(500, 800, [], {}, []);
    expect(breakdown.ahorro).toBe(0);
  });
});

describe('computeScore – budget adherence component', () => {
  test('neutral 17-18 pts when no presupuestos', () => {
    const { breakdown } = computeScore(0, 0, [], {}, []);
    expect(breakdown.presupuestos).toBeGreaterThanOrEqual(17);
    expect(breakdown.presupuestos).toBeLessThanOrEqual(18);
  });

  test('full 35 pts when all budgets have 0 spending', () => {
    const presupuestos = [{ monto: 1000, categoria: { nombre: 'Alimentación' } }];
    const { breakdown } = computeScore(0, 0, presupuestos, {}, []);
    expect(breakdown.presupuestos).toBe(35);
  });

  test('0 pts when budget is 100% exceeded', () => {
    const presupuestos = [{ monto: 500, categoria: { nombre: 'Ocio' } }];
    const gastosPorCat = { Ocio: 1000 }; // 200% of budget
    const { breakdown } = computeScore(0, 0, presupuestos, gastosPorCat, []);
    expect(breakdown.presupuestos).toBe(0);
  });

  test('partial pts when budget is 50% spent', () => {
    const presupuestos = [{ monto: 1000, categoria: { nombre: 'Alimentación' } }];
    const gastosPorCat = { Alimentación: 500 };
    const { breakdown } = computeScore(0, 0, presupuestos, gastosPorCat, []);
    expect(breakdown.presupuestos).toBe(18); // 0.5 * 35 = 17.5 → rounded
  });
});

describe('computeScore – goal progress component', () => {
  test('0 pts when no metas (encourages creating them)', () => {
    const { breakdown } = computeScore(0, 0, [], {}, []);
    expect(breakdown.metas).toBe(0);
  });

  test('full 25 pts when all metas are complete', () => {
    const metas = [{ monto_objetivo: 1000, progreso: 1000 }];
    const { breakdown } = computeScore(0, 0, [], {}, metas);
    expect(breakdown.metas).toBe(25);
  });

  test('partial pts for partially complete meta', () => {
    const metas = [{ monto_objetivo: 1000, progreso: 500 }];
    const { breakdown } = computeScore(0, 0, [], {}, metas);
    expect(breakdown.metas).toBe(13); // 0.5 * 25 = 12.5 → 13
  });

  test('averages across multiple metas', () => {
    const metas = [
      { monto_objetivo: 1000, progreso: 1000 }, // 100%
      { monto_objetivo: 1000, progreso: 0 },    // 0%
    ];
    const { breakdown } = computeScore(0, 0, [], {}, metas);
    expect(breakdown.metas).toBe(13); // avg 50% * 25 = 12.5 → 13
  });
});

describe('computeScore – grades', () => {
  test('Excelente at score >= 80', () => {
    // Full savings (40) + neutral budget (17.5) + full goals (25) = 82.5
    const metas = [{ monto_objetivo: 1000, progreso: 1000 }];
    const { grade, color } = computeScore(1000, 800, [], {}, metas);
    expect(grade).toBe('Excelente');
    expect(color).toBe('green');
  });

  test('Necesita atención at score < 40', () => {
    // 0 savings + 0 budget adherence + 0 goals
    const presupuestos = [{ monto: 100, categoria: { nombre: 'X' } }];
    const gastosPorCat = { X: 999 };
    const { grade, color } = computeScore(0, 0, presupuestos, gastosPorCat, []);
    expect(grade).toBe('Necesita atención');
    expect(color).toBe('red');
  });

  test('score is clamped between 0 and 100', () => {
    const { score } = computeScore(1000000, 0, [], {}, []);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ── HTTP endpoint tests ──────────────────────────────────────────────────────

describe('GET /api/health', () => {
  test('200 with score, grade, color, and breakdown', async () => {
    mockDB();
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(typeof res.body.score).toBe('number');
    expect(res.body).toHaveProperty('grade');
    expect(res.body).toHaveProperty('color');
    expect(res.body.breakdown).toHaveProperty('ahorro');
    expect(res.body.breakdown).toHaveProperty('presupuestos');
    expect(res.body.breakdown).toHaveProperty('metas');
  });

  test('returns neutral score for a new user with no data', async () => {
    mockDB();
    const res = await request(app).get('/api/health');
    // No income, no budgets (neutral 17.5), no goals (0) → score ≈ 17 or 18
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(20);
  });

  test('score improves with healthy finances', async () => {
    mockDB({
      movs: [
        { tipo: 'ingreso', monto: '5000', categoria: { nombre: 'Salario' } },
        { tipo: 'gasto',   monto: '-2000', categoria: { nombre: 'Alimentación' } },
      ],
      presupuestos: [{ monto: 3000, categoria: { nombre: 'Alimentación' } }],
      metas: [{ monto_objetivo: 10000, progreso: 5000 }],
    });
    const res = await request(app).get('/api/health');
    expect(res.body.score).toBeGreaterThan(50);
  });

  test('500 on DB error', async () => {
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      then: (r, j) => Promise.resolve({ data: null, error: new Error('DB error') }).then(r, j),
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(500);
  });
});
