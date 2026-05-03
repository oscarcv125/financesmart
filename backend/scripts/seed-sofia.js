#!/usr/bin/env node
/* eslint-disable no-console */
// Seeds 12 months of realistic financial data for the demo Sofia user.
//
// Patterns:
//   - Salary $25k × 2 quincenas (raised to $27k 3 months ago).
//   - Freelance income $0–$5.5k variable per month.
//   - 4 subscriptions: Netflix, Spotify, Gym, Adobe (Adobe started 8 months ago).
//   - Restaurantes growing trend, current month spike.
//   - December 2025 holiday spike (gifts + travel).
//   - Summer (jul/aug) higher transporte + entretenimiento.
//   - One-off: Monitor 4K $5,500 ~7 months ago.
//   - Bi-monthly aporte $1,500 to Cancún meta.
//   - Realistic recurring household: Renta $6,000/mes (Vivienda).
//
// Usage:
//   node scripts/seed-sofia.js                          # default email
//   node scripts/seed-sofia.js sofia.freelancer@gmail.com
//
// User must already exist (registered via the app). Script does NOT touch the
// `usuario` row's nombre/apellido — only inserts financial data.

require('dotenv').config();
const { supabase } = require('../utils/supabaseserver');

const TARGET_EMAIL = (process.argv[2] || 'sofia.freelancer@gmail.com').toLowerCase();

function ymd(d) { return d.toISOString().split('T')[0]; }

// Hardcoded category IDs from the live Supabase. If you re-deploy from scratch
// these may shift — re-run `node -e ...select id, nombre from categoria` and
// update.
const CAT = {
  SALARIO: 5,
  FREELANCE: 6,
  RESTAURANTES: 38,
  TRANSPORTE: 33,
  SUPERMERCADO: 34,
  ENTRETENIMIENTO: 37,
  SUSCRIPCION: 24,
  SERVICIOS: 32,
  VIVIENDA: 13,
  SALUD: 39,
  ELECTRONICA: 42,
  VIAJES: 41,
  AHORRO: 26, // ingreso
  ROPA: 18,
};

async function main() {
  console.log(`\n📥 Seeding Sofia's data for ${TARGET_EMAIL}\n`);

  // 1. Find user (do not create — they must register via app first)
  const { data: usuarios, error: uErr } = await supabase
    .from('usuario')
    .select('id_usuario, nombre, email')
    .eq('email', TARGET_EMAIL)
    .limit(1);
  if (uErr) throw uErr;
  if (!usuarios?.length) {
    console.error(`⚠️  User not found. Please register the account first via the app.`);
    process.exit(1);
  }
  const usuario = usuarios[0];
  const uid = usuario.id_usuario;
  console.log(`✓ Found user: ${usuario.nombre} (id=${uid})`);

  // 2. Validate categories exist
  const { data: cats } = await supabase.from('categoria').select('id_categoria, nombre, tipo');
  const catIds = new Set(cats.map(c => c.id_categoria));
  for (const [k, v] of Object.entries(CAT)) {
    if (!catIds.has(v)) console.warn(`⚠️  Category ${k} (id=${v}) missing in DB.`);
  }
  console.log(`✓ Loaded ${cats.length} categorías`);

  // 3. Wipe Sofia's existing data
  console.log('\n🗑️  Clearing Sofia\'s existing data...');
  await supabase.from('recurrencia').delete().eq('id_usuario', uid);
  await supabase.from('presupuesto').delete().eq('id_usuario', uid);
  await supabase.from('ahorro_meta').delete().eq('id_usuario', uid);
  await supabase.from('movimiento_financiero').delete().eq('id_usuario', uid);
  await supabase.from('tarjeta').delete().eq('id_usuario', uid);

  // 4. Tarjetas
  const tarjetasSeed = [
    { nombre: 'Banorte Crédito', tipo: 'Crédito' },
    { nombre: 'Banorte Débito',  tipo: 'Débito'  },
  ];
  const { data: tarjetas, error: tErr } = await supabase
    .from('tarjeta')
    .insert(tarjetasSeed.map(t => ({ ...t, id_usuario: uid })))
    .select();
  if (tErr) throw tErr;
  const tCredito = tarjetas.find(t => t.nombre === 'Banorte Crédito');
  const tDebito  = tarjetas.find(t => t.nombre === 'Banorte Débito');
  console.log(`✓ Inserted ${tarjetas.length} tarjetas`);

  // 5. Generate 12 months of movements
  const now = new Date();
  const movs = [];

  function push(monthsAgo, day, payload) {
    const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
    if (d > now) return;
    movs.push({
      id_usuario: uid,
      id_tarjeta: payload.id_tarjeta || tDebito.id_tarjeta,
      id_categoria: payload.id_categoria,
      monto: payload.tipo === 'gasto' ? -Math.abs(payload.monto) : Math.abs(payload.monto),
      tipo: payload.tipo,
      descripcion: payload.descripcion,
      fecha: ymd(d),
    });
  }

  for (let mo = 11; mo >= 0; mo--) {
    const anchor = new Date(now.getFullYear(), now.getMonth() - mo, 1);
    const monthIdx = anchor.getMonth();
    const isCurrent = mo === 0;

    // Salary — raised 3 months ago
    const salary = mo <= 3 ? 27000 : 25000;
    push(mo, 1,  { id_categoria: CAT.SALARIO, tipo: 'ingreso', monto: salary, descripcion: 'Quincena 1', id_tarjeta: tDebito.id_tarjeta });
    push(mo, 15, { id_categoria: CAT.SALARIO, tipo: 'ingreso', monto: salary, descripcion: 'Quincena 2', id_tarjeta: tDebito.id_tarjeta });

    // Freelance — variable
    const freelance = [3500, 0, 4200, 2800, 0, 5500, 3000, 4000, 2500, 3500, 4800, 3500][mo % 12];
    if (freelance > 0) push(mo, 7, { id_categoria: CAT.FREELANCE, tipo: 'ingreso', monto: freelance, descripcion: 'Cliente freelance — proyecto', id_tarjeta: tDebito.id_tarjeta });

    // Renta — fixed monthly
    push(mo, 2, { id_categoria: CAT.VIVIENDA, tipo: 'gasto', monto: 6000, descripcion: 'Renta mensual', id_tarjeta: tDebito.id_tarjeta });

    // Subscriptions every month (Adobe started 8 months ago)
    push(mo, 5,  { id_categoria: CAT.SUSCRIPCION, tipo: 'gasto', monto: 139, descripcion: 'Netflix',         id_tarjeta: tCredito.id_tarjeta });
    push(mo, 8,  { id_categoria: CAT.SUSCRIPCION, tipo: 'gasto', monto: 12,  descripcion: 'Spotify',         id_tarjeta: tCredito.id_tarjeta });
    push(mo, 12, { id_categoria: CAT.SUSCRIPCION, tipo: 'gasto', monto: 99,  descripcion: 'Gym Club',        id_tarjeta: tCredito.id_tarjeta });
    if (mo <= 8) push(mo, 15, { id_categoria: CAT.SUSCRIPCION, tipo: 'gasto', monto: 39, descripcion: 'Adobe Creative Cloud', id_tarjeta: tCredito.id_tarjeta });

    // Restaurantes — growing trend, spike in current month
    const restItems = isCurrent
      ? [{a:650,d:'Comida con amigos'},{a:420,d:'Brunch'},{a:890,d:'Cena familiar'},{a:540,d:'Sushi'},{a:280,d:'Café y postre'},{a:320,d:'Cena'}]
      : (mo <= 2
        ? [{a:580,d:'Sushi'},{a:380,d:'Tacos'},{a:720,d:'Cena familiar'},{a:450,d:'Café'},{a:240,d:'Italiano'}]
        : (mo <= 5
          ? [{a:420,d:'Sushi'},{a:320,d:'Tacos'},{a:520,d:'Italiano'},{a:380,d:'Café'}]
          : [{a:320,d:'Tacos'},{a:280,d:'Pizza'},{a:380,d:'Café'},{a:220,d:'Comida rápida'}]));
    restItems.forEach((it, i) => push(mo, 3 + i * 4, { id_categoria: CAT.RESTAURANTES, tipo: 'gasto', monto: it.a, descripcion: it.d, id_tarjeta: tCredito.id_tarjeta }));

    // Transporte — higher in summer (jul/aug)
    const summer = monthIdx === 6 || monthIdx === 7;
    const transItems = summer
      ? [{a:1800,d:'Vuelos verano'},{a:1200,d:'Gasolina'},{a:380,d:'Uber aeropuerto'},{a:500,d:'Uber semanal'},{a:200,d:'Casetas'}]
      : [{a:1200,d:'Gasolina'},{a:380,d:'Uber aeropuerto'},{a:500,d:'Uber semanal'},{a:120,d:'Estacionamiento'}];
    transItems.forEach((it, i) => push(mo, 4 + i * 5, { id_categoria: CAT.TRANSPORTE, tipo: 'gasto', monto: it.a, descripcion: it.d, id_tarjeta: tDebito.id_tarjeta }));

    // Entretenimiento — Dec spike + summer
    const dec = monthIdx === 11;
    const entItems = dec
      ? [{a:780,d:'Concierto'},{a:540,d:'Cine'},{a:340,d:'Bowling'},{a:280,d:'Bar'},{a:420,d:'Fiesta'}]
      : (summer ? [{a:780,d:'Concierto'},{a:340,d:'Cine'},{a:280,d:'Bar'}] : [{a:340,d:'Cine'},{a:280,d:'Bowling'}]);
    entItems.forEach((it, i) => push(mo, 8 + i * 3, { id_categoria: CAT.ENTRETENIMIENTO, tipo: 'gasto', monto: it.a, descripcion: it.d, id_tarjeta: tCredito.id_tarjeta }));

    // Supermercado — fairly steady
    [{a:850,d:'Despensa quincenal'},{a:420,d:'Despensa semanal'},{a:180,d:'Frutas y verduras'},{a:200,d:'Despensa'}].forEach((it, i) => push(mo, 5 + i * 6, { id_categoria: CAT.SUPERMERCADO, tipo: 'gasto', monto: it.a, descripcion: it.d, id_tarjeta: tDebito.id_tarjeta }));

    // Servicios — Internet + Luz/Agua
    push(mo, 18, { id_categoria: CAT.SERVICIOS, tipo: 'gasto', monto: 700, descripcion: 'Internet y telefonía', id_tarjeta: tDebito.id_tarjeta });
    push(mo, 22, { id_categoria: CAT.SERVICIOS, tipo: 'gasto', monto: 540, descripcion: 'Agua y luz', id_tarjeta: tDebito.id_tarjeta });

    // December: holiday gifts + travel
    if (dec) {
      push(mo, 18, { id_categoria: CAT.ROPA,    tipo: 'gasto', monto: 4500, descripcion: 'Regalos navidad',   id_tarjeta: tCredito.id_tarjeta });
      push(mo, 22, { id_categoria: CAT.VIAJES,  tipo: 'gasto', monto: 3200, descripcion: 'Vuelos diciembre',  id_tarjeta: tCredito.id_tarjeta });
    }

    // One-off big purchase ~7 months ago
    if (mo === 7) {
      push(mo, 14, { id_categoria: CAT.ELECTRONICA, tipo: 'gasto', monto: 5500, descripcion: 'Monitor 4K para casa', id_tarjeta: tCredito.id_tarjeta });
    }

    // Occasional medical
    if (mo === 4 || mo === 9) {
      push(mo, 11, { id_categoria: CAT.SALUD, tipo: 'gasto', monto: 480, descripcion: 'Farmacia', id_tarjeta: tDebito.id_tarjeta });
    }

    // Aportes a Cancún (every other month, $1,500)
    if (mo % 2 === 1) {
      push(mo, 28, { id_categoria: CAT.AHORRO, tipo: 'gasto', monto: 1500, descripcion: 'Ahorro: Viaje a Cancún', id_tarjeta: tDebito.id_tarjeta });
    }
  }

  // Insert in batches of 100 to avoid Supabase request size limits
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < movs.length; i += BATCH) {
    const slice = movs.slice(i, i + BATCH);
    const { error: mErr } = await supabase.from('movimiento_financiero').insert(slice);
    if (mErr) throw mErr;
    inserted += slice.length;
  }
  console.log(`✓ Inserted ${inserted} movimientos (12 meses de historial)`);

  // 6. Metas
  console.log('\n🎯 Creating savings goals...');
  const today = ymd(now);
  const monthsFromNow = (m) => ymd(new Date(now.getFullYear(), now.getMonth() + m, 1));
  const metasSeed = [
    { nombre_meta: 'Viaje a Cancún',       monto_objetivo: 25000, progreso: 9000, fecha_limite: monthsFromNow(8) },
    { nombre_meta: 'Laptop nueva',          monto_objetivo: 15000, progreso: 3150, fecha_limite: monthsFromNow(5) },
    { nombre_meta: 'Fondo de Emergencia',   monto_objetivo: 50000, progreso: 8500, fecha_limite: monthsFromNow(12) },
  ];
  const { error: gErr } = await supabase
    .from('ahorro_meta')
    .insert(metasSeed.map(m => ({ ...m, id_usuario: uid })));
  if (gErr) throw gErr;
  console.log(`✓ Inserted ${metasSeed.length} metas`);

  // 7. Presupuestos
  console.log('\n📊 Creating budgets...');
  const presupuestosSeed = [
    { id_categoria: CAT.RESTAURANTES,    monto: 2500 },
    { id_categoria: CAT.TRANSPORTE,      monto: 2500 },
    { id_categoria: CAT.SUPERMERCADO,    monto: 2000 },
    { id_categoria: CAT.ENTRETENIMIENTO, monto: 1500 },
    { id_categoria: CAT.SERVICIOS,       monto: 1500 },
  ];
  const { error: pErr } = await supabase
    .from('presupuesto')
    .upsert(presupuestosSeed.map(p => ({ ...p, id_usuario: uid })), { onConflict: 'id_usuario,id_categoria' });
  if (pErr) throw pErr;
  console.log(`✓ Upserted ${presupuestosSeed.length} presupuestos`);

  // 8. Recurrencias
  console.log('\n📅 Creating recurring charges...');
  const fechaInicioRec = ymd(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  const recurrenciasSeed = [
    { descripcion: 'Netflix',              monto: 139, dia_del_mes: 5,  id_categoria: CAT.SUSCRIPCION, id_tarjeta: tCredito.id_tarjeta },
    { descripcion: 'Spotify',              monto: 12,  dia_del_mes: 8,  id_categoria: CAT.SUSCRIPCION, id_tarjeta: tCredito.id_tarjeta },
    { descripcion: 'Gym Club',             monto: 99,  dia_del_mes: 12, id_categoria: CAT.SUSCRIPCION, id_tarjeta: tCredito.id_tarjeta },
    { descripcion: 'Adobe Creative Cloud', monto: 39,  dia_del_mes: 15, id_categoria: CAT.SUSCRIPCION, id_tarjeta: tCredito.id_tarjeta },
    { descripcion: 'Renta',                monto: 6000, dia_del_mes: 2, id_categoria: CAT.VIVIENDA,    id_tarjeta: tDebito.id_tarjeta  },
  ].map(r => ({
    id_usuario: uid,
    ...r,
    tipo: 'gasto',
    fecha_inicio: fechaInicioRec,
    activo: true,
  }));
  const { error: rErr } = await supabase.from('recurrencia').insert(recurrenciasSeed);
  if (rErr) throw rErr;
  console.log(`✓ Inserted ${recurrenciasSeed.length} recurrencias`);

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                   ✅ SOFIA'S DATA SEEDED                  ║
╚════════════════════════════════════════════════════════════╝

📊 DATOS CARGADOS:
  👤 User: ${usuario.nombre} (${TARGET_EMAIL})
  💳 Tarjetas: ${tarjetas.length}
  💰 Movimientos: ${inserted} (12 meses de historial)
  🎯 Metas: ${metasSeed.length}
  📊 Presupuestos: ${presupuestosSeed.length}
  📅 Recurrencias: ${recurrenciasSeed.length}

Ahora puedes correr el chatbot y ver respuestas con datos ricos.
`);
}

main().catch(err => { console.error('FAIL:', err); process.exit(1); });
