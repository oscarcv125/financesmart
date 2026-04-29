// ConnectBank.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../utils/supabaseclient";
import { BACKEND_URL } from "../config";

export default function ConnectBank() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const connectBank = async () => {
    setLoading(true);
    setError(null);

    try {
      const session = await supabase.auth.getSession();
      const authToken = session.data.session?.access_token;
      if (!authToken) throw new Error("No hay sesión activa");

      // Sandbox: llamamos directo al backend sin widget
      // En producción el backend usará el link_id que manda el widget real
      const res = await fetch(`${BACKEND_URL}/api/belvo/link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error conectando banco");
      }

      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100vh", gap: "1rem" }}>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <button onClick={connectBank} disabled={loading}>
        {loading ? "Conectando..." : "Conectar banco"}
      </button>
      {/* El widget de Belvo se monta aquí */}
      <div id="belvo" />
    </div>
  );
}
