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

  let { data: usuarios, error: dbError } = await supabase
    .from('usuario')
    .select('*')
    .eq('email', user.email)
    .order('id_usuario', { ascending: true })
    .limit(1);

  if (dbError) {
    console.error('[auth] dbError consultando usuario:', dbError);
    return res.status(500).json({ error: 'Error consultando usuario' });
  }

  let usuario = usuarios?.[0] || null;

  if (!usuario) {
    const meta = user.user_metadata || {};
    const nombre = (meta.nombre || user.email.split('@')[0] || 'Usuario').toString().trim();
    const apellido = (meta.apellido || '').toString().trim();
    const telefono = meta.telefono ? String(meta.telefono).trim() : null;
    const perfil = meta.perfil ? String(meta.perfil).trim() : null;

    const baseRow = { nombre, apellido, email: user.email };
    const fullRow = { ...baseRow, telefono, perfil };

    let inserted = await supabase.from('usuario').insert([fullRow]).select().maybeSingle();
    if (inserted.error) {
      inserted = await supabase.from('usuario').insert([baseRow]).select().maybeSingle();
    }

    if (inserted.error || !inserted.data) {
      const { data: retry } = await supabase
        .from('usuario')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();
      usuario = retry || null;
    } else {
      usuario = inserted.data;
    }

    if (!usuario) {
      return res.status(500).json({ error: 'No se pudo crear el perfil de usuario' });
    }
  }

  req.user = user;
  req.usuario = usuario;
  next();
};
