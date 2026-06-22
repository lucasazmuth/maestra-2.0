import { FC, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiX } from 'react-icons/fi';

import { useAppSelector } from '../../store/store';
import { PAYWALL_DISABLED } from '../../constants/maestra';

// Banner fixo no rodapé, no estilo do banner "Testar o Premium de graça" do Spotify.
// Reutilizável para qualquer aviso do app: promoção de assinatura (gradiente),
// avisos de pagamento (âmbar) e informativos (azul).

export type AnnouncementVariant = 'promo' | 'warning' | 'info';

interface AnnouncementBannerProps {
  variant: AnnouncementVariant;
  title: string;
  description: ReactNode;
  ctaLabel?: string;
  onCta?: () => void;
  onClose?: () => void;
}

export const AnnouncementBanner: FC<AnnouncementBannerProps> = ({
  variant,
  title,
  description,
  ctaLabel,
  onCta,
  onClose,
}) => (
  <div className={`announcement-banner announcement-banner--${variant}`} role='alert' aria-live='polite'>
    <div className='announcement-banner-texts'>
      <p className='announcement-banner-title'>{title}</p>
      <p className='announcement-banner-desc'>{description}</p>
    </div>
    {ctaLabel && onCta && (
      <button className='announcement-banner-cta' onClick={onCta}>
        {ctaLabel}
      </button>
    )}
    {onClose && (
      <button className='announcement-banner-close' aria-label='Fechar' onClick={onClose}>
        <FiX size={18} />
      </button>
    )}
  </div>
);

// ---- Banner de status da assinatura ------------------------------------------------------------

export type StatusBannerKind = 'promo' | 'grace' | 'pending';

/** Inputs for the pure derivation function (testable without hooks). */
export interface DeriveStatusBannerInput {
  status: 'active' | 'overdue' | 'cancelled' | 'pending' | 'none';
  initialized: boolean;
  gracePeriodEndsAt: string | null;
  // Há um asaas_subscription_id de verdade? A linha em asaas_subscriptions também é criada no
  // pagamento ÚNICO do perfil (só pra guardar o customer), e nasce com status 'pending' por
  // default — mas SEM assinatura. Sem subscription_id, não tratamos como assinatura pendente.
  hasSubscriptionId: boolean;
  pathname: string;
  paywallDisabled: boolean;
  now?: number; // defaults to Date.now() when not provided
}

/**
 * Pure function that derives which status banner to show (or null).
 * Extracted from useStatusBanner for testability.
 */
export function deriveStatusBanner(input: DeriveStatusBannerInput): StatusBannerKind | null {
  const { status, initialized, gracePeriodEndsAt, hasSubscriptionId, pathname, paywallDisabled, now = Date.now() } = input;

  if (paywallDisabled) return null;
  if (!initialized) return null;
  if (pathname.startsWith('/assinatura') || pathname.startsWith('/pagamento')) return null;

  // 'pending' SEM subscription_id é fantasma (a linha é só o customer do pagamento único) → 'none'.
  // Só sobrescreve o caso pending — active/overdue/cancelled passam intactos (não esconder ativa).
  const effectiveStatus = (status === 'pending' && !hasSubscriptionId) ? 'none' : status;

  if (
    effectiveStatus === 'overdue' &&
    gracePeriodEndsAt &&
    now < new Date(gracePeriodEndsAt).getTime()
  ) {
    return 'grace';
  }
  if (effectiveStatus === 'pending') return 'pending';
  if (effectiveStatus === 'none' || effectiveStatus === 'cancelled') {
    // Banner promo só aparece nas rotas de detalhe do artista (/artists/:id/...)
    const artistDetailMatch = /^\/artists\/[^/]+/.test(pathname) && pathname !== '/artists';
    if (artistDetailMatch) return 'promo';
  }
  return null;
}

// Decide qual banner de assinatura mostrar (ou nenhum). Usado pelo AppLayout
// também para reservar a altura do rodapé quando um banner está visível.
export function useStatusBanner(): StatusBannerKind | null {
  const status = useAppSelector((s) => s.subscription.status);
  const initialized = useAppSelector((s) => s.subscription.initialized);
  const gracePeriodEndsAt = useAppSelector((s) => s.subscription.gracePeriodEndsAt);
  const asaasSubscriptionId = useAppSelector((s) => s.subscription.asaasSubscriptionId);
  const { pathname } = useLocation();

  return deriveStatusBanner({
    status,
    initialized,
    gracePeriodEndsAt,
    hasSubscriptionId: !!asaasSubscriptionId,
    pathname,
    paywallDisabled: PAYWALL_DISABLED,
  });
}

const formatDeadline = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const StatusBanner: FC<{ kind: StatusBannerKind }> = ({ kind }) => {
  const navigate = useNavigate();
  const gracePeriodEndsAt = useAppSelector((s) => s.subscription.gracePeriodEndsAt);

  if (kind === 'grace') {
    return (
      <AnnouncementBanner
        variant='warning'
        title='Pagamento pendente'
        description={
          <>
            Regularize até <b>{gracePeriodEndsAt ? formatDeadline(gracePeriodEndsAt) : 'o fim do período de graça'}</b>{' '}
            para manter o acesso a todos os módulos.
          </>
        }
        ctaLabel='Regularizar agora'
        onCta={() => navigate('/pagamento')}
      />
    );
  }

  if (kind === 'pending') {
    return (
      <AnnouncementBanner
        variant='info'
        title='Pagamento em análise'
        description='Aguardando a confirmação do pagamento — seu acesso será liberado em instantes.'
        ctaLabel='Ver status'
        onCta={() => navigate('/pagamento')}
      />
    );
  }

  return (
    <AnnouncementBanner
      variant='promo'
      title='Assine o Maestra Pro'
      description='Chat com a Nyta IA, acompanhamento do plano de ação, notificações, catálogo ilimitado e muito mais.'
      ctaLabel='Assinar agora'
      onCta={() => navigate('/assinatura')}
    />
  );
};
