import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from "react-hot-toast";
import { TbRobotFace, TbBulb, TbChartBar, TbTarget, TbUserCog, TbMaximize, TbMinimize, TbPigMoney, TbAlertCircle, TbTrendingUp, TbTarget as TbGoal, TbGauge, TbMicrophone, TbPlayerStop, TbSquare, TbFlame, TbCheck } from "react-icons/tb";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import "../styles/chatbot.css";
import { BACKEND_URL } from "../config";


// Paleta restringida al sistema visual de la página: rojos (brand), verdes,
// naranjas, grises y blanco. Ordenada para máximo contraste entre slices/bars
// adyacentes — los primeros 3 son los más distintivos.
const CHART_PALETTE = [
  "#cc0000", // brand red
  "#2e7d32", // green (success)
  "#f57c00", // orange (warning)
  "#616161", // gray
  "#a30000", // deep red
  "#66bb6a", // light green
  "#ffb74d", // light orange
  "#bdbdbd", // light gray
];

// Used as accent color in some places (gauges, references, etc.)
const ACCENT = {
  red: "#cc0000",
  green: "#2e7d32",
  orange: "#f57c00",
  grayDark: "#424242",
  grayMid: "#757575",
  grayLight: "#bdbdbd",
  bgSoft: "#fafafa",
  white: "#ffffff",
};

const TW_DEFAULT_INTERVAL_MS = 18;
const TW_DEFAULT_BASE_STEP = 2;

const emojiToIcon = (emoji) => {
  const iconMap = {
    "⚠️": <TbAlertCircle size={18} color="#FFA400" />,
    "🚨": <TbAlertCircle size={18} color="#EB0029" />,
    "📈": <TbTrendingUp size={18} color="#6CC04A" />,
    "🎯": <TbGoal size={18} color="#cc0000" />,
    "⚡": <TbGauge size={18} color="#1976d2" />,
    "🔥": <TbFlame size={18} color="#FF4500" />,
    "✅": <TbCheck size={18} color="#4caf50" />,
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
  const { label, current, unit = "días", best, context } = streak;

  // Visual progress bar: how close current is to best (or just full when no best)
  const progressPct = best && best > 0
    ? Math.min(100, Math.round((current / best) * 100))
    : 100;
  const isRecord = best !== undefined && current >= best;

  return (
    <div className="inline-streak-card">
      <div className="streak-card-glow" />

      <div className="streak-card-header">
        <span className="streak-card-flame">
          <TbFlame size={14} />
        </span>
        <span className="streak-card-label">{label}</span>
        {isRecord && <span className="streak-card-badge">¡Récord!</span>}
      </div>

      <div className="streak-card-bignumber">
        <span className="streak-card-value">{current}</span>
        <span className="streak-card-unit">{unit}</span>
      </div>

      {best !== undefined && (
        <div className="streak-card-progress">
          <div className="streak-card-progress-track">
            <div
              className="streak-card-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
            {best > current && (
              <div
                className="streak-card-progress-mark"
                style={{ left: "100%" }}
                title={`Récord: ${best}`}
              />
            )}
          </div>
          <div className="streak-card-progress-meta">
            <span>{progressPct}% del récord</span>
            <span>Récord: {best} {unit}</span>
          </div>
        </div>
      )}

      {context && (
        <div className="streak-card-context">{context}</div>
      )}
    </div>
  );
}

function InlineGauge({ gauge }) {
  if (!gauge) return null;
  const { title, value, max, unit, label, thresholds } = gauge;
  if (typeof value !== 'number' || typeof max !== 'number' || max <= 0) return null;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const warn = thresholds?.warn ?? 80;
  const bad = thresholds?.bad ?? 100;
  const color = pct >= bad ? ACCENT.red : pct >= warn ? ACCENT.orange : ACCENT.green;
  // Semicircle: 180° arc. Value angle goes from -90deg (left, 0%) to +90deg (right, 100%).
  const angle = -90 + (pct / 100) * 180;
  const r = 70, cx = 90, cy = 90;
  const arcEnd = {
    x: cx + r * Math.cos((angle * Math.PI) / 180),
    y: cy + r * Math.sin((angle * Math.PI) / 180),
  };
  const largeArc = pct > 50 ? 1 : 0;
  // Tick marks at 0/25/50/75/100%
  const ticks = [0, 25, 50, 75, 100].map(t => {
    const a = -90 + (t / 100) * 180;
    const x1 = cx + (r - 11) * Math.cos((a * Math.PI) / 180);
    const y1 = cy + (r - 11) * Math.sin((a * Math.PI) / 180);
    const x2 = cx + (r + 4) * Math.cos((a * Math.PI) / 180);
    const y2 = cy + (r + 4) * Math.sin((a * Math.PI) / 180);
    return { x1, y1, x2, y2, t };
  });

  return (
    <div className="inline-gauge">
      <p className="chart-title">{title}</p>
      <div className="gauge-svg-wrap">
        <svg viewBox="0 0 180 100" className="gauge-svg">
          {/* Background arc */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#f0f0f0"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Tick marks */}
          {ticks.map((tk, i) => (
            <line
              key={i}
              x1={tk.x1} y1={tk.y1} x2={tk.x2} y2={tk.y2}
              stroke={ACCENT.grayLight}
              strokeWidth={i === 0 || i === ticks.length - 1 ? 1.5 : 1}
            />
          ))}
          {/* Filled arc — only render if pct > 0 to avoid degenerate path at 0% */}
          {pct > 0 && (
            <path
              d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${arcEnd.x} ${arcEnd.y}`}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeLinecap="round"
            />
          )}
          {/* Big % in center, color-coded */}
          <text x={cx} y={cy - 4} textAnchor="middle"
            style={{ fontSize: 26, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}
            fill={color}>
            {pct.toFixed(0)}%
          </text>
        </svg>
        <div className="gauge-meta">
          <div className="gauge-meta-row">
            <span className="gauge-meta-label">Actual</span>
            <span className="gauge-meta-value" style={{ color }}>
              {unit === 'MXN' ? fmtMXN(value) : value.toLocaleString('es-MX')}
              {unit && unit !== 'MXN' ? ` ${unit}` : ''}
            </span>
          </div>
          <div className="gauge-meta-row">
            <span className="gauge-meta-label">Tope</span>
            <span className="gauge-meta-value">
              {unit === 'MXN' ? fmtMXN(max) : max.toLocaleString('es-MX')}
              {unit && unit !== 'MXN' ? ` ${unit}` : ''}
            </span>
          </div>
        </div>
        {label && <div className="gauge-label" style={{ color }}>{label}</div>}
      </div>
    </div>
  );
}

function InlineHeatmap({ heatmap }) {
  if (!heatmap) return null;
  const { title, cells } = heatmap;
  if (!Array.isArray(cells) || cells.length === 0) return null;
  const max = Math.max(1, ...cells.map(c => Math.abs(Number(c?.value) || 0)));
  return (
    <div className="inline-heatmap">
      <p className="chart-title">{title}</p>
      <div className="heatmap-grid">
        {cells.map((c, i) => {
          const intensity = Math.abs(c.value) / max;
          // White → light orange → red
          const opacity = 0.08 + intensity * 0.92;
          return (
            <div
              key={i}
              className="heatmap-cell"
              style={{
                background: `rgba(204, 0, 0, ${opacity})`,
                color: intensity > 0.55 ? '#fff' : '#424242',
              }}
              title={`${c.label}: ${fmtMXN(c.value)}`}
            >
              <div className="heatmap-cell-label">{c.label}</div>
              <div className="heatmap-cell-value">
                {c.value >= 1000 ? `$${(c.value / 1000).toFixed(1)}k` : `$${Math.round(c.value)}`}
              </div>
            </div>
          );
        })}
      </div>
      <div className="heatmap-legend">
        <span>Menos</span>
        <div className="heatmap-legend-bar" />
        <span>Más</span>
      </div>
    </div>
  );
}

function InlineSubsBreakdown({ subs }) {
  if (!subs) return null;
  const { title, items, total } = subs;
  if (!Array.isArray(items) || items.length === 0) return null;
  const sorted = [...items].sort((a, b) => b.monthly - a.monthly);
  const max = Math.max(1, ...sorted.map(it => Number(it.monthly) || 0));
  const computedTotal = total || sorted.reduce((a, it) => a + (Number(it.monthly) || 0), 0);
  return (
    <div className="inline-subs">
      <p className="chart-title">{title}</p>
      <div className="subs-rows">
        {sorted.map((it, i) => {
          const pct = Math.max(2, (it.monthly / max) * 100);
          return (
            <div key={i} className="subs-row">
              <div className="subs-row-name">{it.name}</div>
              <div className="subs-row-bar">
                <div className="subs-row-bar-fill" style={{ width: `${pct}%` }} />
                <span className="subs-row-amount">{fmtMXN(it.monthly)}/mes</span>
              </div>
              {it.annual && <div className="subs-row-annual">{fmtMXN(it.annual)}/año</div>}
            </div>
          );
        })}
      </div>
      <div className="subs-total">
        Total mensual: <strong>{fmtMXN(computedTotal)}</strong> ·
        Anual: <strong>{fmtMXN(computedTotal * 12)}</strong>
      </div>
    </div>
  );
}

function InlineTopMerchants({ topMerchants }) {
  if (!topMerchants) return null;
  const { title, items } = topMerchants;
  if (!Array.isArray(items) || items.length === 0) return null;
  const sorted = [...items].sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...sorted.map(it => Number(it.total) || 0));
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="inline-merchants">
      <p className="chart-title">{title}</p>
      <div className="merchant-rows">
        {sorted.map((it, i) => {
          const pct = Math.max(4, (it.total / max) * 100);
          return (
            <div key={i} className="merchant-row">
              <div className="merchant-rank">{medals[i] || `#${i + 1}`}</div>
              <div className="merchant-info">
                <div className="merchant-name">{it.name}</div>
                {it.count !== undefined && (
                  <div className="merchant-count">{it.count} {it.count === 1 ? 'transacción' : 'transacciones'}</div>
                )}
              </div>
              <div className="merchant-bar">
                <div className="merchant-bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="merchant-total">{fmtMXN(it.total)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InlineSavingsRate({ savingsRate }) {
  if (!savingsRate) return null;
  const { title, income, saved, benchmarks } = savingsRate;
  if (typeof income !== 'number' || typeof saved !== 'number' || income <= 0) return null;
  const pct = (saved / income) * 100;
  const pctDisplay = Math.max(-99, Math.min(999, pct)).toFixed(1);
  const bench = benchmarks || { good: 10, great: 20, excellent: 30 };
  const tier = pct >= bench.excellent ? 'excellent'
    : pct >= bench.great ? 'great'
    : pct >= bench.good ? 'good'
    : pct >= 0 ? 'low' : 'negative';
  const tierLabel = {
    excellent: 'Excelente',
    great: 'Muy bien',
    good: 'Bien',
    low: 'A mejorar',
    negative: 'Estás gastando más de lo que ganas',
  }[tier];
  const tierColor = {
    excellent: ACCENT.green,
    great: ACCENT.green,
    good: ACCENT.orange,
    low: ACCENT.orange,
    negative: ACCENT.red,
  }[tier];
  // Ring math
  const r = 54, cx = 70, cy = 70;
  const circ = 2 * Math.PI * r;
  // Cap fill to [0, 100] for the visual; pct can exceed but ring stops at 100.
  const visiblePct = Math.max(0, Math.min(100, pct));
  const dash = (visiblePct / 100) * circ;

  return (
    <div className="inline-savrate">
      <p className="chart-title">{title}</p>
      <div className="savrate-row">
        <svg viewBox="0 0 140 140" className="savrate-ring">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0f0" strokeWidth="12" />
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={tierColor} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          <text x={cx} y={cy - 2} textAnchor="middle"
            style={{ fontSize: 22, fontWeight: 800, fontFamily: "'DM Sans', sans-serif" }}
            fill={tierColor}>{pctDisplay}%</text>
          <text x={cx} y={cy + 16} textAnchor="middle"
            style={{ fontSize: 9, fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.05em' }}
            fill={ACCENT.grayMid}>AHORRADO</text>
        </svg>
        <div className="savrate-info">
          <div className="savrate-tier" style={{ color: tierColor }}>{tierLabel}</div>
          <div className="savrate-stat">
            <span className="savrate-stat-label">Ingreso</span>
            <span className="savrate-stat-value">{fmtMXN(income)}</span>
          </div>
          <div className="savrate-stat">
            <span className="savrate-stat-label">Ahorrado</span>
            <span className="savrate-stat-value" style={{ color: tierColor }}>{fmtMXN(saved)}</span>
          </div>
          <div className="savrate-bench">
            <div>10% bien · 20% muy bien · 30%+ excelente</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineRecCal({ recCal }) {
  if (!recCal) return null;
  const { title, charges } = recCal;
  if (!Array.isArray(charges) || charges.length === 0) return null;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const today = now.getDate();

  // Group charges by day
  const byDay = new Map();
  for (const c of charges) {
    const d = Math.min(daysInMonth, Math.max(1, c.day));
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d).push(c);
  }

  const totalMonth = charges.reduce((a, c) => a + c.amount, 0);
  const upcoming = charges.filter(c => c.day >= today).sort((a, b) => a.day - b.day);

  // Build cells: 6 rows × 7 cols max
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="inline-reccal">
      <p className="chart-title">{title}</p>
      <div className="reccal-grid">
        {['D','L','Ma','Mi','J','V','S'].map((d, i) => (
          <div key={`h${i}`} className="reccal-dow">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="reccal-empty" />;
          const has = byDay.has(d);
          const isToday = d === today;
          const isPast = d < today;
          return (
            <div
              key={i}
              className={`reccal-day ${has ? 'has-charge' : ''} ${isToday ? 'is-today' : ''} ${isPast ? 'is-past' : ''}`}
              title={has ? byDay.get(d).map(c => `${c.name}: ${fmtMXN(c.amount)}`).join('\n') : ''}
            >
              <span className="reccal-day-num">{d}</span>
              {has && <span className="reccal-day-dot" />}
            </div>
          );
        })}
      </div>
      <div className="reccal-summary">
        <div><strong>{charges.length}</strong> cargos · Total <strong>{fmtMXN(totalMonth)}</strong></div>
        {upcoming.length > 0 && (
          <div className="reccal-next">
            Próximo: <strong>{upcoming[0].name}</strong> día {upcoming[0].day} ({fmtMXN(upcoming[0].amount)})
          </div>
        )}
      </div>
    </div>
  );
}

function InlineSparklines({ sparklines }) {
  if (!sparklines) return null;
  const { title, categories } = sparklines;
  if (!Array.isArray(categories) || categories.length === 0) return null;
  return (
    <div className="inline-sparklines">
      <p className="chart-title">{title}</p>
      <div className="sparkline-rows">
        {categories.map((c, i) => {
          const vals = Array.isArray(c?.values) ? c.values.filter(v => typeof v === 'number') : [];
          if (vals.length === 0) return null;
          const min = Math.min(...vals);
          const max = Math.max(...vals);
          const range = max - min || 1;
          // Generate SVG polyline points
          const w = 100, h = 30;
          const stepX = vals.length > 1 ? w / (vals.length - 1) : 0;
          const points = vals.map((v, idx) => {
            const x = idx * stepX;
            const y = h - ((v - min) / range) * h;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(' ');
          const current = typeof c.current === 'number' ? c.current : vals[vals.length - 1];
          const first = vals[0];
          const delta = first !== 0 && Number.isFinite(first) ? ((current - first) / Math.abs(first)) * 100 : 0;
          const trendUp = delta > 0;
          // Color: red if going up (gasto subiendo es malo en general), green if down
          const sparkColor = trendUp ? ACCENT.red : ACCENT.green;
          return (
            <div key={i} className="sparkline-row">
              <div className="sparkline-name">{c.name}</div>
              <svg viewBox={`0 0 ${w} ${h}`} className="sparkline-svg" preserveAspectRatio="none">
                <polyline
                  points={points}
                  fill="none"
                  stroke={sparkColor}
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={(vals.length - 1) * stepX}
                  cy={h - ((current - min) / range) * h}
                  r="2"
                  fill={sparkColor}
                />
              </svg>
              <div className="sparkline-meta">
                <div className="sparkline-current">{fmtMXN(current)}</div>
                <div className={`sparkline-delta ${trendUp ? 'up' : 'down'}`}>
                  {trendUp ? '▲' : '▼'} {Math.abs(delta).toFixed(0)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InlineCompare({ compare }) {
  if (!compare) return null;
  const { title, leftLabel, rightLabel, rows } = compare;
  if (!Array.isArray(rows) || rows.length === 0) return null;
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
  const safeParams = Array.isArray(simulator?.params) ? simulator.params : [];
  const [values, setValues] = useState(() =>
    Object.fromEntries(safeParams.map((p) => [p.key, p.value]))
  );
  if (!simulator || safeParams.length === 0) return null;

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

  // Shared axis/tooltip styling — applied to all chart types for consistency.
  const axisTick = { fontSize: 10, fill: ACCENT.grayMid, fontFamily: "'DM Sans', sans-serif" };
  const tooltipStyle = {
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 12,
    borderRadius: 8,
    border: `1px solid ${ACCENT.grayLight}`,
    background: ACCENT.white,
    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    color: ACCENT.grayDark,
  };
  const gridStyle = { stroke: ACCENT.grayLight, strokeDasharray: "3 3" };

  if (type === "pie") {
    return (
      <div className="inline-chart">
        <p className="chart-title">{title}</p>
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={78}
              innerRadius={36}
              paddingAngle={2}
              stroke={ACCENT.white}
              strokeWidth={2}
            >
              {data.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => fmtMXN(v)} contentStyle={tooltipStyle} />
            <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: ACCENT.grayDark }} />
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
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 32, left: 8 }}>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="name" tick={axisTick} angle={-25} textAnchor="end" interval={0} axisLine={{ stroke: ACCENT.grayLight }} tickLine={false} />
            <YAxis tick={axisTick} width={44} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
            <Tooltip formatter={(v) => fmtMXN(v)} contentStyle={tooltipStyle} cursor={{ fill: ACCENT.bgSoft }} />
            {hasSecond && <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, fontFamily: "'DM Sans', sans-serif", color: ACCENT.grayDark }} />}
            <Bar dataKey="value" name="Este mes" fill={ACCENT.red} radius={[4, 4, 0, 0]} maxBarSize={42} />
            {hasSecond && <Bar dataKey="value2" name="Mes anterior" fill={ACCENT.grayLight} radius={[4, 4, 0, 0]} maxBarSize={42} />}
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
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 32, left: 8 }}>
            <CartesianGrid {...gridStyle} vertical={false} />
            <XAxis dataKey="name" tick={axisTick} angle={-25} textAnchor="end" interval={Math.ceil(data.length / 8)} axisLine={{ stroke: ACCENT.grayLight }} tickLine={false} />
            <YAxis tick={axisTick} width={44} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`} />
            <Tooltip formatter={(v) => fmtMXN(v)} contentStyle={tooltipStyle} />
            {reference && typeof reference.value === "number" && (
              <ReferenceLine
                y={reference.value}
                stroke={ACCENT.orange}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: reference.label || "", fontSize: 10, fill: ACCENT.orange, fontFamily: "'DM Sans', sans-serif", position: "insideTopRight" }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={ACCENT.red}
              strokeWidth={2.5}
              dot={{ r: 3, fill: ACCENT.red, strokeWidth: 2, stroke: ACCENT.white }}
              activeDot={{ r: 5, fill: ACCENT.red, strokeWidth: 2, stroke: ACCENT.white }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return null;
}

// Hides any in-progress trailing tag prefix (e.g. `[CHART]{"type":"pie"…`)
// while the model is still streaming. By the time `done` arrives, the backend
// has already extracted complete tags into widgets[] and stripped them from
// the text — so we only need this guard for the live streaming buffer.
//
// IMPORTANT: requires a literal `[` or `**` opening so we don't accidentally
// strip legitimate text like "Tu CHART de gastos mejora cada mes."
const INCOMPLETE_TAG_TAIL_RE =
  /\s*(?:\[|\*\*)\s*(?:CHART|COMPARE|STREAKS?|SIMULATOR|PIE|BAR|LINE)\b[\s\S]*$/i;

function stripIncompleteTagTail(text) {
  if (!text) return text;
  return text.replace(INCOMPLETE_TAG_TAIL_RE, '');
}

function MessageContent({ text }) {
  if (!text) return null;
  const cleaned = stripIncompleteTagTail(text);
  if (!cleaned.trim()) return null;
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleaned}</ReactMarkdown>;
}

function ActionProposalCard({ proposal, tarjetas, onConfirm, onCancel }) {
  const [tarjetaSel, setTarjetaSel] = useState(() =>
    tarjetas.length > 0 ? String(tarjetas[0].id) : ''
  );
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null); // 'confirmed' | 'cancelled' | 'error'
  const [error, setError] = useState(null);
  // Synchronous in-flight latch — guards against a fast double-click firing
  // confirm twice before setBusy(true) propagates through React state.
  const inFlightRef = useRef(false);

  const needsTarjeta = (proposal.needs || []).includes('id_tarjeta');

  async function handleConfirm() {
    if (inFlightRef.current) return;
    if (needsTarjeta && !tarjetaSel) {
      setError('Selecciona una tarjeta');
      return;
    }
    inFlightRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const additional_params = needsTarjeta ? { id_tarjeta: Number(tarjetaSel) } : {};
      const res = await onConfirm(proposal.proposal_id, additional_params);
      if (res?.executed) setOutcome('confirmed');
      else { setError(res?.error || 'No se pudo ejecutar'); setOutcome('error'); }
    } catch (e) {
      setError(e.message || 'Error');
      setOutcome('error');
    } finally {
      inFlightRef.current = false;
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setBusy(true);
    try { await onCancel(proposal.proposal_id); } catch { /* */ }
    inFlightRef.current = false;
    setOutcome('cancelled');
    setBusy(false);
  }

  if (outcome === 'confirmed') {
    return <div className="action-chips"><span className="action-executing"><TbCheck size={14} /> {proposal.summary_es} — Hecho.</span></div>;
  }
  if (outcome === 'cancelled') {
    return <div className="action-chips"><span className="action-executing">Acción cancelada.</span></div>;
  }

  return (
    <div className="action-chips action-proposal-card">
      <div className="proposal-summary">
        <TbAlertCircle size={14} style={{ marginRight: 6, color: '#FFA400' }} />
        {proposal.summary_es}
      </div>
      {needsTarjeta && (
        <div className="tarjeta-picker">
          <span className="picker-label">Tarjeta:</span>
          <select className="picker-select" value={tarjetaSel} onChange={(e) => setTarjetaSel(e.target.value)}>
            {tarjetas.length === 0 ? (
              <option value="">(sin tarjetas)</option>
            ) : tarjetas.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>
      )}
      {error && <div className="proposal-error">{error}</div>}
      <div className="picker-btns">
        <button className="picker-confirm" disabled={busy} onClick={handleConfirm}>
          {busy ? 'Procesando…' : 'Confirmar'}
        </button>
        <button className="picker-cancel" disabled={busy} onClick={handleCancel}>Cancelar</button>
      </div>
    </div>
  );
}

function ActionChips({ actions, tarjetas, onAportar, onNav }) {
  const [picking, setPicking] = useState(null);
  // Initialize from tarjetas via the lazy initializer instead of a useEffect
  // to avoid the cascading-render lint and the brief render where the dropdown
  // shows the empty placeholder before the effect fills it in.
  const [selectedTarjeta, setSelectedTarjeta] = useState(
    () => (tarjetas.length > 0 ? String(tarjetas[0].id) : "")
  );
  const [executing, setExecuting] = useState(false);

  // Keep selection in sync if `tarjetas` changes shape later (e.g. user adds
  // a card mid-session) — but only when the current selection becomes invalid.
  useEffect(() => {
    if (tarjetas.length === 0) {
      if (selectedTarjeta !== "") setSelectedTarjeta("");
      return;
    }
    if (!tarjetas.some(t => String(t.id) === selectedTarjeta)) {
      setSelectedTarjeta(String(tarjetas[0].id));
    }
    // selectedTarjeta is intentionally omitted to avoid resetting on user choice
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  id: 'welcome',
  role: "bot",
  text: mode === "analyst"
    ? `Hola, ${nombre.split(" ")[0]}. Soy tu Analista Financiero. Analizando tu situación actual...`
    : `¡Hola, ${nombre.split(" ")[0]}! Soy tu Coach Financiero. Estoy aquí para ayudarte a alcanzar tus metas y mejorar tus hábitos financieros. ¿Por dónde empezamos?`,
});

// Monotonic message ID. Used as the React key on rendered messages so the
// reconciler stays stable when widgets/proposals stream in late and the
// message shape changes mid-render.
let _msgIdCounter = 0;
const nextMsgId = () => `${Date.now()}-${++_msgIdCounter}`;

async function readChatbotStream(res, { onDelta, onDone, onError, onStatus, onToolCall, onToolResult, onActionProposal, signal }) {
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
          else if (evt.type === "status") onStatus?.(evt);
          else if (evt.type === "tool_call") onToolCall?.(evt);
          else if (evt.type === "tool_result") onToolResult?.(evt);
          else if (evt.type === "action_proposal") onActionProposal?.(evt);
        }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch { /* */ }
  }
}

// Friendly Spanish labels for each tool the agent might call. Falls back to
// generic "consultando datos…" for unmapped tools.
const TOOL_STATUS_LABELS = {
  obtener_resumen_mes: 'consultando resumen del mes…',
  obtener_movimientos: 'buscando movimientos…',
  obtener_gastos_por_categoria: 'sumando gastos por categoría…',
  obtener_metas_ahorro: 'revisando tus metas…',
  obtener_presupuestos: 'revisando presupuestos…',
  obtener_recurrencias: 'revisando cargos recurrentes…',
  obtener_tarjetas: 'consultando tarjetas…',
  obtener_salud_financiera: 'calculando tu salud financiera…',
  obtener_insights_automaticos: 'buscando alertas…',
  proponer_aporte_meta: 'preparando aporte…',
  proponer_crear_presupuesto: 'preparando presupuesto…',
  proponer_modificar_presupuesto: 'preparando cambio de presupuesto…',
  proponer_toggle_recurrencia: 'preparando cambio de recurrencia…',
  proponer_crear_meta: 'preparando nueva meta…',
};

function statusForToolCall(name) {
  return TOOL_STATUS_LABELS[name] || 'consultando datos…';
}

export default function Chatbot() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [nombreUsuario, setNombreUsuario] = useState(null);
  const [userTarjetas, setUserTarjetas] = useState([]);

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

  // Pings /api/health on chat-close and after mutations so any other component
  // observing the score (e.g. dashboard) can refresh from cache. Result is
  // intentionally not stored in chatbot state.
  const fetchHealthScore = useCallback(() => {
    if (!session) return;
    fetch(`${BACKEND_URL}/api/health`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }).catch(() => {});
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
  const [size, setSize]               = useState({ w: 440, h: 560 });
  const [dragging, setDragging]       = useState(false);
  const [resizing, setResizing]       = useState(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, posX: 0, posY: 0 });
  const bottomRef = useRef(null);
  const windowRef = useRef(null);
  const analysisTriggered = useRef(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  // TTS — read bot replies aloud when toggled on. Persists choice; skips
  // markdown chars and widget tags so the spoken text is clean prose.
  const [ttsOn, setTtsOn] = useState(() => localStorage.getItem('chat_tts') === 'true');
  const lastSpokenRef = useRef(null);
  const sendMessageRef = useRef(null);
  const [streaming, setStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState("pensando…");
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
      recognition.interimResults = false;
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
          "network": "Error de conexión con el servicio de voz. Verifica tu internet o usa Chrome.",
        };
        if (event.error === "aborted") return;
        try { recognition.abort(); } catch (abortErr) { console.warn("recognition.abort failed:", abortErr); }
        toast.error(messages[event.error] || `Error de voz: ${event.error}`);
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
    return () => {
      const r = recognitionRef.current;
      if (r) {
        try { r.onresult = null; r.onerror = null; r.onstart = null; r.onend = null; r.abort(); } catch { /* */ }
        recognitionRef.current = null;
      }
    };
  }, []);

  // Abort any in-flight chatbot SSE stream on unmount so we don't leak the
  // fetch reader and don't fire setState on an unmounted component.
  useEffect(() => {
    return () => {
      try { streamAbortRef.current?.abort(); } catch { /* */ }
      streamAbortRef.current = null;
    };
  }, []);

  // Cancel any pending TTS on unmount or when toggled off. Doesn't depend on
  // `messages` so it can live up here. The "speak the latest reply" effect
  // depends on `messages` so it's placed below, after `messages` is defined.
  useEffect(() => {
    if (!ttsOn && typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch { /* */ }
    }
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch { /* */ }
      }
    };
  }, [ttsOn]);

  // ESC closes the chat or any open overlay (settings → disclaimer → chat).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (showSettings) { setShowSettings(false); return; }
      setOpen(false);
      setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, showSettings]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error("Tu navegador no soporta reconocimiento de voz.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
      } catch {
        // Fallback if start fails (e.g. already starting)
        recognitionRef.current.abort();
        setTimeout(() => {
          try { recognitionRef.current.start(); } catch { setIsListening(false); }
        }, 250);
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

  // Speak the latest finished bot reply when TTS is enabled. Only fires when
  // streaming finishes (so we don't read partial sentences) and dedupes via
  // lastSpokenRef so we don't repeat the same message after re-renders.
  useEffect(() => {
    if (!ttsOn || streaming || typeof window === 'undefined' || !window.speechSynthesis) return;
    const last = [...messages].reverse().find((m) => m.role === 'bot' && m.text);
    if (!last || !last.text || last.id === lastSpokenRef.current) return;
    lastSpokenRef.current = last.id || last.text.slice(0, 40);
    const clean = last.text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\[(?:CHART|SIMULATOR|STREAK|COMPARE|GAUGE|HEATMAP|SUBS|TOP_MERCHANTS|SAVINGS_RATE|RECURRING_CALENDAR|SPARKLINES)[\s\S]*?\[\/[A-Z_]+\]/g, '')
      .replace(/[*_`#>\[\]\\]/g, '')
      .trim();
    if (!clean) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean.slice(0, 1000));
      u.lang = 'es-MX';
      u.rate = 1.0;
      window.speechSynthesis.speak(u);
    } catch { /* */ }
  }, [messages, streaming, ttsOn]);

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

    setExtraMessages((prev) => [...prev, { id: nextMsgId(), role: "bot", text: "" }]);

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
          onDone: ({ reply, chart, simulator, streak, compare, widgets }) => {
            setHistory([
              { role: "user", parts: [{ text: analystPrompt }] },
              { role: "model", parts: [{ text: reply }] },
            ]);
            setExtraMessages((prev) => {
              const baseMsg = { role: "bot", text: reply, chart, simulator, streak, compare, widgets };
              if (!prev.length) return [baseMsg];
              const next = [...prev];
              const last = next.length - 1;
              next[last] = { ...next[last], ...baseMsg };
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

  // Debounce localStorage writes — during streaming, extraMessages and history
  // get many sub-second updates; serializing and writing on every one is wasted
  // CPU and storage churn. 500ms gives near-instant persistence after the user
  // stops typing / the model stops streaming.
  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem("chat_messages", JSON.stringify(extraMessages)); } catch { /* */ }
    }, 500);
    return () => clearTimeout(t);
  }, [extraMessages]);

  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem("chat_history", JSON.stringify(history)); } catch { /* */ }
    }, 500);
    return () => clearTimeout(t);
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
    // Pointer events unify mouse + touch + pen so the chat can be moved on
    // tablets/phones without a separate touchmove path.
    const handleMove = (e) => {
      const x = Math.max(0, Math.min(window.innerWidth - 440, e.clientX - dragOffset.current.x));
      const y = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y));
      setPos({ x, y });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
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
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
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
      { id: nextMsgId(), role: "user", text: msg },
      { id: nextMsgId(), role: "bot", text: "" },
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
    tw.onDone = ({ reply, chart, simulator, streak, compare, widgets, subscriptionAudit, actions = [], tarjetas = [] }) => {
      if (tarjetas.length > 0) setUserTarjetas(tarjetas);
      setMessages((prev) => {
        if (!prev.length) return prev;
        const next = [...prev];
        const last = next.length - 1;
        if (next[last]?.role === "bot") {
          next[last] = { ...next[last], text: reply, chart, simulator, streak, compare, widgets, subscriptionAudit, actions };
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

      setStreamStatus("pensando…");
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
          setStreamStatus("pensando…");
          startTypewriter();
        },
        onError: () => { throw new Error("stream-error"); },
        onStatus: (evt) => { if (evt.text) setStreamStatus(evt.text); },
        onToolCall: (evt) => { setStreamStatus(statusForToolCall(evt.name)); },
        onActionProposal: (evt) => {
          // Attach proposals to the current bot message so the renderer shows
          // a confirmation card. The agent loop may emit several proposals in
          // one turn — we accumulate them.
          setMessages((prev) => {
            const next = [...prev];
            const last = next.length - 1;
            if (last < 0 || next[last]?.role !== 'bot') return prev;
            const prevList = Array.isArray(next[last].proposals) ? next[last].proposals : [];
            // De-dupe by proposal_id (in case the stream re-emits)
            if (prevList.some(p => p.proposal_id === evt.proposal_id)) return prev;
            next[last] = { ...next[last], proposals: [...prevList, evt] };
            return next;
          });
        },
      });
    } catch (err) {
      stopTypewriter();
      setStreamStatus("pensando…"); // reset status so a stuck tool label doesn't linger
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
          return [...prev, { id: nextMsgId(), role: "bot", text: "Error de conexión. Intenta de nuevo." }];
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

  const handleConfirmProposal = async (proposal_id, additional_params = {}) => {
    const res = await fetch(`${BACKEND_URL}/api/chatbot/confirm-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ proposal_id, additional_params }),
    });
    const data = await res.json();
    if (!res.ok) {
      // Surface backend error message
      return { executed: false, error: data?.error || data?.detail || `HTTP ${res.status}` };
    }
    fetchHealthScore(); // refresh score after a mutation
    return data;
  };

  const handleCancelProposal = async (proposal_id) => {
    await fetch(`${BACKEND_URL}/api/chatbot/cancel-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ proposal_id }),
    });
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
      const successText = `Aporte de **$${Number(action.monto).toFixed(2)}** a **${action.nombre_meta}** realizado. Nuevo progreso: $${Number(data.nuevoProgreso).toFixed(2)}.`;
      setExtraMessages((prev) => [...prev, { id: nextMsgId(), role: "bot", text: successText }]);
    } catch (err) {
      setExtraMessages((prev) => [
        ...prev,
        { id: nextMsgId(), role: "bot", text: `Error al realizar el aporte: ${err.message}` },
      ]);
    }
  };

  return (
    <>
      {open && (
        <div
          ref={windowRef}
          role="dialog"
          aria-modal="true"
          aria-label="Asistente financiero Fortia AI"
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
              <div className="resize-handle-tl" onPointerDown={(e) => handleResizeDown("tl", e)} />
              <div className="resize-handle-tr" onPointerDown={(e) => handleResizeDown("tr", e)} />
              <div className="resize-handle-bl" onPointerDown={(e) => handleResizeDown("bl", e)} />
              <div className="resize-handle-br" onPointerDown={(e) => handleResizeDown("br", e)} />
            </>
          )}
          <div className="chat-header" onPointerDown={handleMouseDown}>
            <div>
              <h3><TbRobotFace style={{ display: "inline", marginRight: 6, color: "#fff" }} size={18} /> Fortia AI</h3>
              <p>Modo {mode === "coach" ? "Coach" : "Analista"} · En línea</p>
            </div>
            <div className="chat-header-actions">
              {insights && insights.length > 0 && <InlineInsights insights={insights} />}
              <button
                className="chat-icon-btn"
                aria-label={ttsOn ? "Desactivar lectura por voz" : "Activar lectura por voz"}
                aria-pressed={ttsOn}
                title={ttsOn ? "Lectura por voz: ON" : "Lectura por voz: OFF"}
                onClick={() => {
                  const next = !ttsOn;
                  setTtsOn(next);
                  localStorage.setItem('chat_tts', String(next));
                }}
              >
                {ttsOn ? '🔊' : '🔇'}
              </button>
              <button className="chat-icon-btn" aria-label="Configuración del asistente" onClick={() => setShowSettings((s) => !s)} title="Configuración"><TbUserCog size={16} /></button>
              <button className="chat-icon-btn" aria-label={fullscreen ? "Restaurar tamaño" : "Pantalla completa"} onClick={() => setFullscreen((f) => !f)} title={fullscreen ? "Restaurar" : "Pantalla completa"}>
                {fullscreen ? <TbMinimize size={16} /> : <TbMaximize size={16} />}
              </button>
              <button className="chat-icon-btn" aria-label="Cerrar asistente" onClick={() => { setOpen(false); setFullscreen(false); setShowSettings(false); setPos({ x: null, y: null }); setSize({ w: 440, h: 560 }); }}>✕</button>
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
              const hasWidgets = Array.isArray(msg.widgets) && msg.widgets.length > 0;
              const hasProposals = Array.isArray(msg.proposals) && msg.proposals.length > 0;
              if (msg.role === "bot" && !msg.text && !msg.chart && !msg.simulator && !msg.streak && !msg.compare && !hasWidgets && !hasProposals && !msg.subscriptionAudit && !(msg.actions?.length)) {
                return null;
              }
              // Prefer a stable id (set when the message is created) so React's
              // reconciler doesn't get confused when widgets/proposals stream in
              // late and the message shape changes mid-render.
              const stableKey = msg.id != null ? `m-${msg.id}` : `i-${i}`;
              return (
                <div key={stableKey} className={`msg ${msg.role}${isStreamingThis ? " streaming" : ""}`}>
                  {msg.role === "bot" ? (
                    <>
                      <MessageContent text={msg.text} />
                      {/* Prefer the new widgets[] envelope (PR 2 dual-emit). Fall back to
                          legacy per-field props for messages persisted before the upgrade. */}
                      {hasWidgets ? (
                        msg.widgets.map((w, wi) => {
                          if (w.kind === "chart") return <InlineChart key={`w-${wi}`} chart={w.chart} />;
                          if (w.kind === "streak") return <InlineStreak key={`w-${wi}`} streak={w.streak} />;
                          if (w.kind === "compare") return <InlineCompare key={`w-${wi}`} compare={w.compare} />;
                          if (w.kind === "simulator") return <InlineSimulator key={`w-${wi}`} simulator={w.simulator} />;
                          if (w.kind === "gauge") return <InlineGauge key={`w-${wi}`} gauge={w.gauge} />;
                          if (w.kind === "heatmap") return <InlineHeatmap key={`w-${wi}`} heatmap={w.heatmap} />;
                          if (w.kind === "subs") return <InlineSubsBreakdown key={`w-${wi}`} subs={w.subs} />;
                          if (w.kind === "topMerchants") return <InlineTopMerchants key={`w-${wi}`} topMerchants={w.topMerchants} />;
                          if (w.kind === "savingsRate") return <InlineSavingsRate key={`w-${wi}`} savingsRate={w.savingsRate} />;
                          if (w.kind === "recCal") return <InlineRecCal key={`w-${wi}`} recCal={w.recCal} />;
                          if (w.kind === "sparklines") return <InlineSparklines key={`w-${wi}`} sparklines={w.sparklines} />;
                          return null;
                        })
                      ) : (
                        <>
                          <InlineChart chart={msg.chart} />
                          <InlineStreak streak={msg.streak} />
                          <InlineCompare compare={msg.compare} />
                          {msg.simulator && <InlineSimulator simulator={msg.simulator} />}
                        </>
                      )}
                      <InlineSubscriptionAudit audit={msg.subscriptionAudit} />
                      {hasProposals && msg.proposals.map((p) => (
                        <ActionProposalCard
                          key={p.proposal_id}
                          proposal={p}
                          tarjetas={userTarjetas}
                          onConfirm={handleConfirmProposal}
                          onCancel={handleCancelProposal}
                        />
                      ))}
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
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                <div className="dot-anim">
                  <span /><span /><span />
                </div>
                {streaming && messages.length > 0 && (
                  <span style={{ fontSize: 11, color: '#999', fontStyle: 'italic', marginLeft: 4 }}>
                    {streamStatus}
                  </span>
                )}
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
              aria-label={isListening ? "Detener dictado por voz" : "Dictar mensaje por voz"}
              aria-pressed={isListening}
              title={isListening ? "Escuchando..." : "Dictar mensaje"}
            >
              {isListening ? <TbPlayerStop size={20} /> : <TbMicrophone size={20} />}
            </button>
            <input
              className="chat-input"
              aria-label="Mensaje para el asistente"
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
                aria-label="Detener generación"
                title="Detener generación"
              >
                <TbSquare size={16} />
              </button>
            ) : (
              <button
                className="chat-send"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                aria-label="Enviar mensaje"
              >
                ➤
              </button>
            )}
          </div>
        </div>
      )}

      <button
        className="fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente Fortia"}
        aria-expanded={open}
      >
        {open ? <span style={{ fontSize: "20px", fontWeight: "bold", lineHeight: 1 }}>✕</span> : <TbRobotFace size={24} color="#fff" />}
      </button>
    </>
  );
}
