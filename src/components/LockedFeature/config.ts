import { IconType } from 'react-icons';
import { FiCheckSquare, FiUsers, FiTrendingUp } from 'react-icons/fi';

// ─── Types ────────────────────────────────────────────────────────────────────

// Variantes de bloqueio. Duas origens de bloqueio:
//   - perfil pendente (cobrança única R$199,90): 'planning' | 'team'
//   - falta de assinatura PRO (R$39,90/mês): 'tasks' | 'nyta'
export type LockedFeatureKey = 'planning' | 'team' | 'tasks' | 'nyta';

export type LockedCtaKind = 'unlock-profile' | 'subscribe-pro';

export interface LockedFeatureConfig {
  icon: IconType; // mesmo ícone do item no menu lateral do módulo
  title: string;
  benefits: [string, string, string]; // exatamente 3
  cta: { label: string; kind: LockedCtaKind };
}

// ─── Configuration ────────────────────────────────────────────────────────────

// O preço NÃO fica no label (é dinâmico via config) — o componente compõe
// "{label} — {preço}" a partir do `kind`.
const UNLOCK_PROFILE: LockedFeatureConfig['cta'] = {
  label: 'Desbloquear este perfil',
  kind: 'unlock-profile',
};
const SUBSCRIBE_PRO: LockedFeatureConfig['cta'] = {
  label: 'Assine o PRO',
  kind: 'subscribe-pro',
};

export const LOCKED_FEATURE_CONFIG: Record<LockedFeatureKey, LockedFeatureConfig> = {
  planning: {
    icon: FiCheckSquare, // = "Plano de Ação" na navbar
    title: 'Planejamento Estratégico',
    benefits: [
      'Diagnóstico completo da carreira com a Nyta',
      'Plano de ação personalizado, salvo para sempre',
      'Compartilhe o perfil com colaboradores',
    ],
    cta: UNLOCK_PROFILE,
  },
  team: {
    icon: FiUsers, // = "Equipe" na navbar
    title: 'Gestão de Equipe',
    benefits: [
      'Convide colaboradores para o perfil',
      'Eles acompanham planejamento, catálogo e agenda',
      'Compartilhamento incluso no perfil completo',
    ],
    cta: UNLOCK_PROFILE,
  },
  tasks: {
    icon: FiCheckSquare,
    title: 'Gestão de Tarefas',
    benefits: [
      'Gerencie as tarefas do seu plano de ação',
      'Acompanhe o progresso fase a fase',
      'Recurso do plano PRO',
    ],
    cta: SUBSCRIBE_PRO,
  },
  nyta: {
    icon: FiTrendingUp,
    title: 'Nyta — Assistente',
    benefits: [
      'Chat inteligente que executa ações no seu perfil',
      'Crie tarefas, eventos e gerencie catálogo por conversa',
      'Análises e recomendações personalizadas com IA',
    ],
    cta: SUBSCRIBE_PRO,
  },
};
