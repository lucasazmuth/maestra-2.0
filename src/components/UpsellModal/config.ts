import { IconType } from 'react-icons';
import { FiUser, FiMusic } from 'react-icons/fi';

export type UpsellContext = 'artist-limit' | 'catalog-limit';

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
    title: 'Limite de faixas atingido',
    description:
      'No plano gratuito, você pode cadastrar até 10 faixas. Assine o Pro para catálogo ilimitado.',
    benefits: [
      'Catálogo ilimitado',
      'Splits e contratos automatizados',
      'Relatórios de royalties detalhados',
    ],
    icon: FiMusic,
  },
};
