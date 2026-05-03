jest.mock('express-rate-limit', () => () => (req, res, next) => next());
jest.mock('../utils/supabaseserver', () => ({
  supabase: { auth: { getUser: jest.fn() }, from: jest.fn() },
}));
jest.mock('../middleware/auth', () => (req, _res, next) => {
  req.usuario = { id_usuario: 1, nombre: 'Ana', apellido: 'García', email: 'ana@test.com' };
  next();
});

// Mock aiProvider — chatbot route imports it at module load.
// jest.mock is hoisted above all requires, so the factory must construct the mock itself.
jest.mock('../utils/aiProvider', () => {
  const { mockProvider } = require('./helpers/mockProvider');
  return mockProvider('Tu saldo es positivo.');
});

const request = require('supertest');
const app = require('../app');
const { supabase } = require('../utils/supabaseserver');
const provider = require('../utils/aiProvider'); // resolves to the mock above
const { parseSSE } = require('./helpers/sse');

function setProviderResponse(text) {
  provider.calls.length = 0;
  provider.generate = async (args) => {
    provider.calls.push({ method: 'generate', args });
    return text;
  };
  provider.generateStream = async function* (args) {
    provider.calls.push({ method: 'generateStream', args });
    const chunkSize = 16;
    for (let i = 0; i < text.length; i += chunkSize) {
      if (args?.signal?.aborted) break;
      yield text.slice(i, i + chunkSize);
    }
  };
}

function setProviderError(err) {
  provider.calls.length = 0;
  provider.generate = async (args) => {
    provider.calls.push({ method: 'generate', args });
    throw err;
  };
  // eslint-disable-next-line require-yield
  provider.generateStream = async function* (args) {
    provider.calls.push({ method: 'generateStream', args });
    throw err;
  };
}

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

function mockDBWithMetas(metas = [], tarjetas = []) {
  supabase.from.mockImplementation((table) => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    };
    if (table === 'ahorro_meta') {
      chain.then = (r) => Promise.resolve({ data: metas, error: null }).then(r);
    } else if (table === 'tarjeta') {
      chain.then = (r) => Promise.resolve({ data: tarjetas, error: null }).then(r);
    } else {
      chain.then = (r) => Promise.resolve({ data: [], error: null }).then(r);
    }
    return chain;
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

describe('POST /api/chatbot – happy path (SSE)', () => {
  beforeEach(() => {
    mockEmptyDB();
    setProviderResponse('Tu saldo es positivo.');
  });

  test('200 streams reply via SSE done event', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: '¿Cuál es mi saldo?', mode: 'coach' });
    expect(res.status).toBe(200);
    const sse = parseSSE(res.text);
    expect(sse.done).not.toBeNull();
    expect(sse.done.reply).toBe('Tu saldo es positivo.');
    expect(sse.fullText).toBe('Tu saldo es positivo.');
  });

  test('defaults to coach mode when mode not provided', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: 'Hola' });
    expect(res.status).toBe(200);
    const sse = parseSSE(res.text);
    expect(sse.done).not.toBeNull();
    expect(sse.done.reply).toBeDefined();
  });

  test('accepts analyst mode', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: 'Analiza mis finanzas', mode: 'analyst' });
    expect(res.status).toBe(200);
    const sse = parseSSE(res.text);
    expect(sse.done.reply).toBeDefined();
  });

  test('passes conversation history to provider', async () => {
    const history = [
      { role: 'user', parts: [{ text: 'Hola' }] },
      { role: 'model', parts: [{ text: 'Hola, ¿en qué te ayudo?' }] },
    ];
    const res = await request(app).post('/api/chatbot').send({ message: 'Gracias', history, mode: 'coach' });
    expect(res.status).toBe(200);
    const lastCall = provider.calls[provider.calls.length - 1];
    expect(lastCall.method).toBe('generateStream');
    expect(lastCall.args.history).toEqual(history);
    expect(lastCall.args.message).toBe('Gracias');
  });

  test('returns provider name in done payload', async () => {
    const res = await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    const sse = parseSSE(res.text);
    expect(sse.done.provider).toBe('mock');
  });
});

describe('POST /api/chatbot – system prompt content', () => {
  beforeEach(() => {
    mockEmptyDB();
    setProviderResponse('ok');
  });

  test('coach prompt includes coach persona', async () => {
    await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    const lastCall = provider.calls[provider.calls.length - 1];
    expect(lastCall.args.systemPrompt).toMatch(/coach/i);
    expect(lastCall.args.systemPrompt).toMatch(/motivador/i);
  });

  test('analyst prompt includes analyst persona', async () => {
    await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'analyst' });
    const lastCall = provider.calls[provider.calls.length - 1];
    expect(lastCall.args.systemPrompt).toMatch(/analista/i);
    expect(lastCall.args.systemPrompt).toMatch(/objetivo/i);
  });

  test('prompt contains financial context sections', async () => {
    await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    const lastCall = provider.calls[provider.calls.length - 1];
    const prompt = lastCall.args.systemPrompt;
    expect(prompt).toMatch(/PRESUPUESTOS/);
    expect(prompt).toMatch(/METAS DE AHORRO/);
    expect(prompt).toMatch(/CARGOS RECURRENTES/);
  });

  test('prompt includes vs last month comparison', async () => {
    await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'analyst' });
    const lastCall = provider.calls[provider.calls.length - 1];
    expect(lastCall.args.systemPrompt).toMatch(/mes anterior/);
  });
});

describe('POST /api/chatbot – actions (coach mode)', () => {
  test('coach mode returns actions array in done event', async () => {
    mockEmptyDB();
    setProviderResponse('Consejo financiero.');
    const res = await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    expect(res.status).toBe(200);
    const sse = parseSSE(res.text);
    expect(Array.isArray(sse.done.actions)).toBe(true);
  });

  test('analyst mode returns empty actions array', async () => {
    mockEmptyDB();
    setProviderResponse('Análisis.');
    const res = await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'analyst' });
    const sse = parseSSE(res.text);
    expect(sse.done.actions).toEqual([]);
  });

  test('returns tarjetas in coach mode', async () => {
    mockEmptyDB();
    setProviderResponse('ok');
    const res = await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    const sse = parseSSE(res.text);
    expect(Array.isArray(sse.done.tarjetas)).toBe(true);
  });

  test('suggests aportar action when user has metas + tarjetas + savings intent', async () => {
    const metas = [{ id_meta: 1, nombre_meta: 'Vacaciones', monto_objetivo: 10000, progreso: 3000, fecha_limite: null }];
    const tarjetas = [{ id_tarjeta: 5, nombre: 'Débito' }];
    mockDBWithMetas(metas, tarjetas);
    setProviderResponse('Excelente meta!');

    const res = await request(app).post('/api/chatbot').send({ message: '¿cómo va mi meta de ahorro?', mode: 'coach' });
    expect(res.status).toBe(200);
    const sse = parseSSE(res.text);
    const aportarAction = sse.done.actions.find(a => a.type === 'aportar');
    expect(aportarAction).toBeDefined();
    expect(aportarAction.id_meta).toBe(1);
    expect(aportarAction.nombre_meta).toBe('Vacaciones');
    expect(aportarAction.monto).toBeGreaterThan(0);
  });

  test('returns max 3 actions', async () => {
    const metas = [
      { id_meta: 1, nombre_meta: 'Meta1', monto_objetivo: 1000, progreso: 100, fecha_limite: null },
      { id_meta: 2, nombre_meta: 'Meta2', monto_objetivo: 2000, progreso: 200, fecha_limite: null },
      { id_meta: 3, nombre_meta: 'Meta3', monto_objetivo: 3000, progreso: 300, fecha_limite: null },
      { id_meta: 4, nombre_meta: 'Meta4', monto_objetivo: 4000, progreso: 400, fecha_limite: null },
    ];
    const tarjetas = [{ id_tarjeta: 1, nombre: 'Débito' }];
    mockDBWithMetas(metas, tarjetas);
    setProviderResponse('ok');

    const res = await request(app).post('/api/chatbot').send({ message: 'quiero ahorrar', mode: 'coach' });
    const sse = parseSSE(res.text);
    expect(sse.done.actions.length).toBeLessThanOrEqual(3);
  });
});

describe('POST /api/chatbot – provider error handling (SSE error event)', () => {
  beforeEach(() => mockEmptyDB());

  test('emits error event when provider stream throws', async () => {
    setProviderError(new Error('upstream 503'));
    const res = await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    // SSE keeps HTTP 200 but emits an error event and ends the stream.
    expect(res.status).toBe(200);
    const sse = parseSSE(res.text);
    expect(sse.error).not.toBeNull();
    expect(sse.error.error).toMatch(/error/i);
  });
});

describe('POST /api/chatbot – widgets[] dual-emit', () => {
  beforeEach(() => mockEmptyDB());

  test('done.widgets is an empty array when LLM emits no tags', async () => {
    setProviderResponse('Tu saldo es positivo.');
    const res = await request(app).post('/api/chatbot').send({ message: '¿saldo?', mode: 'coach' });
    const sse = parseSSE(res.text);
    expect(sse.done.widgets).toEqual([]);
  });

  test('CHART tag → done.chart AND done.widgets contains a chart entry', async () => {
    const reply = 'Aquí está tu desglose. [CHART]{"type":"pie","title":"Por categoría","data":[{"name":"Comida","value":1200},{"name":"Transporte","value":800}]}[/CHART]';
    setProviderResponse(reply);
    const res = await request(app).post('/api/chatbot').send({ message: 'desglose', mode: 'coach' });
    const sse = parseSSE(res.text);
    expect(sse.done.chart).not.toBeNull();
    expect(sse.done.chart.type).toBe('pie');
    expect(Array.isArray(sse.done.widgets)).toBe(true);
    expect(sse.done.widgets.length).toBe(1);
    expect(sse.done.widgets[0].kind).toBe('chart');
    expect(sse.done.widgets[0].chart).toEqual(sse.done.chart);
  });

  test('STREAK tag → done.streak AND done.widgets contains a streak entry', async () => {
    const reply = 'Vas bien. [STREAK]{"label":"Días sin comer fuera","current":7,"unit":"días","best":12}[/STREAK]';
    setProviderResponse(reply);
    const res = await request(app).post('/api/chatbot').send({ message: 'racha?', mode: 'coach' });
    const sse = parseSSE(res.text);
    expect(sse.done.streak).not.toBeNull();
    expect(sse.done.streak.current).toBe(7);
    expect(sse.done.widgets.length).toBe(1);
    expect(sse.done.widgets[0].kind).toBe('streak');
    expect(sse.done.widgets[0].streak.current).toBe(7);
  });

  test('COMPARE tag → done.compare AND done.widgets contains a compare entry', async () => {
    const reply = 'Comparativa: [COMPARE]{"title":"Abr vs Mar","leftLabel":"Mar","rightLabel":"Abr","rows":[{"label":"Comida","left":4200,"right":5100}]}[/COMPARE]';
    setProviderResponse(reply);
    const res = await request(app).post('/api/chatbot').send({ message: 'compara', mode: 'coach' });
    const sse = parseSSE(res.text);
    expect(sse.done.compare).not.toBeNull();
    expect(sse.done.widgets.length).toBe(1);
    expect(sse.done.widgets[0].kind).toBe('compare');
  });

  test('SIMULATOR tag → done.simulator AND done.widgets contains a simulator entry', async () => {
    const reply = 'Simula esto: [SIMULATOR]{"type":"savings_daily","title":"Si ahorras","params":[{"key":"amount","label":"$ al día","value":150,"min":20,"max":500,"step":10,"unit":"MXN"},{"key":"days","label":"Días","value":30,"min":7,"max":90,"step":1}]}[/SIMULATOR]';
    setProviderResponse(reply);
    const res = await request(app).post('/api/chatbot').send({ message: 'simula', mode: 'coach' });
    const sse = parseSSE(res.text);
    expect(sse.done.simulator).not.toBeNull();
    expect(sse.done.widgets.length).toBe(1);
    expect(sse.done.widgets[0].kind).toBe('simulator');
  });

  test('done.capabilities reflects mock provider caps', async () => {
    setProviderResponse('ok');
    const res = await request(app).post('/api/chatbot').send({ message: 'hola', mode: 'coach' });
    const sse = parseSSE(res.text);
    expect(sse.done.capabilities).toBeTruthy();
    expect(sse.done.capabilities.supportsStreaming).toBe(true);
  });
});

describe('POST /api/chatbot – provider abstraction sanity', () => {
  test('uses generateStream method on the AI provider', async () => {
    mockEmptyDB();
    setProviderResponse('ok');
    await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    expect(provider.calls.some(c => c.method === 'generateStream')).toBe(true);
  });

  test('does not call legacy non-streaming generate', async () => {
    mockEmptyDB();
    setProviderResponse('ok');
    provider.calls.length = 0;
    await request(app).post('/api/chatbot').send({ message: 'Hola', mode: 'coach' });
    expect(provider.calls.every(c => c.method !== 'generate')).toBe(true);
  });
});
