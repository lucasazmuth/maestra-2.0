import { FC, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Progress, Select, Table, Tabs, Tag, message, type TableColumnsType } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiActivity,
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiClock,
  FiMessageCircle,
  FiMusic,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiUser,
} from 'react-icons/fi';
import dayjs from 'dayjs';

import { supabase } from '../../lib/supabase';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import styles from './Artists.module.scss';
import { Spinner } from '../../components/spinner/spinner';

type Activity = 'active' | 'recent' | 'inactive' | 'never';

interface Adoption {
  used: number;
  total: number;
  percent: number;
  areas: Record<string, boolean>;
}

interface AdminArtistRow {
  id: string;
  name: string;
  image: string | null;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string; lastSignInAt: string | null };
  real: { available: boolean; profileName: string; profileKey: string; score: number | null; computedAt: string | null };
  planning: { completed: boolean; step: number | null; objectives: number; strategies: number; swotItems: number };
  actionPlan: { strategies: number; total: number; done: number; progress: number };
  catalog: { total: number; released: number };
  events: { total: number; upcoming: number };
  team: { total: number; active: number };
  nyta: { conversations: number; userMessages: number; lastAt: string | null };
  adoption: Adoption;
  lastActivityAt: string | null;
  activity: Activity;
}

interface ArtistDetail {
  generatedAt: string;
  artist: AdminArtistRow & { purchasedAt: string | null };
  profile: {
    identity: {
      name: string; genre: string; stage: string; city: string; state: string;
      bio: string; vision: string; mission: string; values: string[];
    };
    spotify: { followers: number | null; popularity: number | null; trackCount: number | null; genres: string[] };
    chartmetric: { monthlyListeners: number | null; careerRank: number | null; enriched: boolean };
  };
  real: AdminArtistRow['real'] & {
    description: string;
    pattern: Record<'r' | 'e' | 'a' | 'l', boolean>;
    boletim: Partial<Record<'r' | 'e' | 'a' | 'l', number>>;
    headline: string;
    bullets: string[];
    metrics: Array<{ label: string; value: string }>;
  };
  planning: {
    completed: boolean;
    step: number | null;
    strategies: number;
    swotItems: number;
    objectives: string[];
    swot: { strengths: number; weaknesses: number; opportunities: number; threats: number };
    executiveSummary: string;
  };
  actionPlan: {
    total: number;
    done: number;
    progress: number;
    strategies: Array<{ id: string; title: string; type: string; tasks: number; done: number; progress: number }>;
  };
  catalog: {
    total: number;
    byStatus: Record<string, number>;
    items: Array<{ id: string; title: string; status: string; genre: string | null; releaseDate: string | null; updatedAt: string }>;
  };
  events: {
    total: number;
    upcoming: number;
    byType: Record<string, number>;
    items: Array<{ id: string; title: string; type: string; date: string; startTime: string | null; status: string; source: string }>;
  };
  team: {
    total: number;
    active: number;
    members: Array<{ id: string; name: string | null; email: string; status: string; accessLevels: string[]; createdAt: string }>;
  };
  nyta: {
    conversations: number;
    messages: number;
    userMessages: number;
    assistantMessages: number;
    lastAt: string | null;
    last7d: number;
    last30d: number;
  };
}

interface NytaHistory {
  conversations: Array<{
    id: string;
    label: string;
    createdAt: string;
    updatedAt: string;
    messages: Array<{
      id: string;
      role: string;
      content: string;
      createdAt: string;
    }>;
  }>;
  totalMessages: number;
  truncated: boolean;
  generatedAt: string;
}

const ACTIVITY: Record<Activity, { label: string; color: string }> = {
  active: { label: 'Ativo · 7 dias', color: 'green' },
  recent: { label: 'Recente · 30 dias', color: 'blue' },
  inactive: { label: 'Inativo · +30 dias', color: 'default' },
  never: { label: 'Sem atividade', color: 'default' },
};

const CATALOG_STATUS: Record<string, string> = {
  composition: 'Composição',
  recording: 'Gravação',
  production: 'Produção',
  mixing: 'Mixagem',
  mastering: 'Masterização',
  released: 'Lançada',
};

const EVENT_STATUS: Record<string, string> = {
  scheduled: 'Agendado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const fmtDate = (value?: string | null) => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '—';
const fmtDay = (value?: string | null) => value ? dayjs(value).format('DD/MM/YYYY') : '—';
const fmtNumber = (value?: number | null) => value == null ? '—' : value.toLocaleString('pt-BR');

const invokeAdminArtists = async <T,>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke('admin-artists', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as T;
};

const AdminArtists: FC = () => {
  const { artistId } = useParams<{ artistId?: string }>();
  return artistId ? <ArtistDetailView artistId={artistId} /> : <ArtistList />;
};

const ArtistList: FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminArtistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activity, setActivity] = useState<Activity | 'all'>('all');
  const [adoption, setAdoption] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invokeAdminArtists<{ artists: AdminArtistRow[] }>({ action: 'list' });
      setRows(data.artists || []);
    } catch {
      message.error('Não foi possível carregar os perfis de artista.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !normalized ||
        row.name.toLowerCase().includes(normalized) ||
        row.owner.name.toLowerCase().includes(normalized) ||
        row.owner.email.toLowerCase().includes(normalized);
      const matchesActivity = activity === 'all' || row.activity === activity;
      const level = row.adoption.percent >= 70 ? 'high' : row.adoption.percent >= 35 ? 'medium' : 'low';
      const matchesAdoption = adoption === 'all' || level === adoption;
      return matchesQuery && matchesActivity && matchesAdoption;
    });
  }, [activity, adoption, query, rows]);

  const active7d = rows.filter((row) => row.activity === 'active').length;
  const planned = rows.filter((row) => row.planning.completed).length;
  const nytaUsers = rows.filter((row) => row.nyta.userMessages > 0).length;

  const columns: TableColumnsType<AdminArtistRow> = [
    {
      title: 'Perfil',
      key: 'artist',
      width: 265,
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (_, row) => (
        <div className={styles.artistCell}>
          <img src={row.image || ARTISTS_DEFAULT_IMAGE} alt="" />
          <div>
            <strong>{row.name}</strong>
            <span>{row.owner.name || row.owner.email}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Atividade',
      key: 'activity',
      width: 150,
      sorter: (a, b) => String(a.lastActivityAt || '').localeCompare(String(b.lastActivityAt || '')),
      defaultSortOrder: 'descend',
      render: (_, row) => (
        <div className={styles.activityCell}>
          <Tag color={ACTIVITY[row.activity].color}>{ACTIVITY[row.activity].label}</Tag>
          <span>{fmtDate(row.lastActivityAt)}</span>
        </div>
      ),
    },
    {
      title: 'REAL',
      key: 'real',
      width: 130,
      render: (_, row) => row.real.available ? (
        <div className={styles.metricCell}>
          <strong>{row.real.profileName}</strong>
          <span>{row.real.score == null ? 'Concluído' : `Score ${row.real.score}`}</span>
        </div>
      ) : <span className={styles.muted}>Não realizado</span>,
    },
    {
      title: 'Planejamento',
      key: 'planning',
      width: 130,
      render: (_, row) => (
        <div className={styles.metricCell}>
          <strong>{row.planning.completed ? 'Concluído' : 'Não concluído'}</strong>
          <span>{row.planning.strategies} estratégias</span>
        </div>
      ),
    },
    {
      title: 'Plano',
      key: 'plan',
      width: 145,
      render: (_, row) => (
        <div className={styles.progressCell}>
          <Progress percent={row.actionPlan.progress} size="small" showInfo={false} />
          <span>{row.actionPlan.done}/{row.actionPlan.total} tarefas</span>
        </div>
      ),
    },
    {
      title: 'Uso',
      key: 'usage',
      width: 130,
      render: (_, row) => (
        <div className={styles.usageCell}>
          <span><FiMusic /> {row.catalog.total}</span>
          <span><FiCalendar /> {row.events.total}</span>
          <span><FiMessageCircle /> {row.nyta.userMessages}</span>
        </div>
      ),
    },
    {
      title: 'Adoção',
      key: 'adoption',
      width: 130,
      sorter: (a, b) => a.adoption.percent - b.adoption.percent,
      render: (_, row) => (
        <div className={styles.adoptionCell}>
          <Progress
            type="circle"
            percent={row.adoption.percent}
            size={38}
            strokeColor="#3361ff"
            format={() => `${row.adoption.used}/${row.adoption.total}`}
          />
          <span>{row.adoption.percent}%</span>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1>Artistas</h1>
          <p>Visão operacional dos perfis criados e dos sinais reais de uso da plataforma.</p>
        </div>
        <Button icon={<FiRefreshCw />} loading={loading} onClick={() => void load()}>Atualizar</Button>
      </div>

      <div className={styles.summaryGrid}>
        <SummaryCard icon={<FiMusic />} label="Perfis criados" value={rows.length} hint={`${rows.filter((row) => !row.isLocked).length} desbloqueados`} />
        <SummaryCard icon={<FiActivity />} label="Ativos em 7 dias" value={active7d} hint={`${rows.length ? Math.round((active7d / rows.length) * 100) : 0}% da base`} />
        <SummaryCard icon={<FiTarget />} label="Com planejamento" value={planned} hint={`${rows.length ? Math.round((planned / rows.length) * 100) : 0}% da base`} />
        <SummaryCard icon={<FiMessageCircle />} label="Usaram a Nyta" value={nytaUsers} hint={`${rows.length ? Math.round((nytaUsers / rows.length) * 100) : 0}% da base`} />
      </div>

      <div className={styles.filters}>
        <Input
          prefix={<FiSearch />}
          placeholder="Buscar artista, responsável ou e-mail"
          value={query}
          allowClear
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          value={activity}
          onChange={setActivity}
          options={[
            { value: 'all', label: 'Todas as atividades' },
            ...Object.entries(ACTIVITY).map(([value, item]) => ({ value, label: item.label })),
          ]}
        />
        <Select
          value={adoption}
          onChange={setAdoption}
          options={[
            { value: 'all', label: 'Toda adoção' },
            { value: 'high', label: 'Adoção alta · 70%+' },
            { value: 'medium', label: 'Adoção média · 35–69%' },
            { value: 'low', label: 'Adoção baixa · até 34%' },
          ]}
        />
        <span>{loading ? 'Carregando…' : `${filtered.length} de ${rows.length} perfil(is)`}</span>
      </div>

      <Table<AdminArtistRow>
        className={styles.table}
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={loading}
        scroll={{ x: 1110 }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        onRow={(row) => ({
          onClick: () => navigate(`/admin/artistas/${row.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  );
};

const ArtistDetailView: FC<{ artistId: string }> = ({ artistId }) => {
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [nytaHistory, setNytaHistory] = useState<NytaHistory | null>(null);
  const [nytaHistoryLoading, setNytaHistoryLoading] = useState(false);
  const [nytaConversationId, setNytaConversationId] = useState('');
  const [nytaSearch, setNytaSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setDetail(await invokeAdminArtists<ArtistDetail>({ action: 'detail', artistId }));
    } catch {
      setFailed(true);
      message.error('Não foi possível carregar o perfil.');
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => { void load(); }, [load]);

  const loadNytaHistory = useCallback(async () => {
    if (nytaHistoryLoading) return;
    setNytaHistoryLoading(true);
    try {
      const history = await invokeAdminArtists<NytaHistory>({ action: 'nyta-history', artistId });
      setNytaHistory(history);
      setNytaConversationId((current) => current || history.conversations[0]?.id || '');
    } catch {
      message.error('Não foi possível carregar o histórico da Nyta.');
    } finally {
      setNytaHistoryLoading(false);
    }
  }, [artistId, nytaHistoryLoading]);

  if (loading && !detail) {
    return <div className={styles.loading}><Spinner loading>{null as any}</Spinner></div>;
  }

  if (failed || !detail) {
    return (
      <div className={styles.page}>
        <Button icon={<FiArrowLeft />} onClick={() => navigate('/admin/artistas')}>Voltar para artistas</Button>
        <Alert className={styles.error} type="error" showIcon message="Não foi possível carregar este perfil." action={<Button onClick={() => void load()}>Tentar novamente</Button>} />
      </div>
    );
  }

  const { artist } = detail;
  const usageAreas = [
    ['REAL', artist.adoption.areas.real],
    ['Planejamento', artist.adoption.areas.planning],
    ['Plano de ação', artist.adoption.areas.actionPlan],
    ['Músicas', artist.adoption.areas.catalog],
    ['Agenda', artist.adoption.areas.events],
    ['Equipe', artist.adoption.areas.team],
    ['Nyta', artist.adoption.areas.nyta],
  ] as const;

  const tabs = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <div className={styles.detailContent}>
          <div className={styles.summaryGrid}>
            <SummaryCard icon={<FiTrendingUp />} label="Adoção" value={`${artist.adoption.percent}%`} hint={`${artist.adoption.used} de ${artist.adoption.total} áreas usadas`} />
            <SummaryCard icon={<FiClock />} label="Última atividade" value={fmtDay(artist.lastActivityAt)} hint={ACTIVITY[artist.activity].label} />
            <SummaryCard icon={<FiTarget />} label="Plano de ação" value={`${detail.actionPlan.progress}%`} hint={`${detail.actionPlan.done} de ${detail.actionPlan.total} tarefas`} />
            <SummaryCard icon={<FiMessageCircle />} label="Perguntas à Nyta" value={detail.nyta.userMessages} hint={`${detail.nyta.last30d} nos últimos 30 dias`} />
          </div>
          <section className={styles.panel}>
            <SectionTitle title="Áreas utilizadas" subtitle="Uma área conta como usada quando existe atividade ou conteúdo salvo nela." />
            <div className={styles.areaGrid}>
              {usageAreas.map(([label, active]) => (
                <div className={`${styles.areaItem} ${active ? styles.areaItemActive : ''}`} key={label}>
                  {active ? <FiCheckCircle /> : <span className={styles.emptyDot} />}
                  <span>{label}</span>
                  <strong>{active ? 'Usou' : 'Sem uso'}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className={styles.panel}>
            <SectionTitle title="Informações do perfil" />
            <div className={styles.kvGrid}>
              <KV label="Nome artístico" value={detail.profile.identity.name || artist.name} />
              <KV label="Gênero" value={detail.profile.identity.genre || 'Não informado'} />
              <KV label="Fase" value={detail.profile.identity.stage || 'Não informada'} />
              <KV label="Local" value={[detail.profile.identity.city, detail.profile.identity.state].filter(Boolean).join(' · ') || 'Não informado'} />
              <KV label="Seguidores Spotify" value={fmtNumber(detail.profile.spotify.followers)} />
              <KV label="Ouvintes mensais" value={fmtNumber(detail.profile.chartmetric.monthlyListeners)} />
              <KV label="Cadastro" value={fmtDate(artist.createdAt)} />
              <KV label="Última entrada do dono" value={fmtDate(artist.owner.lastSignInAt)} />
            </div>
            {(detail.profile.identity.bio || detail.profile.identity.vision || detail.profile.identity.mission) && (
              <div className={styles.textBlocks}>
                {detail.profile.identity.bio && <TextBlock label="Bio" value={detail.profile.identity.bio} />}
                {detail.profile.identity.vision && <TextBlock label="Visão" value={detail.profile.identity.vision} />}
                {detail.profile.identity.mission && <TextBlock label="Missão" value={detail.profile.identity.mission} />}
              </div>
            )}
          </section>
        </div>
      ),
    },
    {
      key: 'real',
      label: 'Diagnóstico REAL',
      children: detail.real.available ? (
        <div className={styles.detailContent}>
          <section className={styles.panel}>
            <SectionTitle title={detail.real.profileName} subtitle={detail.real.description || detail.real.headline} />
            <div className={styles.realGrid}>
              {(['r', 'e', 'a', 'l'] as const).map((key) => (
                <div className={styles.realDimension} key={key}>
                  <span>{key.toUpperCase()}</span>
                  <strong>{detail.real.boletim[key] ?? (detail.real.pattern[key] ? 'Alto' : 'Baixo')}</strong>
                  {typeof detail.real.boletim[key] === 'number' && <Progress percent={detail.real.boletim[key]} showInfo={false} strokeColor="#2a9a59" />}
                </div>
              ))}
            </div>
            <div className={styles.kvGrid}>
              <KV label="Score médio" value={detail.real.score ?? '—'} />
              <KV label="Calculado em" value={fmtDate(detail.real.computedAt)} />
              <KV label="Versão/perfil" value={detail.real.profileKey || '—'} />
            </div>
          </section>
          {!!detail.real.bullets.length && (
            <section className={styles.panel}>
              <SectionTitle title="Leituras do diagnóstico" />
              <ul className={styles.bulletList}>{detail.real.bullets.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </section>
          )}
        </div>
      ) : <EmptyModule title="Diagnóstico REAL não realizado" />,
    },
    {
      key: 'planning',
      label: 'Planejamento',
      children: detail.planning.completed || detail.planning.objectives.length ? (
        <div className={styles.detailContent}>
          <div className={styles.summaryGrid}>
            <SummaryCard icon={<FiTarget />} label="Objetivos" value={detail.planning.objectives.length} />
            <SummaryCard icon={<FiTrendingUp />} label="Estratégias" value={detail.planning.strategies} />
            <SummaryCard icon={<FiActivity />} label="Itens SWOT" value={detail.planning.swotItems} />
            <SummaryCard icon={<FiCheckCircle />} label="Situação" value={detail.planning.completed ? 'Concluído' : 'Em construção'} />
          </div>
          {!!detail.planning.objectives.length && (
            <section className={styles.panel}>
              <SectionTitle title="Objetivos definidos" />
              <ol className={styles.objectiveList}>{detail.planning.objectives.map((item, index) => <li key={index}>{item}</li>)}</ol>
            </section>
          )}
          <section className={styles.panel}>
            <SectionTitle title="Matriz SWOT" />
            <div className={styles.kvGrid}>
              <KV label="Forças" value={detail.planning.swot.strengths} />
              <KV label="Fraquezas" value={detail.planning.swot.weaknesses} />
              <KV label="Oportunidades" value={detail.planning.swot.opportunities} />
              <KV label="Ameaças" value={detail.planning.swot.threats} />
            </div>
          </section>
        </div>
      ) : <EmptyModule title="Planejamento ainda não concluído" />,
    },
    {
      key: 'action',
      label: `Plano de ação (${detail.actionPlan.total})`,
      children: detail.actionPlan.strategies.length ? (
        <div className={styles.detailContent}>
          <div className={styles.summaryGrid}>
            <SummaryCard icon={<FiTarget />} label="Tarefas" value={detail.actionPlan.total} />
            <SummaryCard icon={<FiCheckCircle />} label="Concluídas" value={detail.actionPlan.done} />
            <SummaryCard icon={<FiTrendingUp />} label="Progresso" value={`${detail.actionPlan.progress}%`} />
          </div>
          <section className={styles.panel}>
            <SectionTitle title="Estratégias por prioridade" />
            <div className={styles.list}>
              {detail.actionPlan.strategies.map((strategy, index) => (
                <div className={styles.strategyRow} key={strategy.id || index}>
                  <span className={styles.index}>{index + 1}</span>
                  <div><strong>{strategy.title}</strong><span>{strategy.done} de {strategy.tasks} tarefas concluídas</span></div>
                  <Progress type="circle" percent={strategy.progress} size={40} strokeColor="#3361ff" />
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : <EmptyModule title="Plano de ação ainda sem tarefas" />,
    },
    {
      key: 'catalog',
      label: `Músicas (${detail.catalog.total})`,
      children: detail.catalog.total ? (
        <section className={`${styles.panel} ${styles.tabPanel}`}>
          <SectionTitle title="Músicas cadastradas" subtitle="Status e última atualização das músicas adicionadas." />
          <div className={styles.chips}>{Object.entries(detail.catalog.byStatus).map(([status, count]) => <Tag key={status}>{CATALOG_STATUS[status] || status}: {count}</Tag>)}</div>
          <div className={styles.list}>
            {detail.catalog.items.map((item) => (
              <div className={styles.dataRow} key={item.id}>
                <FiMusic />
                <div><strong>{item.title}</strong><span>{item.genre || 'Gênero não informado'} · atualizado em {fmtDay(item.updatedAt)}</span></div>
                <Tag color={item.status === 'released' ? 'green' : 'purple'}>{CATALOG_STATUS[item.status] || item.status}</Tag>
              </div>
            ))}
          </div>
        </section>
      ) : <EmptyModule title="Nenhuma música cadastrada" />,
    },
    {
      key: 'events',
      label: `Agenda (${detail.events.total})`,
      children: detail.events.total ? (
        <section className={`${styles.panel} ${styles.tabPanel}`}>
          <SectionTitle title="Eventos e compromissos" subtitle={`${detail.events.upcoming} compromisso(s) futuro(s).`} />
          <div className={styles.list}>
            {detail.events.items.map((event) => (
              <div className={styles.dataRow} key={event.id}>
                <FiCalendar />
                <div><strong>{event.title}</strong><span>{fmtDay(event.date)}{event.startTime ? ` · ${event.startTime.slice(0, 5)}` : ''} · {event.type}</span></div>
                <Tag color={event.status === 'completed' ? 'green' : event.status === 'cancelled' ? 'default' : 'blue'}>{EVENT_STATUS[event.status] || event.status}</Tag>
              </div>
            ))}
          </div>
        </section>
      ) : <EmptyModule title="Nenhum evento criado" />,
    },
    {
      key: 'team',
      label: `Equipe (${detail.team.total})`,
      children: detail.team.total ? (
        <section className={`${styles.panel} ${styles.tabPanel}`}>
          <SectionTitle title="Pessoas convidadas" subtitle={`${detail.team.active} membro(s) ativo(s).`} />
          <div className={styles.list}>
            {detail.team.members.map((member) => (
              <div className={styles.dataRow} key={member.id}>
                <FiUser />
                <div><strong>{member.name || member.email}</strong><span>{member.email} · convite em {fmtDay(member.createdAt)}</span></div>
                <Tag color={member.status === 'active' ? 'green' : 'orange'}>{member.status === 'active' ? 'Ativo' : 'Pendente'}</Tag>
              </div>
            ))}
          </div>
        </section>
      ) : <EmptyModule title="Nenhum membro convidado" />,
    },
    {
      key: 'nyta',
      label: `Nyta (${detail.nyta.userMessages})`,
      children: detail.nyta.userMessages ? (
        <div className={styles.detailContent}>
          <div className={styles.summaryGrid}>
            <SummaryCard icon={<FiMessageCircle />} label="Perguntas enviadas" value={detail.nyta.userMessages} />
            <SummaryCard icon={<FiActivity />} label="Últimos 7 dias" value={detail.nyta.last7d} />
            <SummaryCard icon={<FiTrendingUp />} label="Últimos 30 dias" value={detail.nyta.last30d} />
            <SummaryCard icon={<FiClock />} label="Última conversa" value={fmtDay(detail.nyta.lastAt)} />
          </div>
          <section className={styles.panel}>
            <SectionTitle title="Uso da Nyta" subtitle="Indicadores de frequência e atividade do perfil." />
            <div className={styles.kvGrid}>
              <KV label="Conversas" value={detail.nyta.conversations} />
              <KV label="Mensagens do usuário" value={detail.nyta.userMessages} />
              <KV label="Respostas da Nyta" value={detail.nyta.assistantMessages} />
              <KV label="Total de mensagens" value={detail.nyta.messages} />
            </div>
          </section>
          <section className={styles.panel}>
            <div className={styles.moderationHeader}>
              <SectionTitle
                title="Histórico para moderação"
                subtitle="Conteúdo restrito a administradores para acompanhar qualidade, segurança e padrões de uso."
              />
              <Tag icon={<FiShield />} color="purple">Acesso administrativo</Tag>
            </div>
            {!nytaHistory ? (
              <div className={styles.historyGate}>
                <FiMessageCircle />
                <div>
                  <strong>Visualizar conversas deste perfil</strong>
                  <span>O histórico será carregado somente quando solicitado por um administrador.</span>
                </div>
                <Button type="primary" loading={nytaHistoryLoading} onClick={() => void loadNytaHistory()}>
                  Carregar histórico
                </Button>
              </div>
            ) : (
              <NytaHistoryView
                history={nytaHistory}
                selectedId={nytaConversationId}
                onSelect={setNytaConversationId}
                search={nytaSearch}
                onSearch={setNytaSearch}
                loading={nytaHistoryLoading}
                onReload={() => void loadNytaHistory()}
              />
            )}
          </section>
        </div>
      ) : <EmptyModule title="Nenhuma interação com a Nyta" />,
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.detailTopbar}>
        <Button icon={<FiArrowLeft />} onClick={() => navigate('/admin/artistas')}>Todos os artistas</Button>
        <Button icon={<FiRefreshCw />} loading={loading} onClick={() => void load()}>Atualizar</Button>
      </div>

      <section className={styles.artistHero}>
        <img src={artist.image || ARTISTS_DEFAULT_IMAGE} alt={artist.name} />
        <div className={styles.artistHeroInfo}>
          <span className={styles.kicker}>PERFIL DE ARTISTA</span>
          <h1>{artist.name}</h1>
          <p>{artist.owner.name || 'Responsável'} · {artist.owner.email}</p>
          <div>
            <Tag color={artist.isLocked ? 'default' : 'green'}>{artist.isLocked ? 'Bloqueado' : 'Desbloqueado'}</Tag>
            <Tag color={ACTIVITY[artist.activity].color}>{ACTIVITY[artist.activity].label}</Tag>
            {detail.real.available && <Tag color="green">REAL concluído</Tag>}
            {detail.planning.completed && <Tag color="purple">Planejamento concluído</Tag>}
          </div>
        </div>
        <div className={styles.heroAdoption}>
          <Progress type="circle" percent={artist.adoption.percent} size={78} strokeColor="#3361ff" />
          <span>Adoção do produto</span>
        </div>
      </section>

      <Tabs
        className={styles.tabs}
        items={tabs}
        onChange={(key) => {
          if (key === 'nyta' && detail.nyta.userMessages > 0 && !nytaHistory) {
            void loadNytaHistory();
          }
        }}
      />

      <p className={styles.generatedAt}>Dados atualizados em {fmtDate(detail.generatedAt)}.</p>
    </div>
  );
};

const SummaryCard: FC<{ icon: ReactNode; label: string; value: ReactNode; hint?: string }> = ({ icon, label, value, hint }) => (
  <div className={styles.summaryCard}>
    <div><span>{icon}</span>{label}</div>
    <strong>{value}</strong>
    {hint && <small>{hint}</small>}
  </div>
);

const SectionTitle: FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className={styles.sectionTitle}>
    <strong>{title}</strong>
    {subtitle && <span>{subtitle}</span>}
  </div>
);

const KV: FC<{ label: string; value: ReactNode }> = ({ label, value }) => (
  <div className={styles.kv}><span>{label}</span><strong>{value}</strong></div>
);

const TextBlock: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className={styles.textBlock}><span>{label}</span><p>{value}</p></div>
);

const EmptyModule: FC<{ title: string }> = ({ title }) => (
  <div className={styles.emptyModule}><FiActivity /><strong>{title}</strong><span>Não há dados suficientes nesta área para indicar uso.</span></div>
);

const NytaHistoryView: FC<{
  history: NytaHistory;
  selectedId: string;
  onSelect: (id: string) => void;
  search: string;
  onSearch: (value: string) => void;
  loading: boolean;
  onReload: () => void;
}> = ({ history, selectedId, onSelect, search, onSearch, loading, onReload }) => {
  const selected = history.conversations.find((conversation) => conversation.id === selectedId) || history.conversations[0];
  const normalized = search.trim().toLowerCase();
  const messages = (selected?.messages || []).filter((item) =>
    !normalized || item.content.toLowerCase().includes(normalized)
  );

  if (!history.conversations.length) {
    return <div className={styles.historyEmpty}>Nenhuma conversa encontrada para este perfil.</div>;
  }

  return (
    <div className={styles.history}>
      {history.truncated && (
        <Alert
          type="warning"
          showIcon
          message="Exibindo as 500 mensagens mais recentes deste perfil."
        />
      )}
      <div className={styles.historyToolbar}>
        <Select
          value={selected?.id}
          onChange={onSelect}
          options={history.conversations.map((conversation) => ({
            value: conversation.id,
            label: `${conversation.label} · ${conversation.messages.length} mensagens · ${fmtDate(conversation.updatedAt)}`,
          }))}
        />
        <Input
          prefix={<FiSearch />}
          placeholder="Buscar no conteúdo da conversa"
          value={search}
          allowClear
          onChange={(event) => onSearch(event.target.value)}
        />
        <Button icon={<FiRefreshCw />} loading={loading} onClick={onReload}>Atualizar</Button>
      </div>
      <div className={styles.conversationMeta}>
        <span>Iniciada em {fmtDate(selected?.createdAt)}</span>
        <span>{messages.length} de {selected?.messages.length || 0} mensagem(ns)</span>
      </div>
      <div className={styles.messageHistory}>
        {messages.length ? messages.map((item) => {
          const isUser = item.role === 'user';
          const isAssistant = item.role === 'assistant';
          const roleLabel = isUser
            ? 'Usuário'
            : isAssistant
              ? 'Nyta'
              : item.role === 'tool'
                ? 'Ação executada'
                : item.role === 'system'
                  ? 'Sistema'
                  : item.role;
          return (
            <article
              className={`${styles.historyMessage} ${isUser ? styles.historyMessageUser : isAssistant ? styles.historyMessageAssistant : styles.historyMessageSystem}`}
              key={item.id}
            >
              <div>
                <strong>{roleLabel}</strong>
                <time>{fmtDate(item.createdAt)}</time>
              </div>
              <p>{item.content || 'Mensagem sem conteúdo textual.'}</p>
            </article>
          );
        }) : (
          <div className={styles.historyEmpty}>Nenhuma mensagem corresponde à busca.</div>
        )}
      </div>
    </div>
  );
};

export default AdminArtists;
