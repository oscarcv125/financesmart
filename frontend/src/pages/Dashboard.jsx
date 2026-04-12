import "../styles/dashboard.css";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:3001/api/dashboard/resumen")
      .then((res) => res.json())
      .then((json) => {
        // Si el backend mandó un error, se maneja para no romper el render
        if (json.error) {
          console.error("Error del backend:", json.error);
          setData(null);
        } else {
          setData(json);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error al conectar con el backend:", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="page-body">Cargando datos financieros...</div>;
  
  //Si el backend falló, mostramos un estado amigable
  if (!data) return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-welcome">Bienvenido</div>
      </div>
      <p>No se pudieron cargar los datos. Contacta a un administrador.</p>
    </div>
  );

  return (
    <main className="page-body">
      <div className="page-header">
        <div className="page-welcome">Bienvenido, {data?.nombreUsuario || "Usuario"}</div>
        <div className="page-breadcrumb">Dashboard</div>
      </div>

      <div className="cards-row-3">
        <div className="stat-card">
          <div className="stat-card-label">Saldo Disponible</div>
          <div className="stat-card-value">
            {/* El ?. asegura que si totales no existe, no se caiga la app */}
            ${(data?.totales?.saldo || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub">
            <span className="dot" style={{ background: "#FFA400" }} />
            Saldo en MXN
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Ingresos del mes</div>
          <div className="stat-card-value green">
            ${(data?.totales?.ingresos || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub">
            <span className="dot" style={{ background: "#6CC04A" }} />
            Total de entradas
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Gastado este mes</div>
          <div className="stat-card-value red">
            ${(data?.totales?.gastos || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub">
            <span className="dot" style={{ background: "#EB0029" }} />
            Total de salidas
          </div>
        </div>
      </div>

      <div>
        <div className="section-title">Movimientos</div>
        <div className="movimientos-card">
          <table className="mov-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Monto</th>
              </tr>
            </thead>
            <tbody>
              {/* Verificar un array antes de hacer .map */}
              {(data?.movimientos || []).map((mov, i) => (
                <tr key={i}>
                  <td>{mov.fecha ? new Date(mov.fecha).toLocaleDateString("es-MX", { timeZone: 'UTC' }) : "---"}</td>
                  <td>{mov.descripcion}</td>
                  <td className={mov.tipo === "Gasto" ? "badge-gasto" : "badge-ingreso"}>
                    {mov.tipo}
                  </td>
                  <td>
                    ${Number(mov.monto || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {(!data?.movimientos || data.movimientos.length === 0) && (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", padding: "20px" }}>
                    No se encontraron movimientos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}