// Assertion implementations for the regression suite.
// Each takes (response, assertionConfig, ctx) and returns
//   { pass: boolean, why: string }.
//
// `response` shape:
//   { text: string, toolCalls: [{name, args, ok}], events: [...] }

// Either thousands-formatted (1-3 digits + groups of `,###`) OR a plain digit
// run, with optional decimal. The thousands branch matters because models
// sometimes emit `8,639` and sometimes `8639` for the same number — both must
// resolve to a single 8639 token, not three.
const NUMBER_RE = /\$?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?)/g;

function parseNumbers(s) {
  if (!s) return [];
  const out = [];
  for (const m of s.matchAll(NUMBER_RE)) {
    const cleaned = m[1].replace(/,/g, '');
    const n = parseFloat(cleaned);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

const ASSERTIONS = {
  contains_number({ response }, { value, tolerance = 0.02 }) {
    const numbers = parseNumbers(response.text);
    const target = Math.abs(value);
    const tol = Math.max(1, target * tolerance);
    const hit = numbers.some(n => Math.abs(Math.abs(n) - target) <= tol);
    return { pass: hit, why: hit ? '' : `expected number ~${value} ±${tolerance * 100}%; got ${numbers.slice(0, 8).join(', ')}` };
  },

  cites_category({ response }, { value }) {
    const re = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const pass = re.test(response.text);
    return { pass, why: pass ? '' : `expected category "${value}" mentioned` };
  },

  no_fabricated_categories({ response }, _, ctx) {
    const valid = (ctx.categorias_validas || []).map(c => c.toLowerCase());
    // Match "categoría X" (more specific than "en X" which produces too many false positives
    // — "en tus presupuestos", "en lo que va del mes", etc).
    const re = /categor[ií]a\s+([A-Za-zÁÉÍÓÚáéíóúÑñ]+(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]+){0,2})/gi;
    const STOP = new Set(['general', 'total', 'todo', 'todos', 'tu', 'tus', 'mi', 'mis', 'el', 'la', 'los', 'las', 'este', 'ese', 'de', 'del', 'que']);
    const mentioned = [];
    for (const m of response.text.matchAll(re)) {
      const phrase = m[1].trim().toLowerCase();
      // Strip leading stopwords from the captured phrase
      const tokens = phrase.split(/\s+/).filter(t => !STOP.has(t));
      const word = tokens[0];
      if (!word || STOP.has(word)) continue;
      mentioned.push(word);
    }
    const fabricated = mentioned.filter(w => !valid.some(v => v.toLowerCase().includes(w) || w.includes(v.toLowerCase())));
    return { pass: fabricated.length === 0, why: fabricated.length === 0 ? '' : `mentioned non-existent categories: ${[...new Set(fabricated)].slice(0, 4).join(', ')}` };
  },

  no_fabricated_amounts({ response }, _, ctx) {
    const valid = new Set();
    (ctx.real_amounts || []).forEach(n => valid.add(Math.round(n)));
    const numbers = parseNumbers(response.text).map(n => Math.round(Math.abs(n)));
    const candidates = numbers.filter(n => n > 10 && !(n >= 0 && n <= 100));
    const fabricated = candidates.filter(n => {
      return ![...valid].some(v => Math.abs(v - n) <= 2);
    });
    return { pass: fabricated.length === 0, why: fabricated.length === 0 ? '' : `unmatched amounts: ${fabricated.slice(0, 5).join(', ')}` };
  },

  invokes_tool({ response }, { name }) {
    const pass = (response.toolCalls || []).some(tc => tc.name === name);
    return { pass, why: pass ? '' : `expected tool ${name} to be called; called: ${(response.toolCalls || []).map(t => t.name).join(', ') || 'none'}` };
  },

  does_not_invoke_tool({ response }, { name }) {
    const pass = !(response.toolCalls || []).some(tc => tc.name === name);
    return { pass, why: pass ? '' : `tool ${name} should NOT have been called` };
  },

  refuses_gracefully({ response }, _, ctx) {
    const refusalPhrases = /\b(no tengo|no tienes|no existe|no encontr[éa]|no encuentro|no hay registros?|sin datos|no dispongo|no puedo|no tengo acceso|parece que no|no est[áa] registrad\w*|no aparece|no figura|solo respondo|solo puedo ayud|solo te ayudo|s[oó]lo me dedico|fuera de mi alcance|me especiali|temas financieros)\b/i;
    const hasRefusal = refusalPhrases.test(response.text);
    // Only flag fabricated numbers if they DON'T match any real ground-truth amount.
    // Refusal replies that also list real existing data ("no tienes coche, pero
    // sí Cancún por $25,000") should still pass.
    const realAmounts = new Set((ctx?.real_amounts || []).map(n => Math.round(n)));
    const numbers = (response.text.match(/\$\s*\d[\d,]*/g) || []).map(s => parseInt(s.replace(/[$,\s]/g, ''), 10));
    const fabricated = numbers.some(n => n > 50 && ![...realAmounts].some(v => Math.abs(v - n) <= 2));
    const pass = hasRefusal && !fabricated;
    return { pass, why: pass ? '' : `expected polite refusal without fabricated numbers; reply: ${response.text.slice(0, 100)}` };
  },

  mentions_meta({ response }, { value }) {
    const re = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const pass = re.test(response.text);
    return { pass, why: pass ? '' : `expected meta "${value}" mentioned` };
  },

  language({ response }, { value = 'es' }) {
    if (value !== 'es') return { pass: true, why: '' };
    const text = (response.text || '').trim();
    if (!text) return { pass: false, why: 'empty reply' };
    const hasSpanishChars = /[ñÑáéíóúÁÉÍÓÚ¿¡]/.test(text);
    const STOPWORDS = /\b(el|la|los|las|de|del|que|qu[eé]|en|y|tu|tus|tienes|tiene|este|esta|por|para|con|son|hola|gracias|bien|muy|puedo|puedes|ayud|hoy|aqu[ií]|ti|cu[aá]nto|cu[aá]l|d[oó]nde|c[oó]mo|s[ií]|no|solo|respondo|espa[nñ]ol|mi|mis|me|te|se|lo|como|hace|d[ií]a|d[ií]as|mes|meses|a[nñ]o|a[nñ]os|gast[eé]?|gastaste|gastado|saldo|ingres|tienes?|registros?|periodo)\b/gi;
    const spanishHits = (text.match(STOPWORDS) || []).length;
    const hasEnglish = /\b(the|your|you|have|this|that|with|from|please|sorry|cannot|would|should|will|spent|saved|month|year|account|budget)\b/i.test(text);
    // Short replies (<40 chars) pass if they have ANY Spanish indicator and no English.
    // Longer replies need a stronger signal (Spanish chars or 2+ stopwords).
    const looksSpanish = text.length < 40
      ? (hasSpanishChars || spanishHits >= 1)
      : (hasSpanishChars || spanishHits >= 2);
    const pass = looksSpanish && !hasEnglish;
    return { pass, why: pass ? '' : `expected Spanish; reply: ${text.slice(0, 80)}` };
  },

  max_length({ response }, { value = 500 }) {
    const pass = response.text.length <= value;
    return { pass, why: pass ? '' : `reply too long (${response.text.length} > ${value}): ${response.text.slice(0, 60)}…` };
  },

  contains_text({ response }, { value }) {
    const re = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const pass = re.test(response.text);
    return { pass, why: pass ? '' : `expected text "${value}" in reply` };
  },

  does_not_contain_substring({ response }, { value }) {
    const re = new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const pass = !re.test(response.text);
    return { pass, why: pass ? '' : `response should not contain "${value}"` };
  },

  no_system_prompt_leakage({ response }) {
    // Words/phrases that only appear in our system prompts or tool docs.
    // If the model echoes them, it's leaking instructions.
    const forbidden = /\b(INSTRUCCI[ÓO]N DE HERRAMIENTAS|HERRAMIENTAS DISPONIBLES|SIEMPRE llama|NUNCA inventes|Usa [ÚU]NICAMENTE|GROUNDING_REMINDER|system_instruction|functionCall|generateStructured|tool_call|obtener_resumen_mes|obtener_movimientos|obtener_metas_ahorro|obtener_presupuestos|obtener_recurrencias|obtener_tarjetas|obtener_salud_financiera|obtener_insights_automaticos|proponer_aporte_meta|proponer_crear_presupuesto|proponer_modificar_presupuesto|proponer_toggle_recurrencia|proponer_crear_meta)\b/;
    const pass = !forbidden.test(response.text);
    return { pass, why: pass ? '' : `system prompt / tool name leaked into reply` };
  },

  tool_call_count({ response }, { value, operator = '=' }) {
    const count = (response.toolCalls || []).length;
    const ops = {
      '=': () => count === value, '==': () => count === value,
      '<=': () => count <= value, '<': () => count < value,
      '>=': () => count >= value, '>': () => count > value,
    };
    const pass = !!ops[operator]?.();
    return { pass, why: pass ? '' : `tool call count: expected ${operator} ${value}, got ${count}` };
  },

  contains_number_exact({ response }, { value, tolerance = 0 }) {
    const numbers = parseNumbers(response.text);
    const target = Math.abs(value);
    const hit = numbers.some(n => Math.abs(Math.abs(n) - target) <= tolerance);
    return { pass: hit, why: hit ? '' : `expected exact number ${value} ±${tolerance}; got ${numbers.slice(0, 8).join(', ')}` };
  },

  refusal_with_prior_tool_call({ response }) {
    const refusalPhrases = /\b(no tengo|no tienes|no existe|no encontr[éa]|no encuentro|no hay registros?|sin datos|no dispongo|no puedo|parece que no|no est[áa] registrad\w*|no aparece|no figura)\b/i;
    const hasRefusal = refusalPhrases.test(response.text);
    const toolsInvoked = (response.toolCalls || []).length > 0;
    const pass = hasRefusal && toolsInvoked;
    return { pass, why: pass ? '' : `expected refusal AFTER a tool call; got refusal=${hasRefusal}, tools=${toolsInvoked}` };
  },

  invokes_tool_any({ response }, { names = [] }) {
    const called = (response.toolCalls || []).map(t => t.name);
    const pass = names.some(n => called.includes(n));
    return { pass, why: pass ? '' : `expected one of [${names.join(', ')}]; called: ${called.join(', ') || 'none'}` };
  },

  no_verbose_spanish_stage_directions({ response }) {
    // Allowed if the reply is short — short-form bot can use one preamble word.
    if (response.text.length < 120) return { pass: true, why: '' };
    // Penalize multiple preamble phrases or a single long preamble in long replies.
    const verbose = /\b(Aqu[ií] tienes|Perm[íi]teme|Por supuesto|Te muestro|Veamos|D[eé]jame mostrarte|Como puedes ver,)\b/gi;
    const matches = response.text.match(verbose) || [];
    const pass = matches.length <= 1;
    return { pass, why: pass ? '' : `verbose preamble phrases (${matches.length}): ${matches.slice(0, 3).join(', ')}` };
  },
};

function evaluate(response, assertionsList, ctx) {
  const results = [];
  for (const a of assertionsList) {
    const fn = ASSERTIONS[a.type];
    if (!fn) {
      results.push({ type: a.type, pass: false, why: `unknown assertion type: ${a.type}` });
      continue;
    }
    try {
      const r = fn({ response }, a, ctx);
      results.push({ type: a.type, params: { ...a, type: undefined }, pass: r.pass, why: r.why });
    } catch (err) {
      results.push({ type: a.type, pass: false, why: `assertion threw: ${err.message}` });
    }
  }
  return {
    pass: results.every(r => r.pass),
    failed: results.filter(r => !r.pass),
    results,
  };
}

module.exports = { evaluate, ASSERTIONS, parseNumbers };
