import "../styles/dashboard.css";
import { useState, useEffect, useCallback } from "react";
import { TbPlus, TbTrash, TbDownload } from "react-icons/tb";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import PageLoader from "../components/Skeleton";

export default function Dashboard() {
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [tarjetas, setTarjetas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tarjetaActiva, setTarjetaActiva] = useState(localStorage.getItem("tarjeta_preferida") || "");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const hoy = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    tipo: "gasto",
    monto: "",
    descripcion: "",
    id_tarjeta: "",
    id_categoria: "",
    fecha: hoy,
  });

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${session.access_token}` }),
    [session]
  );

  const cargarTarjetas = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/tarjetas`, { headers: authHeaders() });
      const json = await res.json();
      setTarjetas(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error("Error cargando tarjetas:", err);
    }
  }, [authHeaders]);

  const cargarCategorias = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/categorias`, { headers: authHeaders() });
      const json = await res.json();
      setCategorias(Array.isArray(json) ? json : []);
    } catch (err) {
      console.error("Error cargando categorías:", err);
    }
  }, [authHeaders]);

  const cargarDashboard = useCallback(async () => {
    setLoading(true);
    const url = tarjetaActiva ? `${backendUrl}/api/dashboard?tarjetaId=${tarjetaActiva}` : "/api/dashboard";
    try {
      const res = await fetch(url, { headers: authHeaders() });
      const json = await res.json();
      if (!json.error) setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [tarjetaActiva, authHeaders]);

  useEffect(() => {
    if (!session) return;
    cargarTarjetas();
    cargarCategorias();
  }, [session, cargarTarjetas, cargarCategorias]);

  useEffect(() => {
    if (!session) return;
    cargarDashboard();
  }, [session, tarjetaActiva, cargarDashboard]);

  const handleChangeTarjeta = (e) => {
    const id = e.target.value;
    setTarjetaActiva(id);
    if (id) localStorage.setItem("tarjeta_preferida", id);
    else localStorage.removeItem("tarjeta_preferida");
  };

  const abrirModal = () => {
    setForm(f => ({
      ...f,
      monto: "",
      descripcion: "",
      id_tarjeta: tarjetaActiva || (tarjetas[0]?.id_tarjeta ?? ""),
      id_categoria: "",
      fecha: hoy,
    }));
    setModal(true);
  };

  const guardarMovimiento = async () => {
    const monto = parseFloat(form.monto);
    if (!monto || monto <= 0) return toast.error("Monto debe ser positivo");
    if (!form.descripcion.trim()) return toast.error("Descripción requerida");
    if (!form.id_tarjeta) return toast.error("Selecciona una tarjeta");
    setSaving(true);
    try {
      const res = await fetch(`${backendUrl}/api/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          tipo: form.tipo,
          monto,
          descripcion: form.descripcion.trim(),
          id_tarjeta: form.id_tarjeta,
          id_categoria: form.id_categoria || null,
          fecha: form.fecha,
        }),
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error);
      toast.success("Movimiento agregado");
      setModal(false);
      await cargarDashboard();
    } catch (err) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const eliminarMovimiento = async (id) => {
    if (!window.confirm("¿Eliminar este movimiento?")) return;
    try {
      const res = await fetch(`${backendUrl}/api/movimientos/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const out = await res.json().catch(() => ({}));
        throw new Error(out.error || "Error");
      }
      toast.success("Movimiento eliminado");
      await cargarDashboard();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const exportarCsv = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/movimientos/export`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `movimientos_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const categoriasDelTipo = categorias.filter(c =>
    form.tipo === "ingreso"
      ? String(c.tipo || "").toLowerCase() === "ingreso"
      : String(c.tipo || "").toLowerCase() !== "ingreso"
  );

  if (loading && !data) return <PageLoader />;
  if (!data) return <div className="page-body">Error al cargar datos.</div>;

  return (
    <main className="page-body">
      <div className="page-header">
        <div className="page-welcome">Bienvenido, {data.nombreUsuario}</div>
        <div className="page-breadcrumb">
          Dashboard ›
          <select className="breadcrumb-select" value={tarjetaActiva} onChange={handleChangeTarjeta}>
            <option value="">Vista General (Global)</option>
            {tarjetas.map(t => (
              <option key={t.id_tarjeta} value={t.id_tarjeta}>{t.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="cards-row-3">
        <div className="stat-card">
          <div className="stat-card-label">Saldo Neto</div>
          <div className="stat-card-value">
            ${(data.totales?.saldo || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub"><span className="dot" style={{ background: "#FFA400" }} /> MXN</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Ingresos</div>
          <div className="stat-card-value green">
            +${(data.totales?.ingresos || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub"><span className="dot" style={{ background: "#6CC04A" }} /> Entradas</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">Gastos</div>
          <div className="stat-card-value red">
            -${(data.totales?.gastos || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
          </div>
          <div className="stat-card-sub"><span className="dot" style={{ background: "#EB0029" }} /> Salidas</div>
        </div>
      </div>

      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Movimientos Recientes</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="modal-btn" onClick={exportarCsv} title="Exportar CSV">
            <TbDownload size={16} style={{ verticalAlign: "middle" }} /> CSV
          </button>
          <button className="modal-btn confirm" onClick={abrirModal}>
            <TbPlus size={16} style={{ verticalAlign: "middle" }} /> Agregar
          </button>
        </div>
      </div>

      <div className="movimientos-card">
        <table className="mov-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Monto</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.movimientos.map((mov) => (
              <tr key={mov.id}>
                <td>{new Date(mov.fecha).toLocaleDateString()}</td>
                <td>{mov.descripcion}</td>
                <td><span className="categoria-pill">{mov.categoria?.nombre || "General"}</span></td>
                <td className={mov.tipo?.toLowerCase() === "gasto" ? "monto-neg" : "monto-pos"}>
                  {mov.tipo?.toLowerCase() === "gasto" ? "-" : "+"}${Math.abs(mov.monto).toFixed(2)}
                </td>
                <td>
                  <button className="meta-btn" onClick={() => eliminarMovimiento(mov.id)} title="Eliminar">
                    <TbTrash size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {data.movimientos.length === 0 && (
              <tr><td colSpan="5" style={{ padding: 24, textAlign: "center", color: "#888" }}>Sin movimientos todavía.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-title">Nuevo movimiento</div>

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
              <label className="modal-label">Monto (MXN)</label>
              <input
                className="modal-input"
                type="number"
                min="0.01"
                step="0.01"
                value={form.monto}
                onChange={e => setForm(f => ({ ...f, monto: e.target.value }))}
              />
            </div>

            <div className="modal-field">
              <label className="modal-label">Descripción</label>
              <input
                className="modal-input"
                value={form.descripcion}
                onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej. Supermercado"
              />
            </div>

            <div className="modal-field">
              <label className="modal-label">Tarjeta</label>
              <select
                className="modal-input"
                value={form.id_tarjeta}
                onChange={e => setForm(f => ({ ...f, id_tarjeta: e.target.value }))}
              >
                <option value="">Selecciona una tarjeta</option>
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
                {categoriasDelTipo.map(c => (
                  <option key={c.id_categoria} value={c.id_categoria}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="modal-field">
              <label className="modal-label">Fecha</label>
              <input
                className="modal-input"
                type="date"
                value={form.fecha}
                onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
              />
            </div>

            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setModal(false)}>Cancelar</button>
              <button className="modal-btn confirm" onClick={guardarMovimiento} disabled={saving}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
