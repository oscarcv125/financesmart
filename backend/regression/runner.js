#!/usr/bin/env node
/* eslint-disable no-console */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { runAgentLoop } = require('../utils/agent/loop');
const { buildToolRegistry } = require('../utils/tools');
const { evaluate } = require('./assertions');
const { buildSofiaSupabase, SOFIA_USER_ID, SOFIA_GROUND_TRUTH, MOVIMIENTOS, METAS, PRESUPUESTOS, RECURRENCIAS } = require('./sofiaFixture');

const REPORTS_DIR = path.join(__dirname, 'reports');
const SUMMARY_CSV = path.join(REPORTS_DIR, 'summary.csv');
const PROMPTS_PATH = path.join(__dirname, 'prompts.json');

function loadProvider(name) {
  if (name === 'gemini') return require('../utils/providers/gemini');
  if (name === 'ollama') return require('../utils/providers/ollama');
  throw new Error(`Unknown provider: ${name}`);
}

function gitSha() {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'unknown'; }
}

function buildContext() {
  // Real-amount whitelist used by no_fabricated_amounts assertion.
  const realAmounts = [];
  for (const m of MOVIMIENTOS) realAmounts.push(Math.abs(m.monto));
  for (const m of METAS) { realAmounts.push(m.monto_objetivo); realAmounts.push(m.progreso); }
  for (const p of PRESUPUESTOS) realAmounts.push(p.monto);
  for (const r of RECURRENCIAS) realAmounts.push(r.monto);
  // Add reasonable totals
  realAmounts.push(SOFIA_GROUND_TRUTH.ingresos_mes);
  realAmounts.push(SOFIA_GROUND_TRUTH.gastos_mes);
  realAmounts.push(SOFIA_GROUND_TRUTH.saldo_mes);
  realAmounts.push(SOFIA_GROUND_TRUTH.recurrencias_total_mensual);
  return { ...SOFIA_GROUND_TRUTH, real_amounts: realAmounts };
}

const { buildSystemPromptGuardrails } = require('../utils/agent/grounding');

// The regression suite tests against Sofia's fixture, so we name her here.
// In production the chatbot route uses req.usuario.nombre (parameterized).
const SOFIA_NAME = 'Sofia';
const SYSTEM_PROMPT = [
  `Eres un asistente financiero personal para ${SOFIA_NAME} (28 años, freelancer en México).`,
  'SIEMPRE llama a las herramientas para obtener datos reales antes de afirmar cifras.',
  'Si una herramienta devuelve vacío, responde literalmente "no tengo registros".',
  'NUNCA inventes montos, fechas, categorías ni nombres de metas.',
  'Responde en español, breve y directo (máx 120 palabras).',
].join(' ') + '\n' + buildSystemPromptGuardrails(SOFIA_NAME);

async function runOne(provider, prompt, assertCtx) {
  const supabase = buildSofiaSupabase();
  const registry = await buildToolRegistry({
    supabase,
    id_usuario: SOFIA_USER_ID,
    opts: { includeWrites: true, send: () => {} },
  });

  const events = [];
  const send = (type, payload) => events.push({ type, ...payload });

  const t0 = Date.now();
  const result = await runAgentLoop({
    provider,
    registry,
    systemPrompt: SYSTEM_PROMPT,
    history: [],
    message: prompt.prompt,
    send,
  });
  const ms = Date.now() - t0;

  const toolCalls = events.filter(e => e.type === 'tool_call').map(e => ({
    name: e.name,
    args: e.args,
    ok: events.find(r => r.type === 'tool_result' && r.name === e.name && r.iter === e.iter)?.ok ?? null,
  }));

  const response = {
    text: result.text || '',
    toolCalls,
    iters: result.iters,
    hitCap: !!result.hitCap,
  };

  const evalResult = evaluate(response, prompt.assertions, assertCtx);

  return { prompt, response, evalResult, ms };
}

async function main() {
  const args = parseArgs();
  const provider = loadProvider(args.provider);
  const promptsDoc = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
  const prompts = args.only
    ? promptsDoc.prompts.filter(p => args.only.includes(p.id))
    : promptsDoc.prompts;

  if (prompts.length === 0) {
    console.error('No prompts to run.');
    process.exit(1);
  }

  console.log(`[regression] provider=${provider.name} model=${provider.model} prompts=${prompts.length}`);
  console.log(`[regression] caps:`, provider.capabilities);

  const ctx = buildContext();
  const results = [];
  let passed = 0;
  let failed = 0;
  let totalMs = 0;

  for (const p of prompts) {
    process.stdout.write(`  [${p.id}] (${p.category}) … `);
    try {
      const r = await runOne(provider, p, ctx);
      results.push(r);
      totalMs += r.ms;
      if (r.evalResult.pass) {
        passed++;
        console.log(`PASS (${r.ms}ms, ${r.response.toolCalls.length} tools)`);
      } else {
        failed++;
        const failedTypes = r.evalResult.failed.map(f => f.type).join(', ');
        console.log(`FAIL (${r.ms}ms): ${failedTypes}`);
        for (const f of r.evalResult.failed) console.log(`      • ${f.type}: ${f.why}`);
      }
    } catch (err) {
      failed++;
      results.push({ prompt: p, error: err.message });
      console.log(`ERROR: ${err.message}`);
    }
  }

  const total = prompts.length;
  const rate = passed / total;
  const halRate = ((failed) / total).toFixed(3);

  console.log(`\n[regression] ${passed}/${total} passed (${(rate * 100).toFixed(1)}%) in ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`[regression] hallucination/failure rate: ${halRate}`);

  // Write JSON report
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(REPORTS_DIR, `report-${stamp}.json`);
  const reportPayload = {
    date: new Date().toISOString(),
    provider: provider.name,
    model: provider.model,
    git_sha: gitSha(),
    total, passed, failed,
    pass_rate: rate,
    hallucination_rate: parseFloat(halRate),
    avg_ms: Math.round(totalMs / total),
    results: results.map(r => ({
      id: r.prompt.id,
      category: r.prompt.category,
      pass: r.evalResult?.pass ?? false,
      failed_assertions: r.evalResult?.failed || [],
      tool_calls: (r.response?.toolCalls || []).map(t => t.name),
      reply: r.response?.text || r.error,
      ms: r.ms || 0,
    })),
  };
  fs.writeFileSync(reportPath, JSON.stringify(reportPayload, null, 2));
  console.log(`[regression] wrote ${reportPath}`);

  // Append to summary.csv
  const summaryHeader = 'date,git_sha,provider,model,total,passed,failed,pass_rate,hallucination_rate,avg_ms\n';
  const summaryRow = `${reportPayload.date},${reportPayload.git_sha},${provider.name},${provider.model},${total},${passed},${failed},${rate.toFixed(3)},${halRate},${reportPayload.avg_ms}\n`;
  if (!fs.existsSync(SUMMARY_CSV)) fs.writeFileSync(SUMMARY_CSV, summaryHeader);
  fs.appendFileSync(SUMMARY_CSV, summaryRow);
  console.log(`[regression] appended summary.csv`);

  process.exit(failed === 0 ? 0 : 2);
}

function parseArgs() {
  const out = { provider: process.env.AI_PROVIDER || 'gemini', only: null };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--provider') out.provider = process.argv[++i];
    else if (a === '--only') out.only = process.argv[++i].split(',');
  }
  return out;
}

main().catch(err => {
  console.error('[regression] fatal:', err);
  process.exit(1);
});
