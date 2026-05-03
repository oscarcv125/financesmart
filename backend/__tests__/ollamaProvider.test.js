// Validate the Ollama JSON-blob tool-calling protocol: model emits one of two
// JSON shapes, and we translate to the same { text, toolCalls } envelope as
// Gemini's native tool calling.

jest.mock('ollama', () => {
  const chat = jest.fn();
  return { Ollama: jest.fn().mockImplementation(() => ({ chat })) };
});

const { Ollama } = require('ollama');
const ollama = require('../utils/providers/ollama');

describe('ollama provider', () => {
  let chatMock;
  beforeEach(() => {
    const inst = new Ollama();
    chatMock = inst.chat;
    chatMock.mockReset();
  });

  test('capabilities advertise non-native tool calling', () => {
    expect(ollama.capabilities.supportsTools).toBe(true);
    expect(ollama.capabilities.supportsToolCalling).toBe(false);
  });

  test('generateWithTools translates {action:"tool_call"} JSON to toolCalls[]', async () => {
    chatMock.mockResolvedValue({
      message: {
        content: JSON.stringify({
          action: 'tool_call',
          tool_name: 'obtener_resumen_mes',
          tool_args: { mes: 'actual' },
        }),
      },
    });
    const r = await ollama.generateWithTools({
      systemPrompt: 's', history: [], message: 'm',
      tools: [{ name: 'obtener_resumen_mes', description: 'd', parameters: { type: 'object', properties: { mes: { type: 'string' } } } }],
    });
    expect(r.text).toBe('');
    expect(r.toolCalls).toEqual([{ name: 'obtener_resumen_mes', args: { mes: 'actual' } }]);
  });

  test('generateWithTools translates {action:"respond"} JSON to text', async () => {
    chatMock.mockResolvedValue({
      message: { content: JSON.stringify({ action: 'respond', text: 'Tu saldo es positivo.' }) },
    });
    const r = await ollama.generateWithTools({ systemPrompt: 's', history: [], message: 'm' });
    expect(r.toolCalls).toEqual([]);
    expect(r.text).toBe('Tu saldo es positivo.');
  });

  test('generateWithTools falls back to raw text on malformed JSON', async () => {
    chatMock.mockResolvedValue({ message: { content: 'no soy json' } });
    const r = await ollama.generateWithTools({ systemPrompt: 's', history: [], message: 'm' });
    expect(r.toolCalls).toEqual([]);
    expect(r.text).toBe('no soy json');
  });
});
