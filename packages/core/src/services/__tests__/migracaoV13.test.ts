import { defaultV13Schedule } from '../cronogramaV13';
import { migrateContentToV13, migrateStrategyToV13 } from '../migracaoV13';
import type { ArtistContent, Strategy } from '../../interfaces/maestra';

const strategy = (tasks: Strategy['tasks'] = []): Strategy => ({
  id: 'strategy-1',
  bankId: '1',
  type: 'WO',
  title: 'Lançamentos',
  tasks,
});

describe('migração do plano v3', () => {
  it('preserves legacy dates, status and owner on matching actions', () => {
    const result = migrateStrategyToV13(strategy([{
      id: 'legacy-1',
      description: 'Catálogo antigo',
      status: 'done',
      owner: 'owner@example.com',
      deadline: '2026-10-10',
      schedule: { anchor: 'lancamento', order: 1 },
    }]), defaultV13Schedule('2026-09-16'), '2026-09-16');
    expect(result.migrated).toBe(true);
    expect(result.strategy.actions?.[0]).toMatchObject({ id: 'legacy-1', date: '2026-10-10', status: 'done', owner: 'owner@example.com' });
    expect(result.strategy.actions?.[0].legacyDescription).toBe('Catálogo antigo');
    expect(result.strategy.actions?.[0].tasks.every((task) => task.status === 'todo')).toBe(true);
  });

  it('keeps unmatched legacy tasks instead of dropping them', () => {
    const result = migrateStrategyToV13(strategy([{
      id: 'legacy-extra', description: 'Ação antiga extra', status: 'todo', deadline: '2026-09-20',
      schedule: { anchor: 'lancamento', order: 99 },
    }]), defaultV13Schedule('2026-09-16'), '2026-09-16');
    expect(result.preservedLegacyTasks).toHaveLength(1);
    expect(result.strategy.legacyTasks?.[0].id).toBe('legacy-extra');
  });

  it('does not migrate a strategy twice', () => {
    const first = migrateStrategyToV13(strategy([{ id: 'legacy-1', description: 'Ação antiga', status: 'todo' }]), defaultV13Schedule('2026-09-16'), '2026-09-16');
    const second = migrateStrategyToV13(first.strategy, defaultV13Schedule('2026-09-16'), '2026-09-16');
    expect(second.migrated).toBe(false);
    expect(second.strategy.actions).toEqual(first.strategy.actions);
  });

  it('reports all migrated strategies at content level', () => {
    const content = { strategies: [strategy([{ id: 'legacy-1', description: 'Ação antiga', status: 'todo' }])] } as ArtistContent;
    const result = migrateContentToV13(content, '2026-09-16');
    expect(result.report.migratedStrategyIds).toEqual(['strategy-1']);
    expect(result.content.actionPlanScheduleV13?.version).toBe('v1.3');
  });
});
