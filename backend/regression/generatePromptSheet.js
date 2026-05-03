#!/usr/bin/env node
// Generates a printable HTML prompt sheet from regression/prompts.json and the
// Sofia ground truth. Open the resulting file in a browser → Cmd/Ctrl+P → Save
// as PDF.
//
// Usage: node regression/generatePromptSheet.js [outputPath]

const fs = require('fs');
const path = require('path');
const { SOFIA_GROUND_TRUTH } = require('./sofiaFixture');
const EXPECTED_ANSWERS = require('./expectedAnswers');

const PROMPTS_PATH = path.join(__dirname, 'prompts.json');
const OUT_PATH = process.argv[2] || path.join(__dirname, 'prompt-sheet.html');

const CATEGORY_LABELS = {
  resumen: 'Resumen del mes',
  categorias: 'Gastos por categoría',
  presupuestos: 'Presupuestos',
  metas: 'Metas de ahorro',
  recurrencias: 'Suscripciones / cargos recurrentes',
  tarjetas: 'Tarjetas',
  movimientos: 'Movimientos individuales',
  comparacion: 'Comparación entre periodos',
  salud: 'Salud financiera',
  hallucination_probe: 'Pruebas anti-hallucinación',
  out_of_scope: 'Fuera de tema',
  multi_step: 'Razonamiento multi-paso',
  small_talk: 'Saludo / small talk',
  consejo: 'Consejo financiero',
  edge_cases: 'Casos límite',
  adversarial: 'Jailbreak / adversarial',
  ambiguous: 'Consultas ambiguas',
  dates: 'Fechas',
  numbers: 'Precisión numérica',
  fixture_edge: 'Datos específicos del usuario',
  concision: 'Concisión',
  efficiency: 'Eficiencia (sin llamadas redundantes)',
  grounded_refusal: 'Rechazo grounded en datos',
  complex: 'Preguntas complejas multi-paso',
  context: 'Contexto conversacional',
};

const ASSERTION_LABELS = {
  contains_number: (a) => `Debe mencionar el número ~${a.value}${a.tolerance ? ` (±${a.tolerance * 100}%)` : ''}`,
  contains_number_exact: (a) => `Debe mencionar el número exacto ${a.value}${a.tolerance ? ` (±${a.tolerance})` : ''}`,
  cites_category: (a) => `Debe citar la categoría "${a.value}"`,
  no_fabricated_categories: () => 'No debe inventar categorías inexistentes',
  no_fabricated_amounts: () => 'No debe inventar montos que no aparecen en los datos',
  invokes_tool: (a) => `Debe llamar la herramienta interna ${a.name}`,
  invokes_tool_any: (a) => `Debe llamar al menos una de: ${a.names.join(', ')}`,
  does_not_invoke_tool: (a) => `No debe llamar la herramienta ${a.name}`,
  refuses_gracefully: () => 'Debe rechazar cortésmente, sin inventar números',
  refusal_with_prior_tool_call: () => 'Debe llamar una herramienta y luego rechazar gentilmente',
  mentions_meta: (a) => `Debe mencionar la meta "${a.value}"`,
  language: (a) => `Debe responder en ${a.value === 'es' ? 'español' : a.value}`,
  max_length: (a) => `Respuesta máx ${a.value} caracteres (concisa)`,
  contains_text: (a) => `Debe contener el texto "${a.value}"`,
  does_not_contain_substring: (a) => `NO debe contener "${a.value}"`,
  no_system_prompt_leakage: () => 'No debe revelar el prompt de sistema ni nombres internos de herramientas',
  tool_call_count: (a) => `Cantidad de llamadas a herramientas ${a.operator || '='} ${a.value}`,
  no_verbose_spanish_stage_directions: () => 'Sin preámbulos verbosos ("Aquí tienes…", "Permíteme…")',
};

function describeAssertion(a) {
  const fn = ASSERTION_LABELS[a.type];
  if (!fn) return `Asserción: ${a.type}`;
  try { return fn(a); } catch { return `Asserción: ${a.type}`; }
}

function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function groupByCategory(prompts) {
  const groups = new Map();
  for (const p of prompts) {
    const k = p.category || 'otros';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  return [...groups.entries()];
}

const promptsDoc = JSON.parse(fs.readFileSync(PROMPTS_PATH, 'utf8'));
const groups = groupByCategory(promptsDoc.prompts);

const fixtureBox = `
  <div class="fixture-box">
    <div class="fixture-title">📊 Datos del usuario de prueba (Sofía)</div>
    <ul>
      <li><strong>Ingresos del mes en curso:</strong> $${SOFIA_GROUND_TRUTH.ingresos_mes.toLocaleString('es-MX')}</li>
      <li><strong>Gastos del mes en curso:</strong> $${SOFIA_GROUND_TRUTH.gastos_mes.toLocaleString('es-MX')}</li>
      <li><strong>Saldo del mes en curso:</strong> $${SOFIA_GROUND_TRUTH.saldo_mes.toLocaleString('es-MX')}</li>
      <li><strong>Gastos del mes anterior:</strong> $${SOFIA_GROUND_TRUTH.gastos_mes_anterior.toLocaleString('es-MX')}</li>
      <li><strong>Total movimientos en 12 meses:</strong> ${SOFIA_GROUND_TRUTH.movimientos_count}</li>
      <li><strong>Categorías:</strong> ${SOFIA_GROUND_TRUTH.categorias_validas.join(', ')}</li>
      <li><strong>Metas:</strong> ${SOFIA_GROUND_TRUTH.metas_nombres.join(', ')}</li>
      <li><strong>Tarjetas:</strong> ${SOFIA_GROUND_TRUTH.tarjetas_nombres.join(', ')}</li>
      <li><strong>Suscripciones activas:</strong> ${SOFIA_GROUND_TRUTH.recurrencias_descripciones.join(', ')} (total $${SOFIA_GROUND_TRUTH.recurrencias_total_mensual}/mes)</li>
      <li><strong>Presupuesto excedido este mes:</strong> ${SOFIA_GROUND_TRUTH.presupuesto_excedido}</li>
    </ul>
  </div>
`;

const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

const sections = groups.map(([cat, prompts]) => `
  <section class="cat">
    <h2>${htmlEscape(CATEGORY_LABELS[cat] || cat)} <span class="cat-count">(${prompts.length})</span></h2>
    ${prompts.map(p => `
      <div class="prompt">
        <div class="prompt-header">
          <span class="prompt-id">${htmlEscape(p.id)}</span>
        </div>
        <div class="prompt-text">"${htmlEscape(p.prompt)}"</div>
        ${EXPECTED_ANSWERS[p.id] ? `
        <div class="expected-answer">
          <strong>💬 Respuesta esperada:</strong>
          <span>${htmlEscape(EXPECTED_ANSWERS[p.id])}</span>
        </div>` : ''}
        <div class="expects">
          <strong>Comportamiento esperado:</strong>
          <ul>
            ${(p.assertions || []).map(a => `<li>${htmlEscape(describeAssertion(a))}</li>`).join('')}
          </ul>
        </div>
        <div class="result-row">
          <span class="result-label">Pasó:</span>
          <span class="checkbox">☐ Sí</span>
          <span class="checkbox">☐ No</span>
          <span class="notes-label">Notas:</span>
          <span class="notes-line"></span>
        </div>
      </div>
    `).join('')}
  </section>
`).join('');

const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>FinanceSmart Chatbot — Hoja de pruebas</title>
  <style>
    @page { size: A4; margin: 14mm 14mm 18mm 14mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; font-size: 11pt; line-height: 1.4; }
    h1 { font-size: 22pt; margin: 0 0 4pt 0; color: #cc0000; }
    h2 { font-size: 14pt; margin: 18pt 0 6pt 0; padding: 4pt 8pt; background: #f3f3f3; border-left: 4pt solid #cc0000; page-break-after: avoid; }
    .meta { color: #666; font-size: 10pt; margin-bottom: 12pt; }
    .fixture-box {
      border: 1pt solid #ddd; padding: 10pt 14pt; margin-bottom: 14pt; background: #fafafa;
      page-break-inside: avoid;
    }
    .fixture-title { font-weight: 600; margin-bottom: 6pt; font-size: 12pt; }
    .fixture-box ul { margin: 0; padding-left: 18pt; }
    .fixture-box li { margin-bottom: 2pt; }
    .cat { page-break-inside: avoid; }
    .cat-count { color: #888; font-weight: 400; font-size: 11pt; }
    .prompt {
      border: 1pt solid #e0e0e0; border-radius: 4pt; padding: 8pt 10pt;
      margin-bottom: 8pt; page-break-inside: avoid; background: #fff;
    }
    .prompt-header { display: flex; justify-content: space-between; margin-bottom: 4pt; }
    .prompt-id { font-family: 'SF Mono', Menlo, Consolas, monospace; font-size: 8.5pt; color: #888; }
    .prompt-text {
      font-size: 11.5pt; font-weight: 600; color: #1a1a1a;
      padding: 4pt 0; font-style: italic;
    }
    .expected-answer {
      background: #eef7ee; border-left: 3pt solid #2e7d32;
      padding: 5pt 8pt; margin-top: 4pt; margin-bottom: 4pt;
      font-size: 10pt; color: #1f3a1f; border-radius: 2pt;
    }
    .expected-answer strong { color: #1b5e20; }
    .expects { font-size: 10pt; color: #444; margin-top: 4pt; }
    .expects ul { margin: 2pt 0 0 0; padding-left: 18pt; }
    .expects li { margin-bottom: 1pt; }
    .result-row {
      margin-top: 6pt; padding-top: 4pt; border-top: 1pt dashed #ddd;
      font-size: 10pt; display: flex; align-items: center; gap: 8pt;
    }
    .result-label { font-weight: 600; }
    .checkbox { font-family: 'Helvetica Neue', sans-serif; }
    .notes-label { margin-left: 8pt; font-weight: 600; }
    .notes-line { flex: 1; border-bottom: 1pt solid #aaa; min-height: 12pt; }
    @media print {
      .no-print { display: none; }
    }
    .no-print {
      background: #fff8ec; border: 1pt solid #f5d188;
      padding: 10pt 14pt; margin-bottom: 14pt; font-size: 10pt;
      border-radius: 4pt;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <strong>📄 Cómo guardar como PDF:</strong> presiona <code>Ctrl+P</code> (Windows) o <code>Cmd+P</code> (Mac), luego elige "Guardar como PDF" como destino.
    Esta caja amarilla no aparecerá en el PDF impreso.
  </div>

  <h1>Hoja de pruebas — FinanceSmart Chatbot</h1>
  <div class="meta">
    Generada el ${today} · ${promptsDoc.prompts.length} prompts en ${groups.length} categorías ·
    Usuario de prueba: <strong>Sofía</strong> (ver datos abajo)
  </div>

  ${fixtureBox}

  ${sections}

  <div class="meta" style="margin-top: 20pt; text-align: center;">
    Fin del documento — ${promptsDoc.prompts.length} prompts.
  </div>
</body>
</html>`;

fs.writeFileSync(OUT_PATH, html);
console.log(`Wrote ${OUT_PATH}`);
console.log(`Open in a browser, then Print → Save as PDF.`);
