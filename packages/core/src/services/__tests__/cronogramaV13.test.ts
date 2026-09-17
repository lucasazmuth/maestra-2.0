import {
  dependencyWarnings,
  actionStatusFromChecklist,
  buildV13Actions,
  defaultV13Schedule,
  distributeV13Actions,
  isBrazilBusinessDay,
  nextBrazilBusinessDay,
  routineOccurrences,
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
  it('keeps responsibility boundaries between action status and checklist status', () => {
    const tasks = [
      { id: 'task-1', description: 'Uma tarefa', status: 'todo' as const },
      { id: 'task-2', description: 'Outra tarefa', status: 'todo' as const },
    ];
    expect(actionStatusFromChecklist(tasks, 'todo')).toBe('todo');
    expect(actionStatusFromChecklist([{ ...tasks[0], status: 'done' }], 'todo')).toBe('done');
    expect(actionStatusFromChecklist(tasks.map((task) => ({ ...task, status: 'done' as const })), 'todo')).toBe('done');
    // A manually completed action may intentionally keep open checklist items.
    expect(actionStatusFromChecklist(tasks, 'done')).toBe('done');
  });

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

  it('derives an existing action status from completed checklist items', () => {
    const actions = buildV13Actions(strategy('1'), defaultV13Schedule('2026-09-16'), {
      today: '2026-09-16',
      existing: [{
        id: 'existing-action',
        number: 1,
        title: 'Catálogo e conceito do produto fonográfico',
        dateType: 'automatica',
        anchor: 'lancamento',
        status: 'todo',
        tasks: [
          { id: 'a', description: 'a', status: 'done' },
          { id: 'b', description: 'b', status: 'done' },
          { id: 'c', description: 'c', status: 'done' },
        ],
      }],
    });
    expect(actions[0].status).toBe('done');
  });

  it('uses the strategy acceptance date for later inicio strategies', () => {
    const schedule = { ...defaultV13Schedule('2026-09-16'), strategies: { 'strategy-3': { acceptedAt: '2026-10-01T10:00:00.000Z' } } };
    const actions = buildV13Actions(strategy('3'), schedule, { today: '2026-09-16' });
    expect(actions[0].date).toBe('2026-10-01');
  });

  it('does not start an accepted strategy before a future plan start date', () => {
    const schedule = { ...defaultV13Schedule('2026-09-16'), startDate: '2026-10-01', strategies: { 'strategy-3': { acceptedAt: '2026-09-16T10:00:00.000Z' } } };
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

  it('schedules dependent actions after an informed date is chosen', () => {
    const schedule = { ...defaultV13Schedule('2026-09-16'), strategies: { 'strategy-22': { informedDates: { 3: '2026-10-01' } } } };
    const actions = buildV13Actions(strategy('22'), schedule, { today: '2026-09-16' });
    expect(actions[2].date).toBe('2026-10-01');
    expect(actions[3].date).toBe('2026-10-08');
  });

  it('starts routines after the previous action and generates cadence occurrences', () => {
    const actions = buildV13Actions(strategy('1'), defaultV13Schedule('2026-09-16'), { today: '2026-09-16' });
    const routine = actions.find((action) => action.dateType === 'rotina');
    expect(routine?.date).toBe('2027-03-15');
    expect(routineOccurrences(routine!, '2027-03-15', '2027-04-05')).toEqual(['2027-03-15', '2027-03-22', '2027-03-29', '2027-04-05']);
  });

  it('respects a minimum floor when a chain is compressed', () => {
    const schedule = { ...defaultV13Schedule('2026-09-16'), strategies: { 'strategy-1': { manualDates: { 2: '2026-09-17' } } } };
    const actions = buildV13Actions(strategy('1'), schedule, { today: '2026-09-16' });
    expect(actions[1].date).toBe('2026-09-19');
    expect(actions[2].date && actions[1].date && actions[2].date >= actions[1].date).toBe(true);
  });

  it('distributes automatic actions only forward on business days', () => {
    const actions = distributeV13Actions([
      { id: 'a', number: 1, title: 'A', dateType: 'automatica', anchor: 'inicio', date: '2026-09-21', status: 'todo', tasks: [] },
      { id: 'b', number: 2, title: 'B', dateType: 'automatica', anchor: 'inicio', date: '2026-09-21', status: 'todo', tasks: [] },
    ], '2026-09-16');
    expect(actions.map((action) => action.date)).toEqual(['2026-09-21', '2026-09-22']);
  });

  it('reports unresolved action dependencies without blocking execution', () => {
    const warnings = dependencyWarnings([
      { id: 'source', bankId: '6', actions: [{ id: 'x', number: 3, title: 'Branding', dateType: 'automatica', anchor: 'lancamento', status: 'todo', tasks: [] }] },
      { id: 'target', bankId: '8', actions: [{ id: 'y', number: 2, title: 'Fotos', dateType: 'automatica', anchor: 'inicio', status: 'todo', tasks: [] }] },
    ], 'execution');
    expect(warnings.some((warning) => warning.strategyId === 'target' && warning.actionNumber === 2)).toBe(true);
  });
});
