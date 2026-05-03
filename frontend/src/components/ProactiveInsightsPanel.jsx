import { useEffect, useState, useCallback } from "react";
import { TbAlertCircle, TbBulb, TbRefresh, TbX } from "react-icons/tb";
import { BACKEND_URL } from "../config";
import { useAuth } from "../context/AuthContext";

const SEVERITY_COLORS = {
  alta: "#cc0000",
  media: "#FFA400",
  baja: "#1976d2",
};

const DISMISS_KEY_PREFIX = "proactive_dismissed_";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dismissKey(titulo) {
  return `${DISMISS_KEY_PREFIX}${todayKey()}_${titulo.replace(/\s+/g, "_").slice(0, 40)}`;
}

export default function ProactiveInsightsPanel() {
  const { session } = useAuth();
  const [observaciones, setObservaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(() => {
    // Pre-populate from localStorage so dismissed cards stay dismissed across reloads.
    const set = new Set();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(DISMISS_KEY_PREFIX)) set.add(k);
      }
    } catch { /* localStorage may be unavailable in privacy mode */ }
    return set;
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    if (!session) return;
    try {
      const url = `${BACKEND_URL}/api/proactive-insights${force ? "?force=true" : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (Array.isArray(data?.observaciones)) setObservaciones(data.observaciones);
    } catch {
      // Silent fail — panel just stays empty.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  function handleDismiss(titulo) {
    const k = dismissKey(titulo);
    localStorage.setItem(k, "1");
    setDismissed(prev => new Set([...prev, k]));
  }

  async function handleRefresh() {
    setRefreshing(true);
    await load(true);
  }

  const visible = observaciones.filter(o => !dismissed.has(dismissKey(o.titulo)));

  if (loading || visible.length === 0) return null;

  return (
    <section className="proactive-insights-panel">
      <div className="proactive-header">
        <span className="proactive-title">
          <TbBulb size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
          Recomendaciones de hoy
        </span>
        <button
          className="proactive-refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Actualizar"
        >
          <TbRefresh size={14} className={refreshing ? "spinning" : ""} />
        </button>
      </div>
      <div className="proactive-cards">
        {visible.map((o) => (
          <article key={o.titulo} className="proactive-card" style={{ borderLeftColor: SEVERITY_COLORS[o.severidad] || "#999" }}>
            <button className="proactive-dismiss" onClick={() => handleDismiss(o.titulo)} title="Descartar">
              <TbX size={12} />
            </button>
            <div className="proactive-card-title">
              <TbAlertCircle size={14} style={{ marginRight: 6, color: SEVERITY_COLORS[o.severidad] }} />
              {o.titulo}
            </div>
            <div className="proactive-card-detail">{o.detalle}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
