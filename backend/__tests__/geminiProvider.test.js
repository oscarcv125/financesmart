// Smoke tests for the Gemini provider adapter — validates the request shape
// and response parsing without hitting the real API. Uses global.fetch mock.

describe('gemini provider', () => {
  let originalFetch;
  let originalKey;
  beforeEach(() => {
    originalFetch = global.fetch;
    originalKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key';
    jest.resetModules();
  });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });

  test('exposes capability flags including tool calling and structured output', () => {
    const gemini = require('../utils/providers/gemini');
    expect(gemini.capabilities.supportsTools).toBe(true);
    expect(gemini.capabilities.supportsToolCalling).toBe(true);
    expect(gemini.capabilities.supportsStructuredOutput).toBe(true);
  });

  test('generateWithTools parses text + functionCall parts from the response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [
              { text: 'Voy a consultar tus metas.' },
              { functionCall: { name: 'obtener_metas_ahorro', args: {} } },
            ],
          },
        }],
      }),
    });
    const gemini = require('../utils/providers/gemini');
    const r = await gemini.generateWithTools({
      systemPrompt: 's', history: [], message: 'm', tools: [{ name: 'noop', description: 'noop', parameters: { type: 'object', properties: {} } }],
    });
    expect(r.text).toContain('consultar');
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0].name).toBe('obtener_metas_ahorro');
  });

  test('generateWithTools rejects when API key missing', async () => {
    delete process.env.GEMINI_API_KEY;
    jest.resetModules();
    const gemini = require('../utils/providers/gemini');
    await expect(gemini.generateWithTools({ systemPrompt: 's', history: [], message: 'm' })).rejects.toThrow(/GEMINI_API_KEY/);
  });

  test('generateWithTools surfaces non-2xx errors with body snippet', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => '{"error":"quota exceeded"}',
    });
    const gemini = require('../utils/providers/gemini');
    await expect(gemini.generateWithTools({ systemPrompt: 's', history: [], message: 'm' }))
      .rejects.toThrow(/429/);
  });
});
