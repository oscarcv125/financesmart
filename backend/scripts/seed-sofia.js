require('dotenv').config();
const { supabase } = require('../utils/supabaseserver');

const TARGET_EMAIL = (process.argv[2] || 'sofia.freelancer@gmail.com').toLowerCase();

function ymd(d) { return d.toISOString().split('T')[0]; }

async function main() {
  console.log(`\n📥 Seeding Sofia's data for ${TARGET_EMAIL}\n`);

  // Get or create user
  let { data: usuarios, error: uErr } = await supabase
    .from('usuario')
    .select('id_usuario, nombre, email')
    .eq('email', TARGET_EMAIL)
    .limit(1);

  if (uErr) throw uErr;

  let usuario;
  if (!usuarios?.length) {
    console.log(`Creating new user for ${TARGET_EMAIL}...`);
    console.error(`⚠️  User not found. Please create account first via the app.`);
    process.exit(1);
  }

  usuario = usuarios[0];
  const uid = usuario.id_usuario;
  console.log(`✓ Found user: ${usuario.nombre} (id=${uid})`);

  // Load categories
  const { data: categorias, error: cErr } = await supabase
    .from('categoria')
    .select('id_categoria, nombre, tipo');
  if (cErr) throw cErr;

  const catGastos = categorias.filter(c => String(c.tipo).toLowerCase() === 'gasto');
  const catIngresos = categorias.filter(c => String(c.tipo).toLowerCase() === 'ingreso');

  const findCat = (kw) => catGastos.find(c => c.nombre.toLowerCase().includes(kw)) || catGastos[0];
  console.log(`✓ Loaded ${categorias.length} categorias`);

  // Clear existing data for this user (optional)
  console.log('\n🗑️  Clearing existing data...');
  await supabase.from('recurrencia').delete().eq('id_usuario', uid);
  await supabase.from('presupuesto').delete().eq('id_usuario', uid);
  await supabase.from('ahorro_meta').delete().eq('id_usuario', uid);
  await supabase.from('movimiento_financiero').delete().eq('id_usuario', uid);
  await supabase.from('tarjeta').delete().eq('id_usuario', uid);

  // Create tarjetas
  const tarjetasSeed = [
    { nombre: 'Banorte Crédito', tipo: 'Crédito' },
    { nombre: 'Banorte Débito', tipo: 'Débito' },
  ];

  const { data: tarjetas, error: tErr } = await supabase
    .from('tarjeta')
    .insert(tarjetasSeed.map(t => ({ ...t, id_usuario: uid })))
    .select();
  if (tErr) throw tErr;
  console.log(`✓ Inserted ${tarjetas.length} tarjetas`);

  const tBanorteCredito = tarjetas.find(t => t.nombre === 'Banorte Crédito');
  const tBanorteDebito = tarjetas.find(t => t.nombre === 'Banorte Débito');

  // Create movements for 4 months (Mar, Apr, May, Jun)
  const today = new Date();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();
  const movs = [];

  console.log('\n💰 Creating movements for 4 months...');

  // Function to generate monthly income and expenses
  const generateMonthData = (month, year, ingresoAmount = 17500) => {
    const monthMovs = [];

    // Income: 2x 17,500 (total 35k) + freelance 3000
    monthMovs.push({
      id_usuario: uid,
      id_tarjeta: tBanorteDebito.id_tarjeta,
      id_categoria: catIngresos[0]?.id_categoria,
      monto: ingresoAmount,
      tipo: 'ingreso',
      descripcion: 'Quincena',
      fecha: ymd(new Date(year, month, 1)),
    });
    monthMovs.push({
      id_usuario: uid,
      id_tarjeta: tBanorteDebito.id_tarjeta,
      id_categoria: catIngresos[0]?.id_categoria,
      monto: ingresoAmount,
      tipo: 'ingreso',
      descripcion: 'Quincena',
      fecha: ymd(new Date(year, month, 15)),
    });

    if (catIngresos.length > 1) {
      monthMovs.push({
        id_usuario: uid,
        id_tarjeta: tBanorteDebito.id_tarjeta,
        id_categoria: catIngresos[1].id_categoria,
        monto: 3000,
        tipo: 'ingreso',
        descripcion: 'Freelance front-end',
        fecha: ymd(new Date(year, month, 20)),
      });
    }

    // Vary expenses by month - showing trending pattern
    const expenseMultipliers = [1, 1.05, 1.1, 1.15]; // Gradually increasing spending
    const mult = expenseMultipliers[month % 4];

    const expenses = [
      // Renta ($6000)
      { cat: 'hogar', amount: 6000, desc: 'Renta mes' },

      // Restaurantes ($1500-$1800)
      { cat: 'restaurant', amount: Math.round(280 * mult), desc: 'Sushi' },
      { cat: 'restaurant', amount: Math.round(250 * mult), desc: 'Tacos' },
      { cat: 'restaurant', amount: Math.round(220 * mult), desc: 'Café' },
      { cat: 'restaurant', amount: Math.round(310 * mult), desc: 'Italiano' },
      { cat: 'restaurant', amount: Math.round(290 * mult), desc: 'Pizza' },
      { cat: 'restaurant', amount: Math.round(240 * mult), desc: 'Comida rápida' },

      // Transporte ($1200-$1400)
      { cat: 'transporte', amount: Math.round(240 * mult), desc: 'Uber' },
      { cat: 'transporte', amount: Math.round(220 * mult), desc: 'Gasolina' },
      { cat: 'transporte', amount: Math.round(280 * mult), desc: 'Uber' },
      { cat: 'transporte', amount: Math.round(250 * mult), desc: 'Metro' },

      // Supermercado ($800-$1000)
      { cat: 'comida', amount: Math.round(350 * mult), desc: 'Costco' },
      { cat: 'comida', amount: Math.round(300 * mult), desc: 'Walmart' },
      { cat: 'comida', amount: Math.round(180 * mult), desc: 'Mercado' },

      // Entretenimiento ($600-$800)
      { cat: 'entret', amount: Math.round(260 * mult), desc: 'Cine' },
      { cat: 'entret', amount: Math.round(320 * mult), desc: 'Bar con amigos' },

      // Servicios ($700-$900)
      { cat: 'salud', amount: Math.round(150 * mult), desc: 'Farmacia' },
      { cat: 'hogar', amount: Math.round(200 * mult), desc: 'Internet y telefonía' },
      { cat: 'hogar', amount: Math.round(150 * mult), desc: 'Agua y luz' },
      { cat: 'salud', amount: Math.round(120 * mult), desc: 'Seguro médico' },

      // Shopping ($500-$700)
      { cat: 'hogar', amount: Math.round(200 * mult), desc: 'Ropa' },
      { cat: 'hogar', amount: Math.round(180 * mult), desc: 'Artículos hogar' },

      // Suscripciones y otros ($300-$400)
      { cat: 'entret', amount: 139, desc: 'Netflix' },
      { cat: 'entret', amount: 99, desc: 'Gym' },
    ];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    expenses.forEach((exp, idx) => {
      monthMovs.push({
        id_usuario: uid,
        id_tarjeta: [tBanorteCredito, tBanorteDebito][Math.random() > 0.5 ? 0 : 1].id_tarjeta,
        id_categoria: findCat(exp.cat).id_categoria,
        monto: -exp.amount,
        tipo: 'gasto',
        descripcion: exp.desc,
        fecha: ymd(new Date(year, month, Math.min(2 + idx * 2, daysInMonth))),
      });
    });

    return monthMovs;
  };

  // Generate data for last 3 months + current month
  for (let i = 3; i >= 0; i--) {
    const targetMonth = thisMonth - i;
    const targetYear = targetMonth < 0 ? thisYear - 1 : thisYear;
    const adjustedMonth = targetMonth < 0 ? 12 + targetMonth : targetMonth;
    movs.push(...generateMonthData(adjustedMonth, targetYear));
  }

  const { error: mErr } = await supabase.from('movimiento_financiero').insert(movs);
  if (mErr) throw mErr;
  console.log(`✓ Inserted ${movs.length} movimientos`);

  // Create metas (savings goals)
  console.log('\n🎯 Creating savings goals...');
  const metasSeed = [
    {
      nombre_meta: 'Viaje a Cancun',
      monto_objetivo: 20000,
      progreso: 4000,
      fecha_limite: ymd(new Date(thisYear, thisMonth + 9, 1)),
    },
    {
      nombre_meta: 'Laptop Nueva',
      monto_objetivo: 12000,
      progreso: 2500,
      fecha_limite: ymd(new Date(thisYear, thisMonth + 6, 15)),
    },
    {
      nombre_meta: 'Fondo de Emergencia',
      monto_objetivo: 40000,
      progreso: 6500,
      fecha_limite: ymd(new Date(thisYear + 1, thisMonth, 1)),
    },
  ];

  const { error: gErr } = await supabase
    .from('ahorro_meta')
    .insert(metasSeed.map(m => ({ ...m, id_usuario: uid })));
  if (gErr) throw gErr;
  console.log(`✓ Inserted ${metasSeed.length} metas`);

  // Create presupuestos (budgets)
  console.log('\n📊 Creating budgets...');
  const presupuestosSeed = [
    { kw: 'restaurant', monto: 1800 },
    { kw: 'transporte', monto: 1400 },
    { kw: 'comida', monto: 1200 },
    { kw: 'entret', monto: 900 },
  ];

  const presupuestosRows = presupuestosSeed.map(p => ({
    id_usuario: uid,
    id_categoria: findCat(p.kw).id_categoria,
    monto: p.monto,
  }));

  const seenCat = new Set();
  const dedupedPresupuestos = presupuestosRows.filter(p => {
    if (seenCat.has(p.id_categoria)) return false;
    seenCat.add(p.id_categoria);
    return true;
  });

  const { error: pErr } = await supabase
    .from('presupuesto')
    .upsert(dedupedPresupuestos, { onConflict: 'id_usuario,id_categoria' });
  if (pErr) throw pErr;
  console.log(`✓ Upserted ${dedupedPresupuestos.length} presupuestos`);

  // Create recurrencias (recurring charges)
  console.log('\n📅 Creating recurring charges...');
  const recurrenciasSeed = [
    { desc: 'Netflix', monto: 139, tipo: 'gasto', dia: 5, catKw: 'entret', tarjeta: tBanorteCredito },
    { desc: 'Spotify', monto: 12, tipo: 'gasto', dia: 12, catKw: 'entret', tarjeta: tBanorteCredito },
    { desc: 'Gym Club', monto: 99, tipo: 'gasto', dia: 10, catKw: 'salud', tarjeta: tBanorteCredito },
    { desc: 'Adobe Creative Cloud', monto: 39, tipo: 'gasto', dia: 8, catKw: 'otros', tarjeta: tBanorteCredito },
  ];

  const recRows = recurrenciasSeed.map(r => ({
    id_usuario: uid,
    id_tarjeta: r.tarjeta.id_tarjeta,
    id_categoria: findCat(r.catKw).id_categoria,
    descripcion: r.desc,
    monto: r.monto,
    tipo: r.tipo,
    dia_del_mes: r.dia,
    fecha_inicio: ymd(new Date(thisYear, thisMonth - 3, 1)),
    activo: true,
  }));

  const { error: rErr } = await supabase.from('recurrencia').insert(recRows);
  if (rErr) throw rErr;
  console.log(`✓ Inserted ${recRows.length} recurrencias`);

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                   ✅ SOFIA'S DATA SEEDED                  ║
╚════════════════════════════════════════════════════════════╝

📊 DATOS CARGADOS:
  👤 User: Sofia (${TARGET_EMAIL})
  💳 Tarjetas: ${tarjetas.length}
  💰 Movimientos: ${movs.length} (4 meses de historial)
  🎯 Metas: ${metasSeed.length}
  📈 Presupuestos: ${dedupedPresupuestos.length}
  📅 Recurrencias: ${recRows.length}

💵 FINANCIERO:
  Ingreso mensual: $37,500 (2x $17.5k + $3k freelance)
  Gasto promedio: $5,500-$6,300/mes
  Tendencia: Gastos en aumento gradual
  Health Score: ~55-60/100 (Saludable)

📋 METAS:
  🏖️  Viaje a Cancun: $4,000 / $20,000 (20%)
  💻 Laptop Nueva: $2,500 / $12,000 (21%)
  🆘 Fondo Emergencia: $6,500 / $40,000 (16%)

💳 SUSCRIPCIONES:
  Netflix: $139
  Spotify: $12
  Gym Club: $99
  Adobe CC: $39
  Total: $289/mes, $3,468/año

🚀 Ahora abre la app con ${TARGET_EMAIL} para ver a Sofia!
  `);
}

main().catch(e => {
  console.error('\n❌ Error:', e.message || e);
  process.exit(1);
});
