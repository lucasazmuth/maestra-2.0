import { FC } from 'react';
import { useLocation } from 'react-router-dom';

import { useNytaModal } from '../../hooks/useNytaModal';
import { useEntitlements } from '../../hooks/useEntitlements';
import { PAYWALL_DISABLED } from '../../constants/maestra';
import { NytaAvatar } from '../../pages/Wizard/chat/nytaPersona';
import styles from './NytaHeaderButton.module.scss';

/**
 * Botão da Nyta no cabeçalho — SÓ NO MOBILE (no desktop a Nyta vive na sidebar).
 * Mostra apenas o avatar da Nyta ao lado do sino, mais limpo que a antiga pílula "Nyta IA".
 * O avatar fica SEMPRE clicável (sem cadeado): o próprio modal avisa quando está bloqueado e
 * mostra o Assinar Pro. Deixá-lo livre é mais convidativo do que travá-lo aqui.
 */
export const NytaHeaderButton: FC = () => {
  const { isOpen, toggle, open } = useNytaModal();
  const entitlements = useEntitlements();
  const { pathname } = useLocation();

  // Só aparece no contexto de um perfil (/artists/:id...). Na lista (/artists) e em outras
  // telas (configurações, assinatura…) fica oculto — a Nyta atua sobre um artista.
  const inArtistContext = /^\/artists\/[^/]+/.test(pathname);

  if (!inArtistContext) return null;

  const hasAccess = PAYWALL_DISABLED || entitlements.isPro;

  const handleClick = () => {
    // Com acesso: abre/fecha o chat. Sem acesso: abre o modal mostrando o paywall (Assinar Pro).
    if (hasAccess) toggle();
    else open();
  };

  const classNames = [styles.button, isOpen && styles.active].filter(Boolean).join(' ');

  return (
    <button
      onClick={handleClick}
      aria-label="Nyta"
      title="Maestra · Nyta IA"
      className={classNames}
    >
      <NytaAvatar size={32} />
    </button>
  );
};
