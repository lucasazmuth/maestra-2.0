import {
  buildV13Actions,
  defaultV13Schedule,
  isBrazilBusinessDay,
  nextBrazilBusinessDay,
  validateV13Sources,
} from '../cronogramaV13';
import type { Strategy } from '../../interfaces/maestra';

const strategy = (bankId: string): Strategy => ({
  id: `strategy-${bankId}`,
  bankId,
  type: 'WO',
  title: `Estratégia ${bankId}`,
  tasks: [],
});

describe('cronograma v1.3', () => {
  it('matches the canonical source counts', () => {
    expect(validateV13Sources()).toEqual([]);
  });

  it('creates actions with undated checklist items', () => {
    const actions = buildV13Actions(strategy('1'), defaultV13Schedule('2026-09-16'), { today: '2026-09-16' });
    expect(actions).toHaveLength(6);
    expect(actions[0].title).toBe('Catálogo e conceito do produto fonográfico');
    expect(actions[0].tasks).toHaveLength(3);
    expect(actions[0].tasks[0]).not.toHaveProperty('deadline');
  });

  it('uses the strategy acceptance date for later inicio strategies', () => {
    const schedule = { ...defaultV13Schedule('2026-09-16'), strategies: { 'strategy-3': { acceptedAt: '2026-10-01T10:00:00.000Z' } } };
    const actions = buildV13Actions(strategy('3'), schedule, { today: '2026-09-16' });
    expect(actions[0].date).toBe('2026-10-01');
  });

  it('does not schedule automatic actions on weekends or national holidays', () => {
    expect(isBrazilBusinessDay('2026-09-19')).toBe(false);
    expect(nextBrazilBusinessDay('2026-09-19')).toBe('2026-09-21');
    expect(nextBrazilBusinessDay('2026-09-07')).toBe('2026-09-08');
  });

  it('keeps informed actions undated until the artist answers', () => {
    const actions = buildV13Actions(strategy('41a'), defaultV13Schedule('2026-09-16'), { today: '2026-09-16' });
    expect(actions.find((action) => action.dateType === 'informada')?.date).toBeUndefined();
  });
});
