import { FC, useState, type CSSProperties } from 'react';

import Crm from '../Crm';
import Kanban from './Kanban';
import Leads from './Leads';

// CRM de vendas da Maestra: onde o time de business development trabalha.
//
// Três coisas neste produto se chamam CRM, e vale deixar registrado qual é qual:
//   - o painel de ATIVAÇÃO (etapas A/B/C/D, nudges) é a aba "Inbound" aqui dentro;
//   - o CRM DO ARTISTA (tabelas `crm_*`) é outro produto, do módulo Marketing do perfil;
//   - este módulo, sobre as tabelas `sales_*`, é o funil de vendas da Maestra.

type Aba = 'negocios' | 'leads' | 'inbound';

const ABAS: { chave: Aba; rotulo: string; descricao: string }[] = [
  {
    chave: 'negocios',
    rotulo: 'Negócios',
    descricao: 'O funil que o time de vendas trabalha: cada cartão é uma negociação em andamento.',
  },
  {
    chave: 'leads',
    rotulo: 'Leads',
    descricao:
      'Gente prospectada de fora, que ainda não é usuária da Maestra. Daqui saem os negócios do funil.',
  },
  {
    chave: 'inbound',
    rotulo: 'Inbound',
    descricao: 'Quem chegou sozinho e parou no meio do caminho. É a matéria-prima da prospecção.',
  },
];

export const AdminSales: FC = () => {
  const [aba, setAba] = useState<Aba>('negocios');
  const atual = ABAS.find((a) => a.chave === aba)!;

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <h1 style={titulo}>CRM de vendas</h1>
      <p style={legenda}>{atual.descricao}</p>

      <div style={barraAbas} role='tablist' aria-label='Seções do CRM de vendas'>
        {ABAS.map((a) => (
          <button
            key={a.chave}
            type='button'
            role='tab'
            aria-selected={a.chave === aba}
            onClick={() => setAba(a.chave)}
            style={{ ...botaoAba, ...(a.chave === aba ? botaoAbaAtiva : null) }}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {/* A aba Inbound reaproveita a tela de ativação inteira, com a apuração que ela já faz.
          Reescrever aquilo aqui criaria duas contas do mesmo funil, que um dia divergiriam. */}
      {aba === 'negocios' && <Kanban />}
      {aba === 'leads' && <Leads />}
      {aba === 'inbound' && <Crm />}
    </div>
  );
};

const titulo: CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  fontSize: 'clamp(24px, 3vw, 28px)',
  color: '#2c3f63',
  margin: '0 0 6px',
};

const legenda: CSSProperties = {
  color: '#7c8da8',
  fontSize: 14,
  lineHeight: 1.5,
  margin: '0 0 18px',
  maxWidth: 720,
};

const barraAbas: CSSProperties = {
  display: 'flex',
  gap: 5,
  width: 'fit-content',
  marginBottom: 18,
  padding: 5,
  border: '1px solid #e3eaf3',
  borderRadius: 10,
  background: '#fff',
};

const botaoAba: CSSProperties = {
  border: 0,
  borderRadius: 7,
  padding: '9px 18px',
  background: 'transparent',
  color: '#7c8da8',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
};

const botaoAbaAtiva: CSSProperties = {
  background: '#eaf0ff',
  color: '#3361ff',
  boxShadow: 'inset 0 0 0 1px #d7e2ff',
};

export default AdminSales;
