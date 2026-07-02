import { FC, useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiArrowRight, FiTarget, FiMessageCircle, FiGrid, FiAward } from 'react-icons/fi';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { createAsaasCustomer, createSubscription, fetchPlanConfig, fetchSubscriptionStatus, pollPaymentStatus, clearError, type BillingCycle } from '../../store/slices/subscription';
import {
  CheckoutLayout, AccountRow, CheckoutPanel, PaymentMethods, CardForm, CpfField, CouponField,
  CartSummary, BenefitsCompare, useCheckoutForm, type PayMethod, type BenefitGroup,
} from '../../components/checkout';
import { useCoupon } from '../../hooks/useCoupon';

// Fallback enquanto a config do plano não carregou do Supabase (asaas_plan_config).
const FALLBACK_MONTHLY = 39.9;
const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Benefícios do PRO agrupados (coluna direita da comparação).
const PRO_GROUPS: BenefitGroup[] = [
  {
    icon: <FiTarget />, title: 'Execute o seu plano',
    items: ['Gestão de tarefas do plano de ação', 'Edição em todos os perfis que você acessa'],
  },
  {
    icon: <FiMessageCircle />, title: 'IA consultora ao seu lado',
    items: ['Nyta Consultora — chat de IA ilimitado', 'Recomendações sob o contexto da sua carreira'],
  },
  {
    icon: <FiGrid />, title: 'Gestão completa',
    items: ['Catálogo de faixas ilimitado', 'Acesso a todos os perfis da conta'],
  },
];

const FREE_GROUPS: BenefitGroup[] = [
  {
    icon: <FiAward />, title: 'Acompanhe a carreira',
    items: ['Veja o diagnóstico e o plano de ação', 'Visualize catálogo, agenda e equipe', 'Apenas leitura, sem edição'],
  },
];

const addMonths = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Assinatura Maestra PRO (R$ 39,90/mês, por conta): edição + IA consultora em
// todos os perfis. Comparação Grátis vs PRO → checkout 2 colunas (padrão Adobe).
const SubscriptionPage: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error, plan, status, initialized } = useAppSelector((s) => s.subscription);
  const user = useAppSelector((s) => s.auth.user);

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
  const userEmail = user?.email || '';

  const [view, setView] = useState<'benefits' | 'checkout'>('benefits');
  const [method, setMethod] = useState<PayMethod>('PIX');
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY');
  const [formError, setFormError] = useState('');
  // Cartão em análise pela operadora: mantém o CTA em "Processando…" enquanto
  // aguardamos a confirmação (polling) — o Pro só libera com o débito confirmado.
  const [confirmingCard, setConfirmingCard] = useState(false);
  const form = useCheckoutForm();
  const coupon = useCoupon();

  const isCard = method === 'CREDIT';
  const isPix = method === 'PIX';

  // Carrega preços (Supabase) + status da assinatura (pra travar duplicidade e oferecer retomar).
  useEffect(() => {
    dispatch(fetchPlanConfig());
    dispatch(fetchSubscriptionStatus());
  }, [dispatch]);

  // Preços dinâmicos por ciclo. Fallback ao mensal padrão enquanto a config carrega.
  const monthlyValue = plan?.monthlyValue ?? FALLBACK_MONTHLY;
  const annualValue = plan?.annualValue ?? null;
  const annualEnabled = !!(plan?.annualEnabled && annualValue && annualValue > 0);
  const isAnnual = cycle === 'YEARLY' && annualEnabled;
  const currentValue = isAnnual ? (annualValue as number) : monthlyValue;
  const discountPct = annualValue ? Math.round((1 - annualValue / (monthlyValue * 12)) * 100) : 0;
  const annualPerMonth = annualValue ? annualValue / 12 : 0;
  const cycleLabel = isAnnual ? 'Anual' : 'Mensal';
  const unit = isAnnual ? '/ano' : '/mês';
  const priceFmt = fmtBRL(currentValue);
  // Desconto do cupom sobre o valor do ciclo atual (recomputado; backend reconfirma).
  const { amount: couponDiscount, final: totalValue } = coupon.discountFor(currentValue);
  const totalFmt = fmtBRL(totalValue);
  const everyWord = isAnnual ? 'a cada 12 meses' : 'a cada mês';

  const handleSubmit = async () => {
    const err = form.validate(isCard);
    if (err) { setFormError(err); return; }
    setFormError('');
    dispatch(clearError());

    const rawCpfCnpj = form.cpf.replace(/\D/g, '');
    const customerResult = await dispatch(createAsaasCustomer({ name: userName, email: userEmail, cpfCnpj: rawCpfCnpj }));
    if (createAsaasCustomer.rejected.match(customerResult)) {
      setFormError((customerResult.payload as string) || 'Erro ao iniciar a cobrança.');
      return;
    }
    const customerId = (customerResult.payload as { customerId: string }).customerId;

    const couponCode = coupon.couponCode ?? undefined;

    if (method === 'PIX') {
      const result = await dispatch(createSubscription({ customerId, billingType: 'PIX', cycle, couponCode }));
      if (createSubscription.rejected.match(result)) return;
      // Rede de segurança: a edge barrou duplicidade.
      const p = result.payload as { resume?: boolean; alreadyActive?: boolean };
      if (p.alreadyActive) { navigate('/settings'); return; }
      if (p.resume) { navigate('/pagamento'); return; }
      const pixPayload = (result.payload as { pixData?: { qrCode: string | null } | null })?.pixData;
      if (!pixPayload?.qrCode) return;
      navigate('/pagamento');
    } else {
      const expiryDigits = form.cardExpiry.replace(/\D/g, '');
      const result = await dispatch(createSubscription({
        customerId,
        billingType: 'CREDIT_CARD',
        cycle,
        couponCode,
        creditCard: {
          holderName: form.cardName.trim(),
          number: form.cardNumber.replace(/\D/g, ''),
          expiryMonth: expiryDigits.slice(0, 2),
          expiryYear: '20' + expiryDigits.slice(2, 4),
          ccv: form.cardCvv,
        },
        creditCardHolderInfo: {
          name: userName, email: userEmail, cpfCnpj: rawCpfCnpj,
          postalCode: form.cep.replace(/\D/g, ''), phone: form.phone.replace(/\D/g, ''),
        },
      }));
      if (createSubscription.rejected.match(result)) return;
      const p = result.payload as { resume?: boolean; alreadyActive?: boolean; status?: string };
      if (p.alreadyActive) { navigate('/settings'); return; }
      if (p.resume) { navigate('/pagamento'); return; }

      // Débito já confirmado pela operadora → sucesso direto.
      if (p.status === 'active') { navigate('/assinatura/sucesso'); return; }

      // Cartão em análise (PENDING na Asaas): espera a confirmação real antes de
      // liberar o Pro — o webhook ativa quando o débito cai e o polling detecta.
      setConfirmingCard(true);
      const poll = await dispatch(pollPaymentStatus());
      setConfirmingCard(false);
      if (pollPaymentStatus.fulfilled.match(poll)) {
        navigate('/assinatura/sucesso');
        return;
      }
      // Não confirmou no tempo limite: segue em análise. O acesso libera sozinho
      // quando a operadora aprovar (webhook); o /settings mostra o banner de pendência.
      setFormError('Pagamento em análise pela operadora do cartão. Seu acesso Pro será liberado automaticamente assim que for aprovado.');
    }
  };

  if (view === 'benefits') {
    // Gate por status: não deixa quem já tem assinatura (ativa) ou pendência re-assinar (duplicar).
    const gateCard: CSSProperties = { maxWidth: 560, margin: '0 auto', background: '#181818', border: '1px solid #282828', borderRadius: 16, padding: 32, textAlign: 'center' };
    const btnPrimary: CSSProperties = { background: '#af2896', border: 'none', color: '#fff', borderRadius: 9999, padding: '12px 30px', fontSize: 14, fontWeight: 800, cursor: 'pointer' };
    const btnGhost: CSSProperties = { background: 'none', border: 'none', color: '#9a9aa5', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginTop: 12 };

    if (!initialized) {
      return <div style={{ padding: 24 }}><div style={gateCard}>Carregando…</div></div>;
    }
    if (status === 'active') {
      const proCard: CSSProperties = {
        maxWidth: 520, margin: '0 auto', borderRadius: 20, padding: '44px 32px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        background: 'radial-gradient(120% 120% at 50% 0%, rgba(175,40,150,0.18) 0%, rgba(175,40,150,0.04) 45%, rgba(255,255,255,0.02) 100%)',
        border: '1px solid rgba(175,40,150,0.32)',
      };
      const proBadge: CSSProperties = {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 60, height: 60,
        borderRadius: 18, marginBottom: 22, background: 'rgba(175,40,150,0.14)',
        border: '1px solid rgba(175,40,150,0.35)', boxShadow: '0 12px 32px rgba(175,40,150,0.25)',
      };
      const btnPrimaryArrow: CSSProperties = {
        display: 'inline-flex', alignItems: 'center', gap: 8, background: '#af2896', border: 'none', color: '#fff',
        borderRadius: 9999, padding: '13px 32px', fontSize: 14, fontWeight: 800, cursor: 'pointer',
        boxShadow: '0 10px 30px rgba(175,40,150,0.32)', transition: 'transform 0.15s, background 0.2s',
      };
      return (
        <div style={{ padding: 24 }}>
          <div style={proCard}>
            <span style={proBadge}><FiAward size={30} color='#e07fce' /></span>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#d264bb', marginBottom: 10 }}>Assinatura ativa</span>
            <div style={{ color: '#fff', fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 12 }}>Você já é Maestra PRO</div>
            <p style={{ color: '#cfcfd4', fontSize: 14.5, lineHeight: 1.55, margin: '0 0 26px', maxWidth: 400 }}>
              Edição completa, Nyta IA e todos os perfis da conta liberados.
            </p>
            <button
              style={btnPrimaryArrow}
              onClick={() => navigate('/settings')}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#c13fa8'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#af2896'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Gerenciar assinatura <FiArrowRight size={16} />
            </button>
          </div>
        </div>
      );
    }
    if (status === 'pending' || status === 'overdue') {
      return (
        <div style={{ padding: 24 }}>
          <div style={gateCard}>
            <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Você tem um pagamento pendente</div>
            <p style={{ color: '#b3b3b3', fontSize: 14, lineHeight: 1.5, margin: '0 0 20px' }}>Já existe uma assinatura aguardando pagamento. Retome de onde parou — não precisa começar do zero.</p>
            <button style={btnPrimary} onClick={() => navigate('/pagamento')}>Retomar pagamento</button>
            <div><button style={btnGhost} onClick={() => navigate('/settings')}>Ver assinatura</button></div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ padding: 24 }}>
        <BenefitsCompare
          headline="Faça mais com o Maestra PRO"
          sub={<>Edição completa e a <b>Nyta Consultora</b> em todos os seus perfis.</>}
          free={{ name: 'Grátis', desc: 'O essencial para acompanhar o plano e a carreira.', price: 'R$ 0', groups: FREE_GROUPS }}
          pro={{
            name: 'Maestra PRO',
            desc: 'Ferramentas para executar o plano e crescer mais rápido.',
            price: priceFmt,
            unit,
            priceNote: isAnnual ? `equivale a ${fmtBRL(annualPerMonth)}/mês` : undefined,
            groups: PRO_GROUPS,
          }}
          billing={{
            cycle,
            onChange: setCycle,
            annualEnabled,
            saveLabel: discountPct > 0 ? `-${discountPct}%` : undefined,
          }}
          ctaLabel="Assinar PRO"
          onCta={() => setView('checkout')}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <button
        onClick={() => setView('benefits')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', color: '#9a9aa5', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 18 }}
      >
        <FiArrowLeft size={16} /> Voltar aos planos
      </button>

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
                  ? <p style={{ fontSize: 14, color: '#9a9aa5', lineHeight: 1.55, margin: 0 }}>Ao continuar, geramos um código PIX. Sua assinatura é ativada assim que o pagamento cair.</p>
                  : <CardForm form={form} />
                )}
              />
            </CheckoutPanel>
          </>
        }
        aside={
          <CartSummary
            selectLabel="Assinatura"
            selectValue={cycleLabel}
            topSlot={
              <div style={{ marginBottom: 20 }}>
                <CouponField
                  value={coupon.input}
                  onChange={coupon.setInput}
                  onApply={() => coupon.apply('subscription', currentValue)}
                  onClear={coupon.clear}
                  loading={coupon.loading}
                  error={coupon.error}
                  appliedLabel={coupon.labelFor(currentValue)}
                />
              </div>
            }
            item={{
              icon: <span style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 13, color: '#af2896' }}>PRO</span>,
              name: 'Maestra PRO',
              sub: <span>Edição + Nyta IA · {cycleLabel}</span>,
              price: `${priceFmt}${unit}`,
            }}
            rows={[
              { label: 'Subtotal', value: `${priceFmt}${unit}` },
              ...(isAnnual && annualValue
                ? [{ label: `Economia (${discountPct}%)`, value: `−${fmtBRL(monthlyValue * 12 - annualValue)}` }]
                : []),
              ...(coupon.applied
                ? [{ label: `Cupom ${coupon.applied.code}`, value: `−${fmtBRL(couponDiscount)}` }]
                : []),
            ]}
            timeline={[
              { label: 'Total hoje', value: totalFmt },
              {
                label: `${isPix ? 'Próxima cobrança em' : 'Renova em'} ${isAnnual ? addMonths(12) : addMonths(1)}`,
                value: `${totalFmt}${unit}`,
                open: true,
                hint: isPix
                  ? `Geramos uma nova cobrança PIX ${everyWord}. Cancele quando quiser pela sua conta.`
                  : `Renova automaticamente${isAnnual ? ' ' + everyWord : ''}. Cancele quando quiser pela sua conta.`,
              },
            ]}
            legal={isPix
              ? <>Você receberá uma cobrança PIX de {totalFmt} {everyWord} enquanto a assinatura estiver ativa. Cancele quando quiser pela sua conta. Você concorda com os Termos de uso e a Política de privacidade.</>
              : <>Ao assinar, você autoriza a cobrança automática de {totalFmt} {isAnnual ? 'por ano' : 'por mês'} até cancelar. Cancele quando quiser pela sua conta. Você concorda com os Termos de uso e a Política de privacidade.</>}
            ctaLabel={isPix ? 'Pagar com PIX' : 'Concordar e assinar'}
            onCta={handleSubmit}
            loading={loading || confirmingCard}
            disabled={!!form.validate(isCard)}
            error={formError || error || undefined}
          />
        }
      />
    </div>
  );
};

export default SubscriptionPage;

// Reexport dos validadores puros (mantém compatibilidade com testes/import externos).
export { isValidCpf, isValidCnpj, isValidCpfCnpj, validateCreditCardFields, type CreditCardFields } from '../../utils/payments';
