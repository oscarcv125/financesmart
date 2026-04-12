const express = require('express');
const cors = require('cors');
const finanzasRoutes = require('./routes/finanzas');
const dashboardRoutes = require('./routes/dashboard');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/finanzas', finanzasRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.listen(3001, () => {
  console.log('Backend corriendo en http://localhost:3001');
});