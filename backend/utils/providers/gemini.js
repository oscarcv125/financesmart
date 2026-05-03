const { zodToGeminiSchema } = require('../zodToGeminiSchema');

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS || '90000', 10);

// Combine an external client signal with our own timeout so a hung upstream
// can't pin a serverless function for the full maxDuration.
function withTimeout(signal, ms = DEFAULT_TIMEOUT_MS) {
  if (typeof AbortSignal?.timeout !== 'function') return signal;
  const timeoutSignal = AbortSignal.timeout(ms);
  if (!signal) return timeoutSignal;
  if (typeof AbortSignal?.any === 'function') return AbortSignal.any([signal, timeoutSignal]);
  // Node 18 fallback: combine manually.
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  signal.addEventListener('abort', onAbort, { once: true });
  timeoutSignal.addEventListener('abort', onAbort, { once: true });
  return ctrl.signal;
}

const capabilities = {
  supportsStructuredOutput: true,
  supportsTools: true,
  supportsToolCalling: true,
  supportsStreaming: true,
};

function buildBody(systemPrompt, history, message, extras = {}) {
  const contents = [...(history || []), { role: 'user', parts: [{ text: message }] }];
  const thinkingBudget = process.env.GEMINI_THINKING_BUDGET !== undefined
    ? parseInt(process.env.GEMINI_THINKING_BUDGET, 10)
    : 0;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      thinkingConfig: { thinkingBudget },
      ...(extras.generationConfig || {}),
    },
  };
  if (extras.tools) body.tools = extras.tools;
  return body;
}

async function generate({ systemPrompt, history, message }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody(systemPrompt, history, message)),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini error: ${res.status}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';
}

async function* generateStream({ systemPrompt, history, message, signal }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurada');
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody(systemPrompt, history, message)),
      signal: withTimeout(signal),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini stream error: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  function nextBoundary(s) {
    const a = s.indexOf('\n\n');
    const b = s.indexOf('\r\n\r\n');
    if (a === -1) return b === -1 ? -1 : { idx: b, len: 4 };
    if (b === -1) return { idx: a, len: 2 };
    return a < b ? { idx: a, len: 2 } : { idx: b, len: 4 };
  }

  try {
    while (true) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let bound;
      while ((bound = nextBoundary(buf)) !== -1) {
        const event = buf.slice(0, bound.idx);
        buf = buf.slice(bound.idx + bound.len);
        for (const line of event.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) yield text;
          } catch {
            continue;
          }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* */ }
  }
}

async function generateStructured({ systemPrompt, history, message, schema, schemaName = 'Response', tools, signal }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurada');
  }
  if (!schema) {
    throw new Error('generateStructured requires a zod schema');
  }

  const responseSchema = zodToGeminiSchema(schema, schemaName);

  const extras = {
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  };
  if (tools && tools.length > 0) {
    extras.tools = [{ functionDeclarations: tools }];
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildBody(systemPrompt, history, message, extras)),
      signal: withTimeout(signal),
    }
  );

  if (!res.ok) {
    let body = '';
    try { body = await res.text(); } catch { /* */ }
    throw new Error(`Gemini structured error: ${res.status} ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const textPart = parts.find(p => typeof p?.text === 'string');
  const functionCalls = parts.filter(p => p?.functionCall).map(p => ({
    name: p.functionCall.name,
    args: p.functionCall.args || {},
  }));

  let parsed = null;
  let raw = '';
  if (textPart) {
    raw = textPart.text;
    try {
      const json = JSON.parse(raw);
      const result = schema.safeParse(json);
      if (result.success) {
        parsed = result.data;
      } else {
        throw new Error(`Schema validation failed: ${JSON.stringify(result.error.issues)}`);
      }
    } catch (err) {
      throw new Error(`Failed to parse Gemini structured response: ${err.message}. Raw: ${raw.slice(0, 200)}`);
    }
  }

  return {
    parsed,
    toolCalls: functionCalls,
    raw,
    usedFallback: false,
  };
}

/**
 * One agent turn: send the conversation to Gemini with tools enabled, get back
 * either a text response or a list of tool calls (or both). Used by the agent
 * loop. No responseSchema — that biases the model to respond instead of calling
 * tools.
 */
async function generateWithTools({ systemPrompt, history, message, tools, signal }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurada');
  }
  const extras = {};
  if (tools && tools.length > 0) {
    extras.tools = [{ functionDeclarations: tools }];
  }
  // The body builder treats `message` as a final user turn, but for the agent
  // loop the user turn may already be in `history` (with tool results). Pass an
  // empty message in that case and let history carry the conversation.
  const body = buildBody(systemPrompt, history, message || '', extras);
  // Strip the empty user turn we synthesized when message is empty.
  if (!message) {
    body.contents = body.contents.filter(c => !(c.role === 'user' && c.parts.length === 1 && c.parts[0].text === ''));
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: withTimeout(signal),
    }
  );
  if (!res.ok) {
    let txt = '';
    try { txt = await res.text(); } catch { /* */ }
    throw new Error(`Gemini agent turn error: ${res.status} ${txt.slice(0, 400)}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter(p => typeof p?.text === 'string').map(p => p.text).join('');
  const toolCalls = parts
    .filter(p => p?.functionCall)
    .map(p => ({ name: p.functionCall.name, args: p.functionCall.args || {} }));
  return { text, toolCalls };
}

/**
 * Streaming variant of generateWithTools. Yields events in order:
 *   { type: 'text', delta }     — text chunk (emit to client immediately)
 *   { type: 'toolCalls', calls } — model wants to call tools (loop should pause)
 *   { type: 'done' }             — stream finished
 *
 * The loop uses this so the user sees tokens as Gemini produces them on the
 * final turn (when no more tool calls are pending), instead of waiting for the
 * whole reply and then animating it client-side.
 */
async function* generateStreamWithTools({ systemPrompt, history, message, tools, signal }) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY no configurada');
  }
  const extras = {};
  if (tools && tools.length > 0) {
    extras.tools = [{ functionDeclarations: tools }];
  }
  const body = buildBody(systemPrompt, history, message || '', extras);
  if (!message) {
    body.contents = body.contents.filter(c => !(c.role === 'user' && c.parts.length === 1 && c.parts[0].text === ''));
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: withTimeout(signal),
    }
  );
  if (!res.ok) {
    let txt = '';
    try { txt = await res.text(); } catch { /* */ }
    throw new Error(`Gemini stream-with-tools error: ${res.status} ${txt.slice(0, 400)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  const accumulatedToolCalls = [];

  function nextBoundary(s) {
    const a = s.indexOf('\n\n');
    const b = s.indexOf('\r\n\r\n');
    if (a === -1 && b === -1) return -1;
    if (a === -1) return { idx: b, len: 4 };
    if (b === -1) return { idx: a, len: 2 };
    return a < b ? { idx: a, len: 2 } : { idx: b, len: 4 };
  }

  try {
    while (true) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let bound;
      while ((bound = nextBoundary(buf)) !== -1) {
        const event = buf.slice(0, bound.idx);
        buf = buf.slice(bound.idx + bound.len);
        for (const line of event.split(/\r?\n/)) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          let parsed;
          try { parsed = JSON.parse(payload); } catch { continue; }
          const parts = parsed?.candidates?.[0]?.content?.parts || [];
          for (const p of parts) {
            if (typeof p?.text === 'string' && p.text) {
              yield { type: 'text', delta: p.text };
            }
            if (p?.functionCall) {
              accumulatedToolCalls.push({
                name: p.functionCall.name,
                args: p.functionCall.args || {},
              });
            }
          }
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* */ }
  }

  if (accumulatedToolCalls.length > 0) {
    yield { type: 'toolCalls', calls: accumulatedToolCalls };
  }
  yield { type: 'done' };
}

module.exports = {
  generate,
  generateStream,
  generateStructured,
  generateWithTools,
  generateStreamWithTools,
  name: 'gemini',
  model: DEFAULT_MODEL,
  capabilities,
};
