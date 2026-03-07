const express = require('express');
const router = express.Router();

const datos = {
  mensual: {
    barras: [
      { name: "Ene", value: 3200, color: "#e53935" },
      { name: "Feb", value: 5800, color: "#43a047" },
      { name: "Mar", value: 4500, color: "#fdd835" },
    ],
    pay: [
      { name: "Inversión", value: 35, color: "#43a047" },
      { name: "Snacks",    value: 25, color: "#e53935" },
      { name: "Ocio",      value: 40, color: "#fdd835" },
    ],
  },
  trimestral: {
    barras: [
      { name: "Q1", value: 9200, color: "#e53935" },
      { name: "Q2", value: 11400, color: "#43a047" },
      { name: "Q3", value: 8700, color: "#fdd835" },
    ],
    pay: [
      { name: "Inversión", value: 40, color: "#43a047" },
      { name: "Snacks",    value: 20, color: "#e53935" },
      { name: "Ocio",      value: 40, color: "#fdd835" },
    ],
  },
  anual: {
    barras: [
      { name: "2022", value: 38000, color: "#e53935" },
      { name: "2023", value: 45000, color: "#43a047" },
      { name: "2024", value: 52000, color: "#fdd835" },
    ],
    pay: [
      { name: "Inversión", value: 45, color: "#43a047" },
      { name: "Snacks",    value: 15, color: "#e53935" },
      { name: "Ocio",      value: 40, color: "#fdd835" },
    ],
  },
};

router.get('/:periodo', (req, res) => {
  const { periodo } = req.params;
  const resultado = datos[periodo.toLowerCase()];
  if (!resultado) return res.status(404).json({ error: 'Periodo no encontrado' });
  res.json(resultado);
});

module.exports = router;