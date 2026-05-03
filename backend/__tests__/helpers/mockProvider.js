function buildScript(scriptedResponses) {
  if (Array.isArray(scriptedResponses)) {
    let i = 0;
    return () => {
      const r = scriptedResponses[Math.min(i, scriptedResponses.length - 1)];
      i++;
      return r;
    };
  }
  if (typeof scriptedResponses === 'function') return scriptedResponses;
  const single = scriptedResponses;
  return () => single;
}

function normalizeResponse(r) {
  if (typeof r === 'string') return { text: r, toolCalls: [], parsed: { text: r, widgets: [] } };
  if (r && typeof r === 'object') {
    return {
      text: r.text || (r.parsed && r.parsed.text) || '',
      toolCalls: r.toolCalls || [],
      parsed: r.parsed || { text: r.text || '', widgets: r.widgets || [] },
      raw: r.raw || JSON.stringify(r.parsed || { text: r.text || '' }),
      usedFallback: !!r.usedFallback,
      throws: r.throws,
    };
  }
  return { text: '', toolCalls: [], parsed: { text: '', widgets: [] } };
}

function mockProvider(scriptedResponses, opts = {}) {
  const next = buildScript(scriptedResponses);
  const calls = [];

  const provider = {
    name: opts.name || 'mock',
    model: opts.model || 'mock-1',
    capabilities: opts.capabilities || {
      supportsStructuredOutput: true,
      supportsTools: true,
      supportsToolCalling: true,
      supportsStreaming: true,
    },

    async generate(args) {
      calls.push({ method: 'generate', args });
      const r = normalizeResponse(next());
      if (r.throws) throw r.throws;
      return r.text;
    },

    async *generateStream(args) {
      calls.push({ method: 'generateStream', args });
      const r = normalizeResponse(next());
      if (r.throws) throw r.throws;
      const text = r.text || '';
      const chunkSize = opts.chunkSize || 16;
      for (let i = 0; i < text.length; i += chunkSize) {
        if (args.signal?.aborted) break;
        yield text.slice(i, i + chunkSize);
      }
    },

    async generateStructured(args) {
      calls.push({ method: 'generateStructured', args });
      const r = normalizeResponse(next());
      if (r.throws) throw r.throws;
      return {
        parsed: r.parsed,
        toolCalls: r.toolCalls,
        raw: r.raw || JSON.stringify(r.parsed),
        usedFallback: r.usedFallback,
      };
    },

    calls,
    reset() { calls.length = 0; },
  };

  return provider;
}

module.exports = { mockProvider };
