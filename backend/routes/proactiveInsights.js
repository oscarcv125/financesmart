const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');
const aiProvider = require('../utils/aiProvider');
const { getProactiveInsights, clearCache } = require('../services/proactiveInsightsService');

router.get('/', async (req, res) => {
  try {
    const force = String(req.query.force || '').toLowerCase() === 'true';
    const result = await getProactiveInsights({
      supabase,
      id_usuario: req.usuario.id_usuario,
      aiProvider,
      force,
    });
    res.json(result);
  } catch (err) {
    console.error('[proactive-insights]', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    clearCache(req.usuario.id_usuario);
    const result = await getProactiveInsights({
      supabase,
      id_usuario: req.usuario.id_usuario,
      aiProvider,
      force: true,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
