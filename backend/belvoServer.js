import express from "express";
import axios from "axios";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Belvo auth helper ────────────────────────────────────────────────────────
const belvoAuth = {
  username: process.env.BELVO_SECRET_ID,
  password: process.env.BELVO_SECRET_PASSWORD,
};

const BELVO_BASE = process.env.BELVO_ENV === "production"
  ? "https://api.belvo.com"
  : "https://sandbox.belvo.com";

// ─── Decodifica JWT de Belvo sin verificar firma ──────────────────────────────
function decodeJWT(token) {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function verifyBelvoToken(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token requerido" });
    return null;
  }

  const token = authHeader.split(" ")[1];
  const payload = decodeJWT(token);

  if (!payload) {
    res.status(401).json({ error: "Token inválido" });
    return null;
  }

  // Verificar expiración
  const ahora = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < ahora) {
    res.status(401).json({ error: "Token expirado" });
    return null;
  }

  // Verificar que sea token de Belvo
  if (!payload.api_url?.includes("belvo.com")) {
    res.status(401).json({ error: "Token no es de Belvo" });
    return null;
  }

  return {
    user_id: payload.user_id,
    email: payload.organization_name || payload.user_id,
    environment: payload.environment,
  };
}

// ─── 1. CREAR O REUSAR LINK ───────────────────────────────────────────────────
app.post("/api/belvo/link", async (req, res) => {
  const user = verifyBelvoToken(req, res);
  if (!user) return;

  try {
    const linksRes = await axios.get(`${BELVO_BASE}/api/links/`, { auth: belvoAuth });
    const links = linksRes.data.results ?? [];
    const existing = links.find(
      (l) => l.institution === "erebor_mx_retail" && l.status === "valid"
    );
    if (existing) return res.json(existing);

    const response = await axios.post(
      `${BELVO_BASE}/api/links/`,
      { institution: "erebor_mx_retail", username: "test", password: "test", access_mode: "recurrent" },
      { auth: belvoAuth }
    );
    res.json(response.data);
  } catch (error) {
    console.error("ERROR BELVO LINK:", error.response?.data || error.message);
    res.status(500).json(error.response?.data || { error: error.message });
  }
});

// ─── 2. DASHBOARD ─────────────────────────────────────────────────────────────
app.get("/api/dashboard", async (req, res) => {
  const user = verifyBelvoToken(req, res);
  if (!user) return;

  try {
    const linksRes = await axios.get(`${BELVO_BASE}/api/links/`, { auth: belvoAuth });
    const links = linksRes.data.results ?? linksRes.data;
    const link = links.find((l) => l.status === "valid") ?? links[0];

    if (!link) {
      return res.json({
        nombreUsuario: user.email,
        cuentas: [],
        totales: { saldo: 0, ingresos: 0, gastos: 0 },
        movimientos: [],
      });
    }

    const [accountsRes, txRes] = await Promise.all([
      axios.get(`${BELVO_BASE}/api/accounts/?link=${link.id}`, { auth: belvoAuth }),
      axios.get(`${BELVO_BASE}/api/transactions/?link=${link.id}&page_size=100`, { auth: belvoAuth }),
    ]);

    const cuentasRaw = accountsRes.data.results ?? accountsRes.data;
    const cuentas = cuentasRaw.map((c) => ({
      id: c.id,
      nombre: c.name,
      tipo: c.type,
      moneda: c.currency,
      saldo: parseFloat(c.balance?.current ?? 0),
      saldo_disponible: parseFloat(c.balance?.available ?? 0),
      institucion: c.institution,
    }));

    const saldoTotal = cuentas.reduce((sum, c) => sum + c.saldo, 0);
    const transactionsRaw = txRes.data.results ?? txRes.data;
    let ingresos = 0;
    let gastos = 0;

    const movimientos = transactionsRaw.map((t) => {
      const monto = parseFloat(t.amount);
      const esGasto = t.type === "OUTFLOW";
      if (esGasto) gastos += monto;
      else ingresos += monto;
      return {
        id: t.id,
        fecha: t.value_date,
        descripcion: t.description,
        categoria: t.category ?? "General",
        tipo: esGasto ? "gasto" : "ingreso",
        monto: esGasto ? -monto : monto,
        cuenta_id: t.account?.id ?? null,
        moneda: t.currency,
        merchant: t.merchant?.name ?? null,
      };
    });

    res.json({
      nombreUsuario: user.email,
      cuentas,
      totales: { saldo: saldoTotal, ingresos, gastos },
      movimientos,
    });
  } catch (error) {
    console.error("ERROR DASHBOARD:", error.response?.data || error.message);
    res.status(500).json(error.response?.data || { error: error.message });
  }
});

// ─── 3. TARJETAS (cuentas reales de Belvo) ────────────────────────────────────
app.get("/api/tarjetas", async (req, res) => {
  const user = verifyBelvoToken(req, res);
  if (!user) return;

  try {
    const linksRes = await axios.get(`${BELVO_BASE}/api/links/`, { auth: belvoAuth });
    const links = linksRes.data.results ?? linksRes.data;
    const link = links.find((l) => l.status === "valid" && l.institution.includes("retail"))
  ?? links.find((l) => l.status === "valid")
  ?? links[0];
    if (!link) return res.json([]);

    const accountsRes = await axios.get(
      `${BELVO_BASE}/api/accounts/?link=${link.id}`,
      { auth: belvoAuth }
    );

    const tarjetas = (accountsRes.data.results ?? accountsRes.data).map((c) => ({
      id_tarjeta: c.id,
      nombre: c.name,
    }));

    res.json(tarjetas);
  } catch (error) {
    console.error("ERROR TARJETAS:", error.response?.data || error.message);
    res.status(500).json(error.response?.data || { error: error.message });
  }
});

// ─── 4. TRANSACCIONES ─────────────────────────────────────────────────────────
app.get("/api/transacciones", async (req, res) => {
  const user = verifyBelvoToken(req, res);
  if (!user) return;

  const { cuenta_id, desde, hasta, page_size = 50 } = req.query;

  try {
    const linksRes = await axios.get(`${BELVO_BASE}/api/links/`, { auth: belvoAuth });
    const links = linksRes.data.results ?? linksRes.data;
    const link = links.find((l) => l.status === "valid") ?? links[0];
    if (!link) return res.json([]);

    let url = `${BELVO_BASE}/api/transactions/?link=${link.id}&page_size=${page_size}`;
    if (cuenta_id) url += `&account=${cuenta_id}`;
    if (desde) url += `&date_from=${desde}`;
    if (hasta) url += `&date_to=${hasta}`;

    const txRes = await axios.get(url, { auth: belvoAuth });
    const movimientos = (txRes.data.results ?? txRes.data).map((t) => {
      const monto = parseFloat(t.amount);
      const esGasto = t.type === "OUTFLOW";
      return {
        id: t.id,
        fecha: t.value_date,
        descripcion: t.description,
        categoria: t.category ?? "General",
        tipo: esGasto ? "gasto" : "ingreso",
        monto: esGasto ? -monto : monto,
        cuenta_id: t.account?.id ?? null,
        moneda: t.currency,
        merchant: t.merchant?.name ?? null,
      };
    });

    res.json(movimientos);
  } catch (error) {
    console.error("ERROR TRANSACCIONES:", error.response?.data || error.message);
    res.status(500).json(error.response?.data || { error: error.message });
  }
});

// ─── SERVER ───────────────────────────────────────────────────────────────────
app.listen(3000, () => {
  console.log(`Servidor en http://localhost:3000 [${process.env.BELVO_ENV ?? "sandbox"}]`);
});