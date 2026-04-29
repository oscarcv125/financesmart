import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import PageLoader from "../components/Skeleton";
import "../styles/analisisfinanciero.css";
import { BACKEND_URL } from "../config";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, CartesianGrid,
} from "recharts";
import { TbBulb, TbCash, TbTrendingUp, TbPigMoney } from "react-icons/tb";

const TABS = ["Mensual", "Trimestral", "Anual"];
const PIE_COLORS = ["#EB0029", "#FFA400", "#fdd835", "#43a047", "#1976d2", "#8e24aa"];

const fmt = (v) => `$${Number(v).toLocaleString("es-MX", { minimumFractionDigits: 0 })}`;
const fmtMXN = (v) => `$${Number(v).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;

export default function AnalisisFinanciero() {
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState("Mensual");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    fetch(`${BACKEND_URL}/api/analisis/resumen?periodo=${activeTab}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error al cargar análisis:", err);
        setLoading(false);
      });
  }, [activeTab, session]);

  if (loading) return <PageLoader />;
  if (!data || data.gastosDiarios.length === 0) return (
    <div className="page-body">
      <div className="tabs">
        {TABS.map(tab => (
          <button key={tab} className={`tab-btn ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>
      <p style={{marginTop: "20px"}}>No hay movimientos registrados en este periodo.</p>
    </div>
  );

  // Calcular KPIs
  const totalGastos = Math.abs(data.gastosDiarios.reduce((s, d) => s + (d.gasto || 0), 0));
  const totalIngresos = data.gastosDiarios.reduce((s, d) => s + (d.ingreso || 0), 0);
  const ahorroNeto = totalIngresos - totalGastos;
  const pctAhorro = totalIngresos > 0 ? Math.round((ahorroNeto / totalIngresos) * 100) : 0;

  // Agrupar por semanas para Mensual
  const agruparSemanas = (dias) => {
    const semanas = [
      { label: "Sem 1", gasto: 0, ingreso: 0 },
      { label: "Sem 2", gasto: 0, ingreso: 0 },
      { label: "Sem 3", gasto: 0, ingreso: 0 },
      { label: "Sem 4", gasto: 0, ingreso: 0 },
    ];
    dias.forEach(d => {
      const n = parseInt(d.label, 10);
      const idx = n <= 7 ? 0 : n <= 14 ? 1 : n <= 21 ? 2 : 3;
      semanas[idx].gasto += d.gasto || 0;
      semanas[idx].ingreso += d.ingreso || 0;
    });
    return semanas;
  };

  const barData = activeTab === "Mensual" ? agruparSemanas(data.gastosDiarios) : data.gastosMensuales;

  // Top 5 categorías
  const totalCat = data.categorias.reduce((s, c) => s + Math.abs(c.value), 0);
  const top5 = [...data.categorias]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5)
    .map(c => ({ ...c, pct: totalCat > 0 ? Math.round((Math.abs(c.value) / totalCat) * 100) : 0, value: Math.abs(c.value) }));

  const barChartTitle = activeTab === "Mensual" ? "Gasto semanal" : "Tendencia mensual";
  const barChartSubtitle = activeTab === "Mensual"
    ? "Gastos agrupados por semana del mes"
    : activeTab === "Trimestral" ? "Últimos 3 meses" : "Últimos 12 meses";

  return (
    <main className="page-body">
      <div className="page-breadcrumb">Análisis Financiero › <strong>{activeTab}</strong></div>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-icon kpi-icon--red"><TbCash size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-label">Total Gastos</span>
            <span className="kpi-value red">{fmtMXN(totalGastos)}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon kpi-icon--green"><TbTrendingUp size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-label">Total Ingresos</span>
            <span className="kpi-value green">{fmtMXN(totalIngresos)}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: ahorroNeto >= 0 ? "#e8f5e9" : "#fff5f5" }}>
            <TbPigMoney size={22} color={ahorroNeto >= 0 ? "#6CC04A" : "#EB0029"} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Ahorro Neto</span>
            <span className={`kpi-value ${ahorroNeto >= 0 ? "green" : "red"}`}>{fmtMXN(ahorroNeto)}</span>
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-icon kpi-icon--orange"><TbTrendingUp size={22} /></div>
          <div className="kpi-info">
            <span className="kpi-label">% Ahorro</span>
            <span className={`kpi-value ${pctAhorro >= 20 ? "green" : "red"}`}>{pctAhorro}%</span>
            <span className="kpi-sub">del ingreso</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        <div className="chart-card">
          <div className="chart-card-header">
            <span className="chart-card-title">Flujo del período</span>
            <span className="chart-card-subtitle">Ingresos vs Gastos</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.gastosDiarios}>
              <defs>
                <linearGradient id="colorIngreso" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6CC04A" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6CC04A" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorGasto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EB0029" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#EB0029" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(label) => {
                  if (activeTab !== "Mensual") return label;
                  const n = parseInt(label, 10);
                  return n % 5 === 0 ? label : "";
                }}
                interval={0}
              />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => fmtMXN(v)} />
              <Area type="monotone" dataKey="ingreso" stroke="#6CC04A" fillOpacity={1} fill="url(#colorIngreso)" strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="gasto" stroke="#EB0029" fillOpacity={1} fill="url(#colorGasto)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <span className="chart-card-title">Gastos por categoría</span>
            <span className="chart-card-subtitle">Top {top5.length} categorías</span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={top5}
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                paddingAngle={3}
                label={({ pct }) => `${pct}%`}
                labelLine={false}
              >
                {top5.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmtMXN(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="cat-table">
            {top5.map((c, i) => (
              <div key={i} className="cat-row">
                <div className="cat-row-top">
                  <span className="cat-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="cat-name">{c.name}</span>
                  <span className="cat-pct">{c.pct}%</span>
                  <span className="cat-value">{fmt(c.value)}</span>
                </div>
                <div className="cat-progress-bg">
                  <div className="cat-progress-fill" style={{ width: `${c.pct}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="chart-card">
        <div className="chart-card-header">
          <span className="chart-card-title">{barChartTitle}</span>
          <span className="chart-card-subtitle">{barChartSubtitle}</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="#EBF0F2" vertical={false} />
            <XAxis
              dataKey={activeTab === "Mensual" ? "label" : "mes"}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`}
            />
            <Tooltip
              formatter={(v, name) => [fmtMXN(v), name === "gasto" ? "Gastos" : "Ingresos"]}
              contentStyle={{ background: "#fff", border: "1px solid #CFD2D3", borderRadius: 6 }}
            />
            <Bar dataKey="gasto" fill="#EB0029" radius={[6, 6, 0, 0]} maxBarSize={60} />
            <Bar dataKey="ingreso" fill="#6CC04A" radius={[6, 6, 0, 0]} maxBarSize={60} />
          </BarChart>
        </ResponsiveContainer>
        <div className="bar-legend">
          <span className="bar-legend-item"><span className="bar-dot" style={{ background: "#EB0029" }}/> Gastos</span>
          <span className="bar-legend-item"><span className="bar-dot" style={{ background: "#6CC04A" }}/> Ingresos</span>
        </div>
      </div>

      {/* Tip Banner */}
      {(() => {
        if (!top5.length || totalCat === 0) return null;
        const topCat = top5[0];
        const isGoodSaver = pctAhorro >= 20;
        const isWarning = topCat.pct >= 40;
        const tip = isWarning
          ? `Tu mayor gasto es ${topCat.name} con ${fmt(topCat.value)} (${topCat.pct}% del total). Revisa esta categoría para mejorar tu ahorro.`
          : isGoodSaver
          ? `Excelente. Estás ahorrando el ${pctAhorro}% de tus ingresos. Tu gasto más alto es ${topCat.name} (${topCat.pct}%).`
          : `Tu categoría principal es ${topCat.name} con ${fmt(topCat.value)} (${topCat.pct}%). Tu tasa de ahorro es ${pctAhorro}%.`;
        const color = isWarning ? "#EB0029" : isGoodSaver ? "#6CC04A" : "#FFA400";
        return (
          <div className="tip-banner" style={{ borderLeftColor: color, background: `${color}08`, borderColor: `${color}33` }}>
            <TbBulb size={20} style={{ color, flexShrink: 0 }} />
            <p>{tip}</p>
          </div>
        );
      })()}
    </main>
  );
}
