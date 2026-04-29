import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import { TbRobotFace, TbSettings, TbBulb, TbChartBar, TbTarget, TbUserCog, TbMaximize, TbMinimize, TbPigMoney, TbAlertCircle, TbTrendingUp, TbTarget as TbGoal, TbGauge } from "react-icons/tb";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import "../styles/chatbot.css";
import { BACKEND_URL } from "../config";


const CHART_PALETTE = ["#cc0000", "#2196f3", "#4caf50", "#ff9800", "#9c27b0", "#00bcd4", "#ff5722", "#795548"];

const TW_DEFAULT_INTERVAL_MS = 18;
const TW_DEFAULT_BASE_STEP = 2;

const emojiToIcon = (emoji) => {
  const iconMap = {
    "⚠️": <TbAlertCircle size={18} color="#FFA400" />,
    "🚨": <TbAlertCircle size={18} color="#EB0029" />,
    "📈": <TbTrendingUp size={18} color="#6CC04A" />,
    "🎯": <TbGoal size={18} color="#cc0000" />,
    "⚡": <TbGauge size={18} color="#1976d2" />,
  };
  return iconMap[emoji] || emoji;
};

function fmtMXN(v) {
  return `$${Number(v).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function computeSimulatorOutput(type, values, params, meta) {
  const get = (i) => Number(values[params[i]?.key] ?? 0);
  switch (type) {
    case "savings_daily": {
      const total = get(0) * get(1);
      return { primary: { label: "Total ahorrado", value: total } };
    }
    case "category_reduction": {
      const total = get(0) * (get(1) / 100) * get(2);
      return { primary: { label: "Total ahorrado", value: total } };
    }
    case "goal_acceleration": {
      if (!meta || !meta.target) return { primary: { label: "Meses para completar", value: 0 } };
      const faltante = Math.max(0, meta.target - (meta.progress || 0));
      const monthly = get(0);
      const months = monthly > 0 ? Math.ceil(faltante / monthly) : Infinity;
      return {
        primary: {
          label: "Meses para completar",
          value: Number.isFinite(months) ? months : 0,
          unit: Number.isFinite(months) ? "meses" : "—",
        },
      };
    }
    case "compound_savings": {
      const monthly = get(0);
      const years = get(1);
      const annualRate = get(2);
      const months = years * 12;
      const monthlyRate = annualRate / 100 / 12;
      let total = 0;
      if (monthlyRate > 0) {
        total = monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
      } else {
        total = monthly * months;
      }
      const contributed = monthly * months;
      const interest = total - contributed;

      // Build a yearly chart series for visualization
      const chartData = [];
      const stepYears = Math.max(1, Math.round(years / 12));
      for (let y = 0; y <= years; y += stepYears) {
        const m = y * 12;
        let v = monthlyRate > 0
          ? monthly * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate)
          : monthly * m;
        chartData.push({ name: `${y}a`, value: Math.round(v) });
      }
      if (chartData[chartData.length - 1].name !== `${years}a`) {
        chartData.push({ name: `${years}a`, value: Math.round(total) });
      }

      return {
        primary: { label: "Monto final", value: total },
        secondary: [
          { label: "Aportado", value: contributed },
          { label: "Intereses", value: interest },
        ],
        chart: chartData,
      };
    }
    default:
      return { primary: { label: "—", value: 0 } };
  }
}

function InlineInsights({ insights }) {
  const [showModal, setShowModal] = useState(false);
  if (!insights || !insights.length) return null;
  return (
    <>
      <button
        className="insights-badge"
        onClick={() => setShowModal(true)}
        title={`${insights.length} detección${insights.length !== 1 ? "es" : ""}`}
        type="button"
      >
        <TbBulb size={14} style={{ marginRight: 4 }} /> {insights.length}
      </button>
      {showModal && (
        <div className="insights-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="insights-modal" onClick={(e) => e.stopPropagation()}>
            <div className="insights-modal-header">
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}><TbBulb size={16} /> Detecciones ({insights.length})</span>
              <button
                className="insights-modal-close"
                onClick={() => setShowModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="insights-modal-body">
              {insights.map((ins, i) => (
                <div key={i} className={`insight-row sev-${ins.severity}`}>
                  <span className="insight-icon">{emojiToIcon(ins.icon)}</span>
                  <div className="insight-body">
                    <div className="insight-title">{ins.title}</div>
                    <div className="insight-detail">{ins.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function InlineSubscriptionAudit({ audit }) {
  if (!audit || !audit.items?.length) return null;
  const { items, totalMonthly, totalAnnual } = audit;
  return (
    <div className="inline-audit">
      <p className="chart-title">Auditoría de suscripciones</p>
      <div className="audit-totals">
        <div className="audit-total">
          <span className="audit-total-label">Mensual</span>
          <span className="audit-total-value">{fmtMXN(totalMonthly)}</span>
        </div>
        <div className="audit-total">
          <span className="audit-total-label">Anual</span>
          <span className="audit-total-value strong">{fmtMXN(totalAnnual)}</span>
        </div>
      </div>
      <div className="audit-list">
        {items.map((it, i) => (
          <div key={i} className="audit-row">
            <div className="audit-desc">{it.descripcion}</div>
            <div className="audit-monthly">{fmtMXN(it.monthly)}/mes</div>
            <div className="audit-annual">{fmtMXN(it.annual)}/año</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InlineStreak({ streak }) {
  if (!streak) return null;
  const { label, current, unit = "días", best, icon, context } = streak;
  return (
    <div className="inline-streak">
      <div className="streak-left">
        <div className="streak-icon">{icon || "🔥"}</div>
        <div className="streak-value-block">
          <div className="streak-value">{current}</div>
          <div className="streak-unit">{unit}</div>
        </div>
      </div>
      <div className="streak-body">
        <div className="streak-label">{label}</div>
        {context ? (
          <div className="streak-context">{context}</div>
        ) : best !== undefined ? (
          <div className="streak-context">Récord: {best} {unit}</div>
        ) : null}
      </div>
    </div>
  );
}

function InlineCompare({ compare }) {
  if (!compare) return null;
  const { title, leftLabel, rightLabel, rows } = compare;
  return (
    <div className="inline-compare">
      <p className="chart-title">{title}</p>
      <div className="compare-header">
        <div className="compare-spacer" />
        <div className="compare-col-label">{leftLabel}</div>
        <div className="compare-col-label">{rightLabel}</div>
        <div className="compare-delta-label">Δ</div>
      </div>
      {rows.map((r, i) => {
        const diff = r.right - r.left;
        const pct = r.left !== 0 ? (diff / Math.abs(r.left)) * 100 : 0;
        const positive = diff >= 0;
        return (
          <div key={i} className="compare-row">
            <div className="compare-row-label">{r.label}</div>
            <div className="compare-cell">{fmtMXN(r.left)}</div>
            <div className="compare-cell strong">{fmtMXN(r.right)}</div>
            <div className={`compare-delta ${positive ? "up" : "down"}`}>
              {positive ? "▲" : "▼"} {Math.abs(pct).toFixed(0)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

function InlineSimulator({ simulator }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(simulator.params.map((p) => [p.key, p.value]))
  );

  const { type, title, params, meta } = simulator;
  const output = computeSimulatorOutput(type, values, params, meta);
  const isMoney = type !== "goal_acceleration";

  let metaImpact = null;
  if (meta && type !== "goal_acceleration") {
    const before = meta.target > 0 ? Math.min(100, Math.round((meta.progress / meta.target) * 100)) : 0;
    const after = meta.target > 0 ? Math.min(100, Math.round(((meta.progress + output.primary.value) / meta.target) * 100)) : 0;
    metaImpact = { name: meta.name, before, after };
  }

  return (
    <div className="inline-sim">
      <p className="sim-title">{title}</p>
      {params.map((p) => (
        <div key={p.key} className="sim-param">
          <div className="sim-param-row">
            <span className="sim-param-label">{p.label}</span>
            <span className="sim-param-value">
              {p.unit === "MXN" ? fmtMXN(values[p.key]) : values[p.key]}
              {p.unit && p.unit !== "MXN" ? ` ${p.unit}` : ""}
            </span>
          </div>
          <input
            type="range"
            min={p.min}
            max={p.max}
            step={p.step}
            value={values[p.key]}
            onChange={(e) =>
              setValues((v) => ({ ...v, [p.key]: Number(e.target.value) }))
            }
          />
        </div>
      ))}
      <div className="sim-output">
        <div className="sim-output-label">{output.primary.label}</div>
        <div className="sim-output-value">
          {isMoney
            ? fmtMXN(output.primary.value)
            : `${output.primary.value} ${output.primary.unit || ""}`.trim()}
        </div>
        {output.secondary && (
          <div className="sim-secondary">
            {output.secondary.map((s, i) => (
              <div key={i} className="sim-secondary-row">
                <span className="sim-secondary-label">{s.label}</span>
                <span className="sim-secondary-value">{fmtMXN(s.value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {output.chart && output.chart.length > 1 && (
        <div className="sim-chart">
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={output.chart} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} width={42}
                tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
              <Tooltip formatter={(v) => fmtMXN(v)} />
              <Line type="monotone" dataKey="value" stroke="#cc0000" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {metaImpact && (
        <div className="sim-meta">
          <div className="sim-meta-label">{metaImpact.name}</div>
          <div className="sim-meta-bar">
            <div className="sim-meta-bar-before" style={{ width: `${metaImpact.before}%` }} />
            <div
              className="sim-meta-bar-delta"
              style={{
                left: `${metaImpact.before}%`,
                width: `${Math.max(0, metaImpact.after - metaImpact.before)}%`,
              }}
            />
          </div>
          <div className="sim-meta-pct">
            {metaImpact.before}% → <strong>{metaImpact.after}%</strong>
          </div>
        </div>
      )}
    </div>
  );
}

function InlineChart({ chart }) {
  if (!chart) return null;
  const { type, title, data } = chart;

  if (type === "pie") {
    return (
      <div className="inline-chart">
        <p className="chart-title">{title}</p>
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={74} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => fmtMXN(v)} />
            <Legend iconSize={9} wrapperStyle={{ fontSize: "10px" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "bar") {
    const hasSecond = data.some(d => d.value2 !== undefined);
    return (
      <div className="inline-chart">
        <p className="chart-title">{title}</p>
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 28, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 9 }} width={42}
              tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
            <Tooltip formatter={(v) => fmtMXN(v)} />
            {hasSecond && <Legend iconSize={9} wrapperStyle={{ fontSize: "10px" }} />}
            <Bar dataKey="value" name="Este mes" fill="#cc0000" radius={[3, 3, 0, 0]} />
            {hasSecond && <Bar dataKey="value2" name="Mes anterior" fill="#bbb" radius={[3, 3, 0, 0]} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "line") {
    const reference = chart.reference;
    return (
      <div className="inline-chart">
        <p className="chart-title">{title}</p>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 28, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={Math.ceil(data.length / 8)} />
            <YAxis tick={{ fontSize: 9 }} width={42}
              tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
            <Tooltip formatter={(v) => fmtMXN(v)} />
            {reference && typeof reference.value === "number" && (
              <ReferenceLine y={reference.value} stroke="#999" strokeDasharray="4 4" label={{ value: reference.label || "", fontSize: 9, fill: "#777" }} />
            )}
            <Line type="monotone" dataKey="value" stroke="#cc0000" strokeWidth={2} dot={{ r: 2, fill: "#cc0000" }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}

function MessageContent({ text }) {
  if (!text) return null;

  // Pattern to find any of our tags, with or without opening brackets, allowing for flexible spacing and plural forms like STREAKS
  const pattern = /\[?\s*(CHART|COMPARE|STREAKS?|SIMULATOR|PIE|BAR|LINE)\s*\]?\s*(\{[\s\S]*?\})\s*\[?\s*\/\s*(CHART|COMPARE|STREAKS?|SIMULATOR|PIE|BAR|LINE|CHART)\s*\]?/gi;

  const parts = [];
  let lastIdx = 0;
  let match;

  // Use matchAll to get all occurrences
  const matches = [...text.matchAll(pattern)];
  
  if (matches.length === 0) {
    return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
  }

  for (const m of matches) {
    // Text before the match
    if (m.index > lastIdx) {
      parts.push({ type: "text", content: text.slice(lastIdx, m.index) });
    }

    const tagType = m[1].toUpperCase();
    const jsonStr = m[2];
    
    try {
      const data = JSON.parse(jsonStr);
      // Handle CHART and its specific variants (PIE/BAR/LINE)
      if (["CHART", "PIE", "BAR", "LINE"].includes(tagType)) {
        if (!data.type) {
          if (tagType === "PIE") data.type = "pie";
          else if (tagType === "BAR") data.type = "bar";
          else if (tagType === "LINE") data.type = "line";
          else data.type = "pie"; // fallback
        }
        parts.push({ type: "chart", data });
      } else if (tagType === "COMPARE") {
        parts.push({ type: "compare", data });
      } else if (tagType === "STREAK") {
        parts.push({ type: "streak", data });
      } else if (tagType === "SIMULATOR") {
        parts.push({ type: "simulator", data });
      }
    } catch (e) {
      // If parsing fails, treat it as text
      parts.push({ type: "text", content: m[0] });
    }
    lastIdx = m.index + m[0].length;
  }

  // Remaining text
  if (lastIdx < text.length) {
    parts.push({ type: "text", content: text.slice(lastIdx) });
  }

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === "text") {
          return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>;
        }
        if (part.type === "chart") return <InlineChart key={i} chart={part.data} />;
        if (part.type === "compare") return <InlineCompare key={i} compare={part.data} />;
        if (part.type === "streak") return <InlineStreak key={i} streak={part.data} />;
        if (part.type === "simulator") return <InlineSimulator key={i} simulator={part.data} />;
        return null;
      })}
    </>
  );
}

function ActionChips({ actions, tarjetas, onAportar, onNav }) {
  const [picking, setPicking] = useState(null);
  const [selectedTarjeta, setSelectedTarjeta] = useState("");
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (tarjetas.length > 0) setSelectedTarjeta(String(tarjetas[0].id));
  }, [tarjetas]);

  async function handleChip(action) {
    if (action.type === "nav") {
      onNav(action.path);
      return;
    }
    if (action.type === "aportar") {
      if (tarjetas.length === 1) {
        setExecuting(true);
        await onAportar(action, tarjetas[0].id);
        setExecuting(false);
      } else {
        setPicking(action);
      }
    }
  }

  async function confirmAportar() {
    if (!selectedTarjeta || !picking) return;
    setExecuting(true);
    await onAportar(picking, Number(selectedTarjeta));
    setExecuting(false);
    setPicking(null);
  }

  if (executing) return <div className="action-chips"><span className="action-executing">Procesando...</span></div>;

  if (picking) {
    return (
      <div className="action-chips tarjeta-picker">
        <span className="picker-label">¿Con qué tarjeta?</span>
        <select
          className="picker-select"
          value={selectedTarjeta}
          onChange={(e) => setSelectedTarjeta(e.target.value)}
        >
          {tarjetas.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
        <div className="picker-btns">
          <button className="picker-confirm" onClick={confirmAportar}>Confirmar</button>
          <button className="picker-cancel" onClick={() => setPicking(null)}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="action-chips">
      {actions.map((action, i) => (
        <button key={i} className="action-chip" onClick={() => handleChip(action)}>
          {action.type === "aportar" ? <span style={{ marginRight: 6, display: "inline-flex", alignItems: "center" }}><TbPigMoney size={14} /></span> : "→ "}{action.label}
        </button>
      ))}
    </div>
  );
}

const SCORE_COLORS = {
  green:  '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red:    '#ef4444',
};

const COACH_CHIPS = [
  "¿En qué puedo ahorrar más?",
  "¿Cómo avanzo en mis metas?",
  "Dame un reto para esta semana",
  "¿Qué inversión me conviene?",
];

const ANALYST_CHIPS = [
  "¿Cómo comparo con el mes pasado?",
  "¿Qué presupuesto estoy excediendo?",
  "¿Cuáles son mis gastos recurrentes?",
  "¿Cuál es mi saldo actual?",
];

const buildMsgBienvenida = (nombre, mode) => ({
  role: "bot",
  text: mode === "analyst"
    ? `Hola, ${nombre.split(" ")[0]}. Soy tu Analista Financiero. Analizando tu situación actual...`
    : `¡Hola, ${nombre.split(" ")[0]}! 👋 Soy tu Coach Financiero. Estoy aquí para ayudarte a alcanzar tus metas y mejorar tus hábitos financieros. ¿Por dónde empezamos?`,
});

async function readChatbotStream(res, { onDelta, onDone, onError, signal }) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let sep;
      while ((sep = buf.indexOf("\n\n")) !== -1) {
        const block = buf.slice(0, sep);
        buf = buf.slice(sep + 2);
        for (const line of block.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let evt;
          try { evt = JSON.parse(payload); } catch { continue; }
          if (evt.type === "delta" && evt.text) onDelta?.(evt.text);
          else if (evt.type === "done") onDone?.(evt);
          else if (evt.type === "error") onError?.(evt.error || "Error del servidor");
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* */ }
  }
}

export default function Chatbot() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [nombreUsuario, setNombreUsuario] = useState(null);
  const [userTarjetas, setUserTarjetas] = useState([]);
  const [healthScore, setHealthScore] = useState(null);

  useEffect(() => {
    if (!session) return;
    fetch(`${BACKEND_URL}/api/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.nombre) setNombreUsuario(`${data.nombre} ${data.apellido}`);
      })
      .catch(() => setNombreUsuario("Usuario"));
  }, [session]);

  const fetchHealthScore = useCallback(() => {
    if (!session) return;
    fetch(`${BACKEND_URL}/api/health`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => { if (data.score !== undefined) setHealthScore(data); })
      .catch(() => {});
  }, [session]);

  useEffect(() => { fetchHealthScore(); }, [fetchHealthScore]);

  const [open, setOpen]               = useState(false);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [fullscreen, setFullscreen]   = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [accepted, setAccepted]       = useState(() => localStorage.getItem("chat_disclaimer") === "true");
  const [mode, setMode]               = useState(() => localStorage.getItem("chat_mode") || "coach");
  const [extraMessages, setExtraMessages] = useState(() => { localStorage.removeItem("chat_messages"); return []; });
  const [history, setHistory]         = useState(() => { localStorage.removeItem("chat_history"); return []; });
  const [pos, setPos]                 = useState({ x: null, y: null });
  const [size, setSize]               = useState({ w: 370, h: 520 });
  const [dragging, setDragging]       = useState(false);
  const [resizing, setResizing]       = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, posX: 0, posY: 0 });
  const bottomRef = useRef(null);
  const windowRef = useRef(null);
  const analysisTriggered = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const sendMessageRef = useRef(null);
  const [showHealthTip, setShowHealthTip] = useState(false);
  const healthTipTimer = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [insights, setInsights] = useState(null);
  const streamAbortRef = useRef(null);
  const twConfigRef = useRef({
    intervalMs: TW_DEFAULT_INTERVAL_MS,
    charsPerTick: TW_DEFAULT_BASE_STEP,
  });
  useEffect(() => {
    let cancelled = false;
    fetch(`${BACKEND_URL}/api/config`)
      .then((r) => r.json())
      .then((cfg) => {
        if (cancelled || !cfg?.typewriter) return;
        const tw = cfg.typewriter;
        twConfigRef.current = {
          intervalMs: tw.intervalMs || TW_DEFAULT_INTERVAL_MS,
          charsPerTick: tw.charsPerTick || TW_DEFAULT_BASE_STEP,
        };
      })
      .catch(() => { /* */ });
    return () => { cancelled = true; };
  }, []);
  const typewriterRef = useRef({
    target: "",        // accumulated text from server
    displayed: 0,      // chars already rendered
    doneData: null,    // {reply, chart, actions, tarjetas} when stream completes
    onTick: null,      // (text) => void  — applies displayed text to a message
    onDone: null,      // ({reply, chart, actions}) => void — finalize
    intervalId: null,
  });

  const stopTypewriter = useCallback(() => {
    const t = typewriterRef.current;
    if (t.intervalId) clearInterval(t.intervalId);
    t.intervalId = null;
  }, []);

  const startTypewriter = useCallback(() => {
    const t = typewriterRef.current;
    if (t.intervalId) return;
    const cfg = twConfigRef.current;
    t.intervalId = setInterval(() => {
      const remaining = t.target.length - t.displayed;
      if (remaining > 0) {
        t.displayed = Math.min(t.target.length, t.displayed + cfg.charsPerTick);
        t.onTick?.(t.target.slice(0, t.displayed));
      } else if (t.doneData) {
        const data = t.doneData;
        t.doneData = null;
        stopTypewriter();
        t.onDone?.(data);
      }
    }, cfg.intervalMs);
  }, [stopTypewriter]);

  const resetTypewriter = useCallback(() => {
    stopTypewriter();
    const t = typewriterRef.current;
    t.target = "";
    t.displayed = 0;
    t.doneData = null;
    t.onTick = null;
    t.onDone = null;
  }, [stopTypewriter]);

  const showHealthTooltip = useCallback(() => {
    if (healthTipTimer.current) clearTimeout(healthTipTimer.current);
    setShowHealthTip(true);
  }, []);
  const hideHealthTooltip = useCallback(() => {
    if (healthTipTimer.current) clearTimeout(healthTipTimer.current);
    healthTipTimer.current = setTimeout(() => setShowHealthTip(false), 180);
  }, []);

  // Refresh score when chat closes (contributions or other actions may have changed data)
  useEffect(() => {
    if (!open) fetchHealthScore();
  }, [open, fetchHealthScore]);

  const insightsFetchedRef = useRef(false);
  useEffect(() => {
    if (!open || !session || !accepted || insightsFetchedRef.current) return;
    insightsFetchedRef.current = true;
    fetch(`${BACKEND_URL}/api/insights`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.insights?.length) setInsights(data.insights);
      })
      .catch(() => {});
  }, [open, session, accepted]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "es-MX";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);

      recognition.onerror = (event) => {
        setIsListening(false);
        const messages = {
          "not-allowed": "Permiso de micrófono denegado. Habilítalo en tu navegador.",
          "service-not-allowed": "El reconocimiento de voz no está disponible.",
          "no-speech": "No detecté ninguna voz. Intenta de nuevo.",
          "audio-capture": "No se encontró micrófono.",
          "network": "Error de red. Verifica tu conexión.",
        };
        if (event.error === "aborted") return;
        toast.error(messages[event.error] || "Error en el reconocimiento de voz.");
      };

      recognition.onresult = (event) => {
        let transcript = "";
        let isFinal = false;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
          if (event.results[i].isFinal) isFinal = true;
        }
        setInput(transcript);
        if (isFinal && transcript.trim()) {
          setTimeout(() => sendMessageRef.current?.(transcript), 350);
        }
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Tu navegador no soporta reconocimiento de voz.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch {
        // Already started — restart it
        recognitionRef.current.stop();
        setTimeout(() => recognitionRef.current?.start(), 200);
      }
    }
  };

  const messages = nombreUsuario
    ? [buildMsgBienvenida(nombreUsuario, mode), ...extraMessages]
    : extraMessages;

  const setMessages = (updater) => {
    setExtraMessages((prev) => {
      const current =
        typeof updater === "function"
          ? updater([buildMsgBienvenida(nombreUsuario || "Usuario", mode), ...prev])
          : updater;
      return current.slice(1);
    });
  };

  // Analyst auto-analysis: fires once when the chat opens with an empty history
  useEffect(() => {
    if (!open || mode !== "analyst" || !accepted || !session || extraMessages.length > 0) return;
    if (analysisTriggered.current) return;
    analysisTriggered.current = true;

    const analystPrompt = "Proporciona un análisis financiero objetivo y breve de mi situación actual.";
    const ctrl = new AbortController();
    streamAbortRef.current = ctrl;
    setLoading(true);
    setStreaming(true);

    setExtraMessages((prev) => [...prev, { role: "bot", text: "" }]);

    fetch(`${BACKEND_URL}/api/chatbot`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ message: analystPrompt, history: [], mode: "analyst" }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok || !res.body) throw new Error("Error del servidor");
        await readChatbotStream(res, {
          signal: ctrl.signal,
          onDelta: (text) => {
            setLoading(false);
            setExtraMessages((prev) => {
              const next = [...prev];
              const last = next.length - 1;
              if (last < 0 || next[last]?.role !== "bot") return prev;
              next[last] = { ...next[last], text: (next[last].text || "") + text };
              return next;
            });
          },
          onDone: ({ reply, chart }) => {
            setHistory([
              { role: "user", parts: [{ text: analystPrompt }] },
              { role: "model", parts: [{ text: reply }] },
            ]);
            setExtraMessages((prev) => {
              if (!prev.length) return [{ role: "bot", text: reply, chart }];
              const next = [...prev];
              const last = next.length - 1;
              next[last] = { ...next[last], text: reply, chart };
              return next;
            });
          },
        });
      })
      .catch(() => { /* */ })
      .finally(() => {
        setLoading(false);
        setStreaming(false);
        if (streamAbortRef.current === ctrl) streamAbortRef.current = null;
      });

    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, accepted, session]);

  useEffect(() => {
    localStorage.setItem("chat_messages", JSON.stringify(extraMessages));
  }, [extraMessages]);

  useEffect(() => {
    localStorage.setItem("chat_history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleMouseDown = useCallback((e) => {
    if (fullscreen) return;
    if (e.target.closest(".chat-icon-btn")) return;
    const rect = windowRef.current.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
  }, [fullscreen]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      const x = Math.max(0, Math.min(window.innerWidth - 370, e.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y));
      setPos({ x, y });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging]);

  const handleResizeDown = useCallback((corner, e) => {
    if (fullscreen) return;
    e.stopPropagation();
    const rect = windowRef.current.getBoundingClientRect();
    resizeStart.current = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height, posX: rect.left, posY: rect.top };
    setResizing(corner);
  }, [fullscreen]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (e) => {
      const s = resizeStart.current;
      const dx = e.clientX - s.x;
      const dy = e.clientY - s.y;
      let newW = s.w, newH = s.h, newX = s.posX, newY = s.posY;
      if (resizing === "br") { newW = s.w + dx; newH = s.h + dy; }
      else if (resizing === "bl") { newW = s.w - dx; newH = s.h + dy; newX = s.posX + dx; }
      else if (resizing === "tr") { newW = s.w + dx; newH = s.h - dy; newY = s.posY + dy; }
      else if (resizing === "tl") { newW = s.w - dx; newH = s.h - dy; newX = s.posX + dx; newY = s.posY + dy; }
      newW = Math.max(300, Math.min(window.innerWidth - 20, newW));
      newH = Math.max(350, Math.min(window.innerHeight - 20, newH));
      setSize({ w: newW, h: newH });
      setPos({ x: Math.max(0, newX), y: Math.max(0, newY) });
    };
    const handleUp = () => setResizing(null);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizing]);

  const handleAccept = () => {
    localStorage.setItem("chat_disclaimer", "true");
    setAccepted(true);
  };

  const handleModeChange = (newMode) => {
    setMode(newMode);
    localStorage.setItem("chat_mode", newMode);
    setHistory([]);
    setExtraMessages([]);
    localStorage.removeItem("chat_history");
    setShowSettings(false);
    analysisTriggered.current = false;
    insightsFetchedRef.current = false;
    setInsights(null);
  };

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading || streaming) return;
    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", text: msg },
      { role: "bot", text: "" },
    ]);
    setLoading(true);
    setStreaming(true);

    const ctrl = new AbortController();
    streamAbortRef.current = ctrl;
    let streamedSomething = false;

    const tw = typewriterRef.current;
    resetTypewriter();
    tw.onTick = (rendered) => {
      setLoading(false);
      setMessages((prev) => {
        const next = [...prev];
        const last = next.length - 1;
        if (last < 0 || next[last]?.role !== "bot") return prev;
        next[last] = { ...next[last], text: rendered };
        return next;
      });
    };
    tw.onDone = ({ reply, chart, simulator, streak, compare, subscriptionAudit, actions = [], tarjetas = [] }) => {
      if (tarjetas.length > 0) setUserTarjetas(tarjetas);
      setMessages((prev) => {
        if (!prev.length) return prev;
        const next = [...prev];
        const last = next.length - 1;
        if (next[last]?.role === "bot") {
          next[last] = { ...next[last], text: reply, chart, simulator, streak, compare, subscriptionAudit, actions };
        }
        return next;
      });
      setHistory((prev) => [
        ...prev,
        { role: "user", parts: [{ text: msg }] },
        { role: "model", parts: [{ text: reply }] },
      ]);
      setStreaming(false);
      if (streamAbortRef.current === ctrl) streamAbortRef.current = null;
    };

    try {
      const res = await fetch(`${BACKEND_URL}/api/chatbot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ message: msg, history, mode }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error("Error del servidor");

      await readChatbotStream(res, {
        signal: ctrl.signal,
        onDelta: (chunk) => {
          streamedSomething = true;
          tw.target += chunk;
          startTypewriter();
        },
        onDone: (doneData) => {
          tw.target = doneData.reply || tw.target;
          tw.doneData = doneData;
          startTypewriter();
        },
        onError: () => { throw new Error("stream-error"); },
      });
    } catch (err) {
      stopTypewriter();
      if (err?.name === "AbortError") {
        setStreaming(false);
        if (streamAbortRef.current === ctrl) streamAbortRef.current = null;
      } else if (!streamedSomething) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next.length - 1;
          if (last >= 0 && next[last]?.role === "bot" && !next[last].text) {
            next[last] = { ...next[last], text: "Error de conexión. Intenta de nuevo." };
            return next;
          }
          return [...prev, { role: "bot", text: "Error de conexión. Intenta de nuevo." }];
        });
        setStreaming(false);
        if (streamAbortRef.current === ctrl) streamAbortRef.current = null;
      } else {
        setStreaming(false);
        if (streamAbortRef.current === ctrl) streamAbortRef.current = null;
      }
    } finally {
      setLoading(false);
    }
  };

  sendMessageRef.current = sendMessage;

  const cancelStream = () => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      streamAbortRef.current = null;
    }
    const t = typewriterRef.current;
    if (t.target.length > t.displayed) {
      t.displayed = t.target.length;
      t.onTick?.(t.target);
    }
    stopTypewriter();
    setStreaming(false);
  };

  const handleAportarAction = async (action, tarjetaId) => {
    // Clear actions from the last bot message so chips disappear
    setExtraMessages((prev) => {
      const updated = [...prev];
      const last = updated.length - 1;
      if (last >= 0) updated[last] = { ...updated[last], actions: [] };
      return updated;
    });

    try {
      const res = await fetch(`${BACKEND_URL}/api/metas/${action.id_meta}/aportar`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ monto: action.monto, id_tarjeta: tarjetaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al aportar");
      const successText = `✅ Aporte de **$${Number(action.monto).toFixed(2)}** a **${action.nombre_meta}** realizado. Nuevo progreso: $${Number(data.nuevoProgreso).toFixed(2)}.`;
      setExtraMessages((prev) => [...prev, { role: "bot", text: successText }]);
    } catch (err) {
      setExtraMessages((prev) => [
        ...prev,
        { role: "bot", text: `Error al realizar el aporte: ${err.message}` },
      ]);
    }
  };

  return (
    <>
      {open && (
        <div
          ref={windowRef}
          className={`chat-window${fullscreen ? " fullscreen" : ""}${dragging || resizing ? " dragging" : ""}`}
          style={
            fullscreen
              ? {}
              : pos.x === null
              ? { bottom: 96, right: 28, width: size.w, height: size.h, maxHeight: size.h }
              : { left: pos.x, top: pos.y, bottom: "auto", right: "auto", width: size.w, height: size.h, maxHeight: size.h }
          }
        >
          {!fullscreen && (
            <>
              <div className="resize-handle-tl" onMouseDown={(e) => handleResizeDown("tl", e)} />
              <div className="resize-handle-tr" onMouseDown={(e) => handleResizeDown("tr", e)} />
              <div className="resize-handle-bl" onMouseDown={(e) => handleResizeDown("bl", e)} />
              <div className="resize-handle-br" onMouseDown={(e) => handleResizeDown("br", e)} />
            </>
          )}
          <div className="chat-header" onMouseDown={handleMouseDown}>
            <div>
              <h3><TbRobotFace style={{ display: "inline", marginRight: 6, color: "#fff" }} size={18} /> Fortia AI</h3>
              <p>Modo {mode === "coach" ? "Coach" : "Analista"} · En línea</p>
            </div>
            <div className="chat-header-actions">
              {insights && insights.length > 0 && <InlineInsights insights={insights} />}
              <button className="chat-icon-btn" onClick={() => setShowSettings((s) => !s)} title="Configuración"><TbUserCog size={16} /></button>
              <button className="chat-icon-btn" onClick={() => setFullscreen((f) => !f)} title={fullscreen ? "Restaurar" : "Pantalla completa"}>
                {fullscreen ? <TbMinimize size={16} /> : <TbMaximize size={16} />}
              </button>
              <button className="chat-icon-btn" onClick={() => { setOpen(false); setFullscreen(false); setShowSettings(false); setPos({ x: null, y: null }); setSize({ w: 370, h: 520 }); }}>✕</button>
            </div>
          </div>

          {showSettings && (
            <div className="settings-panel">
              <div className="settings-title">
                Modo del asistente
                <button className="settings-close" onClick={() => setShowSettings(false)}>✕</button>
              </div>
              <div className={`mode-option ${mode === "coach" ? "selected" : ""}`} onClick={() => handleModeChange("coach")}>
                <div className="mode-option-header">
                  <div className="mode-dot" />
                  <span className="mode-name"><TbTarget size={16} style={{ marginRight: 8, display: "inline" }} /> Coach Financiero</span>
                </div>
                <span className="mode-desc">Te propone metas, te da consejos para ahorrar, te sugiere inversiones y te motiva a mejorar tus hábitos financieros.</span>
              </div>
              <div className={`mode-option ${mode === "analyst" ? "selected" : ""}`} onClick={() => handleModeChange("analyst")}>
                <div className="mode-option-header">
                  <div className="mode-dot" />
                  <span className="mode-name"><TbChartBar size={16} style={{ marginRight: 8, display: "inline" }} /> Analista Financiero</span>
                </div>
                <span className="mode-desc">Solo te presenta tus datos de forma objetiva y precisa. No da opiniones ni consejos a menos que se los pidas directamente.</span>
              </div>
            </div>
          )}

          {!accepted && (
            <div className="disclaimer-overlay">
              <div className="disclaimer-card">
                <div className="disclaimer-icon">🔒</div>
                <div className="disclaimer-title">Uso de tus datos financieros</div>
                <div className="disclaimer-text">
                  Para ofrecerte una experiencia personalizada, Fortia AI utiliza información de tu cuenta.
                </div>
                <ul className="disclaimer-bullets">
                  <li>Tus datos se procesan en tiempo real y no se almacenan en servidores externos</li>
                  <li>La conversación es privada y no se comparte con terceros</li>
                  <li>Puedes eliminar el historial en cualquier momento</li>
                  <li>Fortia AI no realiza operaciones bancarias, solo informa y aconseja</li>
                </ul>
                <button className="disclaimer-accept" onClick={handleAccept}>Entendido, continuar</button>
                <span className="disclaimer-link">Consultar aviso de privacidad</span>
              </div>
            </div>
          )}

          <div className="chat-messages">
            {messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const isStreamingThis = streaming && isLast && msg.role === "bot";
              if (msg.role === "bot" && !msg.text && !msg.chart && !msg.simulator && !msg.streak && !msg.compare && !msg.subscriptionAudit && !(msg.actions?.length)) {
                return null;
              }
              return (
                <div key={i} className={`msg ${msg.role}${isStreamingThis ? " streaming" : ""}`}>
                  {msg.role === "bot" ? (
                    <>
                      <MessageContent text={msg.text} />
                      <InlineChart chart={msg.chart} />
                      <InlineStreak streak={msg.streak} />
                      <InlineCompare compare={msg.compare} />
                      <InlineSubscriptionAudit audit={msg.subscriptionAudit} />
                      {msg.simulator && <InlineSimulator simulator={msg.simulator} />}
                      {msg.actions && msg.actions.length > 0 && isLast && (
                        <ActionChips
                          actions={msg.actions}
                          tarjetas={userTarjetas}
                          onAportar={handleAportarAction}
                          onNav={(path) => { navigate(path); setOpen(false); }}
                        />
                      )}
                    </>
                  ) : (
                    msg.text
                  )}
                </div>
              );
            })}
            {loading && (
              <div className="dot-anim">
                <span /><span /><span />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {!messages.some((m) => m.role === "user") && !loading && (
            <div className="quick-chips">
              {(mode === "analyst" ? ANALYST_CHIPS : COACH_CHIPS).map((chip, i) => (
                <button key={i} className="chip" onClick={() => sendMessage(chip)}>
                  {chip}
                </button>
              ))}
            </div>
          )}

          <div className="chat-input-row">
            <button 
              className={`chat-voice-btn ${isListening ? "listening" : ""}`}
              onClick={toggleListening}
              title={isListening ? "Escuchando..." : "Dictar mensaje"}
            >
              {isListening ? "🛑" : "🎤"}
            </button>
            <input
              className="chat-input"
              placeholder={isListening ? "Escuchando..." : "Escribe tu pregunta..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              disabled={loading || streaming}
            />
            {streaming ? (
              <button
                className="chat-send chat-cancel"
                onClick={cancelStream}
                title="Detener generación"
              >
                ■
              </button>
            ) : (
              <button
                className="chat-send"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
              >
                ➤
              </button>
            )}
          </div>
        </div>
      )}

      <button className="fab" onClick={() => setOpen((o) => !o)}>
        {open ? <span style={{ fontSize: "20px", fontWeight: "bold", lineHeight: 1 }}>✕</span> : <TbRobotFace size={24} color="#fff" />}
      </button>
    </>
  );
}
