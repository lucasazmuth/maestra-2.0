import { FC } from 'react';
import { useLocation } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';

import { useNytaModal } from '../../hooks/useNytaModal';
import { useEntitlements } from '../../hooks/useEntitlements';
import { PAYWALL_DISABLED } from '../../constants/maestra';
import { AiGlow } from '../AiGlow';
import styles from './NytaHeaderButton.module.scss';

/**
 * Botão permanente no cabeçalho que abre/fecha o modal da Nyta.
 * Pílula com o ROSTO da Nyta + rótulo "Nyta IA" (autoexplicativo) e gradiente da marca.
 * Sem acesso (paywall), mostra um cadeado no lugar do rosto e fica travado.
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
  const isLocked = !hasAccess;

  const handleClick = () => {
    // Com acesso: abre/fecha o chat. Sem acesso: abre o modal mostrando o paywall (Assinar Pro).
    if (hasAccess) toggle();
    else open();
  };

  const classNames = [
    styles.button,
    isOpen && styles.active,
    isLocked && styles.disabled,
  ]
    .filter(Boolean)
    .join(' ');

  const button = (
    <button
      onClick={handleClick}
      aria-label="Nyta"
      title={isLocked ? 'Maestra · Assine o Pro para usar a Nyta IA' : 'Maestra · Nyta IA'}
      className={classNames}
    >
      {isLocked && <FiLock size={14} />}
      {/* Nome padronizado "Nyta IA" em desktop e mobile. */}
      <span className={styles.label}>
        Nyta
        <span className={styles.labelExtra}> IA</span>
        <span className={styles.labelShort}> IA</span>
      </span>
    </button>
  );

  // Sem acesso (paywall): pílula travada (cadeado, sem brilho) que abre o modal de assinatura.
  return isLocked ? button : <AiGlow>{button}</AiGlow>;
};
