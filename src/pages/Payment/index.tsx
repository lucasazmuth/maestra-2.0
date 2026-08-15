import { FC, useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircleFilled, CopyOutlined, ClockCircleOutlined, WifiOutlined } from '@ant-design/icons';

import { App } from 'antd';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { cancelSubscription, pollPaymentStatus, resumePayment } from '../../store/slices/subscription';

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    padding: 24,
    maxWidth: 480,
    margin: '0 auto',
  } as React.CSSProperties,
  // Telas de estado (recuperando, análise, erro, sucesso) não são conteúdo: são uma mensagem.
  // Ficam centralizadas no espaço disponível e sobre o próprio fundo — um cartão branco aqui
  // seria moldura dentro de moldura, já que a área de conteúdo do app é ela própria um cartão.
  stateWrap: {
    display: 'flex',
    minHeight: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  } as React.CSSProperties,
  state: {
    maxWidth: 420,
  } as React.CSSProperties,
  title: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 28,
    color: '#405985',
    margin: '0 0 8px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  subtitle: {
    color: '#8ca0c5',
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center' as const,
  } as React.CSSProperties,
  card: {
    background: '#fff',
    border: '1px solid #e3eaf3',
    borderRadius: 14,
    padding: 24,
    marginBottom: 20,
    boxShadow: '0 10px 26px rgba(74, 99, 145, .08)',
  } as React.CSSProperties,
  qrContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 16,
  } as React.CSSProperties,
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 10,
    background: '#fff',
    border: '1px solid #e6ecf6',
    padding: 8,
  } as React.CSSProperties,
  sectionTitle: {
    color: '#405985',
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
    background: '#fbfcfe',
    border: '1px solid #e1e7f0',
    borderRadius: 9,
    color: '#52668d',
    padding: '10px 12px',
    fontSize: 13,
    fontFamily: 'monospace',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  copyBtn: {
    background: '#3361ff',
    border: 'none',
    borderRadius: 9,
    color: '#FFFFFF',
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
    background: '#1d8a68',
  } as React.CSSProperties,
  countdown: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: '#7c8da8',
    fontSize: 14,
    marginBottom: 16,
  } as React.CSSProperties,
  countdownExpired: {
    color: '#d2474b',
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
    background: '#3361ff',
    animation: 'pulse 1.4s infinite ease-in-out',
  } as React.CSSProperties,
  pollingText: {
    color: '#7c8da8',
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
    color: '#1d8a68',
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
    color: '#d2474b',
    fontSize: 15,
    fontWeight: 600,
  } as React.CSSProperties,
  errorHint: {
    color: '#8ca0c5',
    fontSize: 13,
  } as React.CSSProperties,
  retryBtn: {
    background: '#3361ff',
    border: 'none',
    borderRadius: 9,
    color: '#FFFFFF',
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

// A validade do QR vem na própria cobrança do Asaas e varia muito: pode ser de minutos (PIX
// avulso) a quase um ano (a cobrança de uma assinatura). MM:SS só faz sentido na reta final —
// com 366 dias pela frente ele imprimia "527086:15", que não é hora nem prazo.
function formatCountdown(seconds: number, expiresAt?: string | null): string {
  if (seconds <= 0) return '00:00';

  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins ? `${hours}h${String(mins).padStart(2, '0')}` : `${hours}h`;
  }

  // De um dia em diante, a data diz mais do que a contagem: ninguém acompanha "em 366 dias".
  const date = expiresAt ? new Date(expiresAt) : new Date(Date.now() + seconds * 1000);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Component ──────────────────────────────────────────────────────────────────

const PaymentPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const { pixData, status } = useAppSelector((s) => s.subscription);

  const [copied, setCopied] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [connectivityError, setConnectivityError] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [resumeFailed, setResumeFailed] = useState(false);
  // Assinatura de CARTÃO pendente: a 1ª cobrança está em análise na operadora —
  // não há QR pra mostrar; exibimos o estado de análise e aguardamos o webhook.
  const [cardAnalysis, setCardAnalysis] = useState(false);
  const [renewing, setRenewing] = useState(false);

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
        // Cartão em análise: não existe QR — mostra o estado de análise (não é erro).
        if (res.billingType === 'CREDIT_CARD') { setCardAnalysis(true); return; }
        // pending: se veio QR, entra no Redux e renderiza; se não, mostra estado de falha.
        if (!res.pixData?.qrCode) setResumeFailed(true);
      })
      .catch(() => {
        setResuming(false);
        navigate('/assinatura', { replace: true });
      });
  }, [pixData, paymentConfirmed, status, dispatch, navigate]);

  // ─── Cartão em análise: polling até a operadora confirmar (webhook → active) ─
  useEffect(() => {
    if (!cardAnalysis) return;
    let alive = true;
    dispatch(pollPaymentStatus())
      .unwrap()
      .then(() => { if (alive) setPaymentConfirmed(true); })
      .catch(() => { /* segue em análise; o acesso libera sozinho depois */ });
    return () => { alive = false; };
  }, [cardAnalysis, dispatch]);

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
      <div style={styles.stateWrap}>
        <div style={{ ...styles.state, ...styles.successContainer }}>
          <div style={styles.successText}>Recuperando seu pagamento…</div>
          <div style={{ color: '#8ca0c5', fontSize: 14 }}>Buscando o PIX da sua assinatura.</div>
        </div>
      </div>
    );
  }

  // ── Cartão em análise pela operadora (sem QR; sucesso vem via webhook) ──
  if (cardAnalysis && !paymentConfirmed) {
    return (
      <div style={styles.stateWrap}>
        <div style={{ ...styles.state, ...styles.errorContainer }}>
          <ClockCircleOutlined style={{ fontSize: 48, color: '#3361ff' }} />
          <div style={{ ...styles.errorText, color: '#405985' }}>Pagamento em análise</div>
          <div style={styles.errorHint}>
            A operadora do cartão está processando o débito — isso pode levar alguns
            minutos. Assim que for aprovado, seu acesso Pro é liberado automaticamente.
            Pode fechar esta tela e continuar usando o app.
          </div>
          <button onClick={() => navigate('/artists', { replace: true })} style={styles.retryBtn}>
            Voltar ao painel
          </button>
        </div>
      </div>
    );
  }

  // ── Não foi possível recuperar o QR (cobrança expirada/indisponível) ──
  //
  // Mandar de volta para /assinatura sem mais nada fechava um LOOP: lá o gate vê a assinatura
  // ainda `pending` e oferece "Retomar pagamento", que traz para cá, onde a retomada falha de
  // novo. E mesmo pulando o gate, o asaas-create-subscription responde `resume: true` pela
  // trava anti-duplicidade. Sem encerrar a assinatura pendente não havia saída pelo app.
  //
  // Por isso o botão principal encerra a pendência (asaas-cancel-subscription, que cancela no
  // Asaas e marca 'cancelled') antes de ir aos planos — aí a escolha começa do zero.
  if (resumeFailed) {
    const gerarNovo = async () => {
      setRenewing(true);
      try {
        const res = await dispatch(cancelSubscription());
        if (cancelSubscription.rejected.match(res)) {
          message.error('Não foi possível encerrar a cobrança anterior. Fale com o suporte para liberar um novo pagamento.');
          return;
        }
        navigate('/assinatura', { replace: true });
      } finally {
        setRenewing(false);
      }
    };
    return (
      <div style={styles.stateWrap}>
        <div style={{ ...styles.state, ...styles.errorContainer }}>
          <ClockCircleOutlined style={{ fontSize: 48, color: '#d2474b' }} />
          <div style={styles.errorText}>A cobrança PIX expirou.</div>
          <div style={styles.errorHint}>
            Encerramos a cobrança anterior e você escolhe o plano de novo — nada foi cobrado.
          </div>
          <button onClick={gerarNovo} disabled={renewing} style={{ ...styles.retryBtn, opacity: renewing ? 0.6 : 1, cursor: renewing ? 'progress' : 'pointer' }}>
            {renewing ? 'Preparando…' : 'Gerar novo pagamento'}
          </button>
          <button
            onClick={() => navigate('/artists', { replace: true })}
            style={{ background: 'none', border: 'none', color: '#7c8da8', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}
          >
            Voltar ao painel
          </button>
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
      <div style={styles.stateWrap}>
        <div style={{ ...styles.state, ...styles.successContainer }}>
          <CheckCircleFilled style={{ fontSize: 56, color: '#1d8a68' }} />
          <div style={styles.successText}>Bem-vindo ao Maestra Pro!</div>
          <div style={{ color: '#52668d', fontSize: 14, lineHeight: 1.5 }}>
            Pagamento confirmado com sucesso.<br />
            Todos os recursos estão desbloqueados.
          </div>
          <div style={{ color: '#93a4c0', fontSize: 12, marginTop: 8 }}>
            Redirecionando...
          </div>
        </div>
      </div>
    );
  }

  // ─── Timeout state ──────────────────────────────────────────────────────────
  if (timedOut) {
    return (
      <div style={styles.stateWrap}>
        <div style={{ ...styles.state, ...styles.errorContainer }}>
          <ClockCircleOutlined style={{ fontSize: 48, color: '#d2474b' }} />
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
      <div style={styles.stateWrap}>
        <div style={{ ...styles.state, ...styles.errorContainer }}>
          <WifiOutlined style={{ fontSize: 48, color: '#d2474b' }} />
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

        {/* Prazo. Só aparece quando informa algo: o Asaas devolve a validade do QR de assinatura
            a UM ANO de distância (conferido na resposta: expirationDate "2027-08-15 23:59:59"
            para uma cobrança criada hoje), e anunciar "expira em 2027" não ajuda a decidir nada
            — só parece defeito. Dentro de 48h o prazo volta a importar e a contagem aparece. */}
        {(isExpired || (secondsRemaining !== null && secondsRemaining <= 48 * 3600)) && (
          <div style={{ ...styles.countdown, ...(isExpired ? styles.countdownExpired : {}) }}>
            <ClockCircleOutlined />
            {isExpired ? (
              <span>QR Code expirado</span>
            ) : (
              <span>Expira em {formatCountdown(secondsRemaining ?? 0, pixData?.expiresAt)}</span>
            )}
          </div>
        )}

        {/* Recebedor: no app do banco aparece a razão social da empresa por trás da Maestra. */}
        <p style={{ color: '#93a4c0', fontSize: 12.5, lineHeight: 1.5, textAlign: 'center', margin: '14px 0 0' }}>
          O pagamento aparecerá no seu banco em nome de
          <br />
          <strong style={{ color: '#7c8da8', fontWeight: 700 }}>MUSIC RIO ACADEMY LTDA</strong> · CNPJ 22.826.985/0001-41
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
