import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import PageLoader from "../components/Skeleton";
import "../styles/tarjetas.css";

const API_TARJETAS = "/api/tarjetas/";
const API_DASHBOARD = "/api/dashboard/";

export default function Tarjetas() {
  const { session } = useAuth();
  const [tarjetas, setTarjetas] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [activo, setActivo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    const inicializar = async () => {
      try {
        const res = await fetch(API_TARJETAS, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json();
        
        const procesadas = data.map(t => ({
          id: t.id_tarjeta,
          nombre: t.nombre,
          numero: "**** " + t.id_tarjeta,
          tipo: t.tipo,
          logoClass: t.tipo === "Crédito" ? "logo-credito" : "logo-debito",
          saldo: t.movimiento_financiero.reduce((acc, m) => acc + Number(m.monto), 0)
        }));

        setTarjetas(procesadas);
        cargarSoloResumen(null);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    inicializar();
  }, [session]);

  const cargarSoloResumen = async (idTarjeta) => {
    if (!session) return;
    const url = idTarjeta ? `${API_DASHBOARD}?tarjetaId=${idTarjeta}` : API_DASHBOARD;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const data = await res.json();
    setResumen(data);
  };

  const manejarSeleccion = (id) => {
    const nuevoActivo = activo === id ? null : id;
    setActivo(nuevoActivo);
    
    //Sincronizacion con Dashboard
    if (nuevoActivo) localStorage.setItem("tarjeta_preferida", nuevoActivo);
    else localStorage.removeItem("tarjeta_preferida");
    
    cargarSoloResumen(nuevoActivo);
  };

  if (loading) return <PageLoader />;

  return (
    <main className="page-body">
      <div className="page-breadcrumb">Cuentas y Tarjetas › <strong>Mis Cuentas</strong></div>

      <div className="items-list">
        {tarjetas.map(t => (
          <div key={t.id} className={`item-card ${activo === t.id ? "active" : ""}`} onClick={() => manejarSeleccion(t.id)}>
            <div className={`item-logo ${t.logoClass}`}>BN</div>
            <div className="item-info">
              <div className="item-name">{t.nombre}</div>
              <div className="item-numero">{t.numero}</div>
            </div>
            <div className="item-right">
              <div className="item-saldo-label">Saldo Actual</div>
              <div className="item-saldo-value">${Math.abs(t.saldo).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      {resumen && (
        <div className="resumen-container" style={{ marginTop: '20px' }}>
          <div className="section-title">Resumen de {activo ? 'Cuenta' : 'Efectivo Total'}</div>
          <div className="resumen-row" style={{ display: 'flex', gap: '15px' }}>
            <div className="resumen-card">
              <div className="resumen-label">Ingresos Totales</div>
              <div className="resumen-value" style={{ color: '#6CC04A' }}>+${resumen.totales.ingresos.toLocaleString()}</div>
            </div>
            <div className="resumen-card">
              <div className="resumen-label">Gastos Totales</div>
              <div className="resumen-value" style={{ color: '#EB0029' }}>-${resumen.totales.gastos.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}