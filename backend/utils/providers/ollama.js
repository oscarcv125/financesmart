const { Ollama } = require('ollama');

const client = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.OLLAMA_TIMEOUT_MS || '120000', 10);

// Ollama's npm client doesn't accept an AbortSignal on chat() in non-stream
// mode, so we race against a manual timeout. The local model can hang on big
// prompts; better to surface a user-visible failure than block the request.
function raceWithTimeout(promise, signal, ms = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const t = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Ollama timeout (${ms}ms)`));
    }, ms);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      reject(new Error('aborted'));
    };
    if (signal) {
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener('abort', onAbort, { once: true });
    }
    promise.then(
      (v) => { if (!settled) { settled = true; clearTimeout(t); resolve(v); } },
      (e) => { if (!settled) { settled = true; clearTimeout(t); reject(e); } },
    );
  });
}

const capabilities = {
  supportsStructuredOutput: false,
  // Tools are supported via the harness-implemented JSON-blob protocol below
  // (`generateWithTools`). Quality is lower than native function calling on
  // Gemini but enables read-only agentic behavior on local models.
  supportsTools: true,
  supportsToolCalling: false, // not native — implemented in-harness
  supportsStreaming: true,
};

function partsToText(parts) {
  return (parts || []).map(p => {
    if (typeof p?.text === 'string') return p.text;
    if (p?.functionCall) return `[Llamé a ${p.functionCall.name} con args ${JSON.stringify(p.functionCall.args || {})}]`;
    if (p?.functionResponse) {
      const r = p.functionResponse.response?.result ?? p.functionResponse.response;
      return `[Resultado de ${p.functionResponse.name}: ${JSON.stringify(r).slice(0, 1500)}]`;
    }
    return '';
  }).filter(Boolean).join('\n');
}

function toOllamaMessages(systemPrompt, history, message) {
  const mapped = (history || []).map(h => ({
    role: h.role === 'model' ? 'assistant' : h.role,
    content: partsToText(h.parts) || (h.parts?.[0]?.text || ''),
  }));
  const out = [
    { role: 'system', content: systemPrompt },
    ...mapped,
  ];
  if (message) out.push({ role: 'user', content: message });
  return out;
}

async function generate({ systemPrompt, history, message }) {
  const res = await client.chat({
    model: DEFAULT_MODEL,
    messages: toOllamaMessages(systemPrompt, history, message),
    stream: false,
  });
  return res?.message?.content || 'Sin respuesta.';
}

async function* generateStream({ systemPrompt, history, message, signal }) {
  const stream = await client.chat({
    model: DEFAULT_MODEL,
    messages: toOllamaMessages(systemPrompt, history, message),
    stream: true,
  });
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const piece = chunk?.message?.content;
    if (piece) yield piece;
  }
}

function stripJsonFence(s) {
  if (!s) return '';
  let t = s.trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  return t.trim();
}

async function generateStructured({ systemPrompt, history, message, schema, signal }) {
  if (!schema) {
    throw new Error('generateStructured requires a zod schema');
  }

  const messages = toOllamaMessages(systemPrompt, history, message);

  async function callOnce(extraMessages = []) {
    const res = await raceWithTimeout(
      client.chat({
        model: DEFAULT_MODEL,
        messages: [...messages, ...extraMessages],
        stream: false,
        format: 'json',
      }),
      signal,
    );
    if (signal?.aborted) throw new Error('aborted');
    return res?.message?.content || '';
  }

  const raw1 = await callOnce();
  let parsed1;
  try {
    parsed1 = JSON.parse(stripJsonFence(raw1));
  } catch (err) {
    parsed1 = null;
  }
  if (parsed1) {
    const result = schema.safeParse(parsed1);
    if (result.success) {
      return { parsed: result.data, toolCalls: [], raw: raw1, usedFallback: false };
    }
  }

  const issues = parsed1
    ? schema.safeParse(parsed1).error?.issues || []
    : [{ message: 'No es JSON válido' }];
  const retry = [
    { role: 'assistant', content: raw1 },
    { role: 'user', content:
      `Tu respuesta anterior no es JSON válido contra el esquema requerido. Errores: ${JSON.stringify(issues).slice(0, 500)}. Responde solo con JSON válido conforme al esquema, sin texto adicional ni bloques markdown.`
    },
  ];

  const raw2 = await callOnce(retry);
  let parsed2;
  try {
    parsed2 = JSON.parse(stripJsonFence(raw2));
  } catch {
    parsed2 = null;
  }
  if (parsed2) {
    const result = schema.safeParse(parsed2);
    if (result.success) {
      return { parsed: result.data, toolCalls: [], raw: raw2, usedFallback: false };
    }
  }

  const fallbackText = stripJsonFence(raw2 || raw1).replace(/[{}"]/g, '').trim()
    || 'No pude generar una respuesta estructurada. Intenta de nuevo.';
  return {
    parsed: { text: fallbackText, widgets: [] },
    toolCalls: [],
    raw: raw2,
    usedFallback: true,
  };
}

/**
 * Harness-implemented tool calling for models without native function support.
 * Asks the model to emit one of:
 *   {"action":"tool_call","tool_name":"<n>","tool_args":{...}}
 *   {"action":"respond","text":"<respuesta>"}
 * via Ollama's `format:'json'` mode, then translates back to the same shape
 * the agent loop expects from Gemini's native `generateWithTools`.
 *
 * Lower reliability than native (model may emit malformed JSON or wrong shape)
 * — we accept whatever we get and let the agent loop's grounding reminders
 * keep it on track. Write tools should NOT be exposed via this path.
 */
function buildToolListPrompt(tools) {
  if (!tools || tools.length === 0) return '';
  const lines = tools.map(t => {
    const props = t.parameters?.properties ? JSON.stringify(t.parameters.properties).slice(0, 200) : '{}';
    return `- ${t.name}: ${t.description}\n  Parámetros JSON: ${props}`;
  }).join('\n');
  return `\n\n=== HERRAMIENTAS DISPONIBLES ===\n${lines}\n\nPROTOCOLO DE RESPUESTA (OBLIGATORIO):\nDevuelve SOLO un objeto JSON con uno de estos dos formatos, sin texto adicional ni markdown:\n  - Para llamar una herramienta: {"action":"tool_call","tool_name":"<nombre>","tool_args":{...}}\n  - Para responder al usuario (cuando ya tengas datos suficientes): {"action":"respond","text":"<respuesta breve en español>"}`;
}

async function generateWithTools({ systemPrompt, history, message, tools, signal }) {
  const augmentedSystem = `${systemPrompt}${buildToolListPrompt(tools)}`;
  const messages = toOllamaMessages(augmentedSystem, history, message);

  const res = await raceWithTimeout(
    client.chat({
      model: DEFAULT_MODEL,
      messages,
      format: 'json',
      stream: false,
    }),
    signal,
  );
  if (signal?.aborted) throw new Error('aborted');

  const raw = res?.message?.content || '';
  let parsed;
  try { parsed = JSON.parse(stripJsonFence(raw)); }
  catch { return { text: raw, toolCalls: [] }; }

  if (parsed && parsed.action === 'tool_call' && parsed.tool_name) {
    return {
      text: '',
      toolCalls: [{ name: parsed.tool_name, args: parsed.tool_args || {} }],
    };
  }
  // 'respond' or anything else → treat as final text.
  const text = (parsed && typeof parsed.text === 'string') ? parsed.text : raw;
  return { text, toolCalls: [] };
}

module.exports = {
  generate,
  generateStream,
  generateStructured,
  generateWithTools,
  name: 'ollama',
  model: DEFAULT_MODEL,
  capabilities,
};
