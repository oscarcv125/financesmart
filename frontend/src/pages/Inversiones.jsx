import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";
import PageLoader from "../components/Skeleton";
import "../styles/inversiones.css";

export default function Inversiones() {
  const { session } = useAuth();
  const [inversiones, setInversiones] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortDir, setSortDir] = useState("asc");
  const [dropOpen, setDropOpen] = useState(false);
  const [modalInv, setModalInv] = useState(null);
  const [montoInv, setMontoInv] = useState("");
  const [tarjetaInv, setTarjetaInv] = useState("");
  const [comprando, setComprando] = useState(false);

  useEffect(() => {
    if (!session) return;
    Promise.all([
      fetch(`${backendUrl}/api/inversion/lista`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.json()),
      fetch(`${backendUrl}/api/tarjetas/`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.json()),
    ])
      .then(([invData, tarjData]) => {
        setInversiones(Array.isArray(invData) ? invData : []);
        setTarjetas(Array.isArray(tarjData) ? tarjData : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error al cargar:", err);
        setLoading(false);
      });
  }, [session]);

  const sorted = [...inversiones].sort((a, b) =>
    sortDir === "asc" ? a.roi - b.roi : b.roi - a.roi
  );

  const abrirModal = (inv) => {
    setModalInv(inv);
    setMontoInv("");
    setTarjetaInv(localStorage.getItem("tarjeta_preferida") || "");
  };

  const confirmarInversion = async () => {
    const monto = parseFloat(montoInv);
    if (isNaN(monto) || monto <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    if (!tarjetaInv) {
      toast.error("Selecciona una tarjeta");
      return;
    }
    setComprando(true);
    try {
      const res = await fetch(`${backendUrl}/api/inversion/comprar`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id_inversion: modalInv.id,
          nombre_inversion: modalInv.nombre,
          monto,
          id_tarjeta: tarjetaInv,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Inversión en ${modalInv.nombre} registrada`);
      setModalInv(null);
    } catch (err) {
      toast.error(err.message || "Error al procesar la inversión");
    } finally {
      setComprando(false);
    }
  };

  if (loading) return <PageLoader />;

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
                  <button className="inv-btn" onClick={() => abrirModal(inv)}>Invertir</button>
                </div>
              </div>
            ))}
          </main>
        </div>
      </div>

      {modalInv && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setModalInv(null)}>
          <div className="modal">
            <div className="modal-title">Invertir en {modalInv.nombre}</div>

            <div style={{ marginBottom: 16, fontSize: 13, color: "#555", lineHeight: 1.6 }}>
              <div>ROI estimado: <strong>{modalInv.roi.toFixed(2)}%</strong></div>
              <div>Plazo: <strong>{modalInv.plazo} días</strong></div>
              <div>Riesgo: <strong>{modalInv.riesgo}</strong></div>
            </div>

            <div className="modal-field">
              <label className="modal-label">Monto a invertir (MXN)</label>
              <input
                className="modal-input"
                type="number"
                min="1"
                placeholder="Ej. 500"
                value={montoInv}
                onChange={(e) => setMontoInv(e.target.value)}
              />
            </div>

            <div className="modal-field">
              <label className="modal-label">Tarjeta</label>
              <select
                className="modal-input"
                value={tarjetaInv}
                onChange={(e) => setTarjetaInv(e.target.value)}
              >
                <option value="">Selecciona una tarjeta</option>
                {tarjetas.map((t) => (
                  <option key={t.id_tarjeta} value={t.id_tarjeta}>{t.nombre}</option>
                ))}
              </select>
            </div>

            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setModalInv(null)}>Cancelar</button>
              <button className="modal-btn confirm" onClick={confirmarInversion} disabled={comprando}>
                {comprando ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
