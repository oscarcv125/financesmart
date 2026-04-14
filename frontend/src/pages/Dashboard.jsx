import "../styles/dashboard.css";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [tarjetas, setTarjetas] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [tarjetaActiva, setTarjetaActiva] = useState(localStorage.getItem("tarjeta_preferida") || "");

  // 1. Cargar la lista de tarjetas
  useEffect(() => {
    fetch("http://localhost:3001/api/tarjetas/")
      .then(res => res.json())
      .then(json => setTarjetas(json))
      .catch(err => console.error("Error cargando tarjetas:", err));
  }, []);

  // 2. Cargar los datos del dashboard dinamico
  useEffect(() => {
    setLoading(true);
    const url = tarjetaActiva 
      ? `http://localhost:3001/api/dashboard?tarjetaId=${tarjetaActiva}` 
      : "http://localhost:3001/api/dashboard";

    fetch(url)
      .then((res) => res.json())
      .then((json) => {
        if (!json.error) setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error de conexión:", err);
        setLoading(false);
      });
  }, [tarjetaActiva]);

  // 3. Manejar el cambio en el selector de tarjetas
  const handleChangeTarjeta = (e) => {
    const id = e.target.value;
    setTarjetaActiva(id);
    if (id) {
      localStorage.setItem("tarjeta_preferida", id);
    } else {
      localStorage.removeItem("tarjeta_preferida");
    }
  };

  if (loading && !data) return <div className="page-body">Cargando datos financieros...</div>;
  if (!data) return <div className="page-body">Error al cargar datos.</div>;

  return (
    <main className="page-body">
      <div className="page-header">
        <div className="page-welcome">Bienvenido, {data.nombreUsuario}</div>
        <div className="page-breadcrumb">
          Dashboard › 
          <select 
            className="breadcrumb-select" 
            value={tarjetaActiva} 
            onChange={handleChangeTarjeta}
          >
            <option value="">Vista General (Global)</option>
            {tarjetas.map(t => (
              <option key={t.id_tarjeta} value={t.id_tarjeta}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="cards-row-3">
        <div className="stat-card">
          <div className="stat-card-label">Saldo Neto</div>
          <div className="stat-card-value">
            ${(data.totales?.saldo || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub"><span className="dot" style={{ background: "#FFA400" }} /> MXN</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Ingresos</div>
          <div className="stat-card-value green">
            +${(data.totales?.ingresos || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub"><span className="dot" style={{ background: "#6CC04A" }} /> Entradas</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Gastos</div>
          <div className="stat-card-value red">
            -${(data.totales?.gastos || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub"><span className="dot" style={{ background: "#EB0029" }} /> Salidas</div>
        </div>
      </div>

      <div className="section-title">Movimientos Recientes</div>
      <div className="movimientos-card">
        <table className="mov-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {data.movimientos.map((mov, i) => (
              <tr key={i}>
                <td>{new Date(mov.fecha).toLocaleDateString()}</td>
                <td>{mov.descripcion}</td>
                <td><span className="categoria-pill">{mov.categoria?.nombre || 'General'}</span></td>
                <td className={mov.tipo === "Gasto" ? "monto-neg" : "monto-pos"}>
                  {mov.tipo === "Gasto" ? "-" : "+"}${Math.abs(mov.monto).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}