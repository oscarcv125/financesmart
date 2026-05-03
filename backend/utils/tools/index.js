const { z } = require('zod');
const { buildAgentContext } = require('./context');
const { buildToolSchemas, TOOL_DESCRIPTIONS_ES } = require('./schemas');
const { buildReadTools } = require('./readTools');
const { buildWriteSchemas, buildWriteTools, WRITE_DESCRIPTIONS_ES } = require('./writeTools');
const { zodToGeminiSchema } = require('../zodToGeminiSchema');

/**
 * Build a per-request tool registry. Returns:
 *   {
 *     ctx,                    // pre-fetched context (categoria/tarjeta/meta enums)
 *     names: string[],
 *     describe(name) → string (Spanish description),
 *     geminiDeclarations: [{name, description, parameters}],
 *     exec(name, args) → Promise<{ok:true,data} | {ok:false,error,hint?}>,
 *   }
 *
 * exec validates args via the per-request zod schema (which references ctx
 * for ID enums) before calling the underlying executor. Validation failures
 * return a structured {ok:false, error, hint} so the model can self-correct
 * on the next iteration without ever hitting Postgres with bad data.
 */
async function buildToolRegistry({ supabase, id_usuario, opts = {} }) {
  const ctx = await buildAgentContext({ supabase, id_usuario });
  const readSchemas = buildToolSchemas(ctx);
  const readExecs = buildReadTools(ctx);

  let allSchemas = { ...readSchemas };
  let enabled = { ...readExecs };

  // Write tools are opt-in (gated by caller — wired only on the Gemini path
  // because small Ollama models hallucinate too aggressively for safe writes,
  // even with the confirmation card).
  if (opts.includeWrites) {
    const writeSchemas = buildWriteSchemas(ctx);
    const writeExecs = buildWriteTools(ctx, { send: opts.send });
    allSchemas = { ...allSchemas, ...writeSchemas };
    enabled = { ...enabled, ...writeExecs };
  }

  const schemas = allSchemas;
  const names = Object.keys(enabled);

  function describe(name) {
    return TOOL_DESCRIPTIONS_ES[name] || WRITE_DESCRIPTIONS_ES[name] || `Herramienta ${name}.`;
  }

  function geminiDeclaration(name) {
    const schema = schemas[name];
    if (!schema) return null;
    return {
      name,
      description: describe(name),
      parameters: zodToGeminiSchema(schema),
    };
  }

  const geminiDeclarations = names.map(geminiDeclaration).filter(Boolean);

  async function exec(name, rawArgs) {
    const schema = schemas[name];
    const fn = enabled[name];
    if (!schema || !fn) {
      return { ok: false, error: 'TOOL_NO_ENCONTRADA', mensaje: `La herramienta ${name} no existe.`, hint: `Herramientas disponibles: ${names.join(', ')}` };
    }
    const parsed = schema.safeParse(rawArgs || {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        ok: false,
        error: issue?.message || 'ARGUMENTO_INVALIDO',
        mensaje: `Argumentos inválidos para ${name}: ${issue?.path?.join('.') || ''} ${issue?.message || ''}`.trim(),
        hint: 'Revisa el formato esperado y vuelve a llamar la herramienta.',
      };
    }
    try {
      const data = await fn.call(enabled, parsed.data);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: 'INTERNAL', mensaje: String(err?.message || err), hint: 'Reformula la consulta o intenta otra herramienta.' };
    }
  }

  return { ctx, names, describe, geminiDeclaration, geminiDeclarations, exec };
}

module.exports = { buildToolRegistry };
