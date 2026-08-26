import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Table, message } from 'antd';
import { FiPlus } from 'react-icons/fi';

import {
  carregarLeads,
  carregarTime,
  criarLead,
  editarLead,
  type DadosDoLead,
  type Lead,
  type MembroDoTime,
} from './dados';
import styles from './Sales.module.scss';

// Leads prospectados na mão.
//
// Estes NÃO são usuários da Maestra: são pessoas de fora que o time foi atrás. Quem chega pelo
// funil de ativação é o caso oposto e mora na aba Inbound. A separação importa porque a
// abordagem é diferente: aqui ninguém pediu contato, e não há histórico de produto para citar.

const VAZIO: DadosDoLead = { name: '', email: '', phone: '', notes: '' };

export const Leads: FC<{ onCriarNegocio?: (lead: Lead) => void }> = ({ onCriarNegocio }) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [time, setTime] = useState<MembroDoTime[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  // `null` fechado, string vazia criando, id editando. Um estado só evita a combinação
  // impossível de "criando e editando ao mesmo tempo".
  const [editandoId, setEditandoId] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState<DadosDoLead>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [ls, t] = await Promise.all([carregarLeads(), carregarTime()]);
      setLeads(ls);
      setTime(t);
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível carregar os leads.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const nomeDoMembro = useCallback(
    (id: string | null) => (id ? time.find((m) => m.user_id === id)?.email || '—' : '—'),
    [time]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return leads;
    return leads.filter((l) =>
      [l.name, l.email, l.phone].some((c) => (c || '').toLowerCase().includes(termo))
    );
  }, [leads, busca]);

  const abrirNovo = () => {
    setForm(VAZIO);
    setEditandoId(null);
  };

  const abrirEdicao = (lead: Lead) => {
    setForm({ name: lead.name, email: lead.email, phone: lead.phone, notes: lead.notes });
    setEditandoId(lead.id);
  };

  const salvar = async () => {
    if (!form.name.trim()) return;
    setSalvando(true);
    try {
      if (editandoId) {
        await editarLead(editandoId, form);
        setLeads((atual) =>
          atual.map((l) => (l.id === editandoId ? { ...l, ...form, name: form.name.trim() } : l))
        );
      } else {
        const novo = await criarLead({ ...form, name: form.name.trim() });
        setLeads((atual) => [novo, ...atual]);
      }
      setEditandoId(undefined);
    } catch (err: any) {
      message.error(err?.message || 'Não foi possível salvar o lead.');
    } finally {
      setSalvando(false);
    }
  };

  if (erro) return <p className={styles.avisoErro}>{erro}</p>;

  return (
    <div className={styles.quadroWrap}>
      <div className={styles.barraLeads}>
        <Input.Search
          allowClear
          placeholder='Buscar por nome, e-mail ou telefone'
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          style={{ maxWidth: 340 }}
        />
        <Button type='primary' icon={<FiPlus />} onClick={abrirNovo}>
          Novo lead
        </Button>
      </div>

      <Table
        rowKey='id'
        loading={carregando}
        dataSource={filtrados}
        size='middle'
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: busca ? 'Nenhum lead para esta busca.' : 'Nenhum lead cadastrado ainda.' }}
        columns={[
          { title: 'Nome', dataIndex: 'name', key: 'name' },
          { title: 'E-mail', dataIndex: 'email', key: 'email', render: (v) => v || '—' },
          { title: 'Telefone', dataIndex: 'phone', key: 'phone', render: (v) => v || '—' },
          {
            title: 'Descrição',
            dataIndex: 'notes',
            key: 'notes',
            ellipsis: true,
            render: (v) => v || '—',
          },
          {
            title: 'Criado por',
            dataIndex: 'created_by',
            key: 'created_by',
            render: (v: string | null) => nomeDoMembro(v),
          },
          {
            title: '',
            key: 'acoes',
            width: 190,
            render: (_: unknown, lead: Lead) => (
              <span className={styles.acoesDaLinha}>
                <Button size='small' onClick={() => abrirEdicao(lead)}>
                  Editar
                </Button>
                {onCriarNegocio && (
                  <Button size='small' type='link' onClick={() => onCriarNegocio(lead)}>
                    Criar negócio
                  </Button>
                )}
              </span>
            ),
          },
        ]}
      />

      <Modal
        open={editandoId !== undefined}
        title={editandoId ? 'Editar lead' : 'Novo lead'}
        onCancel={() => setEditandoId(undefined)}
        onOk={salvar}
        confirmLoading={salvando}
        okText='Salvar'
        cancelText='Cancelar'
        okButtonProps={{ disabled: !form.name.trim() }}
      >
        <div className={styles.formNovo}>
          <label>
            Nome
            <Input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder='Nome do contato ou da empresa'
            />
          </label>
          <label>
            E-mail
            <Input
              type='email'
              value={form.email || ''}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder='contato@empresa.com.br'
            />
          </label>
          <label>
            Telefone
            <Input
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder='(00) 00000-0000'
            />
          </label>
          <label>
            Descrição
            <Input.TextArea
              rows={3}
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder='Onde encontrou, o que conversaram, o que interessa a essa pessoa'
            />
          </label>
        </div>
      </Modal>
    </div>
  );
};

export default Leads;
