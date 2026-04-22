jest.mock('../utils/supabaseserver', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.usuario = { id_usuario: 1, nombre: 'Ana', apellido: 'García', email: 'ana@test.com' };
  next();
});

const request = require('supertest');
const app = require('../app');
const { supabase } = require('../utils/supabaseserver');

// Stub the Gemini fetch globally
global.fetch = jest.fn();

function mockEmptyDB() {
  const emptyChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    then: (r) => Promise.resolve({ data: [], error: null }).then(r),
  };
  supabase.from.mockReturnValue(emptyChain);
}

function mockGemini(reply = 'Respuesta de prueba.') {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: reply }] } }],
    }),
  });
}

describe('POST /api/chatbot – input validation', () => {
  test('400 when message is missing', async () => {
    const res = await request(app).post('/api/chatbot').send({ mode: 'coach' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mensaje/i);
  });

  test('400 when message is empty string', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: '   ', mode: 'coach' });
    expect(res.status).toBe(400);
  });

  test('400 when message exceeds 1000 chars', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: 'a'.repeat(1001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/largo/i);
  });

  test('400 when history is not an array', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: 'Hola', history: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/historial/i);
  });

  test('400 when history exceeds 50 entries', async () => {
    const history = Array(51).fill({ role: 'user', parts: [{ text: 'hi' }] });
    const res = await request(app).post('/api/chatbot').send({ message: 'Hola', history });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/chatbot – happy path', () => {
  beforeEach(() => {
    mockEmptyDB();
    mockGemini('Tu saldo es positivo.');
  });

  test('200 returns reply from Gemini', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: '¿Cuál es mi saldo?', mode: 'coach' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Tu saldo es positivo.');
  });

  test('defaults to coach mode when mode not provided', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: 'Hola' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBeDefined();
  });

  test('accepts analyst mode', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: 'Analiza mis finanzas', mode: 'analyst' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBeDefined();
  });

  test('passes conversation history to Gemini', async () => {
    const history = [
      { role: 'user', parts: [{ text: 'Hola' }] },
      { role: 'model', parts: [{ text: 'Hola, ¿en qué te ayudo?' }] },
    ];
    const res = await request(app).post('/api/chatbot').send({ message: 'Gracias', history, mode: 'coach' });
    expect(res.status).toBe(200);

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.contents.length).toBe(3); // 2 history + 1 new message
  });
});

describe('POST /api/chatbot – system prompt content', () => {
  beforeEach(() => mockEmptyDB());

  test('coach prompt includes coach persona', async () => {
    mockGemini('ok');
    await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const prompt = body.system_instruction.parts[0].text;
    expect(prompt).toMatch(/coach/i);
    expect(prompt).toMatch(/motivador/i);
  });

  test('analyst prompt includes analyst persona', async () => {
    mockGemini('ok');
    await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'analyst' });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const prompt = body.system_instruction.parts[0].text;
    expect(prompt).toMatch(/analista/i);
    expect(prompt).toMatch(/objetivo/i);
  });

  test('prompt contains financial context sections', async () => {
    mockGemini('ok');
    await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const prompt = body.system_instruction.parts[0].text;
    expect(prompt).toMatch(/PRESUPUESTOS/);
    expect(prompt).toMatch(/METAS DE AHORRO/);
    expect(prompt).toMatch(/CARGOS RECURRENTES/);
  });

  test('prompt includes vs last month comparison', async () => {
    mockGemini('ok');
    await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'analyst' });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const prompt = body.system_instruction.parts[0].text;
    expect(prompt).toMatch(/mes anterior/);
  });
});

describe('POST /api/chatbot – Gemini error handling', () => {
  beforeEach(() => mockEmptyDB());

  test('500 when Gemini returns non-ok status', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 503 });
    const res = await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    expect(res.status).toBe(500);
  });

  test('500 when fetch throws', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    const res = await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    expect(res.status).toBe(500);
  });
});
