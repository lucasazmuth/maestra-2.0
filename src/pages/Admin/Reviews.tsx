import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Rate, Select, Table, message, type TableColumnsType } from 'antd';
import { FiMessageSquare, FiRefreshCw, FiSearch, FiStar, FiTrendingUp, FiUsers } from 'react-icons/fi';
import dayjs from 'dayjs';

import { supabase } from '../../lib/supabase';
import styles from './Reviews.module.scss';
import { Spinner } from '../../components/spinner/spinner';

interface ReviewItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  rating: number;
  comment: string | null;
  pagePath: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReviewResponse {
  generatedAt: string;
  stats: {
    total: number;
    average: number;
    withComment: number;
    last7d: number;
    distribution: Record<number, number>;
  };
  items: ReviewItem[];
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';

const AdminReviews: FC = () => {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [rating, setRating] = useState<number | 'all'>('all');
  const [selected, setSelected] = useState<ReviewItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: response, error } = await supabase.functions.invoke('admin-reviews', { body: {} });
    if (error || response?.error) {
      message.error('Não foi possível carregar as avaliações.');
      setData(null);
    } else {
      setData(response as ReviewResponse);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    return (data?.items || []).filter((item) => {
      const matchesQuery = !normalized || [item.name, item.email, item.comment || '']
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized));
      return matchesQuery && (rating === 'all' || item.rating === rating);
    });
  }, [data?.items, query, rating]);

  const columns: TableColumnsType<ReviewItem> = [
    {
      title: 'Usuário',
      key: 'user',
      width: 250,
      render: (_, row) => (
        <div className={styles.userCell}>
          {row.avatarUrl ? (
            <img className={styles.avatar} src={row.avatarUrl} alt="" />
          ) : (
            <span className={styles.avatarFallback}>{initials(row.name)}</span>
          )}
          <div>
            <strong>{row.name}</strong>
            <span>{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Nota',
      dataIndex: 'rating',
      width: 150,
      sorter: (a, b) => a.rating - b.rating,
      render: (value: number) => <Rate disabled value={value} />,
    },
    {
      title: 'Comentário',
      dataIndex: 'comment',
      render: (value: string | null) => (
        value ? <span className={styles.comment} title={value}>{value}</span> : <span className={styles.empty}>Sem comentário</span>
      ),
    },
    {
      title: 'Atualizada',
      dataIndex: 'updatedAt',
      width: 145,
      sorter: (a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
      defaultSortOrder: 'descend',
      render: (value: string) => <span className={styles.date}>{dayjs(value).format('DD/MM/YYYY HH:mm')}</span>,
    },
  ];

  if (loading && !data) {
    return <div className={styles.page}><Spinner loading>{null as any}</Spinner></div>;
  }

  const stats = data?.stats || { total: 0, average: 0, withComment: 0, last7d: 0, distribution: {} };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>Avaliações</h1>
          <p>Acompanhe a satisfação dos usuários e os comentários enviados pelo menu da conta.</p>
        </div>
        <Button icon={<FiRefreshCw />} onClick={load} loading={loading}>Atualizar</Button>
      </header>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <div><span><FiStar /></span>Nota média</div>
          <strong>{stats.average ? stats.average.toFixed(1) : '—'}</strong>
          <small>de 5 estrelas</small>
        </article>
        <article className={styles.summaryCard}>
          <div><span><FiUsers /></span>Avaliações</div>
          <strong>{stats.total}</strong>
          <small>usuários responderam</small>
        </article>
        <article className={styles.summaryCard}>
          <div><span><FiMessageSquare /></span>Com comentário</div>
          <strong>{stats.withComment}</strong>
          <small>{stats.total ? Math.round((stats.withComment / stats.total) * 100) : 0}% das avaliações</small>
        </article>
        <article className={styles.summaryCard}>
          <div><span><FiTrendingUp /></span>Últimos 7 dias</div>
          <strong>{stats.last7d}</strong>
          <small>avaliações atualizadas</small>
        </article>
      </section>

      <div className={styles.filters}>
        <Input
          prefix={<FiSearch />}
          placeholder="Buscar usuário ou comentário"
          value={query}
          allowClear
          onChange={(event) => setQuery(event.target.value)}
        />
        <Select
          value={rating}
          onChange={setRating}
          options={[
            { value: 'all', label: 'Todas as notas' },
            ...[5, 4, 3, 2, 1].map((value) => ({
              value,
              label: `${value} estrela${value > 1 ? 's' : ''} (${stats.distribution[value] || 0})`,
            })),
          ]}
        />
        <span>{filtered.length} de {stats.total} avaliação(ões)</span>
      </div>

      <Table
        className={styles.table}
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        locale={{ emptyText: 'Nenhuma avaliação encontrada.' }}
        scroll={{ x: 820 }}
        onRow={(row) => ({ onClick: () => setSelected(row) })}
      />

      <Modal
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={null}
        width={570}
        centered
        styles={{ content: { overflow: 'hidden', padding: 0, background: '#18181a', border: '1px solid #303036', borderRadius: 16 } }}
      >
        {selected && (
          <>
            <header className={styles.detailHeader}>
              <span>Avaliação da plataforma</span>
              <h2>{selected.name}</h2>
            </header>
            <div className={styles.detailBody}>
              <Rate disabled value={selected.rating} />
              <p>{selected.comment || 'O usuário não deixou um comentário.'}</p>
              <div className={styles.meta}>
                <div><small>E-mail</small><span>{selected.email}</span></div>
                <div><small>Página de envio</small><span>{selected.pagePath || '—'}</span></div>
                <div><small>Primeira avaliação</small><span>{dayjs(selected.createdAt).format('DD/MM/YYYY HH:mm')}</span></div>
                <div><small>Última atualização</small><span>{dayjs(selected.updatedAt).format('DD/MM/YYYY HH:mm')}</span></div>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};

export default AdminReviews;
