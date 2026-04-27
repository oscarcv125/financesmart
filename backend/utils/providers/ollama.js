const { Ollama } = require('ollama');

const client = new Ollama({
  host: process.env.OLLAMA_HOST || 'http://localhost:11434',
});

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

function toOllamaMessages(systemPrompt, history, message) {
  const mapped = (history || []).map(h => ({
    role: h.role === 'model' ? 'assistant' : h.role,
    content: h.parts?.[0]?.text || '',
  }));
  return [
    { role: 'system', content: systemPrompt },
    ...mapped,
    { role: 'user', content: message },
  ];
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

module.exports = { generate, generateStream, name: 'ollama', model: DEFAULT_MODEL };
