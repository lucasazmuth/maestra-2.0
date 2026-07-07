// ---- Interfaces de Componentes --------------------------------------------------------------

export interface EnhancedEmptyStateProps {
  artistId: string;
  artistName: string;
  onStartWizard: () => void;
  // Se false, o usuário não pode iniciar o planejamento (colaborador sem PRO): mostra uma
  // mensagem de espera em vez do CTA (que só levaria a um bounce de volta pra esta tela).
  canStart?: boolean;
}
