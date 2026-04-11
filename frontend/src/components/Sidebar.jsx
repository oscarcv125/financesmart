import { useNavigate, useLocation } from "react-router-dom";
import banorteLogo from "../assets/Logo_de_Banorte.svg";
import { MdDashboard, MdSavings } from "react-icons/md";
import { RiStockLine } from "react-icons/ri";
import { BsCreditCard2Back } from "react-icons/bs";
import { TbChartBar } from "react-icons/tb";

const styles = `
  /* ── TOPBAR GLOBAL ── */
  .global-topbar {
    width: 100vw;
    height: 63px;
    background: #EB0029;
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
    box-shadow: 0 3px 6px rgba(0,0,0,0.16);
  }
  .global-topbar img {
    height: 33px;
    width: auto;
    filter: brightness(0) invert(1);
  }
  .logout-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    background: transparent;
    border: none;
    color: #ffffff;
    font-size: 15px;
    font-weight: 500;
    font-family: 'Gotham', 'DM Sans', sans-serif;
    padding: 7px 16px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.15s;
  }
  .logout-btn:hover { background: rgba(255,255,255,0.15); }
  .logout-btn svg {
    width: 18px;
    height: 18px;
    stroke: #fff;
    flex-shrink: 0;
  }

  /* ── SIDEBAR ── */
  .sidebar {
    width: 200px;
    min-width: 200px;
    background: #ffffff;
    border-right: 1px solid #CFD2D3;
    display: flex;
    flex-direction: column;
    padding: 20px 0;
    position: fixed;
    top: 63px;
    left: 0;
    bottom: 0;
    z-index: 99;
  }

  /* Título de sección del menú */
  .sidebar-section-title {
    font-size: 13px;
    font-weight: 500;
    font-family: 'Gotham', 'DM Sans', sans-serif;
    color: #A2A9AD;
    padding: 8px 20px 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
    cursor: pointer;
    font-size: 15px;
    font-weight: 400;
    color: #5B6670;
    border-left: 3px solid transparent;
    transition: all 0.15s;
    font-family: 'Gotham', 'DM Sans', sans-serif;
  }
  .nav-item:hover {
    background: #F4F7F8;
    color: #323E48;
  }
  .nav-item.active {
    background: #F4F7F8;
    color: #EB0029;
    border-left: 3px solid #EB0029;
    font-weight: 500;
  }
  .nav-icon {
    flex-shrink: 0;
    opacity: 0.6;
    color: #5B6670;
    transition: all 0.15s;
  }
  .nav-item:hover .nav-icon {
    opacity: 0.8;
    color: #323E48;
  }
  .nav-item.active .nav-icon {
    opacity: 1;
    color: #EB0029;
  }
`;

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { icon: MdDashboard,       label: "Dashboard",           path: "/dashboard"   },
    { icon: RiStockLine,       label: "Inversiones",         path: "/inversiones" },
    { icon: TbChartBar,        label: "Análisis Financiero", path: "/analisis"    },
    { icon: BsCreditCard2Back, label: "Tarjetas y Cuentas",  path: "/tarjetas"    },
    { icon: MdSavings,         label: "Metas de Ahorro",     path: "/metas"       },
  ];

  const handleLogout = () => {
    navigate("/login");
  };

  return (
    <>
      <style>{styles}</style>

      <div className="global-topbar">
        <img src={banorteLogo} alt="Banorte" />
        <button className="logout-btn" onClick={handleLogout}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Cerrar sesión
        </button>
      </div>

      <aside className="sidebar">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.path}
              className={`nav-item ${location.pathname === item.path ? "active" : ""}`}
              onClick={() => navigate(item.path)}
            >
              <Icon size={20} className="nav-icon" />
              <span>{item.label}</span>
            </div>
          );
        })}
      </aside>
    </>
  );
}