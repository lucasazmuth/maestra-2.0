import { FC, useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Input, Table, Tag, Tooltip, message, type TableColumnsType } from 'antd';
import { FiAlertTriangle, FiMail, FiSearch, FiBell } from 'react-icons/fi';
import dayjs from 'dayjs';

import { supabase } from '../../lib/supabase';
import { Spinner } from '../../components/spinner/spinner';

// CRM interno: onde cada pessoa parou no funil de ativação, e o que já foi disparado para ela.
//
// A etapa é DERIVADA do estado atual (tem perfil? desbloqueou? concluiu o planejamento?) — não
// existe coluna de etapa em lugar nenhum, e é assim que o `activation-nudges` também decide quem
// recebe o quê. As duas precisam concordar: se divergirem, esta tela mostra uma etapa e o e-mail
// dispara por outra.
//
// O catálogo de automações vem da PRÓPRIA função do funil (action: 'spec'), e não de uma cópia
// aqui — senão, no dia em que alguém ajustar um prazo ou uma frase, a tela seguiria mostrando a
// versão antiga. Justamente a divergência que ela deveria denunciar.

type Etapa = 'A' | 'B' | 'C' | 'D';

interface EtapaFunil {
  id: Etapa;
  nome: string;
  descricao: string;
  aqui: number;
  chegaram: number;
  conversao: number | null;
}

interface Lead {
  id: string;
  email: string;
  nome: string | null;
  criadoEm: string;
  etapa: Etapa;
  perfil: string | null;
  diasNaEtapa: number | null;
  ultimoAcesso: string | null;
  diasSemAcessar: number | null;
  perfis: number;
  usouNyta: boolean;
  perfisPagos: number;
  totalPago: number;
  assinatura: string | null;
  provedor: string;
  veioDeConvite: boolean;
  aceitaComunicacoes: boolean;
  nudgesRecebidos: string[];
}

interface Automacao {
  etapa: string;
  code: string;
  apos: number;
  canais: string[];
  titulo: string;
  mensagem: string;
  assunto: string;
  corpo: string;
  botao: string;
  destino: string;
}

const COR_ETAPA: Record<Etapa, string> = { A: 'default', B: 'orange', C: 'blue', D: 'green' };

const fmtBRL = (v: number) =>
  v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : '—';
const fmtDia = (iso?: string | null) => (iso ? dayjs(iso).format('DD/MM/YY') : '—');

const Crm: FC = () => {
  const [funil, setFunil] = useState<EtapaFunil[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [automacoes, setAutomacoes] = useState<Automacao[]>([]);
  const [semOptIn, setSemOptIn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [etapaAtiva, setEtapaAtiva] = useState<Etapa | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [visao, spec] = await Promise.all([
      supabase.functions.invoke('admin-crm', { body: { action: 'overview' } }),
      supabase.functions.invoke('activation-nudges', { body: { action: 'spec' } }),
    ]);
    if (visao.error) message.error('Não foi possível carregar o funil.');
    setFunil(visao.data?.funil || []);
    setLeads(visao.data?.leads || []);
    setSemOptIn(visao.data?.semOptInRecebendoNudge || 0);
    // O catálogo é acessório: sem ele a tela ainda serve para acompanhar os leads.
    setAutomacoes(spec.data?.automacoes || []);
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (etapaAtiva && l.etapa !== etapaAtiva) return false;
      if (!q) return true;
      return l.email.toLowerCase().includes(q) || (l.nome || '').toLowerCase().includes(q);
    });
  }, [leads, query, etapaAtiva]);

  const colunas: TableColumnsType<Lead> = [
    {
      title: 'Lead',
      key: 'lead',
      render: (_, l) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ color: '#2c3f63', fontWeight: 600 }}>{l.nome || l.email.split('@')[0]}</span>
          <span style={{ color: '#7c8da8', fontSize: 12 }}>{l.email}</span>
        </div>
      ),
    },
    {
      title: 'Etapa',
      key: 'etapa',
      width: 150,
      sorter: (a, b) => a.etapa.localeCompare(b.etapa),
      render: (_, l) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Tag color={COR_ETAPA[l.etapa]}>{l.etapa} · {funil.find((f) => f.id === l.etapa)?.nome || ''}</Tag>
          {l.perfil && <span style={{ color: '#7c8da8', fontSize: 11.5 }}>{l.perfil}</span>}
        </div>
      ),
    },
    {
      title: 'Parado há',
      dataIndex: 'diasNaEtapa',
      width: 100,
      sorter: (a, b) => (a.diasNaEtapa ?? 0) - (b.diasNaEtapa ?? 0),
      // Quem está em D não está "parado": concluiu. A coluna só faz sentido para quem travou.
      render: (d: number | null, l) =>
        l.etapa === 'D' ? <span style={{ color: '#2a9a59' }}>ativado</span>
          : <span style={{ color: (d ?? 0) >= 7 ? '#a4682f' : '#405985' }}>{d ?? '—'} d</span>,
    },
    {
      title: 'Engajamento',
      key: 'engajamento',
      width: 170,
      render: (_, l) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: '#405985' }}>
          <span>{l.perfis} perfil(is) · {l.usouNyta ? 'usou a Nyta' : 'sem Nyta'}</span>
          <span style={{ color: (l.diasSemAcessar ?? 0) >= 14 ? '#a4682f' : '#7c8da8' }}>
            {l.ultimoAcesso ? `último acesso há ${l.diasSemAcessar} d` : 'nunca acessou'}
          </span>
        </div>
      ),
    },
    {
      title: 'Financeiro',
      key: 'financeiro',
      width: 150,
      sorter: (a, b) => a.totalPago - b.totalPago,
      render: (_, l) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
          <span style={{ color: l.totalPago ? '#2c3f63' : '#7c8da8' }}>{fmtBRL(l.totalPago)}</span>
          {l.assinatura && <Tag color={l.assinatura === 'active' ? 'green' : 'default'}>{l.assinatura}</Tag>}
        </div>
      ),
    },
    {
      title: 'Origem',
      key: 'origem',
      width: 130,
      render: (_, l) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: '#405985' }}>
          <span>{l.provedor === 'google' ? 'Google' : 'E-mail'}</span>
          {l.veioDeConvite && <Tag color="purple">convidado</Tag>}
          <span style={{ color: '#7c8da8', fontSize: 11.5 }}>{fmtDia(l.criadoEm)}</span>
        </div>
      ),
    },
    {
      title: 'Automação',
      key: 'automacao',
      width: 160,
      render: (_, l) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {l.nudgesRecebidos.length
              ? l.nudgesRecebidos.map((c) => <Tag key={c} style={{ marginInlineEnd: 0 }}>{c}</Tag>)
              : <span style={{ color: '#7c8da8', fontSize: 12 }}>nenhum</span>}
          </div>
          {!l.aceitaComunicacoes && (
            <Tooltip title="Não optou por receber comunicações. Nudges de marketing não deveriam sair para esta pessoa.">
              <span style={{ color: '#a4682f', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <FiAlertTriangle size={12} /> sem opt-in
              </span>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <Spinner loading global>{null as any}</Spinner>;

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>CRM</h1>
      <p style={styles.sub}>
        Em que etapa cada pessoa parou e o que já foi disparado para ela. A etapa é calculada a
        partir do estado atual da conta — a mesma regra que o funil de ativação usa para decidir os
        envios.
      </p>

      {/* Funil */}
      <div style={styles.funil}>
        {funil.map((e) => {
          const ativo = etapaAtiva === e.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => setEtapaAtiva(ativo ? null : e.id)}
              style={{ ...styles.etapaCard, ...(ativo ? styles.etapaCardAtiva : {}) }}
            >
              <span style={styles.etapaNome}>{e.id} · {e.nome}</span>
              <span style={styles.etapaNumero}>{e.aqui}</span>
              <span style={styles.etapaLegenda}>
                {e.conversao !== null ? `${e.conversao}% da etapa anterior` : `${e.chegaram} chegaram`}
              </span>
              <span style={styles.etapaDescricao}>{e.descricao}</span>
            </button>
          );
        })}
      </div>

      {semOptIn > 0 && (
        <div style={styles.alerta}>
          <FiAlertTriangle size={15} />
          <span>
            <strong>{semOptIn}</strong> {semOptIn === 1 ? 'pessoa recebeu nudge' : 'pessoas receberam nudge'} sem
            ter optado por comunicações. O funil não checa o consentimento antes de enviar.
          </span>
        </div>
      )}

      {/* Leads */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 12px', flexWrap: 'wrap' }}>
        <Input
          prefix={<FiSearch style={{ color: '#7c8da8' }} />}
          placeholder="Buscar por nome ou e-mail"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          style={{ maxWidth: 320 }}
        />
        <span style={{ color: '#7c8da8', fontSize: 13 }}>
          {filtrados.length} de {leads.length} lead(s)
          {etapaAtiva && ` · filtrando a etapa ${etapaAtiva}`}
        </span>
      </div>

      <Table<Lead>
        rowKey="id"
        columns={colunas}
        dataSource={filtrados}
        size="small"
        pagination={{ pageSize: 25, showSizeChanger: false }}
      />

      {/* Automações */}
      <h2 style={{ ...styles.sectionHead, marginTop: 34 }}>Automações por etapa</h2>
      <p style={{ ...styles.sub, margin: '0 0 16px' }}>
        Lidas da própria função do funil, não de uma cópia — o que está aqui é o que dispara de
        verdade. Hoje cada nudge sai como notificação no app e e-mail; push não é enviado pelo
        funil.
      </p>

      <div style={styles.automacoes}>
        {(['A', 'B', 'C'] as const).map((et) => {
          const doGrupo = automacoes.filter((a) => a.etapa === et);
          if (!doGrupo.length) return null;
          const etapa = funil.find((f) => f.id === et);
          return (
            <div key={et} style={styles.grupoAutomacao}>
              <div style={styles.grupoTitulo}>
                {et} · {etapa?.nome} <span style={{ color: '#7c8da8', fontWeight: 400 }}>({etapa?.aqui ?? 0} agora)</span>
              </div>
              {doGrupo.map((a) => {
                const enviados = leads.filter((l) => l.nudgesRecebidos.includes(a.code)).length;
                return (
                  <div key={a.code} style={styles.automacao}>
                    <div style={styles.automacaoTopo}>
                      <Tag color="blue" style={{ marginInlineEnd: 0 }}>{a.code}</Tag>
                      <span style={{ color: '#405985', fontSize: 12.5 }}>após {a.apos} dias parado</span>
                      <span style={styles.canais}>
                        <FiBell size={12} /> in-app <FiMail size={12} /> e-mail
                      </span>
                      <span style={{ marginLeft: 'auto', color: '#7c8da8', fontSize: 12 }}>
                        {enviados} enviado(s)
                      </span>
                    </div>
                    <div style={styles.automacaoTitulo}>{a.titulo}</div>
                    <div style={styles.automacaoCorpo}>{a.mensagem}</div>
                    <div style={styles.automacaoRodape}>
                      Assunto do e-mail: <em>{a.assunto}</em> · Botão: “{a.botao}” → {a.destino}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {!automacoes.length && (
          <div style={{ color: '#7c8da8', fontSize: 13 }}>
            Catálogo indisponível — a função do funil precisa estar deployada com a ação “spec”.
          </div>
        )}
      </div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  page: { padding: 24, maxWidth: 1180 },
  title: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(24px, 3vw, 28px)', color: '#2c3f63', margin: '0 0 6px' },
  sub: { color: '#7c8da8', fontSize: 14, lineHeight: 1.5, margin: '0 0 22px', maxWidth: 720 },
  sectionHead: { color: '#2c3f63', fontSize: 15, fontWeight: 700, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #e8eef8' },

  funil: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 },
  etapaCard: { display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 16px', textAlign: 'left', background: '#ffffff', border: '1px solid #e3eaf3', borderRadius: 10, cursor: 'pointer', color: 'inherit' },
  etapaCardAtiva: { borderColor: '#3361ff', background: '#ffffff' },
  etapaNome: { color: '#405985', fontSize: 12, fontWeight: 700, letterSpacing: '.02em' },
  etapaNumero: { color: '#2c3f63', fontSize: 30, fontWeight: 800, lineHeight: 1.1 },
  etapaLegenda: { color: '#3361ff', fontSize: 12, fontWeight: 600 },
  etapaDescricao: { color: '#7c8da8', fontSize: 11.5, lineHeight: 1.45, marginTop: 2 },

  alerta: { display: 'flex', alignItems: 'center', gap: 9, marginTop: 14, padding: '11px 14px', background: '#fdf7ea', border: '1px solid #f0dcae', borderRadius: 9, color: '#8a6420', fontSize: 12.5, lineHeight: 1.5 },

  automacoes: { display: 'flex', flexDirection: 'column', gap: 20 },
  grupoAutomacao: { display: 'flex', flexDirection: 'column', gap: 9 },
  grupoTitulo: { color: '#2c3f63', fontSize: 13, fontWeight: 700 },
  automacao: { display: 'flex', flexDirection: 'column', gap: 6, padding: 13, background: '#ffffff', border: '1px solid #e3eaf3', borderRadius: 9 },
  automacaoTopo: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  canais: { display: 'inline-flex', alignItems: 'center', gap: 5, color: '#7c8da8', fontSize: 11.5 },
  automacaoTitulo: { color: '#2c3f63', fontSize: 13.5, fontWeight: 600 },
  automacaoCorpo: { color: '#405985', fontSize: 12.5, lineHeight: 1.5 },
  automacaoRodape: { color: '#7c8da8', fontSize: 11.5, lineHeight: 1.5, borderTop: '1px solid #e8eef8', paddingTop: 7 },
};

export default Crm;
