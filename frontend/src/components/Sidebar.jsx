import { useNavigate, useLocation } from "react-router-dom";
import iconDashboard   from "../assets/inspeccion.png";
import iconAnalisis    from "../assets/home.png";
import iconInversiones from "../assets/settings.png";
import iconTarjetas    from "../assets/tarjetas.png";
import banorteLogo     from "../assets/Logo_de_Banorte.svg";
import MetasAhorro from "../assets/metasdeahorro.jpg";

const styles = `
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  /* ── TOPBAR GLOBAL ── */
  .global-topbar {
    width: 100vw;
    height: 56px;
    background: #cc0000;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    box-sizing: border-box;
    flex-shrink: 0;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 100;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  }
  .global-topbar img {
    height: 30px;
    width: auto;
    filter: brightness(0) invert(1);
  }
  .logout-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3);
    color: #ffffff;
    font-size: 13px;
    font-weight: 600;
    font-family: 'DM Sans', sans-serif;
    padding: 7px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .logout-btn:hover { background: rgba(255,255,255,0.28); }
  .logout-btn svg {
    width: 15px;
    height: 15px;
    stroke: #fff;
    flex-shrink: 0;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    width: 180px;
    min-width: 180px;
    background: #ffffff;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    padding: 20px 0;
    position: fixed;
    top: 56px;
    left: 0;
    bottom: 0;
    z-index: 99;
  }
  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 18px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: #666;
    border-left: 3px solid transparent;
    transition: all 0.15s;
    font-family: 'DM Sans', sans-serif;
  }
  .nav-item:hover { background: #f9f9f9; color: #333; }
  .nav-item.active {
    background: #fff5f5;
    color: #cc0000;
    border-left: 3px solid #cc0000;
    font-weight: 600;
  }
  .nav-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
    opacity: 0.5;
  }
  .nav-item.active .nav-icon {
    opacity: 1;
  }
`;

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { icon: iconDashboard,   label: "Dashboard",           path: "/dashboard"   },
    { icon: iconInversiones, label: "Inversiones",         path: "/inversiones" },
    { icon: iconAnalisis,    label: "Análisis Financiero", path: "/analisis"    },
    { icon: iconTarjetas,    label: "Tarjetas y Cuentas",  path: "/tarjetas"    },
    { icon: MetasAhorro,     label: "Metas de Ahorro",     path: "/metas"       },
  ];

  const handleLogout = () => {
    // localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <>
      <style>{styles}</style>

      {/* Topbar global fija arriba */}
      <div className="global-topbar">
        <img src={banorteLogo} alt="Banorte" />
        <button className="logout-btn" onClick={handleLogout}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Cerrar sesión
        </button>
      </div>

      {/* Sidebar fijo a la izquierda debajo de la topbar */}
      <aside className="sidebar">
        {items.map((item) => (
          <div
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
            onClick={() => navigate(item.path)}
          >
            <img src={item.icon} alt={item.label} className="nav-icon" />
            <span>{item.label}</span>
          </div>
        ))}
      </aside>
    </>
  );
}