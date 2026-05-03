const express = require('express');
const cors = require('cors');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const finanzasRoutes = require('./routes/finanzas');
const dashboardRoutes = require('./routes/dashboard');
const inversionRoutes = require('./routes/inversion');
const analisisRoutes = require('./routes/analisis');
const metasRoutes = require('./routes/metas');
const tarjetasRoutes = require('./routes/tarjetas');
const movimientosRoutes = require('./routes/movimientos');
const categoriasRoutes = require('./routes/categorias');
const presupuestosRoutes = require('./routes/presupuestos');
const recurrenciasRoutes = require('./routes/recurrencias');
const chatbotRoutes = require('./routes/chatbot');
const healthRoutes = require('./routes/health');
const configRoutes = require('./routes/config');
const suscripcionesRoutes = require('./routes/suscripciones');
const insightsRoutes = require('./routes/insights');
const proactiveInsightsRoutes = require('./routes/proactiveInsights');
const chatHistoryRoutes = require('./routes/chatHistory');
const planesRoutes = require('./routes/planes');
const exportRoutes = require('./routes/export');
const notificacionesRoutes = require('./routes/notificaciones');
const authMiddleware = require('./middleware/auth');
require('dotenv').config();

const app = express();

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

const isDev = process.env.NODE_ENV !== 'production';

const generalLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: 'Demasiadas solicitudes, intenta más tarde.' }
});

// IP-based first-line gate (covers unauthenticated requests).
const chatbotIpLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: 'Demasiadas solicitudes, intenta más tarde.' }
});

// Per-user limit AFTER auth so a botnet of IPs can't burn one user's quota.
// Falls back to IP if for any reason req.usuario isn't populated yet.
const chatbotUserLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  keyGenerator: (req, res) => {
    if (req.usuario?.id_usuario) return `u:${req.usuario.id_usuario}`;
    // IPv6-safe fallback (groups by /64 subnet so an attacker can't cycle within one).
    return ipKeyGenerator(req, res);
  },
  message: { error: 'Límite de mensajes alcanzado, espera un momento.' }
});

app.use('/api/', generalLimit);

app.use('/api/finanzas', authMiddleware, finanzasRoutes);
app.use('/api/dashboard', authMiddleware, dashboardRoutes);
app.get('/api/me', authMiddleware, (req, res) => {
  const { nombre, apellido, email } = req.usuario;
  res.json({ nombre, apellido, email });
});
app.use('/api/inversion', authMiddleware, inversionRoutes);
app.use('/api/analisis', authMiddleware, analisisRoutes);
app.use('/api/metas', authMiddleware, metasRoutes);
app.use('/api/tarjetas', authMiddleware, tarjetasRoutes);
app.use('/api/movimientos', authMiddleware, movimientosRoutes);
app.use('/api/categorias', authMiddleware, categoriasRoutes);
app.use('/api/presupuestos', authMiddleware, presupuestosRoutes);
app.use('/api/recurrencias', authMiddleware, recurrenciasRoutes);
app.use('/api/chatbot', chatbotIpLimit, authMiddleware, chatbotUserLimit, chatbotRoutes);
app.use('/api/health', authMiddleware, healthRoutes);
app.use('/api/config', configRoutes);
app.use('/api/suscripciones', authMiddleware, suscripcionesRoutes);
app.use('/api/insights', authMiddleware, insightsRoutes);
app.use('/api/proactive-insights', authMiddleware, proactiveInsightsRoutes);
app.use('/api/chat-history', authMiddleware, chatHistoryRoutes);
app.use('/api/planes', authMiddleware, planesRoutes);
app.use('/api/export', authMiddleware, exportRoutes);
app.use('/api/notificaciones', authMiddleware, notificacionesRoutes);

module.exports = app;
