import type { ReactNode } from 'react';

// ---- Interfaces de Componentes --------------------------------------------------------------

export interface EnhancedEmptyStateProps {
  artistId: string;
  artistName: string;
  onStartWizard: () => void;
  // Se false, o usuário não pode iniciar o planejamento (colaborador sem PRO): mostra uma
  // mensagem de espera em vez do CTA (que só levaria a um bounce de volta pra esta tela).
  canStart?: boolean;
  // Vídeo de apresentação, opcional: o wizard passa o dele; o Plano de Ação usa a mesma tela sem
  // vídeo. Recebido pronto para este componente não precisar conhecer o mapa de vídeos.
  video?: ReactNode;
}
