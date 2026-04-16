import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabaseclient";
import banorteLogo from "../assets/Logo_de_Banorte.svg";
import "../styles/register.css";

export default function Register() {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [tel, setTel] = useState("");
  const [perfil, setPerfil] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isFormValid = nombre && apellido && email && password && confirm;

  const handleRegister = async () => {
    if (!isFormValid) return;
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre, apellido, telefono: tel, perfil },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else if (data.session) {
      // Email confirmation is disabled — session is ready immediately
      navigate("/dashboard");
    } else {
      // Email confirmation is enabled — user must verify before logging in
      setError("Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.");
      setLoading(false);
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
            <p className="login-title">Crear cuenta</p>

            <div className="fields-row">
              <div className="field-group">
                <label className="field-label">Nombre(s)</label>
                <input
                  className="login-input"
                  type="text"
                  placeholder="Juan"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Apellidos</label>
                <input
                  className="login-input"
                  type="text"
                  placeholder="Pérez García"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                />
              </div>
            </div>

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

            <div className="fields-row">
              <div className="field-group">
                <label className="field-label">Teléfono</label>
                <input
                  className="login-input"
                  type="tel"
                  placeholder="81 0000 0000"
                  value={tel}
                  onChange={(e) => setTel(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Perfil</label>
                <select
                  className="login-select"
                  value={perfil}
                  onChange={(e) => setPerfil(e.target.value)}
                >
                  <option value="" disabled>Selecciona</option>
                  <option value="personal">Personal</option>
                  <option value="empresarial">Empresarial</option>
                  <option value="fiduciario">Fiduciario</option>
                </select>
              </div>
            </div>

            <div className="divider">contraseña</div>

            <div className="fields-row">
              <div className="field-group">
                <label className="field-label">Contraseña</label>
                <input
                  className="login-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="field-group">
                <label className="field-label">Confirmar contraseña</label>
                <input
                  className="login-input"
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                />
              </div>
            </div>

            {error && <p className="field-error">{error}</p>}

            <button
              className="login-btn"
              onClick={handleRegister}
              disabled={!isFormValid || loading}
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>

            <p className="login-footer">
              ¿Ya tienes cuenta?{" "}
              <button className="login-link" onClick={() => navigate("/login")}>
                Iniciar sesión
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}