// Deterministic Supabase mock that returns Sofia's seeded financial data.
// Used by the regression runner to evaluate the agent against a known-good
// baseline without needing a real Supabase project or seeded user.
//
// Mirrors SEED_SOFIA_README.md:
//   Sofia (id_usuario=1, sofia.freelancer@gmail.com)
//   - 2× $25k income, 1× $3.5k freelance income
//   - $8,350 monthly expenses (Restaurantes $3,100 OVER budget, Transporte $2,200,
//     Entretenimiento $1,400, Supermercado $1,650)
//   - 3 metas: Cancun ($25k @ 20%), Laptop ($15k @ 21%), Emergencia ($50k @ 17%)
//   - 4 budgets: Restaurantes $2.5k EXCEEDED, Transporte $2.5k, Supermercado $2k, Entretenimiento $1.5k
//   - 4 recurring subs ($289/mo): Netflix $139, Spotify $12, Gym $99, Adobe $39

const SOFIA_USER_ID = 1;

function ymd(d) { return d.toISOString().split('T')[0]; }
function mkDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return ymd(d);
}

const CATEGORIAS = [
  { id_categoria: 1, nombre: 'Restaurantes', tipo: 'gasto' },
  { id_categoria: 2, nombre: 'Transporte', tipo: 'gasto' },
  { id_categoria: 3, nombre: 'Entretenimiento', tipo: 'gasto' },
  { id_categoria: 4, nombre: 'Supermercado', tipo: 'gasto' },
  { id_categoria: 5, nombre: 'Suscripciones', tipo: 'gasto' },
  { id_categoria: 6, nombre: 'Salario', tipo: 'ingreso' },
  { id_categoria: 7, nombre: 'Freelance', tipo: 'ingreso' },
  { id_categoria: 8, nombre: 'Ahorro', tipo: 'gasto' },
];

const TARJETAS = [
  { id_tarjeta: 10, id_usuario: SOFIA_USER_ID, nombre: 'Visa 4512', tipo: 'Crédito' },
  { id_tarjeta: 11, id_usuario: SOFIA_USER_ID, nombre: 'Santander Premium', tipo: 'Débito' },
];

const METAS = [
  { id_meta: 100, id_usuario: SOFIA_USER_ID, nombre_meta: 'Viaje a Cancún', monto_objetivo: 25000, progreso: 5000, fecha_limite: '2026-12-31' },
  { id_meta: 101, id_usuario: SOFIA_USER_ID, nombre_meta: 'Laptop nueva', monto_objetivo: 15000, progreso: 3150, fecha_limite: '2026-09-30' },
  { id_meta: 102, id_usuario: SOFIA_USER_ID, nombre_meta: 'Fondo de emergencia', monto_objetivo: 50000, progreso: 8500, fecha_limite: null },
];

// Helper to inline the categoria join Supabase would perform server-side.
// The runtime mock chain doesn't run real joins; we pre-attach the relation.
function withCategoria(rows) {
  return rows.map(r => {
    const cat = CATEGORIAS.find(c => c.id_categoria === r.id_categoria);
    return { ...r, categoria: cat ? { nombre: cat.nombre, tipo: cat.tipo } : null };
  });
}

function withTarjeta(rows) {
  return rows.map(r => {
    const t = TARJETAS.find(x => x.id_tarjeta === r.id_tarjeta);
    return { ...r, tarjeta: t ? { nombre: t.nombre } : null };
  });
}

const PRESUPUESTOS = withCategoria([
  { id_presupuesto: 200, id_usuario: SOFIA_USER_ID, id_categoria: 1, monto: 2500 }, // Restaurantes
  { id_presupuesto: 201, id_usuario: SOFIA_USER_ID, id_categoria: 2, monto: 2500 }, // Transporte
  { id_presupuesto: 202, id_usuario: SOFIA_USER_ID, id_categoria: 4, monto: 2000 }, // Supermercado
  { id_presupuesto: 203, id_usuario: SOFIA_USER_ID, id_categoria: 3, monto: 1500 }, // Entretenimiento
]);

const RECURRENCIAS = withTarjeta(withCategoria([
  { id_recurrencia: 300, id_usuario: SOFIA_USER_ID, id_tarjeta: 10, id_categoria: 5, descripcion: 'Netflix', monto: 139, tipo: 'gasto', dia_del_mes: 5, activo: true, fecha_inicio: '2026-01-01', ultima_ejecucion: mkDate(40) },
  { id_recurrencia: 301, id_usuario: SOFIA_USER_ID, id_tarjeta: 10, id_categoria: 5, descripcion: 'Spotify', monto: 12, tipo: 'gasto', dia_del_mes: 8, activo: true, fecha_inicio: '2026-01-01', ultima_ejecucion: mkDate(38) },
  { id_recurrencia: 302, id_usuario: SOFIA_USER_ID, id_tarjeta: 11, id_categoria: 5, descripcion: 'Gimnasio', monto: 99, tipo: 'gasto', dia_del_mes: 12, activo: true, fecha_inicio: '2026-01-01', ultima_ejecucion: mkDate(34) },
  { id_recurrencia: 303, id_usuario: SOFIA_USER_ID, id_tarjeta: 10, id_categoria: 5, descripcion: 'Adobe Creative', monto: 39, tipo: 'gasto', dia_del_mes: 15, activo: true, fecha_inicio: '2026-01-01', ultima_ejecucion: mkDate(31) },
]));

// 12 months of realistic financial history. Patterns:
//   - Base salary $50k/mo (two quincenas of $25k) for the full year.
//   - Salary raised to $54k/mo (two quincenas of $27k) in month -3 (~3 months ago).
//   - Freelance income $2k-$5k variable per month, occasionally $0.
//   - Subscriptions consistent: Netflix, Spotify, Gym, Adobe (Adobe started month -8).
//   - Restaurantes spending grew gradually; spiked in current month.
//   - Holiday spike in December (gifts + travel).
//   - Summer (jul/aug) higher entretenimiento + transport (vacaciones).
//   - One big purchase: nuevo monitor $5,500 ~7 months ago.
//   - Occasional medical / pharmacy unforeseen gastos.
function buildMovimientos() {
  const now = new Date();
  const out = [];
  let nextId = 1000;

  function push(monthsAgo, day, payload) {
    const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
    if (d > now) return; // skip future-dated synthetic rows
    out.push({
      id: nextId++,
      id_usuario: SOFIA_USER_ID,
      monto: payload.tipo === 'gasto' ? -Math.abs(payload.monto) : Math.abs(payload.monto),
      fecha: ymd(d),
      descripcion: payload.descripcion,
      tipo: payload.tipo,
      id_categoria: payload.id_categoria,
      id_tarjeta: payload.id_tarjeta || 11,
      categoria: { nombre: CATEGORIAS.find(c => c.id_categoria === payload.id_categoria)?.nombre || 'Otros' },
      tarjeta: { nombre: TARJETAS.find(t => t.id_tarjeta === (payload.id_tarjeta || 11))?.nombre },
    });
  }

  // Iterate from 11 months ago up to current month (inclusive).
  for (let mo = 11; mo >= 0; mo--) {
    const date = new Date(now.getFullYear(), now.getMonth() - mo, 1);
    const monthIdx = date.getMonth(); // 0-11 calendar month for seasonal logic
    const isCurrent = mo === 0;
    const salaryEach = mo <= 3 ? 27000 : 25000; // raise 3 months ago

    // Income — two quincenas
    push(mo, 1, { id_categoria: 6, tipo: 'ingreso', monto: salaryEach, descripcion: 'Quincena 1', id_tarjeta: 11 });
    push(mo, 15, { id_categoria: 6, tipo: 'ingreso', monto: salaryEach, descripcion: 'Quincena 2', id_tarjeta: 11 });

    // Freelance — variable, 0 some months
    const freelance = [3500, 0, 4200, 2800, 0, 5500, 3000, 4000, 2500, 3500, 4800, 3500][mo % 12];
    if (freelance > 0) push(mo, 7, { id_categoria: 7, tipo: 'ingreso', monto: freelance, descripcion: 'Cliente A — proyecto', id_tarjeta: 11 });

    // Subscriptions every month (Adobe started month -8)
    push(mo, 5, { id_categoria: 5, tipo: 'gasto', monto: 139, descripcion: 'Netflix', id_tarjeta: 10 });
    push(mo, 8, { id_categoria: 5, tipo: 'gasto', monto: 12, descripcion: 'Spotify', id_tarjeta: 10 });
    push(mo, 12, { id_categoria: 5, tipo: 'gasto', monto: 99, descripcion: 'Gimnasio', id_tarjeta: 11 });
    if (mo <= 8) {
      push(mo, 15, { id_categoria: 5, tipo: 'gasto', monto: 39, descripcion: 'Adobe Creative', id_tarjeta: 10 });
    }

    // Restaurantes — growing trend, spike in current month
    const restBase = isCurrent ? [650, 420, 890, 540, 280, 320] : (mo <= 2 ? [580, 380, 720, 450, 240] : (mo <= 5 ? [420, 320, 520, 380] : [320, 280, 380, 220]));
    restBase.forEach((amt, i) => push(mo, 3 + i * 4, { id_categoria: 1, tipo: 'gasto', monto: amt, descripcion: ['Comida con amigos', 'Brunch', 'Cena familiar', 'Sushi', 'Café y postre', 'Cena'][i % 6], id_tarjeta: 10 }));

    // Transporte — higher in summer (vacaciones)
    const summer = monthIdx === 6 || monthIdx === 7;
    const trans = summer ? [1800, 1200, 380, 500, 200] : [1200, 380, 500, 120];
    trans.forEach((amt, i) => push(mo, 4 + i * 5, { id_categoria: 2, tipo: 'gasto', monto: amt, descripcion: ['Gasolina', 'Uber aeropuerto', 'Uber semanal', 'Estacionamiento', 'Casetas'][i % 5], id_tarjeta: 11 }));

    // Entretenimiento — higher Dec (fiestas) and summer
    const dec = monthIdx === 11;
    const ent = dec ? [780, 540, 340, 280, 420] : (summer ? [780, 340, 280] : [340, 280]);
    ent.forEach((amt, i) => push(mo, 8 + i * 3, { id_categoria: 3, tipo: 'gasto', monto: amt, descripcion: ['Concierto', 'Cine', 'Bowling', 'Bar', 'Fiesta'][i % 5], id_tarjeta: 10 }));

    // Supermercado — fairly steady
    [850, 420, 180, 200].forEach((amt, i) => push(mo, 5 + i * 6, { id_categoria: 4, tipo: 'gasto', monto: amt, descripcion: ['Despensa quincenal', 'Despensa semanal', 'Frutas y verduras', 'Despensa'][i], id_tarjeta: 11 }));

    // Holidays: December gifts + travel
    if (dec) {
      push(mo, 18, { id_categoria: 3, tipo: 'gasto', monto: 4500, descripcion: 'Regalos navidad', id_tarjeta: 10 });
      push(mo, 22, { id_categoria: 2, tipo: 'gasto', monto: 3200, descripcion: 'Vuelos diciembre', id_tarjeta: 10 });
    }

    // One-off big purchase ~7 months ago: nuevo monitor
    if (mo === 7) {
      push(mo, 14, { id_categoria: 3, tipo: 'gasto', monto: 5500, descripcion: 'Monitor 4K para casa', id_tarjeta: 10 });
    }

    // Occasional medical
    if (mo === 4 || mo === 9) {
      push(mo, 11, { id_categoria: 4, tipo: 'gasto', monto: 480, descripcion: 'Farmacia', id_tarjeta: 11 });
    }

    // Aportes a metas (every other month, 1500 to Cancun)
    if (mo % 2 === 1) {
      push(mo, 28, { id_categoria: 8, tipo: 'gasto', monto: 1500, descripcion: 'Ahorro: Viaje a Cancún', id_tarjeta: 11 });
    }
  }

  return out;
}

const MOVIMIENTOS = buildMovimientos();

// Build a chainable mock that mimics @supabase/supabase-js's filter chain.
function makeChain(rows, opts = {}) {
  const filters = [];
  let limit = null;
  const chain = {
    select: () => chain,
    eq: (col, val) => { filters.push((r) => String(r[col]) === String(val)); return chain; },
    gte: (col, val) => { filters.push((r) => r[col] >= val); return chain; },
    lte: (col, val) => { filters.push((r) => r[col] <= val); return chain; },
    lt: (col, val) => { filters.push((r) => r[col] < val); return chain; },
    order: () => chain,
    limit: (n) => { limit = n; return chain; },
    ilike: (col, val) => { const re = new RegExp(val.replace(/%/g, '.*'), 'i'); filters.push((r) => re.test(String(r[col] || ''))); return chain; },
    not: () => chain,
  };
  function resolve() {
    let result = rows.filter(r => filters.every(f => f(r)));
    if (limit) result = result.slice(0, limit);
    return { data: opts.singular ? (result[0] || null) : result, error: null };
  }
  chain.then = (r, j) => Promise.resolve(resolve()).then(r, j);
  chain.maybeSingle = () => Promise.resolve({ ...resolve(), data: resolve().data?.[0] || resolve().data || null });
  chain.single = () => Promise.resolve({ ...resolve(), data: resolve().data?.[0] || resolve().data || null });
  return chain;
}

function buildSofiaSupabase() {
  return {
    from(table) {
      const data = ({
        categoria: CATEGORIAS,
        tarjeta: TARJETAS,
        ahorro_meta: METAS,
        presupuesto: PRESUPUESTOS,
        recurrencia: RECURRENCIAS,
        movimiento_financiero: MOVIMIENTOS,
      })[table] || [];
      return makeChain(data);
    },
  };
}

// Compute ground-truth aggregates from the actual fixture so the numbers stay
// in sync if buildMovimientos changes.
function computeGroundTruth() {
  const now = new Date();
  const yyyymm = (d) => d.toISOString().slice(0, 7);
  const thisKey = yyyymm(now);
  const lastKey = yyyymm(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const yearAgoKey = yyyymm(new Date(now.getFullYear(), now.getMonth() - 12, 1));

  const inMonth = (m, key) => m.fecha.startsWith(key);
  const sumBy = (rows, sign) => rows
    .filter(m => sign === 'ingreso' ? m.tipo === 'ingreso' : m.tipo === 'gasto')
    .reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);

  const thisMov = MOVIMIENTOS.filter(m => inMonth(m, thisKey));
  const lastMov = MOVIMIENTOS.filter(m => inMonth(m, lastKey));

  const ingresosThis = sumBy(thisMov, 'ingreso');
  const gastosThis = sumBy(thisMov, 'gasto');
  const ingresosLast = sumBy(lastMov, 'ingreso');
  const gastosLast = sumBy(lastMov, 'gasto');

  const totalGastos12mo = MOVIMIENTOS
    .filter(m => m.tipo === 'gasto' && m.fecha >= yearAgoKey + '-01')
    .reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);
  const totalIngresos12mo = MOVIMIENTOS
    .filter(m => m.tipo === 'ingreso' && m.fecha >= yearAgoKey + '-01')
    .reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);

  return {
    id_usuario: SOFIA_USER_ID,
    ingresos_mes: ingresosThis,
    gastos_mes: gastosThis,
    saldo_mes: ingresosThis - gastosThis,
    ingresos_mes_anterior: ingresosLast,
    gastos_mes_anterior: gastosLast,
    ingresos_12_meses: totalIngresos12mo,
    gastos_12_meses: totalGastos12mo,
    movimientos_count: MOVIMIENTOS.length,
    categorias_validas: CATEGORIAS.map(c => c.nombre),
    metas_nombres: METAS.map(m => m.nombre_meta),
    tarjetas_nombres: TARJETAS.map(t => t.nombre),
    recurrencias_descripciones: RECURRENCIAS.map(r => r.descripcion),
    recurrencias_total_mensual: RECURRENCIAS.reduce((acc, r) => acc + r.monto, 0),
    presupuesto_excedido: 'Restaurantes',
  };
}

const SOFIA_GROUND_TRUTH = computeGroundTruth();

module.exports = {
  buildSofiaSupabase,
  SOFIA_USER_ID,
  SOFIA_GROUND_TRUTH,
  CATEGORIAS, TARJETAS, METAS, PRESUPUESTOS, RECURRENCIAS, MOVIMIENTOS,
};
