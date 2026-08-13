import { FC, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Input, Table, Tag, Modal, Spin, message, Button, Popconfirm, Progress, type TableColumnsType } from 'antd';
import { useNavigate } from 'react-router-dom';
import { FiActivity, FiArrowRight, FiCalendar, FiMessageCircle, FiMusic, FiSearch, FiTarget, FiTrash2, FiUser } from 'react-icons/fi';
import dayjs from 'dayjs';

import { supabase } from '../../lib/supabase';
import { readEdgeFunctionError } from '../../lib/edgeError';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import { Spinner } from '../../components/spinner/spinner';

// ─── Tipos ──────────────────────────────────────────────────────────────────
interface UserRow {
  id: string;
  email: string;
  name: string;
  created_at: string;
  confirmed: boolean;
  artistCount: number;
  paidArtists: number;
  subscription: string; // active | overdue | pending | cancelled | none
}

interface DetailArtist { id: string; name: string; is_locked: boolean; created_at: string; purchased_at: string | null; }
interface DetailSub {
  status: string; billing_type: string | null; cycle: string | null; value: number | null;
  started_at: string | null; next_due_date: string | null; coupon_code: string | null; discount_amount: number | null;
  asaas_customer_id: string | null; asaas_subscription_id: string | null;
}
interface DetailPurchase { id: string; artist_name: string | null; amount: number | null; billing_type: string | null; status: string; paid_at: string | null; created_at: string; coupon_code: string | null; }
interface UserDetail {
  account: { id: string; email: string; name: string; created_at: string; confirmed: boolean; last_sign_in_at: string | null; phone: string | null };
  artists: DetailArtist[];
  subscription: DetailSub | null;
  purchases: DetailPurchase[];
}
type Activity = 'active' | 'recent' | 'inactive' | 'never';
interface ArtistUsageDetail {
  artist: {
    id: string;
    image: string | null;
    lastActivityAt: string | null;
    activity: Activity;
    adoption: { used: number; total: number; percent: number };
  };
  real: { available: boolean; profileName: string; score: number | null };
  planning: { completed: boolean; strategies: number };
  actionPlan: { total: number; done: number; progress: number };
  catalog: { total: number };
  events: { total: number; upcoming: number };
  team: { total: number; active: number };
  nyta: { userMessages: number };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (iso?: string | null) => (iso ? dayjs(iso).format('DD/MM/YYYY HH:mm') : '—');
const fmtDay = (iso?: string | null) => (iso ? dayjs(iso).format('DD/MM/YYYY') : '—');
const fmtBRL = (n?: number | null) =>
  n == null ? '—' : Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SUB_LABEL: Record<string, string> = {
  active: 'PRO ativo', overdue: 'Em atraso', pending: 'Pendente', cancelled: 'Cancelada', none: 'Sem assinatura',
};
const subColor = (s: string): string =>
  ({ active: 'green', overdue: 'orange', pending: 'blue', cancelled: 'default', none: 'default' } as Record<string, string>)[s] || 'default';

const purchaseColor = (s: string): string =>
  ({ received: 'green', pending: 'blue', failed: 'red' } as Record<string, string>)[s] || 'default';

const ACTIVITY: Record<Activity, { label: string; color: string }> = {
  active: { label: 'Ativo · 7 dias', color: 'green' },
  recent: { label: 'Recente · 30 dias', color: 'blue' },
  inactive: { label: 'Inativo · +30 dias', color: 'default' },
  never: { label: 'Sem atividade', color: 'default' },
};

const AdminUsers: FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [artistUsage, setArtistUsage] = useState<Record<string, ArtistUsageDetail>>({});
  const [artistUsageLoading, setArtistUsageLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'list' } });
    if (error) message.error('Não foi possível carregar os usuários.');
    setRows((data?.users as UserRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback(async (userId: string) => {
    setModalOpen(true);
    setDetail(null);
    setArtistUsage({});
    setDetailLoading(true);
    const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'detail', userId } });
    if (error) message.error('Não foi possível carregar o detalhe.');
    const userDetail = (data as UserDetail) || null;
    setDetail(userDetail);
    setDetailLoading(false);

    if (!userDetail?.artists.length) return;
    setArtistUsageLoading(true);
    const usageResults = await Promise.all(userDetail.artists.map(async (artist) => {
      const result = await supabase.functions.invoke('admin-artists', {
        body: { action: 'detail', artistId: artist.id },
      });
      return result.error ? null : [artist.id, result.data as ArtistUsageDetail] as const;
    }));
    setArtistUsage(Object.fromEntries(usageResults.filter((item): item is readonly [string, ArtistUsageDetail] => !!item)));
    setArtistUsageLoading(false);
  }, []);

  const openArtist = useCallback((artistId: string) => {
    setModalOpen(false);
    navigate(`/admin/artistas/${artistId}`);
  }, [navigate]);

  const removeUser = useCallback(async () => {
    if (!detail) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke('admin-users', { body: { action: 'delete', userId: detail.account.id } });
    setDeleting(false);
    if (error) { message.error(await readEdgeFunctionError(error, 'Não foi possível excluir a conta.')); return; }
    if (data?.error) { message.error(data.error); return; }
    message.success('Conta excluída.');
    setModalOpen(false);
    load();
  }, [detail, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.email.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
  }, [rows, query]);

  const columns: TableColumnsType<UserRow> = [
    {
      title: 'Nome', dataIndex: 'name', key: 'name',
      render: (name: string) => <span style={{ color: '#fff', fontWeight: 600 }}>{name || '—'}</span>,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
    },
    { title: 'E-mail', dataIndex: 'email', key: 'email', render: (e: string) => <span style={{ color: '#cfcfd4' }}>{e}</span> },
    {
      title: 'Cadastro', dataIndex: 'created_at', key: 'created_at', width: 130,
      render: (v: string) => <span style={{ color: '#9a9aa5' }}>{fmtDay(v)}</span>,
      sorter: (a, b) => (a.created_at < b.created_at ? -1 : 1), defaultSortOrder: 'descend',
    },
    {
      title: 'E-mail', key: 'confirmed', width: 110, align: 'center',
      render: (_: unknown, r: UserRow) => <Tag color={r.confirmed ? 'green' : 'red'}>{r.confirmed ? 'Confirmado' : 'Pendente'}</Tag>,
      filters: [{ text: 'Confirmado', value: true }, { text: 'Pendente', value: false }],
      onFilter: (val, r) => r.confirmed === val,
    },
    {
      title: 'Perfis', key: 'artists', width: 90, align: 'center',
      render: (_: unknown, r: UserRow) => (
        <span style={{ color: '#fff' }} title={`${r.paidArtists} pago(s) de ${r.artistCount}`}>
          {r.paidArtists}<span style={{ color: '#6f6f78' }}>/{r.artistCount}</span>
        </span>
      ),
      sorter: (a, b) => a.artistCount - b.artistCount,
    },
    {
      title: 'Assinatura', dataIndex: 'subscription', key: 'subscription', width: 140,
      render: (s: string) => <Tag color={subColor(s)}>{SUB_LABEL[s] || s}</Tag>,
      filters: Object.entries(SUB_LABEL).map(([value, text]) => ({ text, value })),
      onFilter: (val, r) => r.subscription === val,
    },
  ];

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Usuários</h1>
      <p style={styles.sub}>Todos os cadastros da plataforma. Clique em um usuário para ver perfis, assinatura e histórico de pagamentos.</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          prefix={<FiSearch style={{ color: '#8a8a8a' }} />}
          placeholder="Buscar por nome ou e-mail"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          style={{ maxWidth: 340 }}
        />
        <span style={{ color: '#9a9aa5', fontSize: 13 }}>
          {loading ? 'Carregando…' : `${filtered.length} de ${rows.length} usuário(s)`}
        </span>
      </div>

      <Table<UserRow>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={loading}
        size="middle"
        pagination={{ pageSize: 20, showSizeChanger: true }}
        onRow={(r) => ({ onClick: () => openDetail(r.id), style: { cursor: 'pointer' } })}
      />

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={880}
        title={<span style={{ color: '#fff', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}><FiUser /> {detail?.account.name || 'Usuário'}</span>}
        footer={detail ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Popconfirm
              title="Excluir esta conta?"
              description={<span style={{ display: 'inline-block', maxWidth: 300 }}>Remove o usuário e todos os dados dele (perfis, assinatura, pagamentos). Não dá pra desfazer.</span>}
              okText="Excluir" okButtonProps={{ danger: true, loading: deleting }} cancelText="Cancelar"
              onConfirm={removeUser}
            >
              <Button danger icon={<FiTrash2 />} loading={deleting}>Excluir conta</Button>
            </Popconfirm>
            <Button onClick={() => setModalOpen(false)}>Fechar</Button>
          </div>
        ) : null}
      >
        {detailLoading || !detail ? (
          <Spinner loading section>{null as any}</Spinner>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Conta */}
            <section>
              <div style={styles.sectionHead}>Conta</div>
              <div style={styles.kvGrid}>
                <KV label="E-mail" value={detail.account.email} />
                <KV label="E-mail confirmado" value={detail.account.confirmed ? 'Sim' : 'Não'} />
                <KV label="Cadastro" value={fmtDate(detail.account.created_at)} />
                <KV label="Último acesso" value={fmtDate(detail.account.last_sign_in_at)} />
                {detail.account.phone && <KV label="Telefone" value={detail.account.phone} />}
              </div>
            </section>

            {/* Assinatura */}
            <section>
              <div style={styles.sectionHead}>Assinatura</div>
              {detail.subscription && detail.subscription.status !== 'none' ? (
                <div style={styles.kvGrid}>
                  <KV label="Status" value={<Tag color={subColor(detail.subscription.status)}>{SUB_LABEL[detail.subscription.status] || detail.subscription.status}</Tag>} />
                  <KV label="Ciclo" value={detail.subscription.cycle === 'YEARLY' ? 'Anual' : detail.subscription.cycle === 'MONTHLY' ? 'Mensal' : '—'} />
                  <KV label="Valor" value={fmtBRL(detail.subscription.value)} />
                  <KV label="Pagamento" value={detail.subscription.billing_type || '—'} />
                  <KV label="Próxima cobrança" value={fmtDay(detail.subscription.next_due_date)} />
                  <KV label="Início" value={fmtDay(detail.subscription.started_at)} />
                  {detail.subscription.coupon_code && <KV label="Cupom" value={detail.subscription.coupon_code} />}
                </div>
              ) : (
                <div style={styles.empty}>Sem assinatura.</div>
              )}
            </section>

            {/* Perfis */}
            <section>
              <div style={styles.sectionHead}>Perfis de artista ({detail.artists.length})</div>
              {detail.artists.length === 0 ? (
                <div style={styles.empty}>Nenhum perfil criado.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.artists.map((a) => {
                    const usage = artistUsage[a.id];
                    return (
                      <button key={a.id} type="button" style={styles.artistItem} onClick={() => openArtist(a.id)}>
                        <div style={styles.artistItemHeader}>
                          <img
                            src={usage?.artist.image || ARTISTS_DEFAULT_IMAGE}
                            alt=""
                            style={styles.artistImage}
                          />
                          <div style={styles.artistIdentity}>
                            <strong style={styles.artistName}>{a.name}</strong>
                            <span style={styles.artistCreated}>Criado em {fmtDay(a.created_at)}</span>
                          </div>
                          <Tag color={a.is_locked ? 'default' : 'green'}>{a.is_locked ? 'Bloqueado' : 'Desbloqueado'}</Tag>
                          {usage && <Tag color={ACTIVITY[usage.artist.activity].color}>{ACTIVITY[usage.artist.activity].label}</Tag>}
                          <FiArrowRight style={{ color: '#a7a7af', fontSize: 18, flexShrink: 0 }} />
                        </div>

                        {artistUsageLoading && !usage ? (
                          <div style={styles.artistUsageLoading}><Spin size="small" /> Carregando sinais de uso…</div>
                        ) : usage ? (
                          <>
                            <div style={styles.usageMetrics}>
                              <UsageMetric
                                icon={<FiActivity />}
                                label="Diagnóstico REAL"
                                value={usage.real.available ? `${usage.real.profileName}${usage.real.score == null ? '' : ` · ${usage.real.score}`}` : 'Não realizado'}
                                active={usage.real.available}
                              />
                              <UsageMetric
                                icon={<FiTarget />}
                                label="Planejamento"
                                value={usage.planning.completed ? `${usage.planning.strategies} estratégias` : 'Não concluído'}
                                active={usage.planning.completed}
                              />
                              <UsageMetric
                                icon={<FiTarget />}
                                label="Plano de ação"
                                value={`${usage.actionPlan.done}/${usage.actionPlan.total} tarefas`}
                                active={usage.actionPlan.total > 0}
                              />
                              <UsageMetric
                                icon={<FiMusic />}
                                label="Músicas"
                                value={`${usage.catalog.total} música(s)`}
                                active={usage.catalog.total > 0}
                              />
                              <UsageMetric
                                icon={<FiCalendar />}
                                label="Agenda"
                                value={`${usage.events.total} evento(s) · ${usage.events.upcoming} futuro(s)`}
                                active={usage.events.total > 0}
                              />
                              <UsageMetric
                                icon={<FiMessageCircle />}
                                label="Nyta"
                                value={`${usage.nyta.userMessages} pergunta(s)`}
                                active={usage.nyta.userMessages > 0}
                              />
                            </div>
                            <div style={styles.adoptionRow}>
                              <span>Adoção do produto</span>
                              <Progress
                                percent={usage.artist.adoption.percent}
                                showInfo={false}
                                strokeColor="#9A4FD1"
                                style={{ flex: 1, margin: 0 }}
                              />
                              <strong>{usage.artist.adoption.percent}%</strong>
                              <small>Última atividade: {fmtDate(usage.artist.lastActivityAt)}</small>
                            </div>
                          </>
                        ) : (
                          <div style={styles.artistUsageLoading}>Detalhes de uso indisponíveis.</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Histórico de pagamentos */}
            <section>
              <div style={styles.sectionHead}>Histórico de pagamentos ({detail.purchases.length})</div>
              {detail.purchases.length === 0 ? (
                <div style={styles.empty}>Nenhuma cobrança de perfil.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.purchases.map((p) => (
                    <div key={p.id} style={styles.rowItem}>
                      <span style={{ color: '#fff', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.artist_name || 'Perfil'}</span>
                      <span style={{ color: '#cfcfd4', width: 90, textAlign: 'right' }}>{fmtBRL(p.amount)}</span>
                      <Tag color={purchaseColor(p.status)}>{p.status}</Tag>
                      <span style={{ color: '#8a8a8a', fontSize: 12.5, width: 92, textAlign: 'right' }}>{fmtDay(p.paid_at || p.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
};

const KV: FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    <span style={{ color: '#8a8a8a', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</span>
    <span style={{ color: '#e6e6ea', fontSize: 14 }}>{value}</span>
  </div>
);

const UsageMetric: FC<{ icon: React.ReactNode; label: string; value: string; active: boolean }> = ({ icon, label, value, active }) => (
  <div style={styles.usageMetric}>
    <span style={{ ...styles.usageIcon, color: active ? '#c97ef3' : '#66666f' }}>{icon}</span>
    <div>
      <span style={styles.usageLabel}>{label}</span>
      <strong style={{ ...styles.usageValue, color: active ? '#f3f3f5' : '#777780' }}>{value}</strong>
    </div>
  </div>
);

const styles: Record<string, CSSProperties> = {
  page: { padding: 24, maxWidth: 1100 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(24px, 3vw, 28px)', color: '#fff', margin: '0 0 6px' },
  sub: { color: '#9a9aa5', fontSize: 14, lineHeight: 1.5, margin: '0 0 22px', maxWidth: 640 },
  sectionHead: { color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #262626' },
  kvGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 },
  rowItem: { display: 'flex', alignItems: 'center', gap: 10, background: '#1f1f1f', border: '1px solid #2a2a2a', borderRadius: 8, padding: '9px 12px' },
  artistItem: { width: '100%', display: 'flex', flexDirection: 'column', gap: 13, padding: 14, textAlign: 'left', color: 'inherit', background: '#191919', border: '1px solid #303035', borderRadius: 10, cursor: 'pointer' },
  artistItemHeader: { display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 },
  artistImage: { width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', background: '#262626', flexShrink: 0 },
  artistIdentity: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  artistName: { color: '#fff', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  artistCreated: { color: '#85858e', fontSize: 12 },
  artistUsageLoading: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, color: '#85858e', fontSize: 13, borderTop: '1px solid #28282d', paddingTop: 12 },
  usageMetrics: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, borderTop: '1px solid #28282d', paddingTop: 12 },
  usageMetric: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '8px 9px', background: '#121212', borderRadius: 7 },
  usageIcon: { display: 'flex', fontSize: 16, flexShrink: 0 },
  usageLabel: { display: 'block', color: '#777780', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 2 },
  usageValue: { display: 'block', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  adoptionRow: { display: 'flex', alignItems: 'center', gap: 10, color: '#9999a2', fontSize: 12, borderTop: '1px solid #28282d', paddingTop: 11 },
  empty: { color: '#6f6f78', fontSize: 13, padding: '4px 0' },
};

export default AdminUsers;
