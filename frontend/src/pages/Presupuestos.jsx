import { useState, useEffect, useCallback } from "react";
import { TbPlus, TbTrash } from "react-icons/tb";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import PageLoader from "../components/Skeleton";
import "../styles/metasahorro.css";
import { BACKEND_URL } from "../config";

const colorPct = (p) => (p >= 100 ? "#EB0029" : p >= 80 ? "#FFA400" : "#6CC04A");

export default function Presupuestos() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ id_categoria: "", monto: "" });
  const [saving, setSaving] = useState(false);

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${session.access_token}` }), [session]);

  const cargar = useCallback(async () => {
    try {
      const [resP, resC] = await Promise.all([
        fetch(`${BACKEND_URL}/api/presupuestos`, { headers: authHeaders() }),
        fetch(`${BACKEND_URL}/api/categorias?tipo=Gasto`, { headers: authHeaders() }),
      ]);
      const pData = await resP.json();
      const cData = await resC.json();
      setItems(Array.isArray(pData) ? pData : []);
      setCategorias(Array.isArray(cData) ? cData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (session) cargar();
  }, [session, cargar]);

  useEffect(() => {
    items.forEach(i => {
      if (i.excedido) toast.error(`Presupuesto excedido en ${i.categoria}`, { id: `pres-${i.id_presupuesto}` });
      else if (i.pct >= 80) toast(`Vas al ${i.pct}% en ${i.categoria}`, { id: `pres-${i.id_presupuesto}`, icon: "⚠️" });
    });
  }, [items]);

  const guardar = async () => {
    if (!form.id_categoria) return toast.error("Selecciona una categoría");
    const m = parseFloat(form.monto);
    if (!m || m <= 0) return toast.error("Monto inválido");
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/presupuestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id_categoria: form.id_categoria, monto: m }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error);
      toast.success("Presupuesto guardado");
      setForm({ id_categoria: "", monto: "" });
      setModal(false);
      cargar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar presupuesto?")) return;
    const res = await fetch(`${BACKEND_URL}/api/presupuestos/${id}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) cargar();
  };

  if (loading) return <PageLoader />;

  return (
    <main className="page-body">
      <div className="page-header-row">
        <div className="page-breadcrumb">Presupuestos › <strong>Mensual</strong></div>
        <button className="btn-nueva-meta" onClick={() => setModal(true)}>
          <TbPlus size={18} /> Nuevo presupuesto
        </button>
      </div>

      {items.length === 0 && (
        <p style={{ padding: 20, color: "#666" }}>
          Aún no defines presupuestos. Crea uno para cada categoría que quieras controlar.
        </p>
      )}

      <div className="metas-grid">
        {items.map(i => (
          <div className="meta-card" key={i.id_presupuesto}>
            <div className="meta-card-accent" style={{ background: colorPct(i.pct) }} />
            <div className="meta-top">
              <div>
                <div className="meta-name">{i.categoria}</div>
                <div className="meta-fecha">Este mes</div>
              </div>
              <span className={`meta-badge ${i.excedido ? "badge-lograda" : "badge-activa"}`}>
                {i.pct}%
              </span>
            </div>
            <div className="meta-progress-wrap">
              <div className="meta-montos">
                <span><strong>${i.gastado.toLocaleString()}</strong> gastados</span>
                <span>Tope: ${i.monto.toLocaleString()}</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${Math.min(100, i.pct)}%`, background: colorPct(i.pct) }} />
              </div>
            </div>
            <div className="meta-actions">
              <button className="meta-btn" onClick={() => eliminar(i.id_presupuesto)}>
                <TbTrash size={16} /> Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-title">Nuevo presupuesto mensual</div>
            <div className="modal-field">
              <label className="modal-label">Categoría</label>
              <select
                className="modal-input"
                value={form.id_categoria}
                onChange={e => setForm(f => ({ ...f, id_categoria: e.target.value }))}
              >
                <option value="">Selecciona</option>
                {categorias.map(c => (
                  <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label className="modal-label">Tope mensual (MXN)</label>
              <input
                className="modal-input"
                type="number"
                min="1"
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
              />
            </div>
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setModal(false)}>Cancelar</button>
              <button className="modal-btn confirm" onClick={guardar} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
