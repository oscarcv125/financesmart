require('dotenv').config();
const { supabase } = require('../utils/supabaseserver');

const TARGET_EMAIL = (process.argv[2] || 'oscar.cv125@gmail.com').toLowerCase();

function ymd(d) { return d.toISOString().split('T')[0]; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.round((min + Math.random() * (max - min)) * 100) / 100; }

async function main() {
  console.log(`\n📥 Seeding dummy data for ${TARGET_EMAIL}\n`);

  const { data: usuarios, error: uErr } = await supabase
    .from('usuario')
    .select('id_usuario, nombre, email')
    .eq('email', TARGET_EMAIL)
    .order('id_usuario', { ascending: true })
    .limit(1);
  if (uErr) throw uErr;
  if (!usuarios?.length) {
    console.error(`❌ No user found with email ${TARGET_EMAIL}. Log in once via the app first.`);
    process.exit(1);
  }
  const usuario = usuarios[0];
  const uid = usuario.id_usuario;
  console.log(`✓ Found user: ${usuario.nombre} (id=${uid})`);

  const { data: categorias, error: cErr } = await supabase
    .from('categoria')
    .select('id_categoria, nombre, tipo');
  if (cErr) throw cErr;
  if (!categorias?.length) {
    console.error('❌ No categorias in DB. Add some first.');
    process.exit(1);
  }
  const catGastos = categorias.filter(c => String(c.tipo).toLowerCase() === 'gasto');
  const catIngresos = categorias.filter(c => String(c.tipo).toLowerCase() === 'ingreso');
  if (!catGastos.length || !catIngresos.length) {
    console.error('❌ Need at least one categoria of each tipo.');
    process.exit(1);
  }
  const findCat = (kw) => catGastos.find(c => c.nombre.toLowerCase().includes(kw)) || catGastos[0];
  console.log(`✓ Loaded ${categorias.length} categorias`);

  const tarjetasSeed = [
    { nombre: 'BBVA Azul', tipo: 'Crédito' },
    { nombre: 'Santander Free', tipo: 'Débito' },
    { nombre: 'Nu', tipo: 'Crédito' },
  ];
  const { data: tarjetas, error: tErr } = await supabase
    .from('tarjeta')
    .insert(tarjetasSeed.map(t => ({ ...t, id_usuario: uid })))
    .select();
  if (tErr) throw tErr;
  console.log(`✓ Inserted ${tarjetas.length} tarjetas`);

  const tCredBbva = tarjetas.find(t => t.nombre === 'BBVA Azul');
  const tDebSant = tarjetas.find(t => t.nombre === 'Santander Free');
  const tCredNu = tarjetas.find(t => t.nombre === 'Nu');

  const today = new Date();
  const thisMonth = today.getMonth();
  const thisYear = today.getFullYear();
  const movs = [];

  function dateIn(year, month, dayMax = null) {
    const max = dayMax || new Date(year, month + 1, 0).getDate();
    const day = Math.max(1, Math.floor(Math.random() * max) + 1);
    return ymd(new Date(year, month, day));
  }

  movs.push({
    id_usuario: uid, id_tarjeta: tDebSant.id_tarjeta,
    id_categoria: catIngresos[0].id_categoria,
    monto: 25000, tipo: 'ingreso',
    descripcion: 'Quincena',
    fecha: ymd(new Date(thisYear, thisMonth, 1)),
  });
  movs.push({
    id_usuario: uid, id_tarjeta: tDebSant.id_tarjeta,
    id_categoria: catIngresos[0].id_categoria,
    monto: 25000, tipo: 'ingreso',
    descripcion: 'Quincena',
    fecha: ymd(new Date(thisYear, thisMonth, 15)),
  });
  movs.push({
    id_usuario: uid, id_tarjeta: tDebSant.id_tarjeta,
    id_categoria: catIngresos[0].id_categoria,
    monto: 25000, tipo: 'ingreso',
    descripcion: 'Quincena',
    fecha: ymd(new Date(thisYear, thisMonth - 1, 1)),
  });
  movs.push({
    id_usuario: uid, id_tarjeta: tDebSant.id_tarjeta,
    id_categoria: catIngresos[0].id_categoria,
    monto: 25000, tipo: 'ingreso',
    descripcion: 'Quincena',
    fecha: ymd(new Date(thisYear, thisMonth - 1, 15)),
  });
  if (catIngresos.length > 1) {
    movs.push({
      id_usuario: uid, id_tarjeta: tDebSant.id_tarjeta,
      id_categoria: catIngresos[1].id_categoria,
      monto: 3500, tipo: 'ingreso',
      descripcion: 'Freelance front-end',
      fecha: ymd(new Date(thisYear, thisMonth, Math.min(20, today.getDate()))),
    });
  }

  const gastoPlantillas = [
    { kw: 'comida',    range: [120, 450],  desc: ['Mercado','Súper Walmart','Costco','Soriana'] },
    { kw: 'transporte',range: [80,  300],  desc: ['Uber','Gasolina','Metro','Taxi'] },
    { kw: 'salud',     range: [200, 1200], desc: ['Farmacia','Consulta médica','Análisis'] },
    { kw: 'entret',    range: [150, 800],  desc: ['Cine','Spotify','Netflix','Concierto','Bar'] },
    { kw: 'restaurant',range: [180, 700],  desc: ['Sushi','Tacos','Italiano','Café','Pizza'] },
    { kw: 'servicios', range: [350, 1500], desc: ['Internet','Luz CFE','Agua','Gas'] },
    { kw: 'ropa',      range: [400, 2200], desc: ['Zara','H&M','Tenis','Pantalón'] },
    { kw: 'hogar',     range: [200, 1500], desc: ['IKEA','Home Depot','Decoración'] },
    { kw: 'educa',     range: [500, 3000], desc: ['Curso online','Libros','Material'] },
    { kw: 'otros',     range: [50,  400],  desc: ['Varios','Imprevisto'] },
  ];

  function gastosForMonth(monthOffset, count) {
    const month = thisMonth + monthOffset;
    const year = thisYear;
    const dayLimit = monthOffset === 0 ? today.getDate() : null;
    const out = [];
    for (let i = 0; i < count; i++) {
      const tpl = pick(gastoPlantillas);
      const cat = findCat(tpl.kw);
      const monto = -Math.abs(rand(tpl.range[0], tpl.range[1]));
      const tarjeta = pick([tCredBbva, tCredNu, tDebSant]);
      out.push({
        id_usuario: uid,
        id_tarjeta: tarjeta.id_tarjeta,
        id_categoria: cat.id_categoria,
        monto,
        tipo: 'gasto',
        descripcion: pick(tpl.desc),
        fecha: dateIn(year, month, dayLimit),
      });
    }
    return out;
  }

  movs.push(...gastosForMonth(0, 25));
  movs.push(...gastosForMonth(-1, 22));

  const { error: mErr } = await supabase.from('movimiento_financiero').insert(movs);
  if (mErr) throw mErr;
  console.log(`✓ Inserted ${movs.length} movimientos (this month + last month)`);

  const metasSeed = [
    { nombre_meta: 'Viaje a Japón',  monto_objetivo: 35000, progreso: 8200,  fecha_limite: ymd(new Date(thisYear, thisMonth + 6, 15)) },
    { nombre_meta: 'Fondo de emergencia', monto_objetivo: 50000, progreso: 22000, fecha_limite: ymd(new Date(thisYear + 1, thisMonth, 1)) },
    { nombre_meta: 'iPhone nuevo',   monto_objetivo: 22000, progreso: 19500, fecha_limite: ymd(new Date(thisYear, thisMonth + 2, 1)) },
  ];
  const { error: gErr } = await supabase
    .from('ahorro_meta')
    .insert(metasSeed.map(m => ({ ...m, id_usuario: uid })));
  if (gErr) throw gErr;
  console.log(`✓ Inserted ${metasSeed.length} metas de ahorro`);

  const presupuestosSeed = [
    { kw: 'comida',     monto: 5000 },
    { kw: 'transporte', monto: 2500 },
    { kw: 'restaurant', monto: 3000 },
    { kw: 'entret',     monto: 1800 },
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

  const recurrenciasSeed = [
    { descripcion: 'Netflix',  monto: 219,  tipo: 'gasto', dia: 5,  catKw: 'entret', tarjeta: tCredBbva },
    { descripcion: 'Spotify',  monto: 119,  tipo: 'gasto', dia: 12, catKw: 'entret', tarjeta: tCredBbva },
    { descripcion: 'Renta',    monto: 9500, tipo: 'gasto', dia: 1,  catKw: 'hogar',  tarjeta: tDebSant  },
    { descripcion: 'Internet', monto: 599,  tipo: 'gasto', dia: 8,  catKw: 'servicios', tarjeta: tDebSant },
  ];
  const recRows = recurrenciasSeed.map(r => ({
    id_usuario: uid,
    id_tarjeta: r.tarjeta.id_tarjeta,
    id_categoria: findCat(r.catKw).id_categoria,
    descripcion: r.descripcion,
    monto: r.monto,
    tipo: r.tipo,
    dia_del_mes: r.dia,
    fecha_inicio: ymd(new Date(thisYear, thisMonth - 2, 1)),
    activo: true,
  }));
  const { error: rErr } = await supabase.from('recurrencia').insert(recRows);
  if (rErr) throw rErr;
  console.log(`✓ Inserted ${recRows.length} recurrencias`);

  console.log(`\n✅ Done. Refresh the app to see the data.\n`);
}

main().catch(e => {
  console.error('\n❌ Error:', e.message || e);
  process.exit(1);
});
