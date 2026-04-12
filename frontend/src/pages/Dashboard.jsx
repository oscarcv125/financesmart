import "../styles/dashboard.css";

const movimientos = [
  { fecha: "26/02", descripcion: "Uber Eats",     tipo: "Gasto",   monto: 199.00 },
  { fecha: "26/02", descripcion: "OXXO Tec",      tipo: "Gasto",   monto: 56.00  },
  { fecha: "26/02", descripcion: "Spotify",       tipo: "Gasto",   monto: 199.00 },
  { fecha: "19/02", descripcion: "Retiro",        tipo: "Gasto",   monto: 500.00 },
  { fecha: "15/02", descripcion: "Transferencia", tipo: "Ingreso", monto: 600.00 },
  { fecha: "10/02", descripcion: "Netflix",       tipo: "Gasto",   monto: 149.00 },
  { fecha: "05/02", descripcion: "Nómina",        tipo: "Ingreso", monto: 5000.00},
];

const totalIngresos = movimientos.filter((m) => m.tipo === "Ingreso").reduce((s, m) => s + m.monto, 0);
const totalGastos   = movimientos.filter((m) => m.tipo === "Gasto").reduce((s, m) => s + m.monto, 0);

export default function Dashboard() {
  return (
    <main className="page-body">

      <div className="page-header">
        <div className="page-welcome">Bienvenido, Diego García</div>
        <div className="page-breadcrumb">Dashboard</div>
      </div>

      <div className="cards-row-3">
        <div className="stat-card">
          <div className="stat-card-label">Saldo Disponible</div>
          <div className="stat-card-value">$1,240.68</div>
          <div className="stat-card-sub">
            <span className="dot" style={{ background: "#FFA400" }} />
            MXN · Te quedan 18 días del mes
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Ingresos del mes</div>
          <div className="stat-card-value green">
            ${totalIngresos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub">
            <span className="dot" style={{ background: "#6CC04A" }} />
            Nómina + Transferencias
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Gastado este mes</div>
          <div className="stat-card-value red">
            ${totalGastos.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub">
            <span className="dot" style={{ background: "#EB0029" }} />
            22% más que el mes anterior ↗
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">Movimientos</div>
        <div className="movimientos-card">
          <table className="mov-table">
            <thead>
              <tr>
                <th>Febrero - 2026</th>
                <th>Descripción</th>
                <th>Tipo</th>
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
  );
}