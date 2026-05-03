const express = require('express');
const router = express.Router();
const { supabase } = require('../utils/supabaseserver');
const logger = require('../utils/logger');

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

// GET /api/chat-history?limit=50 — most recent messages first.
router.get('/', async (req, res) => {
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
  try {
    const { data, error } = await supabase
      .from('chat_message')
      .select('id_message, role, text, widgets, proposals, mode, created_at')
      .eq('id_usuario', req.usuario.id_usuario)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    // Return chronologically (oldest first) for easy frontend rendering.
    res.json({ messages: (data || []).reverse() });
  } catch (err) {
    logger.warn('chat-history list failed', { id_usuario: req.usuario.id_usuario, message: err.message });
    res.status(500).json({ error: 'No se pudo cargar el historial' });
  }
});

// POST /api/chat-history — append a single message. Frontend calls this after
// each user-or-bot turn settles. We don't error on payload truncation —
// silently cap to keep storage bounded.
router.post('/', async (req, res) => {
  const { role, text, widgets, proposals, mode } = req.body || {};
  if (role !== 'user' && role !== 'bot') {
    return res.status(400).json({ error: 'role inválido' });
  }
  if (typeof text !== 'string' || text.length === 0) {
    return res.status(400).json({ error: 'text requerido' });
  }
  const safeText = text.slice(0, 8000);
  try {
    const { data, error } = await supabase
      .from('chat_message')
      .insert([{
        id_usuario: req.usuario.id_usuario,
        role,
        text: safeText,
        widgets: Array.isArray(widgets) ? widgets : null,
        proposals: Array.isArray(proposals) ? proposals : null,
        mode: typeof mode === 'string' ? mode.slice(0, 20) : null,
      }])
      .select('id_message, created_at')
      .maybeSingle();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    logger.warn('chat-history insert failed', { id_usuario: req.usuario.id_usuario, message: err.message });
    res.status(500).json({ error: 'No se pudo guardar el mensaje' });
  }
});

// DELETE /api/chat-history — wipe all messages for the user (used by "borrar").
router.delete('/', async (req, res) => {
  try {
    const { error } = await supabase
      .from('chat_message')
      .delete()
      .eq('id_usuario', req.usuario.id_usuario);
    if (error) throw error;
    res.json({ deleted: true });
  } catch (err) {
    logger.warn('chat-history delete failed', { id_usuario: req.usuario.id_usuario, message: err.message });
    res.status(500).json({ error: 'No se pudo borrar el historial' });
  }
});

module.exports = router;
