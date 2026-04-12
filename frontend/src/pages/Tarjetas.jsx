import { useState } from "react";
import "../styles/tarjetas.css";

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
      <div className="app-layout">
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