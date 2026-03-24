import Sidebar from "../components/Sidebar";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from "recharts";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .app-layout {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    font-family: 'DM Sans', sans-serif;
    position: fixed;
    top: 0; left: 0;
    padding-top: 56px;
    padding-left: 180px;
  }
  .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .page-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: #f4f5f7;
  }
  .page-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .page-welcome {
    font-size: 22px;
    font-weight: 700;
    color: #111;
  }
  .page-breadcrumb {
    font-size: 12px;
    color: #888;
  }
  .cards-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .cards-row-3 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 20px;
  }
  .stat-card {
    background: #fff;
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .stat-card-label { font-size: 13px; color: #888; font-weight: 500; margin-bottom: 8px; }
  .stat-card-value { font-size: 28px; font-weight: 700; color: #111; margin-bottom: 8px; }
  .stat-card-value.green { color: #43a047; }
  .stat-card-value.red { color: #e53935; }
  .stat-card-sub { font-size: 12px; color: #888; display: flex; align-items: center; gap: 6px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .section-title { font-size: 16px; font-weight: 700; color: #222; margin-bottom: 4px; }
  .chart-card {
    background: #fff;
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .chart-card-title { font-size: 14px; font-weight: 700; color: #333; }
  .chart-card-subtitle { font-size: 11px; color: #999; margin-top: -8px; }
  .pie-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    padding-top: 4px;
  }
  .pie-legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #555;
  }
  .pie-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .movimientos-card {
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .mov-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .mov-table thead tr { background: #f0f0f0; }
  .mov-table th { padding: 12px 16px; text-align: left; font-weight: 600; color: #555; font-size: 12px; }
  .mov-table td { padding: 12px 16px; border-bottom: 1px solid #f0f0f0; color: #333; }
  .mov-table tr:last-child td { border-bottom: none; }
  .mov-table tr:hover td { background: #fafafa; }
  .badge-gasto { color: #e53935; font-weight: 500; }
  .badge-ingreso { color: #43a047; font-weight: 500; }
`;

const movimientos = [
  { fecha: "26/02", descripcion: "Uber Eats",     tipo: "Gasto",   monto: 199.00,  categoria: "Comida" },
  { fecha: "26/02", descripcion: "OXXO Tec",      tipo: "Gasto",   monto: 56.00,   categoria: "Snacks" },
  { fecha: "26/02", descripcion: "Spotify",       tipo: "Gasto",   monto: 199.00,  categoria: "Suscripciones" },
  { fecha: "19/02", descripcion: "Retiro",        tipo: "Gasto",   monto: 500.00,  categoria: "Efectivo" },
  { fecha: "15/02", descripcion: "Transferencia", tipo: "Ingreso", monto: 600.00,  categoria: "Transferencia" },
  { fecha: "10/02", descripcion: "Netflix",       tipo: "Gasto",   monto: 149.00,  categoria: "Suscripciones" },
  { fecha: "05/02", descripcion: "Nómina",        tipo: "Ingreso", monto: 5000.00, categoria: "Ingreso" },
];

const gastosDiarios = [
  { dia: "01", gasto: 0, ingreso: 0 },
  { dia: "05", gasto: 0, ingreso: 5000 },
  { dia: "08", gasto: 120, ingreso: 0 },
  { dia: "10", gasto: 149, ingreso: 0 },
  { dia: "13", gasto: 85, ingreso: 0 },
  { dia: "15", gasto: 0, ingreso: 600 },
  { dia: "17", gasto: 210, ingreso: 0 },
  { dia: "19", gasto: 500, ingreso: 0 },
  { dia: "22", gasto: 175, ingreso: 0 },
  { dia: "24", gasto: 90, ingreso: 0 },
  { dia: "26", gasto: 454, ingreso: 0 },
];

const categorias = movimientos
  .filter((m) => m.tipo === "Gasto")
  .reduce((acc, m) => {
    const found = acc.find((c) => c.name === m.categoria);
    if (found) found.value += m.monto;
    else acc.push({ name: m.categoria, value: m.monto });
    return acc;
  }, [])
  .sort((a, b) => b.value - a.value);

const PIE_COLORS = ["#cc0000", "#ff6f00", "#fdd835", "#43a047", "#1976d2", "#8e24aa"];

const gastosMensuales = [
  { mes: "Sep", gasto: 2800 },
  { mes: "Oct", gasto: 3100 },
  { mes: "Nov", gasto: 2600 },
  { mes: "Dic", gasto: 4200 },
  { mes: "Ene", gasto: 3080 },
  { mes: "Feb", gasto: 3760 },
];

const totalIngresos = movimientos.filter((m) => m.tipo === "Ingreso").reduce((s, m) => s + m.monto, 0);
const totalGastos = movimientos.filter((m) => m.tipo === "Gasto").reduce((s, m) => s + m.monto, 0);

export default function Dashboard() {
  return (
    <>
      <style>{styles}</style>
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <main className="page-body">
            <div className="page-header">
              <div className="page-welcome">Bienvenido, Diego García</div>
              <div className="page-breadcrumb">Dashboard ›</div>
            </div>

            <div className="cards-row-3">
              <div className="stat-card">
                <div className="stat-card-label">Saldo Disponible</div>
                <div className="stat-card-value">$1,240.68</div>
                <div className="stat-card-sub">
                  <span className="dot" style={{ background: "#fdd835" }} />
                  MXN · Te quedan 18 días del mes
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Ingresos del mes</div>
                <div className="stat-card-value green">${totalIngresos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
                <div className="stat-card-sub">
                  <span className="dot" style={{ background: "#43a047" }} />
                  Nómina + Transferencias
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-card-label">Gastado este mes</div>
                <div className="stat-card-value red">${totalGastos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</div>
                <div className="stat-card-sub">
                  <span className="dot" style={{ background: "#e53935" }} />
                  22% más que el mes anterior ↗
                </div>
              </div>
            </div>

            <div className="cards-row">
              <div className="chart-card">
                <span className="chart-card-title">Flujo del mes</span>
                <span className="chart-card-subtitle">Gastos e ingresos diarios — Febrero 2026</span>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={gastosDiarios} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradGasto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#e53935" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#e53935" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradIngreso" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#43a047" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#43a047" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="dia" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, fontFamily: "'DM Sans', sans-serif" }}
                      formatter={(v, name) => [`$${v.toLocaleString()}`, name === "gasto" ? "Gasto" : "Ingreso"]}
                      labelFormatter={(l) => `Día ${l}`}
                    />
                    <Area type="monotone" dataKey="ingreso" stroke="#43a047" strokeWidth={2} fill="url(#gradIngreso)" />
                    <Area type="monotone" dataKey="gasto" stroke="#e53935" strokeWidth={2} fill="url(#gradGasto)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <span className="chart-card-title">Gastos por categoría</span>
                <span className="chart-card-subtitle">Distribución de febrero</span>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={categorias}
                      cx="50%" cy="50%"
                      innerRadius={45} outerRadius={75}
                      dataKey="value"
                      startAngle={90} endAngle={-270}
                      paddingAngle={3}
                    >
                      {categorias.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, fontFamily: "'DM Sans', sans-serif" }}
                      formatter={(v, name) => [`$${v.toLocaleString()}`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pie-legend">
                  {categorias.map((c, i) => (
                    <div key={i} className="pie-legend-item">
                      <span className="pie-legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {c.name} · ${c.value.toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="chart-card">
              <span className="chart-card-title">Tendencia de gastos</span>
              <span className="chart-card-subtitle">Últimos 6 meses</span>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={gastosMensuales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, fontFamily: "'DM Sans', sans-serif" }}
                    formatter={(v) => [`$${v.toLocaleString()}`, "Gasto"]}
                  />
                  <Bar dataKey="gasto" radius={[6, 6, 0, 0]}>
                    {gastosMensuales.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={i === gastosMensuales.length - 1 ? "#cc0000" : "#e0e0e0"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div>
              <div className="section-title">Movimientos</div>
              <div className="movimientos-card">
                <table className="mov-table">
                  <thead>
                    <tr>
                      <th>Febrero - 2026</th>
                      <th>Descripción</th>
                      <th>Ingresos/Gastos</th>
                      <th>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((mov, i) => (
                      <tr key={i}>
                        <td>{mov.fecha}</td>
                        <td>{mov.descripcion}</td>
                        <td className={mov.tipo === "Gasto" ? "badge-gasto" : "badge-ingreso"}>
                          {mov.tipo}
                        </td>
                        <td>${mov.monto.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
