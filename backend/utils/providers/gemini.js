const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

function buildBody(systemPrompt, history, message) {
  const contents = [...(history || []), { role: 'user', parts: [{ text: message }] }];
  const thinkingBudget = process.env.GEMINI_THINKING_BUDGET !== undefined
    ? parseInt(process.env.GEMINI_THINKING_BUDGET, 10)
    : 0;
  return {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      thinkingConfig: { thinkingBudget },
    },
  };
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
      signal,
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

module.exports = { generate, generateStream, name: 'gemini', model: DEFAULT_MODEL };
