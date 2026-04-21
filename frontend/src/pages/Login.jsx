import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../utils/supabaseclient";
import banorteLogo from "../assets/Logo_de_Banorte.svg";
import "../styles/login.css";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate("/dashboard");
    }
  };

  const handleForgot = async () => {
    if (!email) {
      setError("Escribe tu correo para enviarte el enlace de recuperación.");
      return;
    }
    setResetting(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    if (error) {
      setError(error.message);
    } else {
      toast.success("Te enviamos un enlace para restablecer tu contraseña.");
    }
  };

  return (
    <>
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <img src={banorteLogo} alt="Banorte" />
          </div>
          <div className="login-body">
            <p className="login-title">Iniciar sesión</p>

            <div className="field-group">
              <label className="field-label">Correo electrónico</label>
              <input
                className="login-input"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label className="field-label">Contraseña</label>
              <input
                className="login-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <div className="forgot-link">
                <button type="button" onClick={handleForgot} disabled={resetting}>
                  {resetting ? "Enviando..." : "¿Olvidaste tu contraseña?"}
                </button>
              </div>
            </div>

            {error && <p className="field-error">{error}</p>}

            <button
              className="login-btn"
              onClick={handleLogin}
              disabled={!email || !password || loading}
            >
              {loading ? "Cargando..." : "Continuar"}
            </button>

            <p className="login-footer">
              ¿No tienes cuenta?{" "}
              <button className="login-link" onClick={() => navigate("/register")}>
                Regístrate
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}