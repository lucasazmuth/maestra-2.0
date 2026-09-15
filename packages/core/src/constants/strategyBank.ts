import banco from './motor_v4_banco.json';

export interface BankStrategy {
  id: string;
  order: number;
  category: string;
  title: string;
  subtitle: string;
  tasks: string[];
  requires_any_opportunity: number[];
  triggers: { weaknesses: number[]; opportunities: number[] };
  info: { strengths: number[]; threats: number[] };
}

export const STRATEGY_BANK: BankStrategy[] = banco.strategies.map((s, order) => ({
  ...s, order, tasks: s.action_plan,
}));
export const STRATEGY_BY_ID: Record<string, BankStrategy> = Object.fromEntries(
  STRATEGY_BANK.map(s => [s.id, s])
);
