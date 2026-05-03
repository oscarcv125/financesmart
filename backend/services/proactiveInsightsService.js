const { z } = require('zod');
const { computeInsights } = require('../routes/insights');
const logger = require('../utils/logger');

// Cache strategy: tier-1 in-memory (warm path) + tier-2 Postgres (cold-start
// resilient). On cold start the in-memory Map is empty, so we hit Postgres
// once to rehydrate; subsequent reads are O(1). 6h TTL applies to both.
const CACHE = new Map();
const TTL_MS = 6 * 60 * 60 * 1000;

const ProactiveSchema = z.object({
  observaciones: z.array(z.object({
    titulo: z.string().min(3).max(80),
    detalle: z.string().min(5).max(280),
    severidad: z.enum(['alta', 'media', 'baja']),
  })).max(3),
});

const SYSTEM_PROMPT = [
  'Eres un asistente financiero que destila observaciones útiles a partir de datos ya procesados.',
  'Recibes alertas determinísticas calculadas por el sistema y debes elegir hasta 3 que valgan la pena resaltar HOY.',
  'NO inventes datos, NO repitas literalmente las alertas — interprétalas brevemente y agrupa cuando tenga sentido.',
  'Cada observación: título corto (máx 60 chars), detalle de una oración (máx 200 chars), severidad alta/media/baja.',
  'Responde SOLO en español, conforme al esquema JSON.',
].join(' ');

function cacheGet(id_usuario) {
  const e = CACHE.get(id_usuario);
  if (!e) return null;
  if (Date.now() - e.generated_at > TTL_MS) { CACHE.delete(id_usuario); return null; }
  return e.payload;
}

function cacheSet(id_usuario, payload) {
  CACHE.set(id_usuario, { generated_at: Date.now(), payload });
}

async function cacheGetPersistent({ supabase, id_usuario }) {
  try {
    const { data, error } = await supabase
      .from('proactive_insights_cache')
      .select('generated_at, payload')
      .eq('id_usuario', id_usuario)
      .maybeSingle();
    if (error || !data) return null;
    const ageMs = Date.now() - new Date(data.generated_at).getTime();
    if (ageMs > TTL_MS) return null;
    // Hydrate the in-memory tier so subsequent calls in the same instance are O(1).
    CACHE.set(id_usuario, { generated_at: Date.now() - ageMs, payload: data.payload });
    return data.payload;
  } catch (err) {
    logger.warn('proactive cache read failed', { id_usuario, message: err.message });
    return null;
  }
}

async function cacheSetPersistent({ supabase, id_usuario, payload }) {
  try {
    const { error } = await supabase
      .from('proactive_insights_cache')
      .upsert({ id_usuario, payload, generated_at: new Date().toISOString() });
    if (error) logger.warn('proactive cache write failed', { id_usuario, message: error.message });
  } catch (err) {
    logger.warn('proactive cache write threw', { id_usuario, message: err.message });
  }
}

function clearCache(id_usuario) {
  if (id_usuario) CACHE.delete(id_usuario);
  else CACHE.clear();
}

/**
 * Compute proactive insights for a user. Strategy:
 *  1. Run the deterministic computeInsights() — this never hallucinates.
 *  2. If LLM provider has structured output, ask it to summarize/select up to 3.
 *     Fall back to the deterministic output (re-shaped) on any LLM failure.
 *  3. Cache result for 6h.
 */
async function getProactiveInsights({ supabase, id_usuario, aiProvider, force = false }) {
  if (!force) {
    const cached = cacheGet(id_usuario);
    if (cached) return { ...cached, cached: true };
    const persistent = await cacheGetPersistent({ supabase, id_usuario });
    if (persistent) return { ...persistent, cached: true };
  }

  const baseline = await computeInsights({ supabase, id_usuario });
  const insights = baseline.insights || [];

  // No LLM enrichment if provider can't do structured output, or no insights to enrich.
  const canEnrich = aiProvider?.capabilities?.supportsStructuredOutput && typeof aiProvider.generateStructured === 'function';
  if (!canEnrich || insights.length === 0) {
    const payload = {
      observaciones: insights.slice(0, 3).map(i => ({
        titulo: i.title,
        detalle: i.detail,
        severidad: i.severity === 'high' ? 'alta' : i.severity === 'medium' ? 'media' : 'baja',
      })),
      source: insights.length === 0 ? 'empty' : 'deterministic',
    };
    cacheSet(id_usuario, payload);
    return { ...payload, cached: false };
  }

  // Ask the LLM to pick + summarize.
  const promptBody = [
    'Estas son las alertas calculadas por el sistema:',
    ...insights.map((i, idx) => `${idx + 1}. [${i.severity}] ${i.title} — ${i.detail}`),
    '',
    'Devuelve un JSON con observaciones (hasta 3).',
  ].join('\n');

  try {
    const r = await aiProvider.generateStructured({
      systemPrompt: SYSTEM_PROMPT,
      history: [],
      message: promptBody,
      schema: ProactiveSchema,
      schemaName: 'ProactiveInsights',
    });
    const payload = {
      observaciones: r.parsed?.observaciones || [],
      source: 'llm',
    };
    cacheSet(id_usuario, payload);
    cacheSetPersistent({ supabase, id_usuario, payload });
    return { ...payload, cached: false };
  } catch (err) {
    // Fallback to deterministic on any LLM error.
    const payload = {
      observaciones: insights.slice(0, 3).map(i => ({
        titulo: i.title,
        detalle: i.detail,
        severidad: i.severity === 'high' ? 'alta' : i.severity === 'medium' ? 'media' : 'baja',
      })),
      source: 'deterministic_fallback',
      error: err.message,
    };
    cacheSet(id_usuario, payload);
    cacheSetPersistent({ supabase, id_usuario, payload });
    return { ...payload, cached: false };
  }
}

module.exports = { getProactiveInsights, clearCache, ProactiveSchema, TTL_MS };
