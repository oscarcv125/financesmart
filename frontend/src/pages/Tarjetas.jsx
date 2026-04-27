import { useState, useEffect } from "react";
import { TbPlus, TbPencil, TbTrash, TbCheck, TbX } from "react-icons/tb";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import PageLoader from "../components/Skeleton";
import "../styles/tarjetas.css";
import { BACKEND_URL } from "../config";
const API_TARJETAS = `${BACKEND_URL}/api/tarjetas/`;
const API_DASHBOARD = `${BACKEND_URL}/api/dashboard/`;

export default function Tarjetas() {
  const { session } = useAuth();
  const [tarjetas, setTarjetas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [activo, setActivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nombre: "", tipo: "Débito" });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");

  const authHeaders = () => ({ Authorization: `Bearer ${session.access_token}` });

  const cargarTarjetas = async () => {
    try {
      const res = await fetch(API_TARJETAS, { headers: authHeaders() });
      const data = await res.json();
      const procesadas = (Array.isArray(data) ? data : []).map(t => ({
        id: t.id_tarjeta,
        nombre: t.nombre,
        numero: "**** " + t.id_tarjeta,
        tipo: t.tipo,
        logoClass: t.tipo === "Crédito" ? "logo-credito" : "logo-debito",
        saldo: (t.movimiento_financiero || []).reduce((acc, m) => acc + Number(m.monto), 0),
      }));
      setTarjetas(procesadas);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!session) return;
    (async () => {
      await cargarTarjetas();
      await cargarSoloResumen(null);
      setLoading(false);
    })();
  }, [session]);

  const cargarSoloResumen = async (idTarjeta) => {
    if (!session) return;
    const url = idTarjeta ? `${API_DASHBOARD}?tarjetaId=${idTarjeta}` : API_DASHBOARD;
    const res = await fetch(url, { headers: authHeaders() });
    const data = await res.json();
    setResumen(data);
  };

  const manejarSeleccion = (id) => {
    if (editId !== null) return;
    const nuevoActivo = activo === id ? null : id;
    setActivo(nuevoActivo);
    if (nuevoActivo) localStorage.setItem("tarjeta_preferida", nuevoActivo);
    else localStorage.removeItem("tarjeta_preferida");
    cargarSoloResumen(nuevoActivo);
  };

  const crearTarjeta = async () => {
    if (!form.nombre.trim()) return toast.error("Ingresa un nombre");
    setSaving(true);
    try {
      const res = await fetch(API_TARJETAS, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ nombre: form.nombre.trim(), tipo: form.tipo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Tarjeta creada");
      setModal(false);
      setForm({ nombre: "", tipo: "Débito" });
      await cargarTarjetas();
    } catch (err) {
      toast.error(err.message || "Error al crear la tarjeta");
    } finally {
      setSaving(false);
    }
  };

  const guardarRename = async (id) => {
    const nuevo = editName.trim();
    if (!nuevo) return toast.error("El nombre no puede estar vacío");
    try {
      const res = await fetch(`${API_TARJETAS}${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ nombre: nuevo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEditId(null);
      setEditName("");
      await cargarTarjetas();
    } catch (err) {
      toast.error(err.message || "Error al renombrar");
    }
  };

  const eliminarTarjeta = async (id) => {
    if (!window.confirm("¿Eliminar esta tarjeta?")) return;
    try {
      const res = await fetch(`${API_TARJETAS}${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Error");
      if (String(activo) === String(id)) {
        setActivo(null);
        localStorage.removeItem("tarjeta_preferida");
      }
      toast.success("Tarjeta eliminada");
      await cargarTarjetas();
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <main className="page-body">
      <div className="page-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="page-breadcrumb">Cuentas y Tarjetas › <strong>Mis Cuentas</strong></div>
        <button className="btn-nueva-meta" onClick={() => setModal(true)}>
          <TbPlus size={18} /> Nueva tarjeta
        </button>
      </div>

      <div className="items-list">
        {tarjetas.map(t => (
          <div key={t.id} className={`item-card ${activo === t.id ? "active" : ""}`} onClick={() => manejarSeleccion(t.id)}>
            <div className={`item-logo ${t.logoClass}`}>BN</div>
            <div className="item-info">
              {editId === t.id ? (
                <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                  <input
                    className="modal-input"
                    value={editName}
                    autoFocus
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && guardarRename(t.id)}
                  />
                  <button className="meta-btn primary" onClick={() => guardarRename(t.id)}><TbCheck size={14} /></button>
                  <button className="meta-btn" onClick={() => { setEditId(null); setEditName(""); }}><TbX size={14} /></button>
                </div>
              ) : (
                <>
                  <div className="item-name">{t.nombre}</div>
                  <div className="item-numero">{t.numero} · {t.tipo}</div>
                </>
              )}
            </div>
            <div className="item-right" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <div className="item-saldo-label">Saldo Actual</div>
                <div className="item-saldo-value">${Math.abs(t.saldo).toLocaleString()}</div>
              </div>
              {editId !== t.id && (
                <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button className="meta-btn" onClick={() => { setEditId(t.id); setEditName(t.nombre); }}><TbPencil size={14} /></button>
                  <button className="meta-btn" onClick={() => eliminarTarjeta(t.id)}><TbTrash size={14} /></button>
                </div>
              )}
            </div>
          </div>
        ))}
        {tarjetas.length === 0 && (
          <p style={{ padding: 20, color: "#666" }}>Aún no tienes tarjetas. Crea una con el botón "Nueva tarjeta".</p>
        )}
      </div>

      {resumen && (
        <div className="resumen-container" style={{ marginTop: "20px" }}>
          <div className="section-title">Resumen de {activo ? "Cuenta" : "Efectivo Total"}</div>
          <div className="resumen-row" style={{ display: "flex", gap: "15px" }}>
            <div className="resumen-card">
              <div className="resumen-label">Ingresos Totales</div>
              <div className="resumen-value" style={{ color: "#6CC04A" }}>+${(resumen.totales?.ingresos || 0).toLocaleString()}</div>
            </div>
            <div className="resumen-card">
              <div className="resumen-label">Gastos Totales</div>
              <div className="resumen-value" style={{ color: "#EB0029" }}>-${(resumen.totales?.gastos || 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-title">Nueva tarjeta</div>
            <div className="modal-field">
              <label className="modal-label">Nombre</label>
              <input
                className="modal-input"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. Nómina Banorte"
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Tipo</label>
              <select
                className="modal-input"
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              >
                <option value="Débito">Débito</option>
                <option value="Crédito">Crédito</option>
              </select>
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setModal(false)}>Cancelar</button>
              <button className="modal-btn confirm" onClick={crearTarjeta} disabled={saving}>
                {saving ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
