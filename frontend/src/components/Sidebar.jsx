import { useNavigate, useLocation } from "react-router-dom";
import banorteLogo from "../assets/Logo_de_Banorte.svg";
import { MdDashboard, MdSavings } from "react-icons/md";
import { RiStockLine } from "react-icons/ri";
import { BsCreditCard2Back } from "react-icons/bs";
import { TbChartBar } from "react-icons/tb";
import "../styles/sidebar.css";

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