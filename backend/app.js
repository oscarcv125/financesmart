const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
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
const authMiddleware = require('./middleware/auth');
require('dotenv').config();

const app = express();

app.set('trust proxy', 1);

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json());

const generalLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde.' }
});

const chatbotLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
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
app.use('/api/chatbot', chatbotLimit, authMiddleware, chatbotRoutes);
app.use('/api/health', authMiddleware, healthRoutes);

module.exports = app;
