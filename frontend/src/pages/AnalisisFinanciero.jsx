import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import PageLoader from "../components/Skeleton";
import "../styles/analisisfinanciero.css";
import { BACKEND_URL } from "../config";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";

const TABS = ["Mensual", "Trimestral", "Anual"];
const PIE_COLORS = ["#EB0029", "#ff6f00", "#fdd835", "#43a047", "#1976d2", "#8e24aa"];

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

      <div className="charts-row">
        <div className="chart-card">
          <span className="chart-card-title">Flujo del periodo</span>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.gastosDiarios}>
              <XAxis dataKey="label" tick={{fontSize: 11}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize: 10}} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Area type="monotone" dataKey="ingreso" stroke="#6CC04A" fillOpacity={0.1} fill="#6CC04A" strokeWidth={2} />
              <Area type="monotone" dataKey="gasto" stroke="#EB0029" fillOpacity={0.1} fill="#EB0029" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <span className="chart-card-title">Gastos por categoría</span>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie data={data.categorias} innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                {data.categorias.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend">
            {data.categorias.map((c, i) => (
              <div key={i} className="pie-legend-item">
                <span className="pie-legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {c.name} · ${c.value.toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="chart-card" style={{ marginTop: "20px" }}>
        <span className="chart-card-title">Tendencia de gastos</span>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.gastosMensuales}>
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
            <Bar dataKey="gasto" radius={[6, 6, 0, 0]}>
              {data.gastosMensuales.map((_, i) => (
                <Cell key={i} fill={i === data.gastosMensuales.length - 1 ? "#EB0029" : "#CFD2D3"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {(() => {
        const totalGastos = data.categorias.reduce((s, c) => s + c.value, 0);
        const top = data.categorias.reduce((a, b) => a.value > b.value ? a : b, data.categorias[0]);
        if (!top || totalGastos === 0) return null;
        const pct = Math.round((top.value / totalGastos) * 100);
        const tip = pct >= 40
          ? `Tu mayor gasto es en ${top.name} con $${top.value.toLocaleString()} (${pct}% del total). Considera revisar esta categoría.`
          : `Tus finanzas se ven equilibradas. Tu mayor categoría es ${top.name} con $${top.value.toLocaleString()} (${pct}%).`;
        return (
          <div className="tip-banner">
            <span>💡</span>
            <p>{tip}</p>
          </div>
        );
      })()}
    </main>
  );
}