import { useState } from "react";
import Sidebar from "../components/Sidebar";


const METAS_INIT = [
  { id: 1, nombre: "Viaje a Japón",       meta: 30000, actual: 12500, fecha: "Dic 2026", estado: "Activa"  },
  { id: 2, nombre: "Fondo de emergencia", meta: 15000, actual: 15000, fecha: "Mar 2026", estado: "Lograda" },
  { id: 3, nombre: "MacBook Pro",         meta: 45000, actual: 9000,  fecha: "Jun 2027", estado: "Activa"  },
  { id: 4, nombre: "Enganche depa",       meta: 80000, actual: 22000, fecha: "Ene 2028", estado: "Activa"  },
];

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .app-layout {
    display: flex; height: 100vh; width: 100vw;
    overflow: hidden; font-family: 'DM Sans', sans-serif;
    position: fixed; top: 0; left: 0;
    padding-top: 56px; padding-left: 180px;
  }
  .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .page-body {
    flex: 1; overflow-y: auto;
    padding: 24px 28px;
    display: flex; flex-direction: column; gap: 20px;
    background: #f4f5f7;
  }

  .page-header-row {
    display: flex; align-items: center; justify-content: space-between;
  }
  .page-breadcrumb { font-size: 13px; color: #888; }
  .page-breadcrumb strong { color: #333; font-weight: 600; }
  .btn-nueva-meta {
    background: #cc0000; color: #fff;
    border: none; border-radius: 6px 6px 0 0;
    padding: 10px 24px; font-size: 14px; font-weight: 700;
    letter-spacing: 0.5px;
    font-family: 'DM Sans', sans-serif;
    cursor: pointer; transition: background 0.15s;
  }
  .btn-nueva-meta:hover { background: #aa0000; }

  .resumen-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .resumen-card {
    background: #fff; border-radius: 12px; padding: 18px 22px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .resumen-label { font-size: 12px; color: #888; font-weight: 500; margin-bottom: 6px; }
  .resumen-value { font-size: 24px; font-weight: 700; color: #111; }
  .resumen-sub { font-size: 11px; color: #aaa; margin-top: 4px; }

  .metas-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .meta-card {
    background: #fff; border-radius: 12px; padding: 20px 22px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    display: flex; flex-direction: column; gap: 12px;
    position: relative; overflow: hidden; transition: box-shadow 0.15s;
    border: 1px solid #e8e8e8;
  }
  .meta-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
  .meta-card-accent {
    position: absolute; top: 0; left: 0;
    width: 4px; height: 100%;
  }
  .meta-top { display: flex; align-items: flex-start; justify-content: space-between; }
  .meta-name { font-size: 15px; font-weight: 700; color: #111; }
  .meta-fecha { font-size: 11px; color: #aaa; margin-top: 3px; }
  .meta-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
  .badge-activa  { background: #e8f5e9; color: #43a047; }
  .badge-pausada { background: #fff3e0; color: #f57c00; }
  .badge-lograda { background: #e3f2fd; color: #1976d2; }

  .meta-progress-wrap { display: flex; flex-direction: column; gap: 6px; }
  .meta-montos { display: flex; justify-content: space-between; font-size: 12px; color: #888; }
  .meta-montos strong { color: #111; font-size: 14px; }
  .progress-bar-bg { width: 100%; height: 8px; background: #f0f0f0; border-radius: 99px; overflow: hidden; }
  .progress-bar-fill { height: 100%; border-radius: 99px; transition: width 0.6s cubic-bezier(.4,0,.2,1); }
  .meta-pct { font-size: 12px; font-weight: 700; }

  .meta-actions { display: flex; gap: 8px; }
  .meta-btn {
    flex: 1; border: 1.5px solid #e0e0e0; background: #fff;
    border-radius: 7px; padding: 7px 0; font-size: 12px; font-weight: 600;
    font-family: 'DM Sans', sans-serif; cursor: pointer; color: #555; transition: all 0.15s;
  }
  .meta-btn:hover { border-color: #cc0000; color: #cc0000; }
  .meta-btn.primary { background: #cc0000; color: #fff; border-color: #cc0000; }
  .meta-btn.primary:hover { background: #aa0000; }

  /* Modal */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    z-index: 2000;
  }
  .modal {
    background: #fff; border-radius: 18px; padding: 32px 36px; width: 440px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  }
  .modal-title { font-size: 18px; font-weight: 700; color: #111; margin-bottom: 24px; }
  .modal-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
  .modal-label { font-size: 12px; font-weight: 600; color: #555; }
  .modal-input {
    border: none; border-bottom: 2px solid #ddd;
    background: #f7f7f7; border-radius: 8px 8px 0 0;
    padding: 12px 14px; font-size: 14px; color: #111;
    font-family: 'DM Sans', sans-serif; outline: none; transition: border 0.15s;
  }
  .modal-input:focus { border-bottom-color: #cc0000; }
  .color-row { display: flex; gap: 10px; }
  .color-dot {
    width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
    transition: transform 0.15s;
    border: 3px solid transparent;
  }
  .color-dot:hover { transform: scale(1.15); }
  .color-dot.selected { border-color: #111; }
  .modal-actions { display: flex; gap: 10px; margin-top: 24px; }
  .modal-btn {
    flex: 1; border: none; border-radius: 8px; padding: 13px;
    font-size: 14px; font-weight: 700; font-family: 'DM Sans', sans-serif;
    cursor: pointer; transition: all 0.15s;
  }
  .modal-btn.cancel { background: #f4f5f7; color: #555; }
  .modal-btn.cancel:hover { background: #e8e8e8; }
  .modal-btn.confirm { background: #cc0000; color: #fff; }
  .modal-btn.confirm:hover { background: #aa0000; }
`;

const COLORES = ["#e53935", "#43a047", "#fdd835"];

const colorPorPct = (p) => p >= 80 ? "#43a047" : p >= 50 ? "#fdd835" : "#e53935";

export default function MetasAhorro() {
  const [metas, setMetas]         = useState(METAS_INIT);
  const [modal, setModal]         = useState(false);
  const [aportarId, setAportarId] = useState(null);
  const [aporte, setAporte]       = useState("");
  const [form, setForm] = useState({ nombre: "", meta: "", fecha: "" });

  const totalMeta    = metas.reduce((s, m) => s + m.meta, 0);
  const totalActual  = metas.reduce((s, m) => s + m.actual, 0);
  const metasActivas = metas.filter(m => m.estado === "Activa").length;
  const pct          = (m) => Math.min(100, Math.round((m.actual / m.meta) * 100));

  const agregarMeta = () => {
    if (!form.nombre || !form.meta) return;
    setMetas(prev => [...prev, {
      id: Date.now(),
      nombre: form.nombre,
      meta: parseFloat(form.meta),
      actual: 0,
      fecha: form.fecha || "Sin fecha",
      estado: "Activa",
    }]);
    setForm({ nombre: "", meta: "", fecha: "" });
    setModal(false);
  };

  const confirmarAporte = () => {
    const val = parseFloat(aporte);
    if (!val || val <= 0) return;
    setMetas(prev => prev.map(m => {
      if (m.id !== aportarId) return m;
      const nuevo = Math.min(m.meta, m.actual + val);
      return { ...m, actual: nuevo, estado: nuevo >= m.meta ? "Lograda" : m.estado };
    }));
    setAportarId(null);
    setAporte("");
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <main className="page-body">

            <div className="page-header-row">
              <div className="page-breadcrumb">
                Metas de Ahorro › <strong>Mis Metas</strong>
              </div>
              <button className="btn-nueva-meta" onClick={() => setModal(true)}>
                ＋ Nueva meta
              </button>
            </div>

            {/* Resumen */}
            <div className="resumen-row">
              <div className="resumen-card">
                <div className="resumen-label">Total ahorrado</div>
                <div className="resumen-value">${totalActual.toLocaleString()}</div>
                <div className="resumen-sub">de ${totalMeta.toLocaleString()} objetivo</div>
              </div>
              <div className="resumen-card">
                <div className="resumen-label">Metas activas</div>
                <div className="resumen-value">{metasActivas}</div>
                <div className="resumen-sub">{metas.length} metas en total</div>
              </div>
              <div className="resumen-card">
                <div className="resumen-label">Progreso general</div>
                <div className="resumen-value">{Math.round((totalActual / totalMeta) * 100)}%</div>
                <div className="resumen-sub">promedio de todas las metas</div>
              </div>
            </div>

            {/* Tarjetas */}
            <div className="metas-grid">
              {metas.map(m => (
                <div className="meta-card" key={m.id}>
                  <div className="meta-card-accent" style={{ background: colorPorPct(pct(m)) }} />
                  <div className="meta-top">
                    <div>
                      <div className="meta-name">{m.nombre}</div>
                      <div className="meta-fecha">📅 {m.fecha}</div>
                    </div>
                    <span className={`meta-badge ${m.estado === "Activa" ? "badge-activa" : m.estado === "Lograda" ? "badge-lograda" : "badge-pausada"}`}>
                      {m.estado}
                    </span>
                  </div>

                  <div className="meta-progress-wrap">
                    <div className="meta-montos">
                      <span><strong>${m.actual.toLocaleString()}</strong> ahorrados</span>
                      <span>Meta: ${m.meta.toLocaleString()}</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${pct(m)}%`, background: colorPorPct(pct(m)) }} />
                    </div>
                    <div className="meta-pct" style={{ color: colorPorPct(pct(m)) }}>{pct(m)}% completado</div>
                  </div>

                  {aportarId === m.id ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="modal-input"
                        style={{ flex: 1, padding: "8px 12px", fontSize: 13 }}
                        type="number"
                        placeholder="Monto a aportar"
                        value={aporte}
                        onChange={e => setAporte(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && confirmarAporte()}
                        autoFocus
                      />
                      <button className="meta-btn primary" style={{ flex: "0 0 70px" }} onClick={confirmarAporte}>OK</button>
                      <button className="meta-btn" style={{ flex: "0 0 60px" }} onClick={() => { setAportarId(null); setAporte(""); }}>✕</button>
                    </div>
                  ) : (
                    <div className="meta-actions">
                      {m.estado !== "Lograda" && (
                        <button className="meta-btn primary" onClick={() => setAportarId(m.id)}>＋ Aportar</button>
                      )}
                      <button className="meta-btn" onClick={() => setMetas(prev => prev.filter(x => x.id !== m.id))}>Eliminar</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

          </main>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-title">Nueva meta de ahorro</div>

            <div className="modal-field">
              <label className="modal-label">Nombre de la meta</label>
              <input className="modal-input" placeholder="Ej. Viaje a Europa" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>

            <div className="modal-field">
              <label className="modal-label">Monto objetivo ($MXN)</label>
              <input className="modal-input" type="number" placeholder="Ej. 20000" value={form.meta} onChange={e => setForm(f => ({ ...f, meta: e.target.value }))} />
            </div>

            <div className="modal-field">
              <label className="modal-label">Fecha límite</label>
              <input className="modal-input" type="month" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </div>

            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setModal(false)}>Cancelar</button>
              <button className="modal-btn confirm" onClick={agregarMeta}>Crear meta</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}