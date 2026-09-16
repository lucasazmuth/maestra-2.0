import { buildV13Actions, defaultV13Schedule } from './cronogramaV13';
import type {
  ActionPlanAction,
  ActionPlanV13Schedule,
  ActionTask,
  ArtistContent,
  Strategy,
} from '../interfaces/maestra';

export interface V13MigrationReport {
  migratedStrategyIds: string[];
  skippedStrategyIds: string[];
  preservedLegacyTaskCount: number;
  warnings: string[];
}

const legacyOrder = (task: ActionTask, index: number): number => task.schedule?.order || index + 1;

const mergeLegacyAction = (action: ActionPlanAction, legacy: ActionTask | undefined): ActionPlanAction => {
  if (!legacy) return action;
  return {
    ...action,
    id: legacy.id || action.id,
    date: legacy.deadline || action.date,
    status: legacy.status,
    owner: legacy.owner,
    legacyDescription: legacy.description !== action.title ? legacy.description : undefined,
    legacyTaskId: legacy.id,
  };
};

export const migrateStrategyToV13 = (
  strategy: Strategy,
  schedule: ActionPlanV13Schedule,
  today: string
): { strategy: Strategy; preservedLegacyTasks: ActionTask[]; migrated: boolean } => {
  if (strategy.actions?.length || strategy.actionPlanVersion === 'v3') {
    return { strategy, preservedLegacyTasks: strategy.legacyTasks || [], migrated: false };
  }

  const legacy = strategy.tasks || [];
  if (!legacy.length) {
    return { strategy, preservedLegacyTasks: [], migrated: false };
  }
  const canonical = buildV13Actions(strategy, schedule, { today });
  const legacyByOrder = new Map(legacy.map((task, index) => [legacyOrder(task, index), task]));
  const actions = canonical.map((action) => mergeLegacyAction(action, legacyByOrder.get(action.number)));
  const consumed = new Set(actions.map((action) => action.legacyTaskId).filter(Boolean));
  const preservedLegacyTasks = legacy.filter((task) => !consumed.has(task.id));

  return {
    strategy: {
      ...strategy,
      actions,
      actionPlanVersion: 'v3',
      legacyTasks: preservedLegacyTasks.length ? preservedLegacyTasks : undefined,
    },
    preservedLegacyTasks,
    migrated: true,
  };
};

export const migrateContentToV13 = (
  content: ArtistContent,
  today: string,
  schedule: ActionPlanV13Schedule = content.actionPlanScheduleV13 || defaultV13Schedule(today)
): { content: ArtistContent; report: V13MigrationReport } => {
  const report: V13MigrationReport = {
    migratedStrategyIds: [],
    skippedStrategyIds: [],
    preservedLegacyTaskCount: 0,
    warnings: [],
  };
  const strategies = (content.strategies || []).map((strategy) => {
    const result = migrateStrategyToV13(strategy, schedule, today);
    if (result.migrated) report.migratedStrategyIds.push(strategy.id);
    else report.skippedStrategyIds.push(strategy.id);
    report.preservedLegacyTaskCount += result.preservedLegacyTasks.length;
    if (!result.migrated && !strategy.actions?.length) {
      report.warnings.push(`Estratégia ${strategy.id} não encontrou ações canônicas.`);
    }
    return result.strategy;
  });
  return {
    content: { ...content, strategies, actionPlanScheduleV13: schedule },
    report,
  };
};
