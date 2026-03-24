import { useState } from "react";
import { useNavigate } from "react-router-dom";
import banorteLogo from "../assets/Logo_de_Banorte.svg";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', sans-serif; }

  .login-page {
    min-height: 100vh;
    background: #f4f5f7;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'DM Sans', sans-serif;
  }
  .login-card {
    background: #fff;
    border-radius: 20px;
    overflow: hidden;
    width: 640px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12);
  }
  .login-header {
    background: #cc0000;
    padding: 64px 36px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .login-header img {
    height: 56px;
    width: auto;
    max-width: 260px;
    filter: brightness(0) invert(1);
  }
  .login-body {
    padding: 56px 60px 52px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .login-input {
    width: 100%;
    border: none;
    border-bottom: 2px solid #ddd;
    background: #f7f7f7;
    border-radius: 8px 8px 0 0;
    padding: 16px 18px;
    font-size: 15px;
    font-family: 'DM Sans', sans-serif;
    outline: none;
    transition: border-color 0.15s;
    color: #111;
  }
  .login-input:focus { border-bottom-color: #cc0000; }
  .login-btn {
    width: 100%;
    background: #cc0000;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 16px;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1px;
    cursor: pointer;
    margin-top: 8px;
    transition: background 0.15s;
    font-family: 'DM Sans', sans-serif;
  }
  .login-btn:hover { background: #aa0000; }
  .login-footer {
    text-align: center;
    font-size: 14px;
    color: #888;
    margin-top: 4px;
  }
  .login-footer a {
    color: #cc0000;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
  }
  .login-footer a:hover { text-decoration: underline; }
`;

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (email && password) navigate("/dashboard");
  };

  return (
    <>
      <style>{styles}</style>
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <img src={banorteLogo} alt="Banorte" />
          </div>
          <div className="login-body">
            <input
              className="login-input"
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="login-input"
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <button className="login-btn" onClick={handleLogin}>
              INICIAR SESIÓN
            </button>
            <p className="login-footer">
              ¿No tienes cuenta? <a onClick={() => {}}>Regístrate</a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}