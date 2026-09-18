import banco from './motor_v4_banco.json';
import bancoV40 from './motor_v4_banco_v4_0.json';

export interface BankStrategy {
  id: string;
  order: number;
  category: string;
  title: string;
  subtitle: string;
  tasks: string[];
  triggers: { weaknesses: number[]; opportunities: number[] };
  responds_to: number[];
  blocked_by_strength: number | null;
  info: { threats: number[] };
}

// O plano legado ainda usa a lista plana 4.0; o cronograma v1.3 usa as ações com checklist.
const legacyTasks = Object.fromEntries(bancoV40.strategies.map(s => [s.id, s.action_plan]));
export const STRATEGY_BANK: BankStrategy[] = banco.strategies.map((s, order) => ({
  ...s, order, tasks: legacyTasks[s.id] || [],
}));
export const STRATEGY_BY_ID: Record<string, BankStrategy> = Object.fromEntries(
  STRATEGY_BANK.map(s => [s.id, s])
);
