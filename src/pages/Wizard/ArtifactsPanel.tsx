import { FC, ReactNode } from 'react';
import { FiX } from 'react-icons/fi';

import { STEP_LABELS } from './chat/script';
import type { ArtistContent } from '../../interfaces/maestra';

// Coluna lateral de resultados do Planejamento Estratégico: lista limpa do que já foi produzido
// (visão, missão, valores, objetivos, SWOT, estratégias, cronograma) conforme a Nyta os gera —
// sem ícones nem cores, só texto, para o artista acompanhar sem rolar a conversa.

const splitRefItems = (s?: string): string[] =>
  (s || '').split(/[,;\n·]+/).map((x) => x.trim()).filter(Boolean);

// Linhas "rótulo · valor" (gênero, cidade, referências, cronograma).
const Meta: FC<{ rows: [string, string][] }> = ({ rows }) =>
  rows.length ? (
    <div className='wiz-art-meta'>
      {rows.map(([k, v]) => (
        <div key={k}>
          <span className='wiz-art-k'>{k}</span> {v}
        </div>
      ))}
    </div>
  ) : null;

// Conteúdo do artefato de cada etapa (ou null se ainda não foi gerado).
const artifactFor = (i: number, d: ArtistContent): ReactNode => {
  const id = d.identity || {};
  switch (i) {
    case 0: { // Identidade: gênero, cidade e referências, tudo como linhas simples
      const refs = id.references || {};
      const pos = refs.posicionamento || {};
      const posItems = [pos.curto, pos.medio, pos.longo].flatMap(splitRefItems);
      const rows: [string, string][] = [];
      if (id.genre) rows.push(['Gênero', id.genre]);
      if (id.city) rows.push(['Cidade', `${id.city}${id.state ? `/${id.state}` : ''}`]);
      if (posItems.length) rows.push(['Posicionamento', posItems.join(', ')]);
      if (refs.artisticas) rows.push(['Artísticas', splitRefItems(refs.artisticas).join(', ')]);
      if (refs.comunicacao) rows.push(['Comunicação', splitRefItems(refs.comunicacao).join(', ')]);
      if (refs.gestao) rows.push(['Carreira', splitRefItems(refs.gestao).join(', ')]);
      return rows.length ? <Meta rows={rows} /> : null;
    }
    case 1: // Visão
      return id.vision ? <p className='wiz-art-text'>{id.vision}</p> : null;
    case 2: // Missão
      return id.mission ? <p className='wiz-art-text'>{id.mission}</p> : null;
    case 3: // Valores
      return id.values?.length ? <div className='wiz-art-text'>{id.values.join(' · ')}</div> : null;
    case 4: // Objetivos
      return d.objectives?.length ? (
        <ol className='wiz-art-list'>
          {d.objectives.map((o, k) => (
            <li key={k}>{o}</li>
          ))}
        </ol>
      ) : null;
    case 5: { // Diagnóstico (SWOT) — contagens
      const s = d.swotAnalysis;
      if (!s) return null;
      const rows: [string, string][] = [];
      if (s.strengths?.length) rows.push(['Forças', String(s.strengths.length)]);
      if (s.weaknesses?.length) rows.push(['Fraquezas', String(s.weaknesses.length)]);
      if (s.opportunities?.length) rows.push(['Oportunidades', String(s.opportunities.length)]);
      if (s.threats?.length) rows.push(['Ameaças', String(s.threats.length)]);
      return rows.length ? <Meta rows={rows} /> : null;
    }
    case 6: // Estratégias
      return d.strategies?.length ? (
        <ol className='wiz-art-list'>
          {d.strategies.slice(0, 6).map((s) => (
            <li key={s.id}>{s.title}</li>
          ))}
          {d.strategies.length > 6 && <li className='wiz-art-muted'>+{d.strategies.length - 6}</li>}
        </ol>
      ) : null;
    case 7: { // Prioridades — top 3 + nº de estratégias que viraram plano de ação
      const ranked = (d.strategies || []).filter((s) => typeof s.finalScore === 'number');
      if (!ranked.length) return null;
      const top = ranked.slice().sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)).slice(0, 3);
      const withTasks = (d.strategies || []).filter((s) => (s.tasks?.length || 0) > 0).length;
      return (
        <>
          <ol className='wiz-art-list'>
            {top.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ol>
          {withTasks > 0 && <div className='wiz-art-muted'>{withTasks} no plano de ação</div>}
        </>
      );
    }
    case 8: // Seu plano
      return d.executiveSummary ? <div className='wiz-art-text'>Plano concluído</div> : null;
    default:
      return null;
  }
};

export const ArtifactsPanel: FC<{
  draft: ArtistContent;
  artistName: string;
  progress: number;
  onClose: () => void;
}> = ({ draft, artistName, progress, onClose }) => {
  const cur = Math.min(draft.step ?? 0, STEP_LABELS.length - 1);
  // Só mostra o que já foi alcançado (etapas até a atual) — coluna "até aqui", sem o roteiro futuro.
  const visible = STEP_LABELS.map((label, i) => ({ label, i, art: artifactFor(i, draft) })).filter(
    (s) => s.i <= cur
  );
  const anyArtifact = visible.some((s) => s.art);

  return (
    <aside className='wiz-artifacts'>
      <div className='wiz-artifacts-head'>
        <div>
          <div className='wiz-artifacts-title'>Seu plano até aqui</div>
          <div className='wiz-artifacts-sub'>{artistName} · {progress}% concluído</div>
        </div>
        <button className='wiz-artifacts-close' onClick={onClose} title='Fechar' aria-label='Fechar'>
          <FiX size={16} />
        </button>
      </div>

      <div className='wiz-artifacts-body'>
        {!anyArtifact && (
          <p className='wiz-art-empty'>Seus resultados aparecem aqui conforme você avança com a Nyta.</p>
        )}
        {visible.map(({ label, i, art }) => (
          <div key={label} className='wiz-art-step'>
            <div className='wiz-art-step-name'>
              {i + 1}. {label}
              {i === cur && <span className='wiz-art-now'> · agora</span>}
            </div>
            {art && <div className='wiz-art-step-body'>{art}</div>}
          </div>
        ))}
      </div>
    </aside>
  );
};

export default ArtifactsPanel;
