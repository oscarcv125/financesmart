import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../utils/supabaseclient";
import banorteLogo from "../assets/Logo_de_Banorte.svg";
import "../styles/login.css";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setReady(!!session);
      if (!session) setError("El enlace expiró o no es válido. Solicita uno nuevo.");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async () => {
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      toast.success("Contraseña actualizada.");
      navigate("/dashboard");
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img src={banorteLogo} alt="Banorte" />
        </div>
        <div className="login-body">
          <p className="login-title">Restablecer contraseña</p>

          <div className="field-group">
            <label className="field-label">Nueva contraseña</label>
            <input
              className="login-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!ready}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Confirmar contraseña</label>
            <input
              className="login-input"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              disabled={!ready}
            />
          </div>

          {error && <p className="field-error">{error}</p>}

          <button
            className="login-btn"
            onClick={handleSubmit}
            disabled={!ready || !password || !confirm || loading}
          >
            {loading ? "Guardando..." : "Actualizar contraseña"}
          </button>

          <p className="login-footer">
            <button className="login-link" onClick={() => navigate("/login")}>
              Volver a iniciar sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
