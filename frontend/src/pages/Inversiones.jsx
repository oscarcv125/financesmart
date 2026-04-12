import { useState } from "react";
import "../styles/inversiones.css";


const inversiones = [
  { nombre: "Fondo de Inversión", roi: 6.20,  plazo: 90,  riesgo: "Bajo"  },
  { nombre: "Mercado Global",     roi: 12.20, plazo: 90,  riesgo: "Alto"  },
  { nombre: "Pagaré",             roi: 16.20, plazo: 190, riesgo: "Bajo"  },
  { nombre: "CETES 28 días",      roi: 11.30, plazo: 28,  riesgo: "Bajo"  },
  { nombre: "Fibra Inmobiliaria", roi: 9.50,  plazo: 365, riesgo: "Medio" },
];

export default function Inversiones() {
  const [sortDir, setSortDir] = useState("asc");
  const [dropOpen, setDropOpen] = useState(false);

  const sorted = [...inversiones].sort((a, b) =>
    sortDir === "asc" ? a.roi - b.roi : b.roi - a.roi
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