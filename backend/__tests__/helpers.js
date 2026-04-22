// Builds a chainable Supabase query mock that resolves to `result` at the end.
function makeChain(result = { data: null, error: null }) {
  const c = {};
  ['select', 'eq', 'neq', 'gte', 'lte', 'lt', 'order', 'limit', 'ilike', 'not', 'head'].forEach(
    (m) => { c[m] = jest.fn(() => c); }
  );
  c.maybeSingle = jest.fn(() => Promise.resolve(result));
  c.single = jest.fn(() => Promise.resolve(result));
  c.then = (r, j) => Promise.resolve(result).then(r, j);
  c.catch = (f) => Promise.resolve(result).catch(f);

  // Operations that return a sub-chain (may be followed by .select().maybeSingle())
  const terminal = (res) => {
    const t = {};
    ['select', 'eq', 'not', 'head'].forEach((m) => { t[m] = jest.fn(() => t); });
    t.maybeSingle = jest.fn(() => Promise.resolve(res));
    t.single = jest.fn(() => Promise.resolve(res));
    t.then = (r, j) => Promise.resolve(res).then(r, j);
    t.catch = (f) => Promise.resolve(res).catch(f);
    return t;
  };

  c.insert = jest.fn(() => terminal(result));
  c.update = jest.fn(() => terminal(result));
  c.delete = jest.fn(() => terminal(result));
  c.upsert = jest.fn(() => terminal(result));
  return c;
}

// Builds an auth middleware stub that injects a fake usuario into req
function makeAuthStub(usuario = { id_usuario: 1, nombre: 'Test', apellido: 'User', email: 'test@example.com' }) {
  return (req, _res, next) => {
    req.user = { id: 'test-uid', email: usuario.email, user_metadata: {} };
    req.usuario = usuario;
    next();
  };
}

module.exports = { makeChain, makeAuthStub };
