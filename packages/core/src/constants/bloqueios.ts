// O que cada bloqueio diz, e o que ele oferece em troca.
//
// Subiu de `src/components/LockedFeature/config.ts` quando o app nativo ganhou a mesma tela: o
// texto de um bloqueio é uma PROMESSA COMERCIAL, e duas listas de benefícios divergindo dariam
// ao mesmo plano descrições diferentes em cada superfície.
//
// O ícone ficou para trás de propósito: na web ele é um componente do `react-icons`, que não
// existe no app. Cada superfície escolhe o seu — e a tela da Nyta usa o emblema dela nas duas.

// ─── Types ────────────────────────────────────────────────────────────────────

// Variantes de bloqueio. Duas origens de bloqueio:
//   - perfil pendente (cobrança única R$199,90): 'planning' | 'team'
//   - falta de assinatura PRO (R$39,90/mês): 'tasks' | 'nyta'
export type LockedFeatureKey = 'planning' | 'team' | 'tasks' | 'nyta';

export type LockedCtaKind = 'unlock-profile' | 'subscribe-pro';

export interface LockedFeatureConfig {
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
    title: 'Planejamento Estratégico',
    benefits: [
      'Diagnóstico completo da carreira com a Nyta',
      'Plano de ação personalizado, salvo para sempre',
      'Compartilhe o perfil com colaboradores',
    ],
    cta: UNLOCK_PROFILE,
  },
  team: {
    title: 'Gestão de Equipe',
    benefits: [
      'Convide colaboradores para o perfil',
      'Eles acompanham planejamento, músicas e agenda',
      'Compartilhamento incluso no perfil completo',
    ],
    cta: UNLOCK_PROFILE,
  },
  tasks: {
    title: 'Gestão de Tarefas',
    benefits: [
      'Gerencie as tarefas do seu plano de ação',
      'Acompanhe o progresso fase a fase',
      'Recurso do plano PRO',
    ],
    cta: SUBSCRIBE_PRO,
  },
  nyta: {
    title: 'Nyta Assistente',
    benefits: [
      'Chat inteligente que executa ações no seu perfil',
      'Crie tarefas, eventos e gerencie músicas por conversa',
      'Análises e recomendações personalizadas com IA',
    ],
    cta: SUBSCRIBE_PRO,
  },
};
