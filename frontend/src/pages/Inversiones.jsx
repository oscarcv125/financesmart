import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import "../styles/inversiones.css";

export default function Inversiones() {
  const { session } = useAuth();
  const [inversiones, setInversiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortDir, setSortDir] = useState("asc");
  const [dropOpen, setDropOpen] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch("http://localhost:3001/api/inversion/lista", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((response) => response.json())
      .then((data) => {
        setInversiones(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error al cargar inversiones:", err);
        setLoading(false);
      });
  }, [session]);

  const sorted = [...inversiones].sort((a, b) =>
    sortDir === "asc" ? a.roi - b.roi : b.roi - a.roi
  );

  if (loading) return <div className="page-body">Cargando datos financieros...</div>;
  
  //En caso de fallar
  if (!inversiones || inversiones.length === 0) return (
    <div className="page-body">
      <div className="page-header">
        <div className="page-welcome">Bienvenido</div>
      </div>
      <p>No se pudieron cargar los datos. Contacta a un administrador.</p>
    </div>
  );


  return (
    <>
      <div className="app-layout">
        <div className="main-content">
          <main className="page-body">
            <div className="page-breadcrumb">Inversiones ›</div>
            <div className="page-title">Mis Oportunidades de Inversión</div>

            <div className="sort-row">
              <span>Ordenar por:</span>
              <button className="sort-btn" onClick={() => setDropOpen((o) => !o)}>
                {sortDir === "asc" ? "Menor a Mayor" : "Mayor a Menor"} ▾
              </button>
              {dropOpen && (
                <div className="sort-dropdown">
                  <div className={`sort-option ${sortDir === "asc" ? "selected" : ""}`} onClick={() => { setSortDir("asc"); setDropOpen(false); }}>Menor a Mayor</div>
                  <div className={`sort-option ${sortDir === "desc" ? "selected" : ""}`} onClick={() => { setSortDir("desc"); setDropOpen(false); }}>Mayor a Menor</div>
                </div>
              )}
            </div>

            {sorted.map((inv, i) => (
              <div className="inv-card" key={i}>
                <div className="inv-info">
                  <div className="inv-name">{inv.nombre}</div>
                  <div className="inv-roi">ROI: {inv.roi.toFixed(2)}%</div>
                </div>
                <div className="inv-plazo">
                  <strong>Plazo:</strong>
                  {inv.plazo} días
                </div>
                <div className="inv-right">
                  <span className={`riesgo-badge ${inv.riesgo === "Bajo" ? "riesgo-bajo" : inv.riesgo === "Alto" ? "riesgo-alto" : "riesgo-medio"}`}>
                    Riesgo: {inv.riesgo}
                  </span>
                  <button className="inv-btn">Invertir</button>
                </div>
              </div>
            ))}
          </main>
        </div>
      </div>
    </>
  );
}