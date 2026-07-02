import { FC, useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Input, Spin, Select } from 'antd';
import { FiArrowLeft } from 'react-icons/fi';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { supabase } from '../../lib/supabase';
import { artistsActions } from '../../store/slices/artists';
import { createAsaasCustomer, fetchPlanConfig, clearError } from '../../store/slices/subscription';
import { createArtistCharge, pollArtistPurchase } from '../../store/slices/artistPurchases';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import { DiagnosticReport, type Chartmetric } from '../ArtistCreate/DiagnosticReport';
import { FlowHeader } from '../ArtistCreate/FlowHeader';
import { PaymentSuccessScreen } from '../../components/PaymentSuccessScreen';
import { shouldEnrichChartmetric } from '../../lib/chartmetricFreshness';
import {
  CheckoutLayout, AccountRow, CheckoutPanel, PaymentMethods, CardForm, CpfField, CouponField,
  CartSummary, useCheckoutForm, type PayMethod,
} from '../../components/checkout';
import { useCoupon } from '../../hooks/useCoupon';
import styles from '../ArtistCreate/ArtistCreate.module.scss';

type Step = 'diagnostico' | 'pagamento' | 'pix' | 'done';

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
// Valor do pagamento único vem da config (asaas_plan_config.profile_unlock_value),
// editável sem deploy — igual ao preço da assinatura. Fallback só se a config falhar.
const FALLBACK_PROFILE_VALUE = 199.9;
// Asaas exige no mínimo R$5,00 por parcela no cartão de crédito — nunca oferecer
// um parcelamento que caia abaixo disso (senão a cobrança volta 400 invalid_value).
const MIN_INSTALLMENT_VALUE = 5;

// O que o pagamento único libera (checklist curta no resumo).
const INCLUDES = [
  'Planejamento estratégico completo com a Nyta',
  'Plano de ação com metas e cronograma',
  'Análise de audiência: ouvintes e cidades',
  'Catálogo, agenda e equipe',
  'Acesso vitalício ao perfil e ao plano',
];

// Tela de desbloqueio do perfil (criado no diagnóstico, ainda NÃO pago).
// Mostra o diagnóstico SALVO (sem regerar) + checkout (padrão Adobe, tema escuro).
// Ao pagar, dispara o enriquecimento profundo do Chartmetric e leva pro planejamento.
const ProfileUnlock: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const user = useAppSelector((s) => s.auth.user);
  const artist = useAppSelector((s) => s.artists.items.find((a) => a.id === id));
  const loaded = useAppSelector((s) => s.artists.loaded);
  const plan = useAppSelector((s) => s.subscription.plan);

  // Preço do pagamento único (dinâmico via config). Enquanto carrega, usa o fallback.
  const priceValue = plan?.profileUnlockValue ?? FALLBACK_PROFILE_VALUE;
  const PRICE = fmtBRL(priceValue);
  const maxInstallments = Math.max(1, Math.min(12, Math.floor(priceValue / MIN_INSTALLMENT_VALUE)));

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
  const userEmail = user?.email || '';

  // O artista aqui já existe e já foi diagnosticado (criação ou perfil pendente em /artists).
  // Abre SEMPRE direto no pagamento — o diagnóstico salvo fica disponível via "Voltar ao diagnóstico".
  // (location.state.skipDiagnostic continua respeitado por compat, mas o default já é 'pagamento'.)
  const [step, setStep] = useState<Step>(
    (location.state as { showDiagnostic?: boolean } | null)?.showDiagnostic ? 'diagnostico' : 'pagamento'
  );

  // Pagamento — default: PIX (aprovação na hora). Parcelamento só aparece no crédito.
  const [method, setMethod] = useState<PayMethod>('PIX');
  const [installments, setInstallments] = useState(12);
  const [payError, setPayError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string | null; copyPaste: string | null } | null>(null);
  const form = useCheckoutForm();
  const coupon = useCoupon();

  // Garante a lista carregada (acesso direto pela URL).
  useEffect(() => {
    if (!loaded && user?.id) dispatch(artistsActions.fetchArtists(user.id));
  }, [loaded, user?.id, dispatch]);

  // Carrega o preço dinâmico (config compartilhada com a assinatura).
  useEffect(() => {
    dispatch(fetchPlanConfig());
  }, [dispatch]);

  // Clampa o parcelamento ao máximo válido quando o preço (config) carrega.
  useEffect(() => {
    setInstallments((n) => Math.min(Math.max(1, n), maxInstallments));
  }, [maxInstallments]);

  // Ao trocar de etapa (ex.: diagnóstico → checkout), volta ao topo pra o usuário
  // ver a tela desde o começo.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [step]);

  // Perfil já pago → não há o que desbloquear; segue pro app.
  // Perfil inexistente/sem acesso → volta pra lista.
  useEffect(() => {
    if (!loaded) return;
    // Na tela de sucesso (pós-pagamento) o is_locked já virou false; deixa o confete tocar
    // e o botão levar ao planejamento, sem o redirect automático roubar a etapa visual.
    if (step === 'done') return;
    if (!artist) navigate('/artists', { replace: true });
    else if (artist.is_locked === false) navigate(`/artists/${id}`, { replace: true });
  }, [loaded, artist, id, navigate, step]);

  const realIndex = artist?.content?.realIndex ?? null;
  const cm = artist?.content?.chartmetricProfile;
  const chartmetric: Chartmetric | null = cm
    ? {
        monthly_listeners: cm.monthly_listeners ?? null,
        monthly_listeners_rank: cm.monthly_listeners_rank ?? null,
        career_rank: cm.career_rank ?? null,
        top_cities: cm.top_cities as Chartmetric['top_cities'],
        audience: (cm.audience as Chartmetric['audience']) ?? null,
        playlists: (cm.playlists as Chartmetric['playlists']) ?? null,
        similar: (cm.similar as Chartmetric['similar']) ?? null,
      }
    : null;
  const artistImage = artist?.content?.spotifyProfile?.image || ARTISTS_DEFAULT_IMAGE;

  const isCard = method === 'CREDIT' || method === 'DEBIT';
  // billingType real enviado ao Asaas, direto do tipo escolhido.
  const billingType: 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' =
    method === 'PIX' ? 'PIX' : method === 'CREDIT' ? 'CREDIT_CARD' : 'DEBIT_CARD';

  const finish = async (artistId: string) => {
    // Mostra a tela de sucesso (confete). A navegação pro planejamento fica no botão.
    setStep('done');
    // Enriquecimento profundo do Chartmetric (pós-pago) — non-blocking, alimenta a Nyta.
    // Política única (30 dias): aqui o perfil só tem o diagnóstico básico, então enriquece agora.
    if (shouldEnrichChartmetric(artist?.content?.chartmetricProfile)) {
      supabase.functions.invoke('artist-enrich-chartmetric', { body: { artistId } }).catch(() => {});
    }
    if (user?.id) await dispatch(artistsActions.fetchArtists(user.id));
  };

  const handlePay = async () => {
    if (!id) return;
    const err = form.validate(isCard);
    if (err) { setPayError(err); return; }
    setPayError('');
    dispatch(clearError());
    setSubmitting(true);
    try {
      const rawCpf = form.cpf.replace(/\D/g, '');
      const custRes = await dispatch(createAsaasCustomer({ name: userName, email: userEmail, cpfCnpj: rawCpf }));
      if (createAsaasCustomer.rejected.match(custRes)) {
        setPayError((custRes.payload as string) || 'Erro ao iniciar a cobrança.');
        return;
      }
      const customerId = (custRes.payload as { customerId: string }).customerId;
      const expiryDigits = form.cardExpiry.replace(/\D/g, '');

      const chargeRes = await dispatch(createArtistCharge({
        artistId: id,
        customerId,
        billingType,
        ...(coupon.couponCode ? { couponCode: coupon.couponCode } : {}),
        // Parcelamento só vale no crédito; débito e PIX são sempre à vista.
        ...(billingType === 'CREDIT_CARD' && installments > 1 ? { installmentCount: installments } : {}),
        ...(isCard ? {
          creditCard: {
            holderName: form.cardName.trim(),
            number: form.cardNumber.replace(/\D/g, ''),
            expiryMonth: expiryDigits.slice(0, 2),
            expiryYear: '20' + expiryDigits.slice(2, 4),
            ccv: form.cardCvv,
          },
          creditCardHolderInfo: {
            name: userName, email: userEmail, cpfCnpj: rawCpf,
            postalCode: form.cep.replace(/\D/g, ''), phone: form.phone.replace(/\D/g, ''),
          },
        } : {}),
      }));
      if (createArtistCharge.rejected.match(chargeRes)) {
        setPayError((chargeRes.payload as { message: string })?.message || 'Não consegui criar a cobrança.');
        return;
      }
      const { purchaseId, status, pixData: pix } = chargeRes.payload;

      if (isCard && status === 'received') {
        await finish(id);
        return;
      }
      if (pix?.qrCode) {
        setPixData(pix);
        setStep('pix');
      }
      const pollRes = await dispatch(pollArtistPurchase({ purchaseId }));
      if (pollArtistPurchase.fulfilled.match(pollRes)) {
        await finish(pollRes.payload.artistId);
      } else {
        setPayError((pollRes.payload as { message: string })?.message || 'Não consegui confirmar o pagamento.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) {
    return <div className={styles.page}><div className={styles.analyzing}><Spin /> Carregando…</div></div>;
  }

  // Desconto do cupom sobre o preço do perfil (recomputado; backend reconfirma).
  const { amount: couponDiscount, final: discountedPrice } = coupon.discountFor(priceValue);
  // Total exibido: parcelado (crédito) ou à vista, já com desconto.
  const installmentTotal = method === 'CREDIT' && installments > 1
    ? `${installments}x de ${fmtBRL(discountedPrice / installments)}`
    : fmtBRL(discountedPrice);

  const ctaLabel = method === 'PIX' ? 'Gerar código PIX' : 'Concordar e pagar';

  // Pós-pagamento: tela cheia de sucesso (mesma da assinatura), sem o chrome do checkout.
  if (step === 'done') {
    return (
      <PaymentSuccessScreen
        title='Pagamento confirmado!'
        subtitle='Seu planejamento estratégico está liberado.'
        description='A Nyta já vai te guiar, passo a passo, na construção do seu plano.'
        ctaLabel='Iniciar planejamento →'
        onCta={() => id && navigate(`/artists/${id}/wizard`, { replace: true })}
      />
    );
  }

  return (
    <div className={styles.page}>
      <button className={styles.back} onClick={() => navigate('/artists')}>Sair</button>

      {/* Header do macro-fluxo (mesmo de /criar-artista): no diagnóstico a fase atual é "Diagnóstico
          REAL"; no pagamento avança pra "Planejamento Estratégico". */}
      <FlowHeader phase={step === 'pagamento' ? 2 : 1} />

      <div className={`${styles.step} ${(step === 'pagamento' || step === 'diagnostico') ? styles.stepWide : ''}`}>
        {step === 'diagnostico' && (
          <div style={{ width: '100%', paddingTop: 20 }}>
            {realIndex ? (
              <DiagnosticReport
                realIndex={realIndex}
                chartmetric={chartmetric}
                artistName={artist?.name}
                artistImage={artist?.content?.spotifyProfile?.image}
                onContinue={() => setStep('pagamento')}
              />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#b3b3b3', marginBottom: 18 }}>Diagnóstico indisponível. Você ainda pode liberar o planejamento.</p>
                <button className={styles.cta} onClick={() => setStep('pagamento')}>Continuar</button>
              </div>
            )}
          </div>
        )}

        {step === 'pagamento' && (
          // Mesmo frame (1080px centralizado) do checkout, pra headline/"Voltar"/colunas alinharem.
          <div style={{ width: '100%', maxWidth: 1080, margin: '0 auto', paddingTop: 4 }}>
            {realIndex && (
              <div style={{ textAlign: 'right', marginBottom: 18 }}>
                <button
                  onClick={() => setStep('diagnostico')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: '#9a9aa5', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0 }}
                >
                  <FiArrowLeft size={16} /> Voltar ao diagnóstico
                </button>
              </div>
            )}

            {/* Headline de conversão: puxa o momentum do diagnóstico pro plano, com as âncoras de
                valor (vitalício, pagamento único) logo antes do formulário. */}
            <div className={styles.unlockHead}>
              <h1 className={styles.unlockHeadTitle}>
                Comece hoje o planejamento{artist?.name ? ` de ${artist.name}` : ' estratégico'}.
              </h1>
              <p className={styles.unlockHeadSub}>
                Você já tem o diagnóstico REAL da carreira. O próximo passo é o plano de ação: metas, estratégias e cronograma, construídos com a Nyta e a metodologia que já orientou centenas de artistas. Acesso vitalício ao perfil, num pagamento único.
              </p>
            </div>

            <CheckoutLayout
              main={
                <>
                  <AccountRow email={userEmail} />
                  <CheckoutPanel title="Insira as informações de pagamento para começar">
                    <div style={{ marginBottom: 16 }}><CpfField form={form} /></div>
                    <PaymentMethods
                      methods={['CREDIT', 'PIX']}
                      value={method}
                      onChange={setMethod}
                      renderBody={(m) => (m === 'PIX'
                        ? <p style={{ fontSize: 14, color: '#9a9aa5', lineHeight: 1.55, margin: 0 }}>Ao continuar, geramos um código PIX pra você pagar na hora. O acesso libera assim que o pagamento cair.</p>
                        : <CardForm form={form} />
                      )}
                    />
                  </CheckoutPanel>
                </>
              }
              aside={
                <CartSummary
                  topSlot={
                    <div style={{ marginBottom: 20 }}>
                      <CouponField
                        value={coupon.input}
                        onChange={coupon.setInput}
                        onApply={() => coupon.apply('one_time', priceValue, method === 'CREDIT' ? installments : undefined)}
                        onClear={coupon.clear}
                        loading={coupon.loading}
                        error={coupon.error}
                        appliedLabel={coupon.labelFor(priceValue)}
                      />
                      {method === 'CREDIT' && (
                        <div style={{ marginTop: 16 }}>
                          <Select
                            value={installments}
                            onChange={setInstallments}
                            size="large"
                            style={{ width: '100%' }}
                            options={Array.from({ length: maxInstallments }, (_, i) => i + 1).map((n) => ({
                              value: n,
                              label: n === 1 ? `À vista · ${fmtBRL(discountedPrice)}` : `${n}x de ${fmtBRL(discountedPrice / n)} sem juros`,
                            }))}
                          />
                        </div>
                      )}
                    </div>
                  }
                  item={{
                    icon: artistImage,
                    name: `Planejamento — ${artist?.name || 'seu artista'}`,
                    sub: <span>Acesso vitalício ao perfil</span>,
                    price: `${PRICE}`,
                  }}
                  includes={INCLUDES}
                  rows={[
                    { label: 'Subtotal', value: PRICE },
                    ...(coupon.applied ? [{ label: `Cupom ${coupon.applied.code}`, value: `−${fmtBRL(couponDiscount)}` }] : []),
                    { label: 'Total', value: installmentTotal, strong: true },
                  ]}
                  legal={<>Pagamento único pelo acesso a este perfil. O perfil e o plano ficam seus pra sempre. A Nyta IA contínua é um plano à parte. Ao continuar, você concorda com os Termos de uso e a Política de privacidade.</>}
                  ctaLabel={ctaLabel}
                  onCta={handlePay}
                  loading={submitting}
                  disabled={!!form.validate(isCard)}
                  error={payError}
                />
              }
            />
          </div>
        )}

        {step === 'pix' && pixData?.qrCode && (
          <>
            <p className={`${styles.line} ${styles.lineCompact}`}>Escaneia o PIX abaixo. Assim que cair, eu te levo direto pro planejamento.</p>
            <div className={styles.interaction}>
              <div className={`${styles.payWrap} ${styles.qrWrap}`} style={{ alignItems: 'center' }}>
                <img className={styles.qrImg} src={`data:image/png;base64,${pixData.qrCode}`} alt='QR Code PIX' />
                {pixData.copyPaste && <Input.TextArea value={pixData.copyPaste} readOnly autoSize />}
                {/* Recebedor: no app do banco aparece a razão social da empresa por trás da Maestra. */}
                <p style={{ color: '#8a8a8a', fontSize: 12.5, lineHeight: 1.5, textAlign: 'center', margin: 0 }}>
                  O pagamento aparecerá no seu banco em nome de{' '}
                  <strong style={{ color: '#b3b3b3', fontWeight: 700 }}>MUSIC RIO ACADEMY LTDA</strong> · CNPJ 22.826.985/0001-41
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#b3b3b3' }}>
                  <Spin size='small' /> Aguardando confirmação…
                </div>
                {payError && <div className={styles.errorMsg}>{payError}</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileUnlock;
