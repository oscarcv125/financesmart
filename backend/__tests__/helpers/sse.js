function parseSSE(rawText) {
  const events = [];
  if (!rawText) return { events, deltas: [], done: null, error: null };

  for (const block of rawText.split(/\r?\n\r?\n/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    for (const line of trimmed.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      try {
        events.push(JSON.parse(payload));
      } catch {
        // ignore malformed
      }
    }
  }

  const deltas = events.filter(e => e.type === 'delta').map(e => e.text || '');
  const done = events.find(e => e.type === 'done') || null;
  const error = events.find(e => e.type === 'error') || null;
  return { events, deltas, done, error, fullText: deltas.join('') };
}

module.exports = { parseSSE };
