const { supabase } = require('../utils/supabaseserver');

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  const { data: usuario, error: dbError } = await supabase
    .from('usuario')
    .select('*')
    .eq('email', user.email)
    .maybeSingle();

  if (dbError || !usuario) {
    return res.status(404).json({ error: 'Usuario no encontrado en la base de datos' });
  }

  req.user = user;
  req.usuario = usuario;
  next();
};
