import { useState } from "react";
import Sidebar from "../components/Sidebar";


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
    background: #f4f5f7;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .page-breadcrumb { font-size: 13px; color: #888; }
  .page-title { font-size: 20px; font-weight: 700; color: #222; }
  .sort-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    font-size: 13px;
    color: #666;
    position: relative;
  }
  .sort-btn {
    border: 1px solid #ddd;
    background: #fff;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    display: flex;
    align-items: center;
    gap: 6px;
    color: #111;
  }
  .sort-dropdown {
    position: absolute;
    top: 36px;
    right: 0;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    z-index: 10;
    min-width: 140px;
  }
  .sort-option { padding: 10px 14px; font-size: 13px; cursor: pointer; font-family: 'DM Sans', sans-serif; color: #111; }
  .sort-option:hover { background: #f5f5f5; }
  .sort-option.selected { background: #fff0f0; color: #cc0000; font-weight: 600; }
  .inv-card {
    background: #fff;
    border-radius: 12px;
    padding: 18px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .inv-icon { font-size: 36px; }
  .inv-info { flex: 1; }
  .inv-name { font-size: 14px; color: #555; margin-bottom: 2px; }
  .inv-roi { font-size: 20px; font-weight: 700; color: #111; }
  .inv-plazo { font-size: 12px; color: #888; }
  .inv-plazo strong { color: #555; font-size: 13px; display: block; margin-bottom: 2px; }
  .riesgo-badge { font-size: 13px; font-weight: 600; }
  .riesgo-bajo { color: #43a047; }
  .riesgo-alto { color: #e53935; }
  .riesgo-medio { color: #f9a825; }
  .inv-right { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
  .inv-btn {
    border: 1px solid #333;
    background: #fff;
    border-radius: 6px;
    padding: 6px 18px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.15s;
    color: #111;
  }
  .inv-btn:hover { background: #cc0000; color: #fff; border-color: #cc0000; }
`;

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
      <style>{styles}</style>
      <div className="app-layout">
        <Sidebar />
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