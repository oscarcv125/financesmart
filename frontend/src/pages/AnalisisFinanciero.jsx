import "../styles/analisisfinanciero.css";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";

const TABS = ["Mensual", "Trimestral", "Anual"];
import { useState } from "react";

const gastosDiarios = [
  { dia: "01", gasto: 0,   ingreso: 0    },
  { dia: "05", gasto: 0,   ingreso: 5000 },
  { dia: "08", gasto: 120, ingreso: 0    },
  { dia: "10", gasto: 149, ingreso: 0    },
  { dia: "13", gasto: 85,  ingreso: 0    },
  { dia: "15", gasto: 0,   ingreso: 600  },
  { dia: "17", gasto: 210, ingreso: 0    },
  { dia: "19", gasto: 500, ingreso: 0    },
  { dia: "22", gasto: 175, ingreso: 0    },
  { dia: "24", gasto: 90,  ingreso: 0    },
  { dia: "26", gasto: 454, ingreso: 0    },
];

const gastosMensuales = [
  { mes: "Sep", gasto: 2800 },
  { mes: "Oct", gasto: 3100 },
  { mes: "Nov", gasto: 2600 },
  { mes: "Dic", gasto: 4200 },
  { mes: "Ene", gasto: 3080 },
  { mes: "Feb", gasto: 3760 },
];

const PIE_COLORS = ["#EB0029", "#ff6f00", "#fdd835", "#43a047", "#1976d2", "#8e24aa"];

const categorias = [
  { name: "Efectivo",      value: 500 },
  { name: "Suscripciones", value: 348 },
  { name: "Comida",        value: 199 },
  { name: "Snacks",        value: 56  },
];

export default function AnalisisFinanciero() {
  const [activeTab, setActiveTab] = useState("Mensual");

  return (
    <main className="page-body">

      <div className="page-breadcrumb">
        Análisis Financiero › <strong>Resumen</strong>
      </div>

      {/* Tabs */}
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

      {/* Flujo del mes + Gastos por categoría */}
      <div className="charts-row">
        <div className="chart-card">
          <span className="chart-card-title">Flujo del mes</span>
          <span className="chart-card-subtitle">Gastos e ingresos diarios — Febrero 2026</span>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={gastosDiarios} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradGasto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#EB0029" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#EB0029" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradIngreso" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6CC04A" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#6CC04A" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, fontFamily: "'DM Sans', sans-serif" }}
                formatter={(v, name) => [`$${v.toLocaleString()}`, name === "gasto" ? "Gasto" : "Ingreso"]}
                labelFormatter={(l) => `Día ${l}`}
              />
              <Area type="monotone" dataKey="ingreso" stroke="#6CC04A" strokeWidth={2} fill="url(#gradIngreso)" />
              <Area type="monotone" dataKey="gasto"   stroke="#EB0029" strokeWidth={2} fill="url(#gradGasto)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <span className="chart-card-title">Gastos por categoría</span>
          <span className="chart-card-subtitle">Distribución de febrero</span>
          <ResponsiveContainer width="100%" height={170}>
            <PieChart>
              <Pie
                data={categorias}
                cx="50%" cy="50%"
                innerRadius={45} outerRadius={75}
                dataKey="value"
                startAngle={90} endAngle={-270}
                paddingAngle={3}
              >
                {categorias.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, fontFamily: "'DM Sans', sans-serif" }}
                formatter={(v, name) => [`$${v.toLocaleString()}`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend">
            {categorias.map((c, i) => (
              <div key={i} className="pie-legend-item">
                <span className="pie-legend-dot" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {c.name} · ${c.value.toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tendencia de gastos */}
      <div className="chart-card">
        <span className="chart-card-title">Tendencia de gastos</span>
        <span className="chart-card-subtitle">Últimos 6 meses</span>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={gastosMensuales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, fontFamily: "'DM Sans', sans-serif" }}
              formatter={(v) => [`$${v.toLocaleString()}`, "Gasto"]}
            />
            <Bar dataKey="gasto" radius={[6, 6, 0, 0]}>
              {gastosMensuales.map((_, i) => (
                <Cell key={i} fill={i === gastosMensuales.length - 1 ? "#EB0029" : "#CFD2D3"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tip */}
      <div className="tip-banner">
        <span style={{ fontSize: 22 }}>💡</span>
        <p>Tu consumo se está desviando un poco en comidas de snack como son los cafés del Andatti</p>
      </div>

    </main>
  );
}