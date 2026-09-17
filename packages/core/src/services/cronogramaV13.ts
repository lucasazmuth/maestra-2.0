import banco from '../constants/cronograma_v1_3.json';
import type {
  ActionPlanAction,
  ActionPlanAnchor,
  ActionPlanCadence,
  ActionPlanChecklistItem,
  ActionPlanDateType,
  ActionPlanMilestoneType,
  ActionPlanV13Schedule,
  ActionPlanV13StrategyState,
  Strategy,
  TaskStatus,
} from '../interfaces/maestra';

export const CRONOGRAMA_V13_VERSION = banco.versao as 'v1.3';
export const CRONOGRAMA_V13_TEXTS = banco.textos_nyta;
export const CRONOGRAMA_V13_GENERAL_QUESTIONS = banco.perguntas_gerais;
export const CRONOGRAMA_V13_PATH_QUESTIONS = banco.perguntas_de_caminho;
export const CRONOGRAMA_V13_DEPENDENCIES = banco.dependencias;
export const CRONOGRAMA_V13_STRATEGIES = banco.estrategias as unknown as Definition[];

type ActionDefinition = {
  n: number;
  n_insumo: number;
  nome: string;
  tipo: string;
  caminho: string | null;
  tarefas: string[];
  dia: number | null;
  conta_de?: string;
  classe?: string;
  piso_dias?: number;
  marco_tipo?: string;
  cadencia?: string;
  fim?: { tipo: string; dias?: number; acao?: number } | null;
  fim_de_semana: boolean;
};
type Definition = {
  id: string;
  titulo: string;
  ancora: string;
  acoes: ActionDefinition[];
};

export const CRONOGRAMA_V13_BY_ID = Object.fromEntries(
  CRONOGRAMA_V13_STRATEGIES.map((strategy) => [strategy.id.replace(/^#/, ''), strategy])
) as Record<string, Definition>;

const DAY = 86_400_000;
const parseDate = (value: string): Date => new Date(`${value}T12:00:00Z`);
const formatDate = (value: Date): string => value.toISOString().slice(0, 10);
const addDays = (value: string, amount: number): string => formatDate(new Date(parseDate(value).getTime() + amount * DAY));
const dateDiff = (a: string, b: string): number => Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / DAY);
const maxDate = (a: string, b: string): string => a >= b ? a : b;

const easterSunday = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12));
};

const nationalHolidays = (year: number): Set<string> => {
  const easter = easterSunday(year);
  const fixed = [`${year}-01-01`, `${year}-04-21`, `${year}-05-01`, `${year}-09-07`, `${year}-10-12`, `${year}-11-02`, `${year}-11-15`, `${year}-11-20`, `${year}-12-25`];
  const goodFriday = formatDate(new Date(easter.getTime() - 2 * DAY));
  return new Set([...fixed, goodFriday]);
};

export const isBrazilBusinessDay = (value: string): boolean => {
  const date = parseDate(value);
  const weekday = date.getUTCDay();
  return weekday !== 0 && weekday !== 6 && !nationalHolidays(date.getUTCFullYear()).has(value);
};

export const nextBrazilBusinessDay = (value: string): string => {
  let result = value;
  while (!isBrazilBusinessDay(result)) result = addDays(result, 1);
  return result;
};

export const defaultV13Schedule = (today: string): ActionPlanV13Schedule => ({
  version: 'v1.3',
  releaseDate: addDays(today, 180),
  startDate: today,
  strategies: {},
});

export const strategyDefinitionV13 = (strategy: Strategy | string): Definition | undefined => {
  const id = typeof strategy === 'string' ? strategy : strategy.bankId || strategy.id;
  return CRONOGRAMA_V13_BY_ID[String(id).replace(/^#/, '')] as Definition | undefined;
};

export const actionDefinitionsForPath = (definition: Definition, path?: string): ActionDefinition[] => {
  if (!path) return definition.acoes;
  return definition.acoes.filter((action: ActionDefinition) => !action.caminho || action.caminho === path);
};

const dateBase = (
  definition: Definition,
  action: ActionDefinition,
  schedule: ActionPlanV13Schedule,
  state: ActionPlanV13StrategyState,
  previousDate?: string
): string | undefined => {
  const acceptedStart = state.acceptedAt?.slice(0, 10);
  const planStart = acceptedStart && schedule.startDate ? maxDate(acceptedStart, schedule.startDate) : acceptedStart || schedule.startDate;
  if (action.conta_de === 'lancamento') return schedule.releaseDate;
  if (action.conta_de === 'inicio') return planStart;
  if (action.conta_de === 'propria') return state.ownDate;
  if (action.conta_de === 'informada_anterior') return previousDate;
  if (definition.ancora === 'inicio') return planStart;
  return definition.ancora === 'lancamento' ? schedule.releaseDate : state.ownDate;
};

const calculatedDate = (
  definition: Definition,
  action: ActionDefinition,
  schedule: ActionPlanV13Schedule,
  state: ActionPlanV13StrategyState,
  previousDate?: string
): string | undefined => {
  const base = dateBase(definition, action, schedule, state, previousDate);
  if (!base || action.tipo === 'rotina' || action.tipo === 'informada') return undefined;
  const offset = action.dia || 0;
  const date = action.conta_de === 'lancamento' || action.conta_de === 'propria'
    ? addDays(base, -offset)
    : addDays(base, offset);
  return action.fim_de_semana ? date : nextBrazilBusinessDay(date);
};

const statusFor = (value?: string): TaskStatus => value === 'done' || value === 'in_progress' || value === 'archived' ? value : 'todo';

/**
 * A checklist drives the action status when it changes. A `done` action with open
 * checklist items is still valid: it represents the manual completion allowed by
 * the v1.3 contract.
 */
export const actionStatusFromChecklist = (
  tasks: ActionPlanChecklistItem[],
  currentStatus?: TaskStatus
): TaskStatus => {
  if (currentStatus === 'archived') return 'archived';
  if (tasks.length > 0 && tasks.every((task) => task.status === 'done')) return 'done';
  if (currentStatus === 'done') return 'done';
  if (tasks.some((task) => task.status === 'done' || task.status === 'in_progress')) return 'in_progress';
  return currentStatus === 'in_progress' ? 'in_progress' : 'todo';
};

export interface BuildV13Options {
  today: string;
  existing?: ActionPlanAction[];
}

export const buildV13Actions = (
  strategy: Strategy,
  schedule: ActionPlanV13Schedule,
  options: BuildV13Options
): ActionPlanAction[] => {
  const definition = strategyDefinitionV13(strategy);
  if (!definition) return [];
  const state = schedule.strategies[strategy.id] || {};
  const definitions = actionDefinitionsForPath(definition, state.selectedPath);
  let previousDate: string | undefined;
  const actions = definitions.map((action) => {
    const routineStart = action.tipo === 'rotina'
      ? dateBase(definition, action, schedule, state, previousDate)
      : undefined;
    const date = state.manualDates?.[action.n]
      || state.informedDates?.[action.n]
      || (routineStart && nextBrazilBusinessDay(routineStart))
      || calculatedDate(definition, action, schedule, state, previousDate);
    const tight = !!date && date < options.today;
    const effectiveDate = date ? maxDate(date, options.today) : undefined;
    if (effectiveDate && action.tipo !== 'rotina') previousDate = effectiveDate;
    const existing = options.existing?.find((item) => item.number === action.n || item.sourceNumber === action.n);
    const tasks = action.tarefas.map((description, index) => ({
      id: existing?.tasks[index]?.id || `${strategy.id}-${action.n}-${index + 1}`,
      description,
      status: statusFor(existing?.tasks[index]?.status),
      comments: existing?.tasks[index]?.comments,
      owner: existing?.tasks[index]?.owner,
    }));
    return {
      id: existing?.id || `${strategy.id}-action-${action.n}`,
      number: action.n,
      sourceNumber: action.n_insumo,
      title: action.nome,
      path: action.caminho,
      dateType: action.tipo as ActionPlanDateType,
      anchor: definition.ancora as ActionPlanAnchor,
      date: effectiveDate,
      status: actionStatusFromChecklist(tasks, statusFor(existing?.status)),
      owner: existing?.owner,
      tight: tight || undefined,
      milestoneType: action.marco_tipo as ActionPlanMilestoneType | undefined,
      cadence: action.cadencia as ActionPlanCadence | undefined,
      recurrenceEnd: action.fim ? action.fim.tipo === 'dias_apos_inicio'
        ? addDays(effectiveDate || options.today, action.fim.dias || 0)
        : undefined : undefined,
      informedDate: state.informedDates?.[action.n],
      tasks,
    };
  });
  return applyCompressionFloors(actions);
};

const addCalendarMonths = (value: string, months: number): string => {
  const date = parseDate(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return formatDate(date);
};

export const applyCompressionFloors = (actions: ActionPlanAction[]): ActionPlanAction[] => {
  let previous: string | undefined;
  return actions.map((action) => {
    if (!action.date || action.dateType === 'rotina' || action.dateType === 'informada') return action;
    const definition = CRONOGRAMA_V13_STRATEGIES
      .flatMap((strategy) => strategy.acoes)
      .find((candidate) => candidate.n === action.number && candidate.nome === action.title);
    const floor = definition?.piso_dias || 0;
    const minimum = previous ? addDays(previous, floor) : action.date;
    const date = action.date < minimum ? minimum : action.date;
    previous = date;
    return { ...action, date, tight: action.tight || date !== action.date };
  });
};

export const distributeV13Actions = (
  actions: ActionPlanAction[],
  today: string
): ActionPlanAction[] => {
  const occupied = new Set<string>();
  return actions.map((action) => {
    if (!action.date || action.dateType !== 'automatica') return action;
    let candidate = nextBrazilBusinessDay(maxDate(action.date, today));
    for (let offset = 0; offset < 4 && occupied.has(candidate); offset += 1) {
      candidate = nextBrazilBusinessDay(addDays(candidate, 1));
    }
    occupied.add(candidate);
    return candidate === action.date ? action : { ...action, date: candidate, tight: action.tight || candidate !== action.date };
  });
};

export const routineOccurrences = (
  action: ActionPlanAction,
  from: string,
  to: string
): string[] => {
  if (action.dateType !== 'rotina' || !action.date || !action.cadence) return [];
  const end = action.recurrenceEnd && action.recurrenceEnd < to ? action.recurrenceEnd : to;
  const step = ({ semanal: 7, quinzenal: 14, mensal: 0, trimestral: 0, semestral: 0, anual: 0 } as Record<ActionPlanCadence, number>)[action.cadence];
  const output: string[] = [];
  let current = action.date;
  while (current <= end) {
    if (current >= from) output.push(current);
    current = step ? addDays(current, step) : addCalendarMonths(current, ({ mensal: 1, trimestral: 3, semestral: 6, anual: 12 } as Record<string, number>)[action.cadence] || 1);
  }
  return output;
};

export interface V13DependencyWarning {
  kind: 'acceptance' | 'drag' | 'execution';
  message: string;
  strategyId: string;
  actionNumber: number;
}

export const dependencyWarnings = (
  strategies: Array<{ id: string; bankId?: string; actions?: ActionPlanAction[] }>,
  mode: V13DependencyWarning['kind']
): V13DependencyWarning[] => {
  const warnings: V13DependencyWarning[] = [];
  for (const dependency of CRONOGRAMA_V13_DEPENDENCIES) {
    const source = strategies.find((strategy) => String(strategy.bankId || strategy.id).replace(/^#/, '') === String(dependency.x.estrategia).replace(/^#/, ''));
    const target = strategies.find((strategy) => String(strategy.bankId || strategy.id).replace(/^#/, '') === String(dependency.y.estrategia).replace(/^#/, ''));
    if (!target?.actions?.length) continue;
    const sourceDone = source?.actions?.some((action) => dependency.x.acoes.includes(action.number) && action.status === 'done');
    const targetAction = target.actions.find((action) => action.number === dependency.y.acao);
    if (!targetAction || sourceDone) continue;
    warnings.push({
      kind: mode,
      message: `${dependency.y.nome} depende de ${dependency.x.nomes.join(' ou ')}.`,
      strategyId: target.id,
      actionNumber: targetAction.number,
    });
  }
  return warnings;
};

export const validateV13Sources = (): string[] => {
  const errors: string[] = [];
  if (CRONOGRAMA_V13_STRATEGIES.length !== 45) errors.push(`expected 45 strategies, got ${CRONOGRAMA_V13_STRATEGIES.length}`);
  const actions = CRONOGRAMA_V13_STRATEGIES.flatMap((strategy) => strategy.acoes);
  const tasks = actions.flatMap((action) => action.tarefas);
  if (actions.length !== 246) errors.push(`expected 246 actions, got ${actions.length}`);
  if (tasks.length !== 665) errors.push(`expected 665 tasks, got ${tasks.length}`);
  if (CRONOGRAMA_V13_DEPENDENCIES.length !== 20) errors.push(`expected 20 dependencies, got ${CRONOGRAMA_V13_DEPENDENCIES.length}`);
  return errors;
};

export const shiftDateByDays = (value: string, amount: number): string => addDays(value, amount);
export const daysBetween = dateDiff;
