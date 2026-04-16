const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

async function fetchUserFinancialData(id_usuario) {
  const { data: movimientos } = await supabase
    .from('movimiento_financiero')
    .select('monto, fecha, tipo, descripcion, categoria(nombre)')
    .eq('id_usuario', id_usuario)
    .order('fecha', { ascending: false })
    .limit(20);

  const lista = movimientos || [];

  const ingresos = lista
    .filter(m => m.tipo?.toLowerCase() === 'ingreso')
    .reduce((acc, m) => acc + Number(m.monto), 0);

  const gastos = lista
    .filter(m => m.tipo?.toLowerCase() === 'gasto')
    .reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);

  const catAgrupadas = {};
  lista
    .filter(m => m.tipo?.toLowerCase() === 'gasto')
    .forEach(m => {
      const cat = m.categoria?.nombre || 'Otros';
      catAgrupadas[cat] = (catAgrupadas[cat] || 0) + Math.abs(Number(m.monto));
    });

  const topCategorias = Object.entries(catAgrupadas)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([nombre, monto]) => `- ${nombre}: $${monto.toFixed(2)}`)
    .join('\n');

  const movRecientes = lista.slice(0, 10).map(m =>
    `| ${m.fecha?.split('T')[0]} | ${m.descripcion || '-'} | ${m.tipo} | $${Math.abs(Number(m.monto)).toFixed(2)} |`
  ).join('\n');

  return { saldo: ingresos - gastos, ingresos, gastos, topCategorias, movRecientes };
}

function buildSystemPrompt(mode, nombre, data) {
  const datosFinancieros = `
=== ESTADO FINANCIERO ACTUAL ===
- Saldo disponible: $${data.saldo.toFixed(2)} MXN
- Ingresos registrados: $${data.ingresos.toFixed(2)} MXN
- Gastos registrados: $${data.gastos.toFixed(2)} MXN

=== MOVIMIENTOS RECIENTES ===
| Fecha | Descripción | Tipo | Monto |
|-------|-------------|------|-------|
${data.movRecientes}

=== TOP CATEGORÍAS DE GASTO ===
${data.topCategorias || 'Sin gastos registrados'}
`;

  if (mode === 'analyst') {
    return `Eres FinanceSmart AI en modo ANALISTA FINANCIERO para el usuario ${nombre}.
Responde SIEMPRE en español, de forma objetiva, precisa y profesional.
No des consejos no solicitados. Mantén un tono neutro. No inventes datos fuera del contexto.
${datosFinancieros}`;
  }

  return `Eres FinanceSmart AI en modo COACH FINANCIERO para el usuario ${nombre}.
Responde SIEMPRE en español, de forma motivadora y cercana.
Propón metas concretas, sugiere cómo reducir gastos, recomienda inversiones según su perfil.
No inventes datos fuera del contexto.
${datosFinancieros}`;
}

router.post('/', async (req, res) => {
  const { message, history = [], mode = 'coach' } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Mensaje requerido' });
  }
  if (message.length > 1000) {
    return res.status(400).json({ error: 'Mensaje demasiado largo (máx 1000 caracteres)' });
  }
  if (!Array.isArray(history) || history.length > 50) {
    return res.status(400).json({ error: 'Historial inválido' });
  }

  try {
    const nombre = `${req.usuario.nombre} ${req.usuario.apellido}`;
    const financialData = await fetchUserFinancialData(req.usuario.id_usuario);
    const systemPrompt = buildSystemPrompt(mode, nombre, financialData);

    const newHistory = [...history, { role: 'user', parts: [{ text: message }] }];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: newHistory,
        }),
      }
    );

    if (!geminiRes.ok) {
      throw new Error(`Gemini error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta.';

    res.json({ reply });
  } catch (error) {
    console.error('Error en chatbot:', error.message);
    res.status(500).json({ error: 'Error al procesar la consulta' });
  }
});

module.exports = router;
