import { FC, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircleFilled, CopyOutlined, ClockCircleOutlined, WifiOutlined } from '@ant-design/icons';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { pollPaymentStatus, resumePayment } from '../../store/slices/subscription';

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    padding: 24,
    maxWidth: 480,
    margin: '0 auto',
  } as React.CSSProperties,
  title: {
    fontFamily: 'SpotifyMixUITitle',
    fontWeight: 800,
    fontSize: 28,
    color: '#fff',
    margin: '0 0 8px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  subtitle: {
    color: '#b3b3b3',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center' as const,
  } as React.CSSProperties,
  card: {
    background: '#181818',
    borderRadius: 12,
    padding: 24,
    marginBottom: 20,
  } as React.CSSProperties,
  qrContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 16,
  } as React.CSSProperties,
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 8,
    background: '#fff',
    padding: 8,
  } as React.CSSProperties,
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
    marginTop: 0,
    marginBottom: 12,
  } as React.CSSProperties,
  copyContainer: {
    display: 'flex',
    gap: 8,
    alignItems: 'stretch',
  } as React.CSSProperties,
  copyInput: {
    flex: 1,
    background: '#282828',
    border: '1px solid #333',
    borderRadius: 8,
    color: '#fff',
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  copyBtn: {
    background: '#af2896',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    padding: '10px 16px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  copiedBtn: {
    background: '#1db954',
  } as React.CSSProperties,
  countdown: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: '#b3b3b3',
    fontSize: 14,
    marginBottom: 16,
  } as React.CSSProperties,
  countdownExpired: {
    color: '#ff4d4f',
  } as React.CSSProperties,
  pollingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 12,
    padding: '16px 0',
  } as React.CSSProperties,
  pollingDots: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  } as React.CSSProperties,
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#af2896',
    animation: 'pulse 1.4s infinite ease-in-out',
  } as React.CSSProperties,
  pollingText: {
    color: '#b3b3b3',
    fontSize: 14,
  } as React.CSSProperties,
  successContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 12,
    padding: '24px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  successText: {
    color: '#af2896',
    fontSize: 18,
    fontWeight: 700,
  } as React.CSSProperties,
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 12,
    padding: '24px 0',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  errorText: {
    color: '#ff4d4f',
    fontSize: 15,
    fontWeight: 600,
  } as React.CSSProperties,
  errorHint: {
    color: '#b3b3b3',
    fontSize: 13,
  } as React.CSSProperties,
  retryBtn: {
    background: '#af2896',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    padding: '12px 24px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: 8,
  } as React.CSSProperties,
};

// ─── Keyframes (injected once) ──────────────────────────────────────────────────

const KEYFRAMES_ID = 'payment-page-keyframes';

function injectKeyframes() {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes pulse {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ─── Component ──────────────────────────────────────────────────────────────────

const PaymentPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { pixData, status } = useAppSelector((s) => s.subscription);

  const [copied, setCopied] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [connectivityError, setConnectivityError] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [resumeFailed, setResumeFailed] = useState(false);

  const pollingStarted = useRef(false);
  const resumeTried = useRef(false);

  // ─── Sem pixData → tenta RETOMAR antes de redirecionar ──────────────────────
  // Cobre o caso "gerou o QR, fechou e voltou depois": o pixData não persiste, então buscamos
  // o QR atual da cobrança em aberto no Asaas (sem criar assinatura nova). Só manda pra
  // /assinatura se não houver nada pra retomar.
  useEffect(() => {
    if (paymentConfirmed || status === 'active') return;

    const hasValidPixData = pixData && pixData.qrCode && pixData.expiresAt;
    if (hasValidPixData) return;          // fluxo normal (QR recém-criado já no estado)
    if (resumeTried.current) return;      // só tenta uma vez
    resumeTried.current = true;

    setResuming(true);
    dispatch(resumePayment())
      .unwrap()
      .then((res) => {
        setResuming(false);
        if (res.status === 'active') { setPaymentConfirmed(true); return; }  // já pago → sucesso
        if (res.status === 'none') { navigate('/assinatura', { replace: true }); return; }
        // pending: se veio QR, entra no Redux e renderiza; se não, mostra estado de falha.
        if (!res.pixData?.qrCode) setResumeFailed(true);
      })
      .catch(() => {
        setResuming(false);
        navigate('/assinatura', { replace: true });
      });
  }, [pixData, paymentConfirmed, status, dispatch, navigate]);

  // ─── Inject keyframes ───────────────────────────────────────────────────────
  useEffect(() => {
    injectKeyframes();
  }, []);

  // ─── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pixData?.expiresAt) return;

    const calculateRemaining = () => {
      const expiresAt = new Date(pixData.expiresAt!).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((expiresAt - now) / 1000));
    };

    setSecondsRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setSecondsRemaining(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [pixData?.expiresAt]);

  // ─── Polling for payment status ─────────────────────────────────────────────
  useEffect(() => {
    // Only start polling if pixData is complete and valid
    if (!pixData || !pixData.qrCode || !pixData.expiresAt || pollingStarted.current) return;
    pollingStarted.current = true;

    dispatch(pollPaymentStatus())
      .unwrap()
      .then(() => {
        setPaymentConfirmed(true);
      })
      .catch((errorMessage: unknown) => {
        const msg = typeof errorMessage === 'string' ? errorMessage : '';
        if (msg.includes('Conexão perdida')) {
          setConnectivityError(true);
        } else {
          setTimedOut(true);
        }
      });
  }, [pixData, dispatch]);

  // ─── Redirect after payment confirmed ──────────────────────────────────────
  useEffect(() => {
    if (!paymentConfirmed) return;

    const timeout = setTimeout(() => {
      navigate('/assinatura/sucesso', { replace: true });
    }, 1500);

    return () => clearTimeout(timeout);
  }, [paymentConfirmed, navigate]);

  // ─── Copy to clipboard ─────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!pixData?.copyPaste) return;
    try {
      await navigator.clipboard.writeText(pixData.copyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback: select and copy
      const textarea = document.createElement('textarea');
      textarea.value = pixData.copyPaste;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }, [pixData?.copyPaste]);

  // ─── Retry polling after connectivity error ─────────────────────────────────
  const handleRetryPolling = useCallback(() => {
    setConnectivityError(false);
    pollingStarted.current = false;

    dispatch(pollPaymentStatus())
      .unwrap()
      .then(() => {
        setPaymentConfirmed(true);
      })
      .catch((errorMessage: unknown) => {
        const msg = typeof errorMessage === 'string' ? errorMessage : '';
        if (msg.includes('Conexão perdida')) {
          setConnectivityError(true);
        } else {
          setTimedOut(true);
        }
      });
  }, [dispatch]);

  // ── Retomando o pagamento (buscando o QR atual no Asaas) ──
  if (resuming) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, ...styles.successContainer }}>
          <div style={styles.successText}>Recuperando seu pagamento…</div>
          <div style={{ color: '#b3b3b3', fontSize: 14 }}>Buscando o PIX da sua assinatura.</div>
        </div>
      </div>
    );
  }

  // ── Não foi possível recuperar o QR (cobrança expirada/indisponível) ──
  if (resumeFailed) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, ...styles.errorContainer }}>
          <ClockCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
          <div style={styles.errorText}>Não foi possível recuperar o PIX.</div>
          <div style={styles.errorHint}>A cobrança pode ter expirado. Volte aos planos para gerar um novo pagamento.</div>
          <button onClick={() => navigate('/assinatura', { replace: true })} style={styles.retryBtn}>Voltar aos planos</button>
        </div>
      </div>
    );
  }

  // Guard: don't render if pixData is invalid and not confirmed
  const hasValidPixData = pixData && pixData.qrCode && pixData.expiresAt;
  if (!hasValidPixData && !paymentConfirmed && status !== 'active') return null;

  const isExpired = secondsRemaining !== null && secondsRemaining <= 0;

  // Sem pixData mas pago/ativo → cai nas telas de sucesso abaixo.
  if (!pixData && status !== 'active' && !paymentConfirmed) return null;

  // ─── Success state ──────────────────────────────────────────────────────────
  if (paymentConfirmed || status === 'active') {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, ...styles.successContainer }}>
          <CheckCircleFilled style={{ fontSize: 56, color: '#af2896' }} />
          <div style={styles.successText}>Bem-vindo ao Maestra Pro!</div>
          <div style={{ color: '#b3b3b3', fontSize: 14, lineHeight: 1.5 }}>
            Pagamento confirmado com sucesso.<br />
            Todos os recursos estão desbloqueados.
          </div>
          <div style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
            Redirecionando...
          </div>
        </div>
      </div>
    );
  }

  // ─── Timeout state ──────────────────────────────────────────────────────────
  if (timedOut) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, ...styles.errorContainer }}>
          <ClockCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
          <div style={styles.errorText}>
            Pagamento não confirmado no tempo limite.
          </div>
          <div style={styles.errorHint}>
            Verifique mais tarde ou tente novamente.
          </div>
        </div>
      </div>
    );
  }

  // ─── Connectivity error state ───────────────────────────────────────────────
  if (connectivityError) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.card, ...styles.errorContainer }}>
          <WifiOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
          <div style={styles.errorText}>
            Conexão perdida
          </div>
          <div style={styles.errorHint}>
            Verifique sua internet e tente novamente.
          </div>
          <button
            onClick={handleRetryPolling}
            style={styles.retryBtn}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Narrow para o render do QR (já passamos pelos estados de sucesso/erro acima).
  if (!pixData) return null;

  // ─── Default: QR Code + Polling state ───────────────────────────────────────
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Pagamento PIX</h1>
      <p style={styles.subtitle}>Escaneie o QR Code ou copie a chave abaixo</p>

      {/* QR Code */}
      <div style={styles.card}>
        <div style={styles.qrContainer}>
          <img
            src={
              pixData.qrCode?.startsWith('data:')
                ? pixData.qrCode
                : `data:image/png;base64,${pixData.qrCode}`
            }
            alt="QR Code PIX"
            style={styles.qrImage}
          />
        </div>

        {/* Countdown */}
        <div style={{ ...styles.countdown, ...(isExpired ? styles.countdownExpired : {}) }}>
          <ClockCircleOutlined />
          {isExpired ? (
            <span>QR Code expirado</span>
          ) : (
            <span>Expira em {formatCountdown(secondsRemaining ?? 0)}</span>
          )}
        </div>

        {/* Recebedor: no app do banco aparece a razão social da empresa por trás da Maestra. */}
        <p style={{ color: '#8a8a8a', fontSize: 12.5, lineHeight: 1.5, textAlign: 'center', margin: '14px 0 0' }}>
          O pagamento aparecerá no seu banco em nome de
          <br />
          <strong style={{ color: '#b3b3b3', fontWeight: 700 }}>MUSIC RIO ACADEMY LTDA</strong> · CNPJ 22.826.985/0001-41
        </p>
      </div>

      {/* Copy-paste section */}
      <div style={styles.card}>
        <h2 style={styles.sectionTitle}>PIX Copia e Cola</h2>
        <div style={styles.copyContainer}>
          <div style={styles.copyInput} title={pixData.copyPaste ?? ''}>
            {pixData.copyPaste}
          </div>
          <button
            onClick={handleCopy}
            style={{ ...styles.copyBtn, ...(copied ? styles.copiedBtn : {}) }}
          >
            {copied ? (
              <>
                <CheckCircleFilled /> Copiado
              </>
            ) : (
              <>
                <CopyOutlined /> Copiar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Polling indicator */}
      <div style={styles.card}>
        <div style={styles.pollingContainer}>
          <div style={styles.pollingDots}>
            <span style={{ ...styles.dot, animationDelay: '0s' }} />
            <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
            <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
          </div>
          <div style={styles.pollingText}>Aguardando pagamento...</div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
