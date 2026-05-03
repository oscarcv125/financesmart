const proposalStore = require('../utils/agent/proposalStore');

describe('proposalStore', () => {
  beforeEach(() => proposalStore._resetAll());

  test('create returns ok + proposal_id', () => {
    const r = proposalStore.create({
      id_usuario: 1, action: 'proponer_aporte_meta',
      params: { id_meta: 5, monto: 100 }, summary_es: 'Aportar $100',
    });
    expect(r.ok).toBe(true);
    expect(r.proposal_id).toMatch(/^ap_/);
    expect(r.expires_at).toBeGreaterThan(Date.now());
  });

  test('get returns the proposal for the right user', () => {
    const c = proposalStore.create({ id_usuario: 1, action: 'a', params: {}, summary_es: 's' });
    const g = proposalStore.get(c.proposal_id, 1);
    expect(g.ok).toBe(true);
    expect(g.proposal.action).toBe('a');
  });

  test('get returns 403 for wrong user', () => {
    const c = proposalStore.create({ id_usuario: 1, action: 'a', params: {}, summary_es: 's' });
    const g = proposalStore.get(c.proposal_id, 2);
    expect(g.ok).toBe(false);
    expect(g.status).toBe(403);
  });

  test('get returns 404 for unknown id', () => {
    const g = proposalStore.get('ap_missing', 1);
    expect(g.ok).toBe(false);
    expect(g.status).toBe(404);
  });

  test('consume succeeds once, immediately removes proposal (replays NOT_FOUND)', () => {
    const c = proposalStore.create({ id_usuario: 1, action: 'a', params: {}, summary_es: 's' });
    const first = proposalStore.consume(c.proposal_id, 1);
    expect(first.ok).toBe(true);
    const second = proposalStore.consume(c.proposal_id, 1);
    expect(second.ok).toBe(false);
    expect(second.error).toBe('NOT_FOUND');
  });

  test('cancel removes the proposal', () => {
    const c = proposalStore.create({ id_usuario: 1, action: 'a', params: {}, summary_es: 's' });
    const r = proposalStore.cancel(c.proposal_id, 1);
    expect(r.ok).toBe(true);
    const after = proposalStore.get(c.proposal_id, 1);
    expect(after.status).toBe(404);
  });

  test('cancel rejects wrong user', () => {
    const c = proposalStore.create({ id_usuario: 1, action: 'a', params: {}, summary_es: 's' });
    const r = proposalStore.cancel(c.proposal_id, 2);
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
  });

  test('enforces max-per-user cap', () => {
    for (let i = 0; i < proposalStore.MAX_PER_USER; i++) {
      proposalStore.create({ id_usuario: 1, action: 'a', params: {}, summary_es: 's' });
    }
    const overflow = proposalStore.create({ id_usuario: 1, action: 'a', params: {}, summary_es: 's' });
    expect(overflow.ok).toBe(false);
    expect(overflow.error).toBe('TOO_MANY_PROPOSALS');
  });
});
