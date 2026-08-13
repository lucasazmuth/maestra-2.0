import { IconType } from 'react-icons';
import { FiCheckSquare, FiMusic, FiUser } from 'react-icons/fi';

export type UpsellContext = 'artist-limit' | 'catalog-limit' | 'action-plan';

export interface UpsellConfig {
  title: string;
  description: string;
  benefits: string[];
  icon: IconType;
}

export const UPSELL_CONFIG: Record<UpsellContext, UpsellConfig> = {
  'artist-limit': {
    title: 'Limite de artistas atingido',
    description:
      'No plano gratuito, você pode gerenciar 1 artista. Assine o Pro para adicionar artistas ilimitados.',
    benefits: [
      'Artistas ilimitados',
      'Planejamento estratégico com IA',
      'Gestão de equipe colaborativa',
    ],
    icon: FiUser,
  },
  'catalog-limit': {
    title: 'Limite de músicas atingido',
    description:
      'No plano gratuito, você pode cadastrar até 10 músicas. Assine o Pro para Músicas ilimitadas.',
    benefits: [
      'Músicas ilimitadas',
      'Splits e contratos automatizados',
      'Relatórios de royalties detalhados',
    ],
    icon: FiMusic,
  },
  'action-plan': {
    title: 'Assine o Maestra Pro',
    description: 'Desbloqueie a edição e a gestão completa do seu Plano de Ação.',
    benefits: [
      'Adicionar tarefas e estratégias',
      'Editar prazos, categorias e responsáveis',
      'Acompanhar seu plano com a Nyta IA',
    ],
    icon: FiCheckSquare,
  },
};
