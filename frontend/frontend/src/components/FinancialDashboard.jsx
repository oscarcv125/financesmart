import { useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer,
  PieChart, Pie,
} from "recharts";

const TABS = ["Mensual", "Trimestral", "Anual"];

const CustomBarLabel = ({ x, y, width, value }) => (
  <text x={x + width / 2} y={y - 6} fill="#555" textAnchor="middle" fontSize={12} fontFamily="'DM Sans', sans-serif">
    ${(value / 1000).toFixed(1)}k
  </text>
);

export default function FinancialDashboard() {
  const [activeTab, setActiveTab] = useState("Mensual");
  const [barOpen, setBarOpen] = useState(true);
  const [pieOpen, setPieOpen] = useState(true);
  const [barData, setBarData] = useState([]);
  const [pieData, setPieData] = useState([]);

  useEffect(() => {
    axios
      .get(`http://localhost:3001/api/finanzas/${activeTab.toLowerCase()}`)
      .then((res) => {
        setBarData(res.data.barras);
        setPieData(res.data.pay);
      })
      .catch(() => {
        setBarData([
          { name: "Ene", value: 3200, color: "#e53935" },
          { name: "Feb", value: 5800, color: "#43a047" },
          { name: "Mar", value: 4500, color: "#fdd835" },
        ]);
        setPieData([
          { name: "Inversión", value: 35, color: "#43a047" },
          { name: "Snacks", value: 25, color: "#e53935" },
          { name: "Ocio", value: 40, color: "#fdd835" },
        ]);
      });
  }, [activeTab]);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'DM Sans', sans-serif; background: #f4f5f7; }

.app-layout {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
}

        /* ── Sidebar ── */
        .sidebar {
          width: 200px;
          min-width: 200px;
          background: #ffffff;
          border-right: 1px solid #e0e0e0;
          display: flex;
          flex-direction: column;
          padding: 24px 0;
          gap: 4px;
        }
        .sidebar-logo {
          padding: 0 20px 24px;
          font-size: 18px;
          font-weight: 700;
          color: #cc0000;
          letter-spacing: -0.5px;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: #666;
          border-left: 3px solid transparent;
          transition: all 0.15s;
        }
        .nav-item:hover { background: #f9f9f9; color: #333; }
        .nav-item.active {
          background: #fff5f5;
          color: #cc0000;
          border-left: 3px solid #cc0000;
          font-weight: 600;
        }
        .nav-icon { font-size: 18px; }

        /* ── Main ── */
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* ── Topbar ── */
        .topbar {
          background: #cc0000;
          height: 56px;
          display: flex;
          align-items: center;
          padding: 0 28px;
          gap: 12px;
        }
        .topbar-title {
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 0.2px;
        }
        .topbar-breadcrumb {
          color: rgba(255,255,255,0.6);
          font-size: 13px;
        }
        .topbar-sep { color: rgba(255,255,255,0.4); }

        /* ── Page body ── */
        .page-body {
          flex: 1;
          overflow-y: auto;
          padding: 28px 32px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        /* ── Tabs ── */
        .tabs {
          display: flex;
          gap: 4px;
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 0;
        }
        .tab-btn {
          border: none;
          background: transparent;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 500;
          color: #888;
          padding: 10px 24px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -2px;
          transition: all 0.15s;
          text-decoration: underline;
        }
        .tab-btn:hover { color: #333; }
        .tab-btn.active {
          background: #cc0000;
          color: #fff;
          font-weight: 700;
          border-radius: 6px 6px 0 0;
          border-bottom: 2px solid #cc0000;
          text-decoration: none;
        }

        /* ── Charts row ── */
        .charts-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        .chart-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 20px 20px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .chart-card-title {
          font-size: 13px;
          font-weight: 600;
          color: #444;
        }
        .chart-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          padding-top: 6px;
          border-top: 1px solid #f0f0f0;
          margin-top: 4px;
        }
        .chart-toggle span {
          font-size: 13px;
          text-decoration: underline;
          color: #444;
          font-weight: 500;
        }
        .chart-toggle small { font-size: 11px; color: #888; }

        /* ── Tip banner ── */
        .tip-banner {
          background: #fff8e1;
          border: 1px solid #ffe082;
          border-radius: 12px;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .tip-banner p {
          font-size: 13px;
          color: #666;
          line-height: 1.5;
        }

        /* ── FAB ── */
        .fab {
          position: fixed;
          bottom: 28px;
          right: 28px;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: #cc0000;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(204,0,0,0.35);
          cursor: pointer;
          font-size: 22px;
          transition: transform 0.15s;
          z-index: 100;
        }
        .fab:hover { transform: scale(1.08); }
      `}</style>

      <div className="app-layout">

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-logo">💰 FinanceSmart</div>
          <NavItem icon="📊" label="Dashboard" active={false} />
          <NavItem icon="📈" label="Inversiones" active={false} />
          <NavItem icon="🎯" label="Análisis Financiero" active={true} />
        </aside>

        {/* Main */}
        <div className="main-content">

          {/* Topbar */}
          <header className="topbar">
            <span className="topbar-breadcrumb">Análisis Financiero</span>
            <span className="topbar-sep">›</span>
            <span className="topbar-title">Resumen</span>
          </header>

          {/* Page body */}
          <main className="page-body">

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

            {/* Charts */}
            <div className="charts-row">

              {/* Bar chart */}
              <div className="chart-card">
                <span className="chart-card-title">Gastos por período</span>
                {barOpen && (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontFamily: "'DM Sans', sans-serif" }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, "Gasto"]} contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} label={<CustomBarLabel />}>
                        {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <div className="chart-toggle" onClick={() => setBarOpen((o) => !o)}>
                  <span>Grafica de barras</span>
                  <small>{barOpen ? "▲" : "▼"}</small>
                </div>
              </div>

              {/* Pie chart */}
              <div className="chart-card">
                <span className="chart-card-title">Distribución de gastos</span>
                {pieOpen && (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} innerRadius={0} dataKey="value" startAngle={90} endAngle={-270}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />)}
                      </Pie>
                      <Tooltip formatter={(v, name) => [`${v}%`, name]} contentStyle={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="chart-toggle" onClick={() => setPieOpen((o) => !o)}>
                  <span>Grafica de pay</span>
                  <small>{pieOpen ? "▲" : "▼"}</small>
                </div>
              </div>
            </div>

            {/* Tip */}
            <div className="tip-banner">
              <span style={{ fontSize: 22 }}>💡</span>
              <p>Tu consumo se está desviando un poco en comidas de snack como son los cafes del Andatti</p>
            </div>

          </main>
        </div>
      </div>

      {/* FAB */}
      <div className="fab">🤖</div>
    </>
  );
}

function NavItem({ icon, label, active }) {
  return (
    <div className={`nav-item ${active ? "active" : ""}`}>
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
    </div>
  );
}