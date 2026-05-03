#!/usr/bin/env node
/* eslint-disable no-console */
// Connects to the live Supabase and computes the expected answer values for
// Sofia (or whatever user) — useful when the prompt sheet's hand-curated values
// drift from what's actually seeded.
//
// Usage:
//   node regression/computeExpectedFromSupabase.js [email]
//   default email: sofia.freelancer@gmail.com
//
// Output: prints an updated expectedAnswers.js skeleton + raw numbers.

require('dotenv').config();
const { supabase } = require('../utils/supabaseserver');

const TARGET_EMAIL = (process.argv[2] || 'sofia.freelancer@gmail.com').toLowerCase();
const fmt = (n) => '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
const yyyymm = (d) => d.toISOString().slice(0, 7);

async function main() {
  const { data: usuarios, error: uErr } = await supabase
    .from('usuario')
    .select('id_usuario, nombre, apellido, email')
    .eq('email', TARGET_EMAIL)
    .limit(1);
  if (uErr) throw uErr;
  if (!usuarios?.length) throw new Error(`User not found: ${TARGET_EMAIL}`);
  const u = usuarios[0];
  console.log(`\n=== USER: ${u.nombre} ${u.apellido || ''} (id=${u.id_usuario}, ${u.email}) ===\n`);

  const now = new Date();
  const thisM = yyyymm(now);
  const lastM = yyyymm(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const yearAgoFirst = new Date(now.getFullYear(), now.getMonth() - 12, 1).toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  // Pull all movimientos for the user (with category names joined)
  const { data: movs, error: mErr } = await supabase
    .from('movimiento_financiero')
    .select('id, monto, tipo, fecha, descripcion, id_categoria, id_tarjeta, categoria(nombre), tarjeta(nombre)')
    .eq('id_usuario', u.id_usuario)
    .gte('fecha', yearAgoFirst)
    .lte('fecha', todayStr);
  if (mErr) throw mErr;
  console.log(`Movimientos en últimos 12 meses: ${movs.length}`);

  const inMonth = (m, key) => m.fecha.startsWith(key);
  const sumGastos = (rows) => rows.filter(m => m.tipo === 'gasto').reduce((a, m) => a + Math.abs(Number(m.monto)), 0);
  const sumIngresos = (rows) => rows.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0);

  const thisRows = movs.filter(m => inMonth(m, thisM));
  const lastRows = movs.filter(m => inMonth(m, lastM));

  console.log(`\n--- MES EN CURSO (${thisM}) ---`);
  console.log(`Ingresos: ${fmt(sumIngresos(thisRows))}`);
  console.log(`Gastos:   ${fmt(sumGastos(thisRows))}`);
  console.log(`Saldo:    ${fmt(sumIngresos(thisRows) - sumGastos(thisRows))}`);

  console.log(`\n--- MES ANTERIOR (${lastM}) ---`);
  console.log(`Ingresos: ${fmt(sumIngresos(lastRows))}`);
  console.log(`Gastos:   ${fmt(sumGastos(lastRows))}`);
  console.log(`Saldo:    ${fmt(sumIngresos(lastRows) - sumGastos(lastRows))}`);

  const catLast = new Map();
  for (const m of lastRows.filter(m => m.tipo === 'gasto')) {
    const k = m.categoria?.nombre || 'Sin categoría';
    catLast.set(k, (catLast.get(k) || 0) + Math.abs(Number(m.monto)));
  }
  console.log('Por categoría (mes anterior):');
  [...catLast.entries()].sort((a,b)=>b[1]-a[1]).forEach(([c,v]) => console.log(`  ${c}: ${fmt(v)}`));

  console.log(`\n--- ÚLTIMOS 12 MESES (${yearAgoFirst} → ${todayStr}) ---`);
  console.log(`Total ingresos: ${fmt(sumIngresos(movs))}`);
  console.log(`Total gastos:   ${fmt(sumGastos(movs))}`);

  const catYear = new Map();
  for (const m of movs.filter(m => m.tipo === 'gasto')) {
    const k = m.categoria?.nombre || 'Sin categoría';
    catYear.set(k, (catYear.get(k) || 0) + Math.abs(Number(m.monto)));
  }
  console.log('Por categoría (12 meses):');
  [...catYear.entries()].sort((a,b)=>b[1]-a[1]).forEach(([c,v]) => console.log(`  ${c}: ${fmt(v)}`));

  // Biggest single expense
  const biggest = movs.filter(m => m.tipo === 'gasto').sort((a,b) => Math.abs(b.monto) - Math.abs(a.monto))[0];
  if (biggest) console.log(`\n--- COMPRA MÁS GRANDE (12 meses): ${biggest.fecha} — "${biggest.descripcion}" — ${fmt(biggest.monto)} (${biggest.categoria?.nombre || '?'})`);

  // Restaurantes mes con más gasto
  const restByMonth = new Map();
  for (const m of movs.filter(m => m.tipo === 'gasto' && (m.categoria?.nombre || '').toLowerCase().includes('restaur'))) {
    const k = m.fecha.slice(0, 7);
    restByMonth.set(k, (restByMonth.get(k) || 0) + Math.abs(Number(m.monto)));
  }
  if (restByMonth.size) {
    console.log('\n--- RESTAURANTES por mes (top 3):');
    [...restByMonth.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).forEach(([m,v]) => console.log(`  ${m}: ${fmt(v)}`));
  }

  // Metas
  const { data: metas } = await supabase.from('ahorro_meta').select('*').eq('id_usuario', u.id_usuario);
  console.log('\n--- METAS:');
  (metas || []).forEach(m => {
    const pct = Math.round(Number(m.progreso) / Number(m.monto_objetivo) * 100);
    const faltante = Number(m.monto_objetivo) - Number(m.progreso);
    console.log(`  ${m.nombre_meta}: ${fmt(m.progreso)} / ${fmt(m.monto_objetivo)} (${pct}%) — faltan ${fmt(faltante)}`);
  });

  // Tarjetas
  const { data: tarjetas } = await supabase.from('tarjeta').select('*').eq('id_usuario', u.id_usuario);
  console.log('\n--- TARJETAS:');
  (tarjetas || []).forEach(t => console.log(`  ${t.nombre} (${t.tipo})`));

  // Recurrencias
  const { data: recs } = await supabase.from('recurrencia').select('*, tarjeta(nombre)').eq('id_usuario', u.id_usuario).eq('activo', true);
  console.log('\n--- SUSCRIPCIONES ACTIVAS:');
  let totalSubs = 0;
  (recs || []).forEach(r => {
    console.log(`  ${r.descripcion}: ${fmt(r.monto)}/mes (en ${r.tarjeta?.nombre || '?'})`);
    totalSubs += Math.abs(Number(r.monto));
  });
  console.log(`Total mensual: ${fmt(totalSubs)}`);
  // Most expensive
  const topRec = (recs || []).slice().sort((a,b) => Math.abs(Number(b.monto)) - Math.abs(Number(a.monto)))[0];
  if (topRec) console.log(`Más cara: ${topRec.descripcion} (${fmt(topRec.monto)})`);

  // Subs por tarjeta
  const subsByCard = {};
  (recs || []).forEach(r => {
    const k = r.tarjeta?.nombre || 'Sin tarjeta';
    subsByCard[k] = (subsByCard[k] || 0) + Math.abs(Number(r.monto));
  });
  console.log('Subs por tarjeta:');
  Object.entries(subsByCard).forEach(([t,v]) => console.log(`  ${t}: ${fmt(v)}/mes`));

  // Presupuestos
  const { data: presupuestos } = await supabase.from('presupuesto').select('*, categoria(nombre)').eq('id_usuario', u.id_usuario);
  console.log('\n--- PRESUPUESTOS:');
  (presupuestos || []).forEach(p => {
    const catName = p.categoria?.nombre || '?';
    const gastado = catLast.get(catName) || 0;
    const pct = Math.round(gastado / Number(p.monto) * 100);
    const exc = gastado > Number(p.monto) ? ' ⚠️ EXCEDIDO' : '';
    console.log(`  ${catName}: ${fmt(gastado)} / ${fmt(p.monto)} (${pct}%, mes pasado)${exc}`);
  });

  // Freelance por mes
  const freelance = movs.filter(m => m.tipo === 'ingreso' && (m.descripcion || '').toLowerCase().includes('freelance'));
  if (freelance.length) {
    const flByMonth = new Map();
    freelance.forEach(m => { const k = m.fecha.slice(0,7); flByMonth.set(k, (flByMonth.get(k)||0) + Number(m.monto)); });
    const flSorted = [...flByMonth.entries()].sort((a,b) => a[0].localeCompare(b[0]));
    console.log('\n--- FREELANCE por mes:');
    flSorted.forEach(([m,v]) => console.log(`  ${m}: ${fmt(v)}`));
  }

  // Salario por mes
  const sal = movs.filter(m => m.tipo === 'ingreso' && /quincena|salario|sueldo/i.test(m.descripcion || ''));
  if (sal.length) {
    const sb = new Map();
    sal.forEach(m => { const k = m.fecha.slice(0,7); sb.set(k, (sb.get(k)||0) + Number(m.monto)); });
    console.log('\n--- SALARIO total por mes:');
    [...sb.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([m,v]) => console.log(`  ${m}: ${fmt(v)}`));
  }

  console.log('\n--- DONE ---');
}

main().catch(err => { console.error('FAIL:', err); process.exit(1); });
