const {
  GROUNDING_REMINDER,
  REDUNDANT_LOOP_REMINDER,
  MAX_ITER_FALLBACK,
  FINAL_RESPONSE_NUDGE,
  EMPTY_RESPONSE_FALLBACK,
} = require('./grounding');

const DEFAULT_MAX_ITERS = 10;
const REDUNDANT_THRESHOLD = 3;
const MAX_HISTORY_BYTES = 40 * 1024;
const COMPACTED_PLACEHOLDER = '[Resultado anterior compactado para ahorrar contexto. Si necesitas estos datos, vuelve a llamar la herramienta.]';

function hashCall(name, args) {
  try { return `${name}::${JSON.stringify(args || {})}`; }
  catch { return `${name}::?`; }
}

function isRedundantLoop(trace) {
  if (trace.length >= REDUNDANT_THRESHOLD) {
    const tail = trace.slice(-REDUNDANT_THRESHOLD).map(c => c.hash);
    if (tail.every(h => h === tail[0])) return true;
  }
  // Also catch alternating ABAB patterns (cycle of 2 different calls).
  if (trace.length >= 4) {
    const t = trace.slice(-4).map(c => c.hash);
    if (t[0] === t[2] && t[1] === t[3] && t[0] !== t[1]) return true;
  }
  return false;
}

// Estimate the JSON-serialized size of the conversation. Used to decide when
// to compact older tool results.
function approxBytes(conversation) {
  try { return JSON.stringify(conversation).length; }
  catch { return 0; }
}

// When the conversation grows past MAX_HISTORY_BYTES, replace the oldest
// `functionResponse` payloads with a placeholder so the model knows the data
// existed but is gone. We keep the most recent two tool-result turns intact —
// that's what the model is most likely to reason over next.
function compactHistory(conversation) {
  if (approxBytes(conversation) <= MAX_HISTORY_BYTES) return;
  const toolResultIdxs = [];
  for (let i = 0; i < conversation.length; i++) {
    const c = conversation[i];
    if (c.role === 'user' && (c.parts || []).some(p => p.functionResponse)) {
      toolResultIdxs.push(i);
    }
  }
  if (toolResultIdxs.length <= 2) return; // nothing safely droppable

  const keepFromIdx = toolResultIdxs[toolResultIdxs.length - 2];
  for (let i = 0; i < keepFromIdx; i++) {
    const c = conversation[i];
    if (c.role !== 'user') continue;
    c.parts = (c.parts || []).map(p => {
      if (!p.functionResponse) return p;
      return {
        functionResponse: {
          name: p.functionResponse.name,
          response: { result: { __compacted: true, hint: COMPACTED_PLACEHOLDER } },
        },
      };
    });
  }
}

function summarizeResult(res) {
  if (!res || typeof res !== 'object') return String(res).slice(0, 80);
  if (res.ok === false) return `error: ${res.error || ''}`;
  const data = res.data;
  if (Array.isArray(data)) return `${data.length} fila(s)`;
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    return keys.length <= 4 ? keys.join(', ') : `${keys.slice(0, 4).join(', ')} (+${keys.length - 4})`;
  }
  return String(data).slice(0, 80);
}

/**
 * Run the agent loop using a provider that supports tools (Gemini path).
 *
 * Each iteration:
 *   1. Ask provider for next turn (text and/or toolCalls).
 *   2. If no toolCalls, we're done — return the text.
 *   3. Otherwise, execute each tool call in parallel via registry.exec, append
 *      results back into the conversation as functionResponse parts, plus a
 *      grounding reminder, then loop.
 *
 * Aborts if signal triggers, caps at MAX_ITERS, detects redundant loops.
 */
async function runAgentLoop({
  provider,
  registry,
  systemPrompt,
  history = [],
  message,
  send,
  signal,
  maxIters = DEFAULT_MAX_ITERS,
  onTextDelta,
}) {
  if (!provider?.generateWithTools) {
    throw new Error('Provider does not support generateWithTools (tool calling).');
  }
  const useStreaming = typeof provider.generateStreamWithTools === 'function' && typeof onTextDelta === 'function';
  const conversation = [...history];
  let pendingMessage = message;
  const trace = [];

  // Helper that calls either the streaming or non-streaming variant and
  // returns { text, toolCalls } the same way. When streaming, also emits text
  // deltas via onTextDelta as they arrive.
  async function runTurn(extraOpts = {}) {
    if (useStreaming && !extraOpts.preferNonStreaming) {
      let text = '';
      let toolCalls = [];
      for await (const evt of provider.generateStreamWithTools({
        systemPrompt,
        history: conversation,
        message: pendingMessage,
        tools: registry.geminiDeclarations,
        signal,
      })) {
        if (evt.type === 'text') {
          text += evt.delta;
          onTextDelta(evt.delta);
        } else if (evt.type === 'toolCalls') {
          toolCalls = evt.calls;
        }
      }
      return { text, toolCalls };
    }
    return provider.generateWithTools({
      systemPrompt,
      history: conversation,
      message: pendingMessage,
      tools: registry.geminiDeclarations,
      signal,
    });
  }

  for (let iter = 0; iter < maxIters; iter++) {
    if (signal?.aborted) return { aborted: true, iters: iter };

    const turn = await runTurn();

    const toolCalls = turn.toolCalls || [];

    if (toolCalls.length === 0) {
      // Model decided no more tool calls. If it also returned non-empty text,
      // we're done. If text is empty AND we previously executed at least one
      // tool, Gemini sometimes "forgets" to produce a final user-facing reply
      // — re-prompt once with a nudge to force a text response.
      const text = (turn.text || '').trim();
      if (text) {
        return { text: turn.text, iters: iter, hitCap: false, trace };
      }
      if (trace.length === 0) {
        // No tools were called and no text either — degenerate, just return empty.
        return { text: '', iters: iter, hitCap: false, trace };
      }
      if (signal?.aborted) return { aborted: true, iters: iter, trace };
      // Nudge for a final response.
      conversation.push({
        role: 'user',
        parts: [{ text: FINAL_RESPONSE_NUDGE }],
      });
      const prevMessage = pendingMessage;
      pendingMessage = '';
      const nudged = await runTurn();
      pendingMessage = prevMessage;
      const nudgedText = (nudged.text || '').trim();
      return {
        text: nudgedText || EMPTY_RESPONSE_FALLBACK,
        iters: iter + 1,
        hitCap: false,
        trace,
        nudged: true,
      };
    }

    // Append the user message (only on first iter) and the model's tool calls.
    if (pendingMessage) {
      conversation.push({ role: 'user', parts: [{ text: pendingMessage }] });
      pendingMessage = '';
    }
    conversation.push({
      role: 'model',
      parts: toolCalls.map(tc => ({ functionCall: { name: tc.name, args: tc.args } })),
    });

    // Execute every tool call in parallel.
    send?.('status', { text: 'Consultando datos…' });
    const results = await Promise.all(toolCalls.map(async (tc) => {
      send?.('tool_call', { name: tc.name, args: tc.args, iter });
      const res = await registry.exec(tc.name, tc.args);
      send?.('tool_result', { name: tc.name, ok: !!res.ok, summary: summarizeResult(res), iter });
      trace.push({ hash: hashCall(tc.name, tc.args), ok: !!res.ok });
      return { name: tc.name, response: res };
    }));

    const redundant = isRedundantLoop(trace);

    // Append all functionResponse parts in a single user-role turn (Gemini's
    // expected shape). NOTE: we used to also append GROUNDING_REMINDER as a
    // text part here, but Gemini occasionally echoed the reminder back as its
    // final reply (the text part got interpreted as user input rather than
    // instruction). The base system prompt already covers grounding.
    const parts = results.map(r => ({
      functionResponse: { name: r.name, response: { result: r.response } },
    }));
    // Only append the redundant-loop reminder when actually triggered — that
    // case is rare enough that the leak risk is acceptable.
    if (redundant) parts.push({ text: REDUNDANT_LOOP_REMINDER });
    conversation.push({ role: 'user', parts });
    compactHistory(conversation);

    // If the model is stuck in a loop, give it ONE more chance to produce a
    // text response, then bail. Without this we'd burn the rest of maxIters
    // watching the same query repeat.
    if (redundant) {
      if (signal?.aborted) return { aborted: true, iters: iter + 1, trace };
      conversation.push({ role: 'user', parts: [{ text: FINAL_RESPONSE_NUDGE }] });
      const prevMessage = pendingMessage;
      pendingMessage = '';
      const finalTurn = await runTurn();
      pendingMessage = prevMessage;
      const finalText = (finalTurn.text || '').trim();
      return {
        text: finalText || EMPTY_RESPONSE_FALLBACK,
        iters: iter + 1,
        hitCap: false,
        trace,
        breakReason: 'redundant_loop',
      };
    }
  }

  // Hit the iteration cap.
  return { text: MAX_ITER_FALLBACK, iters: maxIters, hitCap: true, trace };
}

module.exports = { runAgentLoop, DEFAULT_MAX_ITERS };
