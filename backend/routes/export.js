const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');
const logger = require('../utils/logger');

function fmtMXN(n) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
}

function monthBounds(offsetMonths = 0) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offsetMonths;
  return {
    first: new Date(y, m, 1).toISOString().split('T')[0],
    firstNext: new Date(y, m + 1, 1).toISOString().split('T')[0],
    label: new Date(y, m, 1).toLocaleString('es-MX', { month: 'long', year: 'numeric' }),
  };
}

async function gatherSummary(id_usuario) {
  const { first, firstNext, label } = monthBounds(0);
  const [movsRes, metasRes, presupuestosRes] = await Promise.all([
    supabase
      .from('movimiento_financiero')
      .select('monto, tipo, fecha, descripcion, categoria(nombre)')
      .eq('id_usuario', id_usuario)
      .gte('fecha', first)
      .lt('fecha', firstNext)
      .order('fecha', { ascending: false }),
    supabase
      .from('ahorro_meta')
      .select('nombre_meta, monto_objetivo, progreso')
      .eq('id_usuario', id_usuario),
    supabase
      .from('presupuesto')
      .select('monto, categoria(nombre)')
      .eq('id_usuario', id_usuario),
  ]);

  const movs = movsRes.data || [];
  const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + Number(m.monto), 0);
  const gastos = movs.filter(m => m.tipo === 'gasto').reduce((s, m) => s + Math.abs(Number(m.monto)), 0);
  const porCategoria = {};
  for (const m of movs) {
    if (m.tipo !== 'gasto') continue;
    const k = m.categoria?.nombre || 'Otros';
    porCategoria[k] = (porCategoria[k] || 0) + Math.abs(Number(m.monto));
  }
  const top5 = Object.entries(porCategoria)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return {
    label,
    ingresos,
    gastos,
    saldo: ingresos - gastos,
    top5,
    metas: metasRes.data || [],
    presupuestos: presupuestosRes.data || [],
    movs,
  };
}

function escape(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildHtml(nombre, summary) {
  const { label, ingresos, gastos, saldo, top5, metas, presupuestos, movs } = summary;
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"/>
<title>Resumen ${escape(label)} — ${escape(nombre)}</title>
<style>
  @page { size: Letter; margin: 18mm 16mm; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a1a; font-size: 11pt; }
  h1 { color: #c8102e; border-bottom: 3px solid #c8102e; padding-bottom: 4px; margin: 0 0 6px; }
  h2 { color: #c8102e; margin: 1.4em 0 .4em; font-size: 14pt; }
  .sub { color: #666; margin-bottom: 1em; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 1em 0; }
  .stat { background: #f6f6f6; padding: 14px; border-radius: 8px; }
  .stat .v { font-size: 18pt; font-weight: 700; color: #c8102e; display: block; }
  .stat.pos .v { color: #2e7d32; }
  .stat.neg .v { color: #c62828; }
  table { width: 100%; border-collapse: collapse; margin: .5em 0 1em; font-size: 10pt; }
  th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
  th { background: #f0f0f0; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .muted { color: #888; font-size: 9pt; margin-top: 2em; text-align: center; }
</style>
</head><body>
<h1>Resumen Financiero</h1>
<div class="sub">${escape(nombre)} · ${escape(label)}</div>

<div class="stat-grid">
  <div class="stat pos"><span class="v">${fmtMXN(ingresos)}</span>Ingresos</div>
  <div class="stat neg"><span class="v">${fmtMXN(gastos)}</span>Gastos</div>
  <div class="stat ${saldo >= 0 ? 'pos' : 'neg'}"><span class="v">${fmtMXN(saldo)}</span>Saldo</div>
</div>

<h2>Top categorías de gasto</h2>
<table><thead><tr><th>Categoría</th><th style="text-align:right">Monto</th></tr></thead><tbody>
${top5.length === 0 ? '<tr><td colspan="2">Sin gastos registrados.</td></tr>' :
  top5.map(([k, v]) => `<tr><td>${escape(k)}</td><td style="text-align:right">${fmtMXN(v)}</td></tr>`).join('')}
</tbody></table>

<h2>Metas de ahorro</h2>
<table><thead><tr><th>Meta</th><th style="text-align:right">Progreso</th><th style="text-align:right">Objetivo</th><th style="text-align:right">%</th></tr></thead><tbody>
${metas.length === 0 ? '<tr><td colspan="4">Sin metas configuradas.</td></tr>' :
  metas.map(m => {
    const pct = m.monto_objetivo > 0 ? Math.round((Number(m.progreso) / Number(m.monto_objetivo)) * 100) : 0;
    return `<tr><td>${escape(m.nombre_meta)}</td><td style="text-align:right">${fmtMXN(m.progreso)}</td><td style="text-align:right">${fmtMXN(m.monto_objetivo)}</td><td style="text-align:right">${pct}%</td></tr>`;
  }).join('')}
</tbody></table>

<h2>Presupuestos</h2>
<table><thead><tr><th>Categoría</th><th style="text-align:right">Tope mensual</th></tr></thead><tbody>
${presupuestos.length === 0 ? '<tr><td colspan="2">Sin presupuestos.</td></tr>' :
  presupuestos.map(p => `<tr><td>${escape(p.categoria?.nombre || '—')}</td><td style="text-align:right">${fmtMXN(p.monto)}</td></tr>`).join('')}
</tbody></table>

<h2>Movimientos recientes</h2>
<table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th style="text-align:right">Monto</th></tr></thead><tbody>
${movs.slice(0, 25).map(m => `<tr><td>${escape(m.fecha?.slice(0, 10))}</td><td>${escape(m.descripcion || '—')}</td><td>${escape(m.categoria?.nombre || '—')}</td><td style="text-align:right">${fmtMXN(m.monto)}</td></tr>`).join('') || '<tr><td colspan="4">Sin movimientos.</td></tr>'}
</tbody></table>

<p class="muted">Generado por FinanceSmart · ${new Date().toLocaleString('es-MX')}</p>
</body></html>`;
}

// GET /api/export/summary-html — returns the renderable HTML directly. The
// frontend can either display this in an iframe + window.print(), or hand it
// to a server-side Chromium for true PDF generation. We emit HTML here (not
// PDF) because Vercel Functions don't bundle Chromium by default; users get
// a print-ready page they can save as PDF from the browser dialog.
router.get('/summary-html', async (req, res) => {
  try {
    const summary = await gatherSummary(req.usuario.id_usuario);
    const nombre = `${req.usuario.nombre} ${req.usuario.apellido || ''}`.trim();
    const html = buildHtml(nombre, summary);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    logger.warn('summary export failed', { id_usuario: req.usuario.id_usuario, message: err.message });
    res.status(500).json({ error: 'No se pudo generar el resumen' });
  }
});

module.exports = router;
