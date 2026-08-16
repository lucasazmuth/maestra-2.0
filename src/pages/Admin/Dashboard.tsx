import { FC, useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Tag, message, Button } from 'antd';
import { FiUsers, FiUserCheck, FiMusic, FiDollarSign, FiTrendingUp, FiRefreshCw, FiClock, FiCreditCard } from 'react-icons/fi';
import dayjs from 'dayjs';

import { supabase } from '../../lib/supabase';
import { Spinner } from '../../components/spinner/spinner';

// ─── Tipos (espelham a resposta da edge admin-dashboard) ────────────────────
interface Stats {
  generatedAt: string;
  users: { total: number; confirmed: number; newThisMonth: number; new30d: number };
  artists: { total: number; paid: number; locked: number };
  subscriptions: { active: number; overdue: number; pending: number; cancelled: number; mrr: number };
  revenue: {
    total: number; thisMonth: number; lastMonth: number;
    purchases: { count: number; total: number; thisMonth: number };
    subscriptionPayments: { count: number; total: number; thisMonth: number };
    pendingCount: number;
    accessPassCount: number;
    monthly: Array<{ month: string; total: number }>;
  };
  recentPayments: Array<{
    kind: 'purchase' | 'subscription'; label: string; email: string; amount: number;
    billing_type: string | null; status: string; date: string; coupon: string | null;
  }>;
}

const fmtBRL = (n?: number | null) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtMonth = (m: string) => dayjs(`${m}-01`).format('MMM/YY');

const BILLING_LABEL: Record<string, string> = { PIX: 'PIX', CREDIT_CARD: 'Cartão', BOLETO: 'Boleto' };

const AdminDashboard: FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-dashboard', { body: {} });
    if (error || data?.error) message.error('Não foi possível carregar as métricas.');
    setStats(error || data?.error ? null : (data as Stats));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !stats) {
    return <div style={styles.page}><Spinner loading>{null as any}</Spinner></div>;
  }

  if (!stats) {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>Dashboard</h1>
        <p style={styles.sub}>Não foi possível carregar as métricas agora.</p>
        <Button icon={<FiRefreshCw />} onClick={load}>Tentar de novo</Button>
      </div>
    );
  }

  const { users, artists, subscriptions: subs, revenue, recentPayments } = stats;
  const maxMonthly = Math.max(1, ...revenue.monthly.map((m) => m.total));

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.sub}>Visão geral da plataforma: cadastros, assinaturas e faturamento.</p>
        </div>
        <Button icon={<FiRefreshCw />} onClick={load} loading={loading}>Atualizar</Button>
      </div>

      {/* ── Linha 1: faturamento ── */}
      <div style={styles.cardsGrid}>
        <StatCard
          icon={<FiDollarSign />} accent="#2ec47a"
          label="Faturado este mês" value={fmtBRL(revenue.thisMonth)}
          hint={`Mês passado: ${fmtBRL(revenue.lastMonth)}`}
        />
        <StatCard
          icon={<FiTrendingUp />} accent="#2ec47a"
          label="Faturamento total" value={fmtBRL(revenue.total)}
          hint={`${revenue.purchases.count + revenue.subscriptionPayments.count} pagamento(s) confirmados`
            + (revenue.accessPassCount ? ` · ${revenue.accessPassCount} via Pass Access` : '')}
        />
        <StatCard
          icon={<FiCreditCard />} accent="#9A4FD1"
          label="MRR (assinaturas ativas)" value={fmtBRL(subs.mrr)}
          hint={`${subs.active} assinatura(s) ativa(s)`}
        />
        <StatCard
          icon={<FiClock />} accent="#e8a33d"
          label="Cobranças pendentes" value={String(revenue.pendingCount)}
          hint="Aguardando pagamento"
        />
      </div>

      {/* ── Linha 2: usuários e perfis ── */}
      <div style={styles.cardsGrid}>
        <StatCard
          icon={<FiUsers />} accent="#509bf5"
          label="Usuários" value={String(users.total)}
          hint={`${users.confirmed} com e-mail confirmado`}
        />
        <StatCard
          icon={<FiUserCheck />} accent="#509bf5"
          label="Novos este mês" value={String(users.newThisMonth)}
          hint={`${users.new30d} nos últimos 30 dias`}
        />
        <StatCard
          icon={<FiMusic />} accent="#af68d8"
          label="Perfis de artista" value={String(artists.total)}
          hint={`${artists.paid} liberado(s) · ${artists.locked} bloqueado(s)`}
        />
        <StatCard
          icon={<FiCreditCard />} accent="#9A4FD1"
          label="Assinaturas" value={String(subs.active)}
          hint={[
            subs.overdue ? `${subs.overdue} em atraso` : null,
            subs.pending ? `${subs.pending} pendente(s)` : null,
            subs.cancelled ? `${subs.cancelled} cancelada(s)` : null,
          ].filter(Boolean).join(' · ') || 'Nenhuma pendência'}
        />
      </div>

      <div style={styles.twoCol}>
        {/* ── Receita mensal (6 meses) ── */}
        <section style={styles.panel}>
          <div style={styles.sectionHead}>Receita por mês</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 150, padding: '8px 4px 0' }}>
            {revenue.monthly.map((m) => (
              <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <span style={{ color: '#cfcfd4', fontSize: 11.5, whiteSpace: 'nowrap' }}>{m.total > 0 ? fmtBRL(m.total) : ''}</span>
                <div
                  title={`${fmtMonth(m.month)}: ${fmtBRL(m.total)}`}
                  style={{
                    width: '100%', maxWidth: 44, borderRadius: '6px 6px 2px 2px',
                    height: Math.max(3, Math.round((m.total / maxMonthly) * 96)),
                    background: m.total > 0 ? 'linear-gradient(180deg, #2ec47a, #1d7a4d)' : '#2a2a2a',
                  }}
                />
                <span style={{ color: '#8a8a8a', fontSize: 11.5 }}>{fmtMonth(m.month)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Receita por origem ── */}
        <section style={styles.panel}>
          <div style={styles.sectionHead}>Receita por origem</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SourceRow
              label="Desbloqueio de perfis" color="#af68d8"
              total={revenue.purchases.total} count={revenue.purchases.count}
              thisMonth={revenue.purchases.thisMonth} grand={revenue.total}
            />
            <SourceRow
              label="Assinaturas PRO" color="#9A4FD1"
              total={revenue.subscriptionPayments.total} count={revenue.subscriptionPayments.count}
              thisMonth={revenue.subscriptionPayments.thisMonth} grand={revenue.total}
            />
          </div>
        </section>
      </div>

      {/* ── Últimos pagamentos ── */}
      <section style={{ ...styles.panel, marginTop: 18 }}>
        <div style={styles.sectionHead}>Últimos pagamentos confirmados</div>
        {recentPayments.length === 0 ? (
          <div style={styles.empty}>Nenhum pagamento confirmado ainda.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentPayments.map((p, i) => (
              <div key={i} style={styles.rowItem}>
                <Tag color={p.kind === 'subscription' ? 'magenta' : 'purple'} style={{ marginRight: 0 }}>
                  {p.kind === 'subscription' ? 'Assinatura' : 'Perfil'}
                </Tag>
                <span style={{ color: '#fff', fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.label}
                  {p.coupon && <span style={{ color: '#8a8a8a', fontWeight: 400 }}> · cupom {p.coupon}</span>}
                </span>
                <span style={{ color: '#9a9aa5', fontSize: 12.5, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</span>
                <span style={{ color: '#8a8a8a', fontSize: 12.5, width: 62 }}>{BILLING_LABEL[p.billing_type || ''] || p.billing_type || '—'}</span>
                <span style={{ color: '#2ec47a', fontWeight: 700, width: 96, textAlign: 'right' }}>{fmtBRL(p.amount)}</span>
                <span style={{ color: '#8a8a8a', fontSize: 12.5, width: 88, textAlign: 'right' }}>{dayjs(p.date).format('DD/MM/YYYY')}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p style={{ color: '#5a5a63', fontSize: 12, marginTop: 14 }}>
        Atualizado em {dayjs(stats.generatedAt).format('DD/MM/YYYY HH:mm')}. Receita considera pagamentos confirmados (perfis + assinaturas).
      </p>
    </div>
  );
};

// ─── Componentes locais ──────────────────────────────────────────────────────
const StatCard: FC<{ icon: ReactNode; accent: string; label: string; value: string; hint?: string }> = ({ icon, accent, label, value, hint }) => (
  <div style={styles.card}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#9a9aa5', fontSize: 12.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: `${accent}22`, color: accent, fontSize: 15 }}>
        {icon}
      </span>
      {label}
    </div>
    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, color: '#fff', lineHeight: 1.1 }}>{value}</div>
    {hint && <div style={{ color: '#8a8a8a', fontSize: 12.5 }}>{hint}</div>}
  </div>
);

const SourceRow: FC<{ label: string; color: string; total: number; count: number; thisMonth: number; grand: number }> = ({ label, color, total, count, thisMonth, grand }) => {
  const pct = grand > 0 ? Math.round((total / grand) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: '#e6e6ea', fontSize: 13.5, fontWeight: 600 }}>{label}</span>
        <span style={{ color: '#cfcfd4', fontSize: 13 }}>
          {fmtBRL(total)} <span style={{ color: '#6f6f78' }}>({count} pgto(s) · {pct}%)</span>
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: '#2a2a2a', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <div style={{ color: '#8a8a8a', fontSize: 12, marginTop: 4 }}>Este mês: {fmtBRL(thisMonth)}</div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  page: { padding: 24, maxWidth: 1100 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(24px, 3vw, 28px)', color: '#fff', margin: '0 0 6px' },
  sub: { color: '#9a9aa5', fontSize: 14, lineHeight: 1.5, margin: '0 0 22px', maxWidth: 640 },
  cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14, marginBottom: 14 },
  card: { background: '#1c1c1e', border: '1px solid #2a2a2a', borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14, marginTop: 4 },
  panel: { background: '#1c1c1e', border: '1px solid #2a2a2a', borderRadius: 12, padding: '16px 18px' },
  sectionHead: { color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #262626' },
  rowItem: { display: 'flex', alignItems: 'center', gap: 10, background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px' },
  empty: { color: '#6f6f78', fontSize: 13, padding: '4px 0' },
};

export default AdminDashboard;
