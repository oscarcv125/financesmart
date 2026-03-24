import { useState, useEffect } from "react";
import axios from "axios";
import {
  BarChart, Bar, XAxis, YAxis, Cell, Tooltip, ResponsiveContainer,
  PieChart, Pie,
} from "recharts";
import Sidebar from "../components/Sidebar";


const TABS = ["Mensual", "Trimestral", "Anual"];

const CustomBarLabel = ({ x, y, width, value }) => (
  <text x={x + width / 2} y={y - 6} fill="#555" textAnchor="middle" fontSize={12} fontFamily="'DM Sans', sans-serif">
    ${(value / 1000).toFixed(1)}k
  </text>
);

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .app-layout {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    font-family: 'DM Sans', sans-serif;
    position: fixed;
    top: 0; left: 0;
    padding-top: 56px;
    padding-left: 180px;
  }
  .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .page-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    background: #f4f5f7;
  }
  .page-breadcrumb { font-size: 13px; color: #888; }
  .page-breadcrumb strong { color: #333; font-weight: 600; }
  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 2px solid #e0e0e0;
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
  .charts-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
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
  .chart-card-title { font-size: 13px; font-weight: 600; color: #444; }
  .chart-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    padding-top: 8px;
    border-top: 1px solid #f0f0f0;
    margin-top: 4px;
  }
  .chart-toggle span { font-size: 13px; text-decoration: underline; color: #444; font-weight: 500; }
  .chart-toggle small { font-size: 11px; color: #888; }
  .tip-banner {
    background: #fff8e1;
    border: 1px solid #ffe082;
    border-radius: 12px;
    padding: 14px 20px;
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .tip-banner p { font-size: 13px; color: #666; line-height: 1.5; }
`;

export default function AnalisisFinanciero() {
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
          { name: "Snacks",    value: 25, color: "#e53935" },
          { name: "Ocio",      value: 40, color: "#fdd835" },
        ]);
      });
  }, [activeTab]);

  return (
    <>
      <style>{styles}</style>
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <main className="page-body">
            <div className="page-breadcrumb">
              Análisis Financiero › <strong>Resumen</strong>
            </div>

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
                <span className="chart-card-title">Gastos por período</span>
                {barOpen && (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} margin={{ top: 20, right: 10, left: -10, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, "Gasto"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
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

              <div className="chart-card">
                <span className="chart-card-title">Distribución de gastos</span>
                {pieOpen && (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" startAngle={90} endAngle={-270}>
                        {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="#fff" strokeWidth={2} />)}
                      </Pie>
                      <Tooltip formatter={(v, name) => [`${v}%`, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="chart-toggle" onClick={() => setPieOpen((o) => !o)}>
                  <span>Grafica de pay</span>
                  <small>{pieOpen ? "▲" : "▼"}</small>
                </div>
              </div>
            </div>

            <div className="tip-banner">
              <span style={{ fontSize: 22 }}>💡</span>
              <p>Tu consumo se está desviando un poco en comidas de snack como son los cafes del Andatti</p>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}