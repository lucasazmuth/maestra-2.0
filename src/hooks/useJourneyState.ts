import { useMemo } from 'react';

import type { Artist } from '../interfaces/maestra';
import { PRODUCT_THEME } from '../components/productTheme';
import { useArtistCapabilities } from './useArtistCapabilities';

// Estágio do ciclo de crescimento do artista. Uma fonte única de verdade pro "cada produto libera
// o próximo": Diagnóstico REAL → Planejamento (Nyta) → Plano de Ação → ↺ evolução.
export type JourneyStage = 'diagnostic' | 'plan' | 'tasks' | 'evolution';

export interface JourneyNext {
  stage: JourneyStage;
  kicker: string;     // rótulo do produto (ex.: "Planejamento")
  title: string;      // chamada principal ("Crie seu planejamento com a Nyta")
  desc: string;       // 1 linha de apoio
  ctaLabel: string;   // texto do botão
  to: string;         // sufixo da rota (prefixar com /artists/:id/), ex.: 'wizard'
  accent: string;     // triplete "r, g, b" do produto (PRODUCT_THEME)
}

export interface JourneyState {
  paid: boolean;
  hasDiagnostic: boolean;
  hasPlan: boolean;
  tasksTotal: number;
  tasksDone: number;
  tasksPending: number;
  pct: number;
  stage: JourneyStage;
  next: JourneyNext;
}

const REAL = PRODUCT_THEME.real.accent;
const PLAN = PRODUCT_THEME.planning.accent;
const ACTION = PRODUCT_THEME.action.accent;

// Deriva o estado da jornada a partir do conteúdo do artista + capacidades (pago/PRO).
// Reusado pelo card "Seu próximo passo", pelo JourneyMap e pela Sidebar (cadeados suaves).
export function useJourneyState(artist?: Artist | null): JourneyState {
  const { isPaid, viewPlanning } = useArtistCapabilities(artist);

  return useMemo(() => {
    const c = artist?.content;
    const paid = !!viewPlanning && !!isPaid;
    const hasDiagnostic = !!c?.realIndex?.profile;
    const strategies = c?.strategies || [];
    const hasPlan = strategies.length > 0;

    const allTasks = strategies.flatMap((s) => (s.tasks || []).filter((t) => t.status !== 'archived'));
    const tasksTotal = allTasks.length;
    const tasksDone = allTasks.filter((t) => t.status === 'done').length;
    const tasksPending = tasksTotal - tasksDone;
    const pct = tasksTotal ? Math.round((tasksDone / tasksTotal) * 100) : 0;

    let next: JourneyNext;
    if (!hasDiagnostic) {
      next = {
        stage: 'diagnostic', kicker: 'Diagnóstico REAL', accent: REAL, to: 'diagnostico',
        title: 'Comece pelo seu Diagnóstico REAL',
        desc: 'Descubra em que fase a sua carreira está, com dados reais.',
        ctaLabel: 'Ver diagnóstico',
      };
    } else if (!hasPlan) {
      next = {
        stage: 'plan', kicker: 'Planejamento', accent: PLAN, to: 'wizard',
        title: 'Crie seu planejamento com a Nyta',
        desc: 'Defina visão, missão, objetivos e estratégias — o mapa da sua carreira.',
        ctaLabel: 'Criar planejamento',
      };
    } else if (tasksPending > 0 || tasksTotal === 0) {
      next = {
        stage: 'tasks', kicker: 'Plano de Ação', accent: ACTION, to: 'action-plan',
        title: tasksTotal === 0 ? 'Monte suas tarefas no Plano de Ação' : `Suas tarefas de hoje · ${tasksPending} pendente${tasksPending === 1 ? '' : 's'}`,
        desc: tasksTotal === 0 ? 'Transforme suas estratégias em passos práticos.' : 'Avance um passo de cada vez e veja sua carreira andar.',
        ctaLabel: tasksTotal === 0 ? 'Abrir plano' : 'Ver minhas tarefas',
      };
    } else {
      next = {
        stage: 'evolution', kicker: 'Evolução', accent: REAL, to: 'diagnostico/refazer',
        title: 'Tudo em dia! Hora de medir sua evolução',
        desc: 'Você concluiu suas tarefas. Refaça o diagnóstico e veja o quanto avançou.',
        ctaLabel: 'Refazer diagnóstico',
      };
    }

    return { paid, hasDiagnostic, hasPlan, tasksTotal, tasksDone, tasksPending, pct, stage: next.stage, next };
  }, [artist, isPaid, viewPlanning]);
}

export default useJourneyState;
