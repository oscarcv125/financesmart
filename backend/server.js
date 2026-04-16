const express = require('express');
const cors = require('cors');
const finanzasRoutes = require('./routes/finanzas');
const dashboardRoutes = require('./routes/dashboard');
const inversionRoutes = require('./routes/inversion');
const analisisRoutes = require('./routes/analisis');
const metasRoutes = require('./routes/metas');
const tarjetasRoutes = require('./routes/tarjetas');
const authMiddleware = require('./middleware/auth');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

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

app.listen(3001, () => {
  console.log('Backend corriendo en http://localhost:3001');
});
