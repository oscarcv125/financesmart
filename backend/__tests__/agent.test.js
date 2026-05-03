const { runAgentLoop, DEFAULT_MAX_ITERS } = require('../utils/agent/loop');
const {
  GROUNDING_REMINDER,
  REDUNDANT_LOOP_REMINDER,
  MAX_ITER_FALLBACK,
} = require('../utils/agent/grounding');

function fakeRegistry(execFn = async () => ({ ok: true, data: {} })) {
  return {
    geminiDeclarations: [{ name: 'noop', description: 'noop', parameters: { type: 'object', properties: {} } }],
    exec: jest.fn(execFn),
  };
}

function scriptedProvider(turns) {
  let i = 0;
  return {
    capabilities: { supportsTools: true },
    generateWithTools: jest.fn(async () => {
      const t = turns[Math.min(i, turns.length - 1)];
      i++;
      return t;
    }),
    _turnIndex: () => i,
  };
}

describe('runAgentLoop', () => {
  test('returns text immediately when first turn has no tool calls', async () => {
    const provider = scriptedProvider([{ text: 'Hola.', toolCalls: [] }]);
    const registry = fakeRegistry();
    const result = await runAgentLoop({
      provider, registry,
      systemPrompt: 's', history: [], message: 'hi',
    });
    expect(result.text).toBe('Hola.');
    expect(result.iters).toBe(0);
    expect(result.hitCap).toBe(false);
    expect(registry.exec).not.toHaveBeenCalled();
  });

  test('executes a single tool call then returns final text', async () => {
    const provider = scriptedProvider([
      { text: '', toolCalls: [{ name: 'obtener_metas', args: {} }] },
      { text: 'Tienes 1 meta.', toolCalls: [] },
    ]);
    const registry = fakeRegistry(async () => ({ ok: true, data: [{ id: 1 }] }));
    const result = await runAgentLoop({
      provider, registry,
      systemPrompt: 's', history: [], message: 'metas?',
    });
    expect(result.text).toBe('Tienes 1 meta.');
    expect(result.iters).toBe(1);
    expect(registry.exec).toHaveBeenCalledTimes(1);
    expect(registry.exec).toHaveBeenCalledWith('obtener_metas', {});
  });

  test('executes multiple tool calls in parallel within one turn', async () => {
    const provider = scriptedProvider([
      { text: '', toolCalls: [
        { name: 'obtener_metas', args: {} },
        { name: 'obtener_presupuestos', args: {} },
      ] },
      { text: 'Resumen completo.', toolCalls: [] },
    ]);
    const registry = fakeRegistry();
    await runAgentLoop({
      provider, registry,
      systemPrompt: 's', history: [], message: 'resumen',
    });
    expect(registry.exec).toHaveBeenCalledTimes(2);
    expect(registry.exec).toHaveBeenCalledWith('obtener_metas', {});
    expect(registry.exec).toHaveBeenCalledWith('obtener_presupuestos', {});
  });

  test('caps at MAX_ITERS and returns the fallback message', async () => {
    // Vary args each iter so the redundant-loop detector doesn't break us out
    // early — we're testing the actual MAX_ITERS cap path, not the redundancy
    // short-circuit.
    let n = 0;
    const provider = {
      capabilities: { supportsTools: true },
      generateWithTools: jest.fn(async () => ({
        text: '',
        toolCalls: [{ name: 'obtener_metas', args: { iter: n++ } }],
      })),
    };
    const registry = fakeRegistry();
    const result = await runAgentLoop({
      provider, registry,
      systemPrompt: 's', history: [], message: 'loop forever',
    });
    expect(result.hitCap).toBe(true);
    expect(result.iters).toBe(DEFAULT_MAX_ITERS);
    expect(result.text).toBe(MAX_ITER_FALLBACK);
  });

  test('functionResponse parts (without grounding reminder) are appended after tool results', async () => {
    const provider = scriptedProvider([
      { text: '', toolCalls: [{ name: 'obtener_metas', args: {} }] },
      { text: 'done', toolCalls: [] },
    ]);
    const registry = fakeRegistry(async () => ({ ok: true, data: [{ id_meta: 1 }] }));
    await runAgentLoop({
      provider, registry,
      systemPrompt: 's', history: [], message: 'q',
    });
    // Second call to provider should have the tool result as a functionResponse part.
    // The grounding reminder is intentionally NOT injected as a text part — Gemini
    // would occasionally echo it back as its reply.
    expect(provider.generateWithTools).toHaveBeenCalledTimes(2);
    const secondCallHistory = provider.generateWithTools.mock.calls[1][0].history;
    const allParts = secondCallHistory.flatMap(h => h.parts || []);
    expect(allParts.some(p => p.functionResponse?.name === 'obtener_metas')).toBe(true);
    const allText = allParts.map(p => p.text || '').join('\n');
    expect(allText).not.toContain(GROUNDING_REMINDER);
  });

  test('redundant-loop detection breaks the loop and returns final text', async () => {
    // Provider repeats the same tool call forever; on the nudge turn (after
    // the loop force-breaks), returns plain text.
    let i = 0;
    const sameCall = { text: '', toolCalls: [{ name: 'obtener_metas', args: { x: 1 } }] };
    const finalTurn = { text: 'OK, ya consulté lo necesario.', toolCalls: [] };
    const provider = {
      capabilities: { supportsTools: true },
      generateWithTools: jest.fn(async () => {
        // Iters 0, 1, 2 emit the same tool call; on iter 2 the redundancy
        // detector fires and the loop pushes the nudge + makes one final call.
        const t = i >= 3 ? finalTurn : sameCall;
        i++;
        return t;
      }),
    };
    const registry = fakeRegistry();
    const result = await runAgentLoop({
      provider, registry,
      systemPrompt: 's', history: [], message: 'q',
    });
    const calls = provider.generateWithTools.mock.calls;
    const found = calls.some(c => {
      const text = (c[0].history || []).flatMap(h => h.parts || []).map(p => p.text || '').join('\n');
      return text.includes(REDUNDANT_LOOP_REMINDER);
    });
    expect(found).toBe(true);
    expect(result.breakReason).toBe('redundant_loop');
    expect(result.hitCap).toBe(false);
    expect(result.text).toBe('OK, ya consulté lo necesario.');
  });

  test('emits status, tool_call, tool_result events', async () => {
    const provider = scriptedProvider([
      { text: '', toolCalls: [{ name: 'obtener_metas', args: {} }] },
      { text: 'done', toolCalls: [] },
    ]);
    const registry = fakeRegistry(async () => ({ ok: true, data: [{ id: 1 }] }));
    const events = [];
    const send = (type, payload) => events.push({ type, ...payload });
    await runAgentLoop({
      provider, registry,
      systemPrompt: 's', history: [], message: 'q', send,
    });
    expect(events.find(e => e.type === 'status')).toBeDefined();
    expect(events.find(e => e.type === 'tool_call' && e.name === 'obtener_metas')).toBeDefined();
    expect(events.find(e => e.type === 'tool_result' && e.ok === true)).toBeDefined();
  });

  test('aborts when signal is triggered', async () => {
    const ac = new AbortController();
    const provider = scriptedProvider([
      { text: '', toolCalls: [{ name: 'noop', args: {} }] },
      { text: 'never', toolCalls: [] },
    ]);
    // Abort after the first turn completes
    const registry = {
      geminiDeclarations: [],
      exec: async () => { ac.abort(); return { ok: true, data: {} }; },
    };
    const result = await runAgentLoop({
      provider, registry,
      systemPrompt: 's', history: [], message: 'q',
      signal: ac.signal,
    });
    expect(result.aborted).toBe(true);
  });

  test('throws when provider lacks generateWithTools', async () => {
    const badProvider = { capabilities: { supportsTools: false } };
    await expect(runAgentLoop({
      provider: badProvider, registry: fakeRegistry(),
      systemPrompt: 's', history: [], message: 'q',
    })).rejects.toThrow(/generateWithTools/);
  });

  test('tool failure surfaces as ok:false in tool_result, loop continues', async () => {
    const provider = scriptedProvider([
      { text: '', toolCalls: [{ name: 'obtener_x', args: {} }] },
      { text: 'lo siento, error', toolCalls: [] },
    ]);
    const registry = fakeRegistry(async () => ({ ok: false, error: 'INVALID_DATE_FORMAT', mensaje: 'bad date' }));
    const events = [];
    const result = await runAgentLoop({
      provider, registry,
      systemPrompt: 's', history: [], message: 'q',
      send: (type, payload) => events.push({ type, ...payload }),
    });
    const failedResult = events.find(e => e.type === 'tool_result' && e.ok === false);
    expect(failedResult).toBeDefined();
    expect(result.text).toBe('lo siento, error');
  });
});
