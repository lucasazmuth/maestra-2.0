import banco from '../constants/cronograma_v1_3.json';
import type {
  ActionPlanAction,
  ActionPlanAnchor,
  ActionPlanCadence,
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
  if (action.conta_de === 'lancamento') return schedule.releaseDate;
  if (action.conta_de === 'inicio') return state.acceptedAt?.slice(0, 10) || schedule.startDate;
  if (action.conta_de === 'propria') return state.ownDate;
  if (action.conta_de === 'informada_anterior') return previousDate;
  if (definition.ancora === 'inicio') return state.acceptedAt?.slice(0, 10) || schedule.startDate;
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

const statusFor = (value?: string): TaskStatus => value === 'done' || value === 'archived' ? value : 'todo';

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
  return definitions.map((action) => {
    const date = state.manualDates?.[action.n] || state.informedDates?.[action.n] || calculatedDate(definition, action, schedule, state, previousDate);
    const tight = !!date && date < options.today;
    const effectiveDate = date ? maxDate(date, options.today) : undefined;
    if (effectiveDate && action.tipo !== 'rotina' && action.tipo !== 'informada') previousDate = effectiveDate;
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
      status: statusFor(existing?.status),
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
