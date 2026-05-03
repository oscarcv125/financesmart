// Append-only audit trail for write actions. Failures here NEVER block the
// caller — we just log and move on, since losing an audit row is preferable
// to failing a user's executed action.

const { supabase } = require('./supabaseserver');
const logger = require('./logger');

async function record({ id_usuario, action, source = 'chatbot', status, params, result_summary, error_message }) {
  if (!id_usuario || !action || !status) return;
  try {
    const { error } = await supabase.from('audit_log').insert([{
      id_usuario,
      action,
      source,
      status,
      params: params || null,
      result_summary: result_summary || null,
      error_message: error_message || null,
    }]);
    if (error) logger.warn('audit_log insert failed', { action, status, message: error.message });
  } catch (err) {
    logger.warn('audit_log insert threw', { action, message: err.message });
  }
}

module.exports = { record };
