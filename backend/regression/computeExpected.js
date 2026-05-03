/* eslint-disable no-console */
const { MOVIMIENTOS, METAS, RECURRENCIAS } = require('./sofiaFixture');

const now = new Date();
const yyyymm = (d) => d.toISOString().slice(0, 7);
const thisM = yyyymm(now);
const lastM = yyyymm(new Date(now.getFullYear(), now.getMonth() - 1, 1));
const yearAgo = yyyymm(new Date(now.getFullYear(), now.getMonth() - 12, 1));
const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US');

const inMonth = (m, key) => m.fecha.startsWith(key);
const sumGastos = (rows) => rows.filter(m => m.tipo === 'gasto').reduce((a, m) => a + Math.abs(Number(m.monto)), 0);
const sumIngresos = (rows) => rows.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0);

const thisRows = MOVIMIENTOS.filter(m => inMonth(m, thisM));
const lastRows = MOVIMIENTOS.filter(m => inMonth(m, lastM));
const yearRows = MOVIMIENTOS.filter(m => m.fecha >= yearAgo + '-01');

console.log('### MES EN CURSO (' + thisM + ')');
console.log('Ingresos: ' + fmt(sumIngresos(thisRows)));
console.log('Gastos:   ' + fmt(sumGastos(thisRows)));
console.log('Saldo:    ' + fmt(sumIngresos(thisRows) - sumGastos(thisRows)));

console.log('\n### MES ANTERIOR (' + lastM + ')');
console.log('Ingresos: ' + fmt(sumIngresos(lastRows)));
console.log('Gastos:   ' + fmt(sumGastos(lastRows)));

const catLast = new Map();
for (const m of lastRows.filter(m => m.tipo === 'gasto')) {
  const k = m.categoria?.nombre || 'Otros';
  catLast.set(k, (catLast.get(k) || 0) + Math.abs(Number(m.monto)));
}
console.log('Por categoría (mes anterior):');
[...catLast.entries()].sort((a,b)=>b[1]-a[1]).forEach(([c,v]) => console.log('  ' + c + ': ' + fmt(v)));

console.log('\n### ÚLTIMOS 12 MESES (' + yearAgo + ' a ' + thisM + ')');
console.log('Total ingresos:    ' + fmt(sumIngresos(yearRows)));
console.log('Total gastos:      ' + fmt(sumGastos(yearRows)));
console.log('Movimientos count: ' + yearRows.length);

console.log('\n### RESTAURANTES — mes con más gasto');
const restByMonth = new Map();
for (const m of MOVIMIENTOS.filter(m => m.tipo === 'gasto' && m.categoria?.nombre === 'Restaurantes')) {
  const k = m.fecha.slice(0, 7);
  restByMonth.set(k, (restByMonth.get(k) || 0) + Math.abs(Number(m.monto)));
}
const topRest = [...restByMonth.entries()].sort((a,b)=>b[1]-a[1])[0];
console.log(topRest[0] + ': ' + fmt(topRest[1]));
console.log('(top 3 meses):');
[...restByMonth.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3).forEach(([m,v]) => console.log('  ' + m + ': ' + fmt(v)));

console.log('\n### COMPRA MÁS GRANDE (12 meses)');
const biggest = MOVIMIENTOS.filter(m => m.tipo === 'gasto').sort((a,b) => Math.abs(b.monto) - Math.abs(a.monto))[0];
console.log(biggest.fecha + ' — ' + biggest.descripcion + ' — ' + fmt(Math.abs(biggest.monto)));

console.log('\n### SUSCRIPCIONES ACTIVAS');
RECURRENCIAS.forEach(r => console.log('  ' + r.descripcion + ': ' + fmt(r.monto) + '/mes (en ' + r.tarjeta?.nombre + ')'));
const totalSubMonth = RECURRENCIAS.reduce((a,r) => a + r.monto, 0);
console.log('Total mensual: ' + fmt(totalSubMonth));
const total12Subs = MOVIMIENTOS.filter(m => m.tipo === 'gasto' && m.categoria?.nombre === 'Suscripciones' && m.fecha >= yearAgo + '-01').reduce((a,m) => a + Math.abs(Number(m.monto)), 0);
console.log('Total en últimos 12 meses: ' + fmt(total12Subs));

console.log('\n### METAS');
METAS.forEach(m => {
  const pct = Math.round(m.progreso / m.monto_objetivo * 100);
  const faltante = m.monto_objetivo - m.progreso;
  console.log('  ' + m.nombre_meta + ': ' + fmt(m.progreso) + ' / ' + fmt(m.monto_objetivo) + ' (' + pct + '%) — faltan ' + fmt(faltante));
});

console.log('\n### APORTES A CANCÚN (registrados como movimientos)');
const aportes = MOVIMIENTOS.filter(m => m.descripcion?.includes('Cancún') || m.descripcion?.includes('Cancun'));
aportes.forEach(m => console.log('  ' + m.fecha + ': ' + fmt(Math.abs(m.monto))));
console.log('Total aportes: ' + fmt(aportes.reduce((a,m) => a + Math.abs(m.monto), 0)));

console.log('\n### FREELANCE POR MES');
const freelance = MOVIMIENTOS.filter(m => m.tipo === 'ingreso' && m.categoria?.nombre === 'Freelance');
const flByMonth = new Map();
freelance.forEach(m => { const k = m.fecha.slice(0,7); flByMonth.set(k, (flByMonth.get(k)||0) + Number(m.monto)); });
const flSorted = [...flByMonth.entries()].sort((a,b) => a[0].localeCompare(b[0]));
flSorted.forEach(([m,v]) => console.log('  ' + m + ': ' + fmt(v)));
const flMax = flSorted.reduce((max, cur) => cur[1] > max[1] ? cur : max);
const flMin = flSorted.reduce((min, cur) => cur[1] < min[1] ? cur : min);
console.log('Mejor mes: ' + flMax[0] + ' ' + fmt(flMax[1]));
console.log('Peor mes:  ' + flMin[0] + ' ' + fmt(flMin[1]));
const flZero = MOVIMIENTOS.filter(m => m.tipo === 'ingreso' && m.fecha.startsWith('2025') || m.fecha.startsWith('2026')).map(m => m.fecha.slice(0,7));
const monthsAll = [...new Set(yearRows.map(m => m.fecha.slice(0,7)))];
const flMonthsWithIncome = new Set(flSorted.map(([m]) => m));
const flZeroMonths = monthsAll.filter(m => !flMonthsWithIncome.has(m));
console.log('Meses sin freelance: ' + flZeroMonths.join(', '));

console.log('\n### SALARIO POR MES (suma de ambas quincenas)');
const salByMonth = new Map();
MOVIMIENTOS.filter(m => m.tipo === 'ingreso' && m.categoria?.nombre === 'Salario').forEach(m => {
  const k = m.fecha.slice(0,7); salByMonth.set(k, (salByMonth.get(k)||0) + Number(m.monto));
});
[...salByMonth.entries()].sort((a,b)=>a[0].localeCompare(b[0])).forEach(([m,v]) => console.log('  ' + m + ': ' + fmt(v)));

console.log('\n### DICIEMBRE 2025 (gastos)');
const decGastos = sumGastos(MOVIMIENTOS.filter(m => inMonth(m, '2025-12')));
console.log('Gastos: ' + fmt(decGastos));
const otherMonths = [...new Set(yearRows.filter(m => !m.fecha.startsWith('2025-12') && !inMonth(m, thisM)).map(m => m.fecha.slice(0,7)))];
const otherTotal = otherMonths.reduce((acc, m) => acc + sumGastos(MOVIMIENTOS.filter(x => x.fecha.startsWith(m))), 0);
console.log('Promedio otros meses: ' + fmt(otherTotal / otherMonths.length));

console.log('\n### TRANSPORTE — verano 2025 vs resto');
const julTrans = MOVIMIENTOS.filter(m => m.tipo === 'gasto' && m.categoria?.nombre === 'Transporte' && m.fecha.startsWith('2025-07')).reduce((a,m) => a + Math.abs(Number(m.monto)), 0);
const augTrans = MOVIMIENTOS.filter(m => m.tipo === 'gasto' && m.categoria?.nombre === 'Transporte' && m.fecha.startsWith('2025-08')).reduce((a,m) => a + Math.abs(Number(m.monto)), 0);
console.log('Julio 2025:  ' + fmt(julTrans));
console.log('Agosto 2025: ' + fmt(augTrans));
const otherTrans = MOVIMIENTOS.filter(m => m.tipo === 'gasto' && m.categoria?.nombre === 'Transporte' && !m.fecha.startsWith('2025-07') && !m.fecha.startsWith('2025-08'));
const otherTransMonths = new Set(otherTrans.map(m => m.fecha.slice(0,7))).size;
console.log('Promedio otros meses: ' + fmt(otherTrans.reduce((a,m) => a + Math.abs(Number(m.monto)), 0) / otherTransMonths));

console.log('\n### SUSCRIPCIONES POR TARJETA');
const subsByCard = {};
RECURRENCIAS.forEach(r => {
  const t = r.tarjeta?.nombre || 'Sin tarjeta';
  subsByCard[t] = (subsByCard[t] || 0) + r.monto;
});
Object.entries(subsByCard).forEach(([t,v]) => console.log('  ' + t + ': ' + fmt(v) + '/mes'));

console.log('\n### ADOBE CREATIVE — historial');
const adobe = MOVIMIENTOS.filter(m => m.descripcion?.includes('Adobe'));
const sorted = adobe.sort((a,b) => a.fecha.localeCompare(b.fecha));
console.log('Primer cargo: ' + sorted[0]?.fecha);
console.log('Total pagado: ' + fmt(adobe.reduce((a,m) => a + Math.abs(Number(m.monto)), 0)));
console.log('Cantidad de cargos: ' + adobe.length);

console.log('\n### MOVIMIENTOS MES ACTUAL (' + thisM + ')');
console.log('Mayor gasto: ' + (thisRows.filter(m => m.tipo === 'gasto').sort((a,b) => Math.abs(b.monto) - Math.abs(a.monto))[0] ? thisRows.filter(m => m.tipo === 'gasto').sort((a,b) => Math.abs(b.monto) - Math.abs(a.monto))[0].descripcion + ' ' + fmt(Math.abs(thisRows.filter(m => m.tipo === 'gasto').sort((a,b) => Math.abs(b.monto) - Math.abs(a.monto))[0].monto)) : 'ninguno aún'));

console.log('\n### MOVIMIENTOS MES ANTERIOR (' + lastM + ')');
const sortedLast = lastRows.filter(m => m.tipo === 'gasto').sort((a,b) => Math.abs(b.monto) - Math.abs(a.monto));
console.log('Mayor gasto: ' + sortedLast[0].descripcion + ' ' + fmt(Math.abs(sortedLast[0].monto)));
console.log('Menor gasto: ' + sortedLast[sortedLast.length-1].descripcion + ' ' + fmt(Math.abs(sortedLast[sortedLast.length-1].monto)));
