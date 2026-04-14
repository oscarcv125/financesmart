import { useState, useEffect } from "react";
import { TbPlus, TbCalendar, TbPigMoney, TbTrash, TbX } from "react-icons/tb";
import { useAuth } from "../context/AuthContext";
import "../styles/metasahorro.css";

const API_URL = "http://localhost:3001/api/metas/";
const colorPorPct = (p) => p >= 80 ? "#6CC04A" : p >= 50 ? "#FFA400" : "#EB0029";

export default function MetasAhorro() {
  const { session } = useAuth();
  const [metas, setMetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [aportarId, setAportarId] = useState(null);
  const [aporte, setAporte] = useState("");
  const [form, setForm] = useState({ nombre: "", meta: "", fecha: "" });

  const cargarMetas = async () => {
    try {
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const rawData = await res.json();
      const dataMapeada = rawData.map(m => ({
        id: m.id_meta,           
        nombre: m.nombre_meta,  
        meta: m.monto_objetivo,  
        actual: m.progreso,      
        fecha: m.fecha_limite,   
        estado: (m.progreso >= m.monto_objetivo) ? "Lograda" : "Activa"
      }));
      setMetas(dataMapeada);
      setLoading(false);
    } catch (err) {
      console.error("Error al cargar:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) cargarMetas();
  }, [session]);

  const totalMeta = metas.reduce((s, m) => s + (Number(m.meta) || 0), 0);
  const totalActual = metas.reduce((s, m) => s + (Number(m.actual) || 0), 0);
  const metasActivas = metas.filter(m => m.estado === "Activa").length;
  const pct = (m) => Math.min(100, Math.round(((m.actual || 0) / (m.meta || 1)) * 100));

  const agregarMeta = async () => {
  if (!form.nombre || !form.meta) return;

  const fechaCompleta = form.fecha ? `${form.fecha}-01` : null;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        nombre: form.nombre,
        meta: form.meta,
        fecha: fechaCompleta
      })
    });

    if (res.ok) {
      await cargarMetas(); 
      setForm({ nombre: "", meta: "", fecha: "" });
      setModal(false);
    } else {
      const errorData = await res.json();
      console.error("Error del servidor:", errorData.error);
    }
  } catch (err) { 
    console.error("Error en la petición:", err); 
  }
};

  const confirmarAporte = async () => {
    const val = parseFloat(aporte);
    if (!val || val <= 0) return;

    // LEER TARJETA GLOBAL
    const tarjetaGlobalId = localStorage.getItem("tarjeta_preferida");

    if (!tarjetaGlobalId) {
      alert("No tienes una tarjeta seleccionada. Ve al Dashboard y selecciona una cuenta para poder realizar el cobro del ahorro.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}${aportarId}/aportar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ 
          monto: val,
          id_tarjeta: tarjetaGlobalId 
        })
      });

      if (res.ok) {
        cargarMetas();
        setAportarId(null);
        setAporte("");
      } else {
        const errorData = await res.json();
        alert(errorData.error);
      }
    } catch (err) { 
      console.error("Error al aportar:", err); 
    }
  };
  
  const eliminarMeta = async (id) => {
    if (!window.confirm("¿Eliminar esta meta?")) return;
    try {
      const res = await fetch(`${API_URL}${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${session.access_token}` } });
      if (res.ok) cargarMetas();
    } catch (err) { console.error("Error al eliminar:", err); }
  };

  if (loading) return <main className="page-body">Cargando metas...</main>;

  return (
    <>
      <main className="page-body">
        <div className="page-header-row">
          <div className="page-breadcrumb">Metas de Ahorro › <strong>Mis Metas</strong></div>
          <button className="btn-nueva-meta" onClick={() => setModal(true)}>
            <TbPlus size={18} /> Nueva meta
          </button>
        </div>

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
            <div className="resumen-value">{totalMeta > 0 ? Math.round((totalActual / totalMeta) * 100) : 0}%</div>
          </div>
        </div>

        <div className="metas-grid">
          {metas.map(m => (
            <div className="meta-card" key={m.id}>
              <div className="meta-card-accent" style={{ background: colorPorPct(pct(m)) }} />
              <div className="meta-top">
                <div>
                  <div className="meta-name">{m.nombre}</div>
                  <div className="meta-fecha"><TbCalendar size={13} /> {m.fecha}</div>
                </div>
                <span className={`meta-badge badge-${m.estado.toLowerCase()}`}>{m.estado}</span>
              </div>

              <div className="meta-progress-wrap">
                <div className="meta-montos">
                  <span><strong>${(m.actual || 0).toLocaleString()}</strong> ahorrados</span>
                  <span>Meta: ${(m.meta || 0).toLocaleString()}</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${pct(m)}%`, background: colorPorPct(pct(m)) }} />
                </div>
              </div>

              {aportarId === m.id ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="modal-input" type="number" value={aporte} onChange={e => setAporte(e.target.value)} autoFocus />
                  <button className="meta-btn primary" onClick={confirmarAporte}>OK</button>
                  <button className="meta-btn" onClick={() => { setAportarId(null); setAporte(""); }}><TbX size={16} /></button>
                </div>
              ) : (
                <div className="meta-actions">
                  {m.estado !== "Lograda" && (
                    <button className="meta-btn primary" onClick={() => setAportarId(m.id)}><TbPigMoney size={16} /> Aportar</button>
                  )}
                  <button className="meta-btn" onClick={() => eliminarMeta(m.id)}><TbTrash size={16} /> Eliminar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-title">Nueva meta de ahorro</div>
            <div className="modal-field">
              <label className="modal-label">Nombre</label>
              <input className="modal-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
            </div>
            <div className="modal-field">
              <label className="modal-label">Monto objetivo</label>
              <input className="modal-input" type="number" value={form.meta} onChange={e => setForm(f => ({ ...f, meta: e.target.value }))} />
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