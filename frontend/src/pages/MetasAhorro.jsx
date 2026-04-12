import { useState } from "react";
import { TbPlus, TbCalendar, TbPigMoney, TbTrash, TbX } from "react-icons/tb";
import "../styles/metasahorro.css";

const METAS_INIT = [
  { id: 1, nombre: "Viaje a Japón",       meta: 30000, actual: 12500, fecha: "Dic 2026", estado: "Activa"  },
  { id: 2, nombre: "Fondo de emergencia", meta: 15000, actual: 15000, fecha: "Mar 2026", estado: "Lograda" },
  { id: 3, nombre: "MacBook Pro",         meta: 45000, actual: 9000,  fecha: "Jun 2027", estado: "Activa"  },
  { id: 4, nombre: "Enganche depa",       meta: 80000, actual: 22000, fecha: "Ene 2028", estado: "Activa"  },
];

const colorPorPct = (p) => p >= 80 ? "#6CC04A" : p >= 50 ? "#FFA400" : "#EB0029";

export default function MetasAhorro() {
  const [metas, setMetas]         = useState(METAS_INIT);
  const [modal, setModal]         = useState(false);
  const [aportarId, setAportarId] = useState(null);
  const [aporte, setAporte]       = useState("");
  const [form, setForm]           = useState({ nombre: "", meta: "", fecha: "" });

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
      <main className="page-body">

        <div className="page-header-row">
          <div className="page-breadcrumb">
            Metas de Ahorro › <strong>Mis Metas</strong>
          </div>
          <button className="btn-nueva-meta" onClick={() => setModal(true)}>
            <TbPlus size={18} />
            Nueva meta
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
                  <div className="meta-fecha">
                    <TbCalendar size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                    {m.fecha}
                  </div>
                </div>
                <span className={`meta-badge ${
                  m.estado === "Activa"  ? "badge-activa"  :
                  m.estado === "Lograda" ? "badge-lograda" : "badge-pausada"
                }`}>
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
                  <button className="meta-btn" style={{ flex: "0 0 44px" }} onClick={() => { setAportarId(null); setAporte(""); }}>
                    <TbX size={16} />
                  </button>
                </div>
              ) : (
                <div className="meta-actions">
                  {m.estado !== "Lograda" && (
                    <button className="meta-btn primary" onClick={() => setAportarId(m.id)}>
                      <TbPigMoney size={16} style={{ marginRight: 4 }} />
                      Aportar
                    </button>
                  )}
                  <button className="meta-btn" onClick={() => setMetas(prev => prev.filter(x => x.id !== m.id))}>
                    <TbTrash size={16} style={{ marginRight: 4 }} />
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

      </main>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-title">Nueva meta de ahorro</div>

            <div className="modal-field">
              <label className="modal-label">Nombre de la meta</label>
              <input
                className="modal-input"
                placeholder="Ej. Viaje a Europa"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              />
            </div>

            <div className="modal-field">
              <label className="modal-label">Monto objetivo ($MXN)</label>
              <input
                className="modal-input"
                type="number"
                placeholder="Ej. 20000"
                value={form.meta}
                onChange={e => setForm(f => ({ ...f, meta: e.target.value }))}
              />
            </div>

            <div className="modal-field">
              <label className="modal-label">Fecha límite</label>
              <input
                className="modal-input"
                type="month"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
              />
            </div>

            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setModal(false)}>Cancelar</button>
              <button className="modal-btn confirm" onClick={agregarMeta}>
                <TbPlus size={16} style={{ marginRight: 4 }} />
                Crear meta
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}