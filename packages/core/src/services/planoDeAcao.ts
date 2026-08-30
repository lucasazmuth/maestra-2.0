import { TASK_OWNER_SELF } from '../constants/maestra';
import { STRATEGY_BY_ID } from '../constants/strategyBank';
import type { ActionTask, Strategy } from '../interfaces/maestra';

// O passo a passo canônico de uma estratégia → as tarefas dela.
//
// Vivia em `src/pages/Wizard/method/engines.ts`, só na web. Subiu para o núcleo porque o app
// também precisa: trazer uma estratégia arquivada de volta ao plano é semear as tarefas do
// banco nela, e essa regra não pode ter duas versões — a mesma estratégia tem que render as
// mesmas tarefas, venha o pedido do navegador ou do celular.
//
// Determinístico e sem LLM: as tarefas canônicas não têm placeholder, então o texto é literal.

const identificador = (): string => Math.random().toString(36).slice(2, 10);

export const buildActionPlan = (strategy: Strategy): ActionTask[] => {
  const doBanco = strategy.bankId ? STRATEGY_BY_ID[strategy.bankId] : undefined;
  return (doBanco?.tasks || []).map((description) => ({
    id: identificador(),
    description,
    owner: TASK_OWNER_SELF,
    status: 'todo' as const,
  }));
};
