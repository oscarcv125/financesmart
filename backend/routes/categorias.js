const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');

router.get('/', async (req, res) => {
  try {
    const { tipo } = req.query;
    let q = supabase.from('categoria').select('id_categoria, nombre, tipo').order('nombre', { ascending: true });
    if (tipo) q = q.ilike('tipo', String(tipo));
    const { data, error } = await q;
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
