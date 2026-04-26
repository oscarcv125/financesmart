import { useState, useEffect, useCallback } from "react";
import { TbPlus, TbTrash, TbToggleRight, TbToggleLeft } from "react-icons/tb";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import PageLoader from "../components/Skeleton";
import "../styles/metasahorro.css";
import { BACKEND_URL } from "../config";
export default function Recurrencias() {
  const { session } = useAuth();
  const [items, setItems] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tipo: "gasto",
    descripcion: "",
    monto: "",
    id_tarjeta: "",
    id_categoria: "",
    dia_del_mes: 1,
    fecha_inicio: new Date().toISOString().split("T")[0],
  });

  const authHeaders = useCallback(() => ({ Authorization: `Bearer ${session.access_token}` }), [session]);

  const cargar = useCallback(async () => {
    try {
      const [resR, resT, resC] = await Promise.all([
        fetch(`${BACKEND_URL}/api/recurrencias`, { headers: authHeaders() }),
        fetch(`${BACKEND_URL}/api/tarjetas/`, { headers: authHeaders() }),
        fetch(`${BACKEND_URL}/api/categorias`, { headers: authHeaders() }),
      ]);
      const rData = await resR.json();
      const tData = await resT.json();
      const cData = await resC.json();
      setItems(Array.isArray(rData) ? rData : []);
      setTarjetas(Array.isArray(tData) ? tData : []);
      setCategorias(Array.isArray(cData) ? cData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => { if (session) cargar(); }, [session, cargar]);

  const guardar = async () => {
    const m = parseFloat(form.monto);
    if (!m || m <= 0) return toast.error("Monto inválido");
    if (!form.descripcion.trim()) return toast.error("Descripción requerida");
    if (!form.id_tarjeta) return toast.error("Selecciona tarjeta");
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/recurrencias`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          ...form,
          monto: m,
          id_categoria: form.id_categoria || null,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error);
      toast.success("Recurrencia creada");
      setModal(false);
      setForm(f => ({ ...f, descripcion: "", monto: "" }));
      cargar();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActivo = async (r) => {
    const res = await fetch(`${BACKEND_URL}/api/recurrencias/${r.id_recurrencia}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ activo: !r.activo }),
    });
    if (res.ok) cargar();
  };

  const eliminar = async (id) => {
    if (!window.confirm("¿Eliminar recurrencia?")) return;
    const res = await fetch(`${BACKEND_URL}/api/recurrencias/${id}`, { method: "DELETE", headers: authHeaders() });
    if (res.ok) cargar();
  };

  const catsDelTipo = categorias.filter(c =>
    form.tipo === "ingreso"
      ? String(c.tipo || "").toLowerCase() === "ingreso"
      : String(c.tipo || "").toLowerCase() !== "ingreso"
  );

  if (loading) return <PageLoader />;

  return (
    <main className="page-body">
      <div className="page-header-row">
        <div className="page-breadcrumb">Transacciones Recurrentes › <strong>Mis reglas</strong></div>
        <button className="btn-nueva-meta" onClick={() => setModal(true)}>
          <TbPlus size={18} /> Nueva recurrencia
        </button>
      </div>

      {items.length === 0 && (
        <p style={{ padding: 20, color: "#666" }}>
          Crea una recurrencia para registrar automáticamente salarios, rentas, suscripciones, etc.
        </p>
      )}

      <div className="metas-grid">
        {items.map(r => (
          <div className="meta-card" key={r.id_recurrencia}>
            <div className="meta-card-accent" style={{ background: r.tipo === "ingreso" ? "#6CC04A" : "#EB0029" }} />
            <div className="meta-top">
              <div>
                <div className="meta-name">{r.descripcion}</div>
                <div className="meta-fecha">
                  Día {r.dia_del_mes} · {r.tarjeta?.nombre} · {r.categoria?.nombre || "Sin categoría"}
                </div>
              </div>
              <span className={`meta-badge ${r.activo ? "badge-activa" : "badge-lograda"}`}>
                {r.activo ? "Activa" : "Pausada"}
              </span>
            </div>
            <div className="meta-progress-wrap">
              <div className="meta-montos">
                <span>
                  <strong>{r.tipo === "ingreso" ? "+" : "-"}${Number(r.monto).toLocaleString()}</strong>
                </span>
                <span>{r.ultima_ejecucion ? `Última: ${r.ultima_ejecucion}` : "Sin ejecutar"}</span>
              </div>
            </div>
            <div className="meta-actions">
              <button className="meta-btn primary" onClick={() => toggleActivo(r)}>
                {r.activo ? <TbToggleRight size={16} /> : <TbToggleLeft size={16} />}
                {r.activo ? " Pausar" : " Activar"}
              </button>
              <button className="meta-btn" onClick={() => eliminar(r.id_recurrencia)}>
                <TbTrash size={16} /> Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-title">Nueva recurrencia</div>

            <div className="modal-field">
              <label className="modal-label">Tipo</label>
              <select
                className="modal-input"
                value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value, id_categoria: "" }))}
              >
                <option value="gasto">Gasto</option>
                <option value="ingreso">Ingreso</option>
              </select>
            </div>

            <div className="modal-field">
              <label className="modal-label">Descripción</label>
              <input
                className="modal-input"
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej. Netflix, Renta, Nómina"
              />
            </div>

            <div className="modal-field">
              <label className="modal-label">Monto (MXN)</label>
              <input
                className="modal-input"
                type="number"
                min="1"
                step="0.01"
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
              />
            </div>

            <div className="modal-field">
              <label className="modal-label">Tarjeta</label>
              <select
                className="modal-input"
                value={form.id_tarjeta}
                onChange={e => setForm(f => ({ ...f, id_tarjeta: e.target.value }))}
              >
                <option value="">Selecciona</option>
                {tarjetas.map(t => (
                  <option key={t.id_tarjeta} value={t.id_tarjeta}>{t.nombre}</option>
                ))}
              </select>
            </div>

            <div className="modal-field">
              <label className="modal-label">Categoría</label>
              <select
                className="modal-input"
                value={form.id_categoria}
                onChange={e => setForm(f => ({ ...f, id_categoria: e.target.value }))}
              >
                <option value="">Sin categoría</option>
                {catsDelTipo.map(c => (
                  <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="modal-field">
              <label className="modal-label">Día del mes (1-28)</label>
              <input
                className="modal-input"
                type="number"
                min="1"
                max="28"
                value={form.dia_del_mes}
                onChange={e => setForm(f => ({ ...f, dia_del_mes: parseInt(e.target.value, 10) || 1 }))}
              />
            </div>

            <div className="modal-field">
              <label className="modal-label">Empezar desde</label>
              <input
                className="modal-input"
                type="date"
                value={form.fecha_inicio}
                onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))}
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
