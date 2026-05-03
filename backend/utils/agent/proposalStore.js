const crypto = require('crypto');

const TTL_MS = 10 * 60 * 1000;       // 10 minutes
const MAX_PER_USER = 5;
const proposals = new Map();          // proposal_id → { id_usuario, action, params, expires_at, summary_es, needs }

function newId() {
  return 'ap_' + crypto.randomBytes(8).toString('hex');
}

function isExpired(p, now = Date.now()) {
  return p.expires_at <= now;
}

function purgeExpiredFor(id_usuario) {
  const now = Date.now();
  for (const [id, p] of proposals) {
    if (isExpired(p, now)) proposals.delete(id);
    else if (p.id_usuario === id_usuario && p.consumed) proposals.delete(id);
  }
}

function countOutstandingFor(id_usuario) {
  const now = Date.now();
  let n = 0;
  for (const p of proposals.values()) {
    if (p.id_usuario === id_usuario && !isExpired(p, now) && !p.consumed) n++;
  }
  return n;
}

function create({ id_usuario, action, params, summary_es, needs = [] }) {
  if (typeof id_usuario !== 'number') throw new Error('id_usuario required');
  if (!action || typeof action !== 'string') throw new Error('action required');
  purgeExpiredFor(id_usuario);
  if (countOutstandingFor(id_usuario) >= MAX_PER_USER) {
    return { ok: false, error: 'TOO_MANY_PROPOSALS', mensaje: `Máximo ${MAX_PER_USER} propuestas pendientes por usuario.` };
  }
  const proposal_id = newId();
  const expires_at = Date.now() + TTL_MS;
  proposals.set(proposal_id, {
    proposal_id,
    id_usuario,
    action,
    params,
    summary_es: summary_es || `Acción: ${action}`,
    needs,
    expires_at,
    consumed: false,
    claimed: false,
  });
  return { ok: true, proposal_id, expires_at };
}

function get(proposal_id, id_usuario) {
  const p = proposals.get(proposal_id);
  if (!p) return { ok: false, status: 404, error: 'NOT_FOUND' };
  if (p.id_usuario !== id_usuario) return { ok: false, status: 403, error: 'WRONG_USER' };
  if (isExpired(p)) {
    proposals.delete(proposal_id);
    return { ok: false, status: 410, error: 'EXPIRED' };
  }
  if (p.consumed) return { ok: false, status: 409, error: 'ALREADY_CONSUMED' };
  return { ok: true, proposal: p };
}

// Synchronously marks the proposal as in-flight so concurrent confirm requests
// can't both pass validation and double-execute. Pair with release() on failure
// or consume() on success. Atomic by virtue of Node's single-threaded model:
// the read → check → mark sequence has no await.
function tryClaim(proposal_id, id_usuario) {
  const p = proposals.get(proposal_id);
  if (!p) return { ok: false, status: 404, error: 'NOT_FOUND' };
  if (p.id_usuario !== id_usuario) return { ok: false, status: 403, error: 'WRONG_USER' };
  if (isExpired(p)) {
    proposals.delete(proposal_id);
    return { ok: false, status: 410, error: 'EXPIRED' };
  }
  if (p.consumed || p.claimed) return { ok: false, status: 409, error: 'ALREADY_CONSUMED' };
  p.claimed = true;
  return { ok: true, proposal: p };
}

function release(proposal_id) {
  const p = proposals.get(proposal_id);
  if (p) p.claimed = false;
}

// Removes the proposal. Caller must have already passed tryClaim (or be in the
// legacy single-shot consume path, kept for back-compat with tests).
function consume(proposal_id, id_usuario) {
  const r = get(proposal_id, id_usuario);
  if (!r.ok) return r;
  proposals.delete(proposal_id);
  return { ok: true, proposal: r.proposal };
}

function cancel(proposal_id, id_usuario) {
  const p = proposals.get(proposal_id);
  if (!p) return { ok: false, status: 404, error: 'NOT_FOUND' };
  if (p.id_usuario !== id_usuario) return { ok: false, status: 403, error: 'WRONG_USER' };
  proposals.delete(proposal_id);
  return { ok: true };
}

// Periodic sweeper of expired entries — runs without an associated user create.
// Unref so it doesn't keep the process alive in tests.
const SWEEP_MS = 5 * 60 * 1000;
let sweepTimer = null;
function startSweeper() {
  if (sweepTimer || process.env.NODE_ENV === 'test') return;
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const [id, p] of proposals) {
      if (isExpired(p, now)) proposals.delete(id);
    }
  }, SWEEP_MS);
  if (sweepTimer.unref) sweepTimer.unref();
}
function stopSweeper() {
  if (sweepTimer) { clearInterval(sweepTimer); sweepTimer = null; }
}
startSweeper();

// Test-only — clears all proposals.
function _resetAll() {
  proposals.clear();
}

module.exports = { create, get, tryClaim, release, consume, cancel, _resetAll, stopSweeper, TTL_MS, MAX_PER_USER };
