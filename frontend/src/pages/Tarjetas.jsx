import { useState } from "react";
import Sidebar from "../components/Sidebar";


const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .app-layout {
    display: flex; height: 100vh; width: 100vw;
    overflow: hidden; font-family: 'DM Sans', sans-serif;
    position: fixed; top: 0; left: 0;
    padding-top: 56px; padding-left: 180px;
  }
  .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .page-body {
    flex: 1; overflow-y: auto;
    padding: 24px 28px;
    background: #f4f5f7;
    display: flex; flex-direction: column; gap: 24px;
  }

  .page-breadcrumb { font-size: 13px; color: #888; }
  .page-breadcrumb strong { color: #333; font-weight: 600; }

  .section-title {
    font-size: 16px; font-weight: 700; color: #222;
    margin-bottom: 12px;
  }

  .items-list {
    display: flex; flex-direction: column; gap: 10px;
  }

  .item-card {
    background: #fff; border-radius: 14px;
    padding: 18px 22px;
    display: flex; align-items: center; gap: 16px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    border: 1px solid #ebebeb;
    cursor: pointer;
    transition: box-shadow 0.15s, transform 0.15s;
  }
  .item-card:hover { box-shadow: 0 6px 20px rgba(0,0,0,0.1); transform: translateY(-1px); }
  .item-card.active { border-color: #cc0000; box-shadow: 0 0 0 2px rgba(204,0,0,0.15); }

  .item-logo {
    width: 48px; height: 48px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; font-weight: 700; font-size: 13px;
    color: #fff; letter-spacing: 0.5px;
  }
  .logo-debito  { background: linear-gradient(135deg, #cc0000, #880000); }
  .logo-credito { background: linear-gradient(135deg, #1a1a2e, #16213e); }
  .logo-ahorro  { background: linear-gradient(135deg, #1b5e20, #2e7d32); }

  .item-info { flex: 1; }
  .item-name { font-size: 14px; font-weight: 700; color: #111; margin-bottom: 3px; }
  .item-numero { font-size: 12px; color: #aaa; }

  .item-right { text-align: right; }
  .item-saldo-label { font-size: 11px; color: #aaa; margin-bottom: 2px; }
  .item-saldo-value { font-size: 16px; font-weight: 700; color: #111; }

  /* Historial */
  .historial-card {
    background: #fff; border-radius: 12px;
    overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
  .historial-header {
    padding: 16px 20px; border-bottom: 1px solid #f0f0f0;
    display: flex; align-items: center; justify-content: space-between;
  }
  .historial-title { font-size: 15px; font-weight: 700; color: #222; }
  .historial-tag {
    font-size: 11px; font-weight: 600; padding: 4px 10px;
    border-radius: 20px; background: #fff0f0; color: #cc0000;
  }
  .mov-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .mov-table thead tr { background: #f8f8f8; }
  .mov-table th { padding: 11px 18px; text-align: left; font-weight: 600; color: #666; font-size: 12px; }
  .mov-table td { padding: 13px 18px; border-bottom: 1px solid #f0f0f0; color: #333; }
  .mov-table tr:last-child td { border-bottom: none; }
  .mov-table tr:hover td { background: #fafafa; }
  .badge-gasto   { color: #e53935; font-weight: 600; }
  .badge-ingreso { color: #43a047; font-weight: 600; }
  .categoria-pill {
    display: inline-block; padding: 3px 10px; border-radius: 20px;
    font-size: 11px; font-weight: 500; background: #f0f0f0; color: #555;
  }
  .monto-neg { color: #e53935; font-weight: 600; }
  .monto-pos { color: #43a047; font-weight: 600; }
`;

const cuentas = [
  { id: 3, nombre: "Cuenta de Ahorro Banorte", numero: "**** **** **** 7754", saldo: 15320.00, logoClass: "logo-ahorro", tipo: "Ahorro",  label: "Saldo" },
];

const tarjetas = [
  { id: 1, nombre: "Tarjeta de Débito Banorte",  numero: "**** **** **** 4821", saldo: 1240.68,  logoClass: "logo-debito",  tipo: "Débito",  label: "Saldo" },
  { id: 2, nombre: "Tarjeta de Crédito Banorte", numero: "**** **** **** 3390", saldo: 8500.00,  logoClass: "logo-credito", tipo: "Crédito", label: "Crédito disponible" },
];

const historial = {
  1: [
    { fecha: "26/02", descripcion: "Uber Eats",    categoria: "Comida",        tipo: "Gasto",   monto: -199.00  },
    { fecha: "26/02", descripcion: "OXXO Tec",     categoria: "Tienda",        tipo: "Gasto",   monto: -56.00   },
    { fecha: "26/02", descripcion: "Spotify",      categoria: "Suscripción",   tipo: "Gasto",   monto: -199.00  },
    { fecha: "19/02", descripcion: "Retiro ATM",   categoria: "Efectivo",      tipo: "Gasto",   monto: -500.00  },
    { fecha: "15/02", descripcion: "Transferencia",categoria: "Transferencia", tipo: "Ingreso", monto: +600.00  },
    { fecha: "05/02", descripcion: "Nómina",       categoria: "Ingreso",       tipo: "Ingreso", monto: +5000.00 },
  ],
  2: [
    { fecha: "25/02", descripcion: "Liverpool",    categoria: "Ropa",          tipo: "Gasto",   monto: -1200.00 },
    { fecha: "22/02", descripcion: "Netflix",      categoria: "Suscripción",   tipo: "Gasto",   monto: -149.00  },
    { fecha: "18/02", descripcion: "Gasolina",     categoria: "Transporte",    tipo: "Gasto",   monto: -600.00  },
    { fecha: "10/02", descripcion: "Amazon",       categoria: "Compras",       tipo: "Gasto",   monto: -349.00  },
  ],
  3: [
    { fecha: "01/02", descripcion: "Depósito",     categoria: "Ahorro",        tipo: "Ingreso", monto: +2000.00 },
    { fecha: "01/01", descripcion: "Depósito",     categoria: "Ahorro",        tipo: "Ingreso", monto: +2000.00 },
    { fecha: "01/12", descripcion: "Depósito",     categoria: "Ahorro",        tipo: "Ingreso", monto: +1500.00 },
  ],
};

const todos = [...cuentas, ...tarjetas];

export default function Tarjetas() {
  const [activo, setActivo] = useState(3);
  const itemActivo = todos.find(t => t.id === activo);
  const movimientos = historial[activo] || [];

  return (
    <>
      <style>{styles}</style>
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <main className="page-body">

            <div className="page-breadcrumb">
              Cuentas y Tarjetas › <strong>Mis cuentas</strong>
            </div>

            {/* Cuentas */}
            <div>
              <div className="section-title">Cuentas</div>
              <div className="items-list">
                {cuentas.map(c => (
                  <div
                    key={c.id}
                    className={`item-card ${activo === c.id ? "active" : ""}`}
                    onClick={() => setActivo(c.id)}
                  >
                    <div className={`item-logo ${c.logoClass}`}>BN</div>
                    <div className="item-info">
                      <div className="item-name">{c.nombre}</div>
                      <div className="item-numero">{c.numero}</div>
                    </div>
                    <div className="item-right">
                      <div className="item-saldo-label">{c.label}</div>
                      <div className="item-saldo-value">
                        ${c.saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tarjetas */}
            <div>
              <div className="section-title">Tarjetas</div>
              <div className="items-list">
                {tarjetas.map(t => (
                  <div
                    key={t.id}
                    className={`item-card ${activo === t.id ? "active" : ""}`}
                    onClick={() => setActivo(t.id)}
                  >
                    <div className={`item-logo ${t.logoClass}`}>BN</div>
                    <div className="item-info">
                      <div className="item-name">{t.nombre}</div>
                      <div className="item-numero">{t.numero}</div>
                    </div>
                    <div className="item-right">
                      <div className="item-saldo-label">{t.label}</div>
                      <div className="item-saldo-value">
                        ${t.saldo.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historial */}
            <div className="historial-card">
              <div className="historial-header">
                <span className="historial-title">Historial de movimientos</span>
                <span className="historial-tag">{itemActivo.tipo} · {itemActivo.numero}</span>
              </div>
              <table className="mov-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Categoría</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov, i) => (
                    <tr key={i}>
                      <td>{mov.fecha}</td>
                      <td>{mov.descripcion}</td>
                      <td><span className="categoria-pill">{mov.categoria}</span></td>
                      <td className={mov.tipo === "Gasto" ? "badge-gasto" : "badge-ingreso"}>{mov.tipo}</td>
                      <td className={mov.monto < 0 ? "monto-neg" : "monto-pos"}>
                        {mov.monto < 0 ? "-" : "+"}${Math.abs(mov.monto).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </main>
        </div>
      </div>
    </>
  );
}