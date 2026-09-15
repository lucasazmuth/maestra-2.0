import { STRATEGY_BANK } from '../../constants/strategyBank';
import {
  CRONOGRAMA_STRATEGIES,
  buildScheduledTasks,
  defaultSchedule,
  scheduleStrategy,
  validateScheduleBank,
} from '../cronograma';
import type { Strategy } from '../../interfaces/maestra';

const strategy = (bankId: string): Strategy => ({
  id: `strategy-${bankId}`,
  bankId,
  bankVersion: '4.0',
  type: 'WO',
  title: `#${bankId}`,
  tasks: [],
});

describe('cronograma v1', () => {
  it('cobre o banco v4 e preserva as 449 tarefas aprovadas', () => {
    expect(CRONOGRAMA_STRATEGIES).toHaveLength(45);
    expect(CRONOGRAMA_STRATEGIES.reduce((total, item) => total + item.tarefas.length, 0)).toBe(449);
    expect(validateScheduleBank(STRATEGY_BANK.map((item) => item.id))).toEqual([]);
  });

  it('calcula tarefas antes e depois do Dia D', () => {
    const schedule = { ...defaultSchedule('2026-01-01'), releaseDate: '2026-07-01' };
    const tasks = buildScheduledTasks(strategy('9'), schedule, '2026-01-01');
    expect(tasks[0].deadline).toBe('2026-05-02');
    expect(tasks.at(-1)?.deadline).toBe('2026-07-15');
  });

  it('concentra tarefas vencidas em hoje e marca como apertadas', () => {
    const schedule = { ...defaultSchedule('2026-01-01'), releaseDate: '2026-01-10' };
    const tasks = buildScheduledTasks(strategy('1'), schedule, '2026-01-01');
    expect(tasks[0].deadline).toBe('2026-01-01');
    expect(tasks[0].schedule?.tight).toBe(true);
  });

  it('remove o caminho não escolhido e inicia recorrência semanal', () => {
    const base = defaultSchedule('2026-01-01');
    base.strategies['strategy-3'] = { path: 'Editora própria' };
    const tasks = buildScheduledTasks(strategy('3'), base, '2026-01-01');
    expect(tasks).toHaveLength(6);
    expect(tasks.at(-1)?.schedule?.recurrence).toBe('weekly');
  });

  it('não agenda estratégia própria sem a data respondida e agenda depois da resposta', () => {
    const base = defaultSchedule('2026-01-01');
    expect(buildScheduledTasks(strategy('22'), base, '2026-01-01')).toEqual([]);
    base.strategies['strategy-22'] = { ownDate: '2026-09-20' };
    expect(scheduleStrategy(strategy('22'), base, '2026-01-01').tasks).toHaveLength(10);
  });

  it('reaplica ajuste manual e desloca as tarefas seguintes da cadeia', () => {
    const base = defaultSchedule('2026-01-01');
    base.strategies['strategy-3'] = { path: 'Editora própria', manualDates: { 1: '2026-01-10' } };
    const tasks = buildScheduledTasks(strategy('3'), base, '2026-01-01');
    expect(tasks[0].deadline).toBe('2026-01-10');
    expect(tasks[1].deadline).toBe('2026-01-15');
  });
});
