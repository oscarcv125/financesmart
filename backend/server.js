const express = require('express');
const cors = require('cors');

const finanzasRoutes = require('./routes/finanzas');
const dashboardRoutes = require('./routes/dashboard');
const inversionRoutes = require('./routes/inversion');
const analisisRoutes = require('./routes/analisis');
const metasRoutes = require('./routes/metas');
const tarjetasRoutes = require('./routes/tarjetas');

require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/finanzas', finanzasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inversion', inversionRoutes);
app.use('/api/analisis', analisisRoutes);
app.use('/api/metas', metasRoutes);
app.use('/api/tarjetas', tarjetasRoutes);

app.listen(3001, () => {
  console.log('Backend corriendo en http://localhost:3001');
});