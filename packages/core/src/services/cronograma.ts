import banco from '../constants/cronograma_v1.json';
import type { ActionTask, ActionPlanSchedule, Strategy } from '../interfaces/maestra';

export type ScheduleAnchor = 'lancamento' | 'inicio' | 'propria';

type BankTask = { n: number; texto: string; dia: number | null; continua: boolean };
type BankStrategy = {
  id: string;
  titulo: string;
  ancora: ScheduleAnchor;
  pergunta_propria?: string;
  caminho?: { substitui_tarefa: number | null; opcoes: Array<{ rotulo: string; tarefas_exclusivas: number[] }> };
  tarefas: BankTask[];
};

export const CRONOGRAMA_VERSION = banco.versao as 'v1';
export const CRONOGRAMA_TEXTS = banco.textos_nyta;
export const CRONOGRAMA_GENERAL_QUESTIONS = banco.perguntas_gerais;
export const CRONOGRAMA_STRATEGIES = banco.estrategias as BankStrategy[];
export const CRONOGRAMA_BY_ID = Object.fromEntries(
  CRONOGRAMA_STRATEGIES.map((strategy) => [strategy.id.replace(/^#/, ''), strategy])
) as Record<string, BankStrategy>;

const DAY = 86_400_000;
const parse = (value: string): Date => new Date(`${value}T12:00:00Z`);
const format = (date: Date): string => date.toISOString().slice(0, 10);
const addDays = (value: string, amount: number): string => format(new Date(parse(value).getTime() + amount * DAY));
const maxDate = (a: string, b: string): string => a >= b ? a : b;
const minDate = (a: string, b: string): string => a <= b ? a : b;
const newId = (): string => Math.random().toString(36).slice(2, 10);

export const bankIdForSchedule = (strategy: Strategy): string | undefined => strategy.bankId?.replace(/^#/, '');

export const scheduleBankFor = (strategy: Strategy): BankStrategy | undefined => {
  const id = bankIdForSchedule(strategy);
  return id ? CRONOGRAMA_BY_ID[id] : undefined;
};

export const defaultSchedule = (today: string): ActionPlanSchedule => ({
  version: 'v1',
  releaseDate: addDays(today, 180),
  startDate: today,
  strategies: {},
});

const includedTasks = (definition: BankStrategy, path?: string): BankTask[] => {
  if (!definition.caminho || !path) return definition.tarefas;
  const selected = definition.caminho.opcoes.find((option) => option.rotulo === path);
  if (!selected) return definition.tarefas;
  const exclusive = new Set(definition.caminho.opcoes
    .filter((option) => option.rotulo !== path)
    .flatMap((option) => option.tarefas_exclusivas));
  if (definition.caminho.substitui_tarefa) exclusive.add(definition.caminho.substitui_tarefa);
  return definition.tarefas.filter((task) => !exclusive.has(task.n));
};

export const buildScheduledTasks = (
  strategy: Strategy,
  schedule: ActionPlanSchedule,
  today: string
): ActionTask[] => {
  const definition = scheduleBankFor(strategy);
  if (!definition) return strategy.tasks;
  const state = schedule.strategies[strategy.id] || {};
  const base = definition.ancora === 'lancamento'
    ? schedule.releaseDate
    : definition.ancora === 'inicio'
      ? schedule.startDate
      : state.ownDate;
  if (!base) return strategy.tasks;

  let previous = base;
  const scheduled = includedTasks(definition, state.path).map((task, index) => {
    const raw = task.continua ? previous : definition.ancora === 'inicio'
      ? addDays(base, task.dia || 0)
      : addDays(base, -(task.dia || 0));
    let deadline = task.continua ? previous : raw;
    let tight = deadline < today;
    deadline = maxDate(deadline, today);
    // Lançamento/data própria não pode atravessar a âncora, exceto tarefa pós-Dia D (dia negativo).
    if (definition.ancora !== 'inicio' && (task.dia || 0) >= 0 && deadline > base) {
      deadline = base;
      tight = true;
    }
    previous = deadline;
    const old = strategy.tasks.find((candidate) => candidate.schedule?.order === task.n || candidate.description === task.texto);
    return {
      id: old?.id || newId(),
      description: task.texto,
      owner: old?.owner,
      status: old?.status || 'todo',
      deadline,
      comments: old?.comments,
      type: old?.type,
      schedule: {
        anchor: definition.ancora,
        order: task.n || index + 1,
        tight: tight ? true : undefined,
        continuous: task.continua ? true : undefined,
        recurrence: task.continua ? 'weekly' as const : undefined,
        strategyId: strategy.id,
      },
    };
  });
  for (const [orderValue, manualDate] of Object.entries(state.manualDates || {})) {
    const order = Number(orderValue);
    const index = scheduled.findIndex((task) => task.schedule?.order === order);
    if (index < 0 || !scheduled[index].deadline) continue;
    const delta = Math.round((parse(manualDate).getTime() - parse(scheduled[index].deadline!).getTime()) / DAY);
    for (let offset = index; offset < scheduled.length; offset += 1) {
      const task = scheduled[offset];
      if (!task.deadline) continue;
      let deadline = maxDate(addDays(task.deadline, delta), today);
      if (definition.ancora !== 'inicio' && !task.schedule?.continuous && (definition.tarefas.find((item) => item.n === task.schedule?.order)?.dia || 0) >= 0) {
        deadline = minDate(deadline, base);
      }
      scheduled[offset] = { ...task, deadline, schedule: { ...task.schedule!, tight: deadline === today || deadline === base } };
    }
  }
  return scheduled;
};

export const scheduleStrategy = (strategy: Strategy, schedule: ActionPlanSchedule, today: string): Strategy => ({
  ...strategy,
  tasks: buildScheduledTasks(strategy, schedule, today),
});

// Move a tarefa escolhida e todas as seguintes da mesma estratégia; as anteriores ficam intactas.
export const shiftScheduledTask = (strategy: Strategy, taskId: string, nextDate: string, today: string): Strategy => {
  const definition = scheduleBankFor(strategy);
  const index = strategy.tasks.findIndex((task) => task.id === taskId);
  if (!definition || index < 0) return strategy;
  const base = strategy.tasks[index].deadline || today;
  const delta = Math.round((parse(nextDate).getTime() - parse(base).getTime()) / DAY);
  const anchorDate = definition.ancora === 'inicio' ? undefined : strategy.tasks
    .filter((task) => task.schedule?.anchor === definition.ancora && !task.schedule?.continuous)
    .map((task) => task.deadline)
    .filter(Boolean)
    .sort()
    .at(-1);
  return {
    ...strategy,
    tasks: strategy.tasks.map((task, taskIndex) => {
      if (taskIndex < index || !task.deadline) return task;
      let deadline = maxDate(addDays(task.deadline, delta), today);
      if (anchorDate && !task.schedule?.continuous) deadline = minDate(deadline, anchorDate);
      return { ...task, deadline, schedule: { ...task.schedule!, tight: deadline === today || deadline === anchorDate } };
    }),
  };
};

export const validateScheduleBank = (bankIds: string[]): string[] => {
  const expected = new Set(bankIds.map((id) => id.replace(/^#/, '')));
  return Array.from(expected).filter((id) => !CRONOGRAMA_BY_ID[id]);
};
