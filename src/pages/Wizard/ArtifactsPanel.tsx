import { FC, ReactNode, useEffect, useState } from 'react';
import { FiCheck, FiChevronDown, FiEdit3, FiX } from 'react-icons/fi';

import { STEP_LABELS, currentStepIndex } from './chat/script';
import { stripEmDash } from './clean';
import type { ArtistContent, ArtistIdentity } from '../../interfaces/maestra';

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
    case 0: { // Identidade: gênero e referências, tudo como linhas simples
      const refs = id.references || {};
      const pos = refs.posicionamento || {};
      const posItems = [pos.curto, pos.medio, pos.longo].flatMap(splitRefItems);
      const rows: [string, string][] = [];
      if (id.genre) rows.push(['Gênero', id.genre]);
      if (posItems.length) rows.push(['Posicionamento', posItems.join(', ')]);
      if (refs.artisticas) rows.push(['Artísticas', splitRefItems(refs.artisticas).join(', ')]);
      if (refs.comunicacao) rows.push(['Comunicação', splitRefItems(refs.comunicacao).join(', ')]);
      if (refs.gestao) rows.push(['Carreira', splitRefItems(refs.gestao).join(', ')]);
      return rows.length ? <Meta rows={rows} /> : null;
    }
    case 1: { // Visão: cidade/UF (perguntadas nesta etapa, ver script STEP 1) + o texto da visão
      const rows: [string, string][] = [];
      if (id.city) rows.push(['Cidade', `${id.city}${id.state ? `/${id.state}` : ''}`]);
      return (
        <>
          {rows.length ? <Meta rows={rows} /> : null}
          {id.vision ? <p className='wiz-art-text'>{stripEmDash(id.vision)}</p> : null}
        </>
      );
    }
    case 2: // Missão
      return id.mission ? <p className='wiz-art-text'>{stripEmDash(id.mission)}</p> : null;
    case 3: // Valores
      return id.values?.length ? <div className='wiz-art-text'>{id.values.join(' · ')}</div> : null;
    case 4: // Objetivos
      return d.objectives?.length ? (
        <ol className='wiz-art-list'>
          {d.objectives.map((o, k) => (
            <li key={k}>{stripEmDash(o)}</li>
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
            <li key={s.id}>{stripEmDash(s.title)}</li>
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
              <li key={s.id}>{stripEmDash(s.title)}</li>
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

// Etapas com edição inline pelo painel (as demais — objetivos, SWOT, estratégias, prioridades —
// são derivadas pelos motores da metodologia e só mudam refazendo a etapa no chat).
const EDITABLE_STEPS = new Set([0, 1, 2, 3]);

// Formulário compacto de edição de uma seção. Monta o patch de identity e entrega ao onSave.
const SectionEditor: FC<{
  i: number;
  draft: ArtistContent;
  onCancel: () => void;
  onSave: (patch: Partial<ArtistContent>) => Promise<void> | void;
}> = ({ i, draft, onCancel, onSave }) => {
  const id = draft.identity || {};
  const [genre, setGenre] = useState(id.genre || '');
  const [city, setCity] = useState(id.city || '');
  const [uf, setUf] = useState(id.state || '');
  const [text, setText] = useState(i === 1 ? id.vision || '' : i === 2 ? id.mission || '' : (id.values || []).join('\n'));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const identity: ArtistIdentity = { ...id };
    if (i === 0) {
      identity.genre = genre.trim();
    } else if (i === 1) {
      // Cidade/UF são coletadas na etapa de Visão (script, STEP 1), então é aqui que se editam.
      identity.vision = text.trim();
      identity.city = city.trim();
      identity.state = uf.trim().toUpperCase();
    } else if (i === 2) identity.mission = text.trim();
    else if (i === 3) identity.values = text.split('\n').map((v) => v.trim()).filter(Boolean);
    setSaving(true);
    try {
      await onSave({ identity });
      onCancel();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='wiz-art-edit'>
      {i === 0 ? (
        <>
          <label className='wiz-art-edit-label'>Gênero</label>
          <input className='wiz-art-edit-input' value={genre} onChange={(e) => setGenre(e.target.value)} />
        </>
      ) : (
        <>
          <textarea
            className='wiz-art-edit-area'
            rows={i === 3 ? 4 : 3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {i === 3 && <div className='wiz-art-edit-hint'>Um valor por linha.</div>}
          {/* Cidade/UF acompanham a Visão: é nessa etapa que o chat pergunta de onde o
              artista parte, e o alcance geográfico da visão usa esse dado. */}
          {i === 1 && (
            <div className='wiz-art-edit-row'>
              <div style={{ flex: 1 }}>
                <label className='wiz-art-edit-label'>Cidade</label>
                <input className='wiz-art-edit-input' value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div style={{ width: 56 }}>
                <label className='wiz-art-edit-label'>UF</label>
                <input className='wiz-art-edit-input' value={uf} maxLength={2} onChange={(e) => setUf(e.target.value.toUpperCase())} />
              </div>
            </div>
          )}
        </>
      )}
      <div className='wiz-art-edit-actions'>
        <button className='wiz-art-edit-save' disabled={saving} onClick={save}>
          <FiCheck size={12} /> {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button className='wiz-art-edit-cancel' disabled={saving} onClick={onCancel}>
          <FiX size={12} /> Cancelar
        </button>
      </div>
    </div>
  );
};

/**
 * A lista do plano acumulado, SEM moldura própria.
 *
 * Extraída do `ArtifactsPanel` porque agora tem dois donos com molduras diferentes: no desktop ela
 * é a parte de baixo da coluna de contexto (sem cabeçalho, sem botão de fechar), e no celular
 * continua sendo o corpo da folha de tela cheia. O conteúdo é o mesmo nos dois; só o entorno muda.
 *
 * Só existe UMA instância montada por vez (ver `useIsDesktop` no Wizard): o `SectionEditor` guarda
 * estado local de edição, e duas cópias montadas seriam dois editores divergentes gravando pelo
 * mesmo `onEdit`.
 */
export const PlanList: FC<{
  draft: ArtistContent;
  // Quando presente, habilita a edição inline dos entregáveis (lápis sutil por seção).
  onEdit?: (patch: Partial<ArtistContent>) => Promise<void> | void;
}> = ({ draft, onEdit }) => {
  const cur = currentStepIndex(draft);
  const [editing, setEditing] = useState<number | null>(null);
  // Aberto/fechado POR ESCOLHA do usuário. Sem entrada aqui, vale o padrão: a etapa atual aberta,
  // as concluídas fechadas — assim a coluna não vira uma pilha de nove cartões abertos.
  const [aberturaManual, setAberturaManual] = useState<Record<number, boolean>>({});

  // Ao concluir uma etapa, as escolhas manuais são descartadas: a recém-concluída fecha e a nova
  // abre, que é o comportamento pedido. Sem isto, uma etapa aberta à mão continuaria aberta para
  // sempre, e a coluna voltaria a crescer sozinha.
  useEffect(() => {
    setAberturaManual({});
  }, [cur]);

  const estaAberta = (i: number) => aberturaManual[i] ?? i === cur;
  const alternar = (i: number) => setAberturaManual((m) => ({ ...m, [i]: !estaAberta(i) }));
  // Só mostra o que já foi alcançado (etapas até a atual) — coluna "até aqui", sem o roteiro futuro.
  const visible = STEP_LABELS.map((label, i) => ({ label, i, art: artifactFor(i, draft) })).filter(
    (s) => s.i <= cur
  );
  const anyArtifact = visible.some((s) => s.art);

  return (
    <>
      {!anyArtifact && (
        <p className='wiz-art-empty'>Seus resultados aparecem aqui conforme você avança com a Nyta.</p>
      )}
      {visible.map(({ label, i, art }) => (
        <div key={label} className={`wiz-art-step${i === cur ? ' wiz-art-step--now' : ''}${i < cur ? ' wiz-art-step--done' : ''}${estaAberta(i) || editing === i ? ' is-open' : ''}`}>
          {/* O cabeçalho é uma LINHA com dois controles irmãos, não um botão só: o lápis não pode
              ficar dentro do botão que abre/fecha (botão dentro de botão é HTML inválido e o
              clique de um dispararia o outro). */}
          <div className='wiz-art-step-name'>
            <button
              type='button'
              className='wiz-art-toggle'
              onClick={() => alternar(i)}
              aria-expanded={estaAberta(i) || editing === i}
              title={estaAberta(i) ? `Recolher ${label.toLowerCase()}` : `Expandir ${label.toLowerCase()}`}
            >
              {/* Número como elemento próprio: vira o selo redondo da etapa. Como texto solto
                  ("1.") ele se perdia junto do rótulo. Concluída troca o número por um check — o
                  progresso fica legível de relance. */}
              <i className='wiz-art-num' aria-hidden>{i < cur ? <FiCheck size={13} /> : i + 1}</i>
              <span className='wiz-art-label'>{label}</span>
              {i === cur && <span className='wiz-art-now'>agora</span>}
              <FiChevronDown className='wiz-art-chevron' size={15} aria-hidden />
            </button>
            {onEdit && EDITABLE_STEPS.has(i) && !!art && editing !== i && (
              <button
                className='wiz-art-pencil'
                onClick={() => setEditing(i)}
                title={`Editar ${label.toLowerCase()}`}
                aria-label={`Editar ${label.toLowerCase()}`}
              >
                <FiEdit3 size={12} />
              </button>
            )}
          </div>
          {!(estaAberta(i) || editing === i) ? null : editing === i && onEdit ? (
            <div className='wiz-art-step-body'>
              <SectionEditor i={i} draft={draft} onCancel={() => setEditing(null)} onSave={onEdit} />
            </div>
          ) : (
            /* Sem vídeo aqui: ele é de PERGUNTA, não de etapa — reforça um momento específico da
               conversa, e por isso vive lá, no fio do diálogo. Nesta coluna ele só repetia o mesmo
               player em cada cartão, sem relação com o que estava sendo perguntado. */
            art && <div className='wiz-art-step-body'>{art}</div>
          )}
        </div>
      ))}
    </>
  );
};

/**
 * Folha de tela cheia com o plano acumulado — hoje só no celular, aberta pela barra da etapa.
 * No desktop o plano é coluna fixa, e a `PlanList` é usada direto, sem esta moldura.
 */
export const ArtifactsPanel: FC<{
  draft: ArtistContent;
  onClose: () => void;
  onEdit?: (patch: Partial<ArtistContent>) => Promise<void> | void;
}> = ({ draft, onClose, onEdit }) => {
  const cur = currentStepIndex(draft);

  return (
    <aside className='wiz-artifacts' role='dialog' aria-modal='true' aria-label='Seu plano'>
      <div className='wiz-artifacts-head'>
        <div className='wiz-artifacts-title'>
          Etapa {cur + 1} de {STEP_LABELS.length} · {STEP_LABELS[cur]}
        </div>
        {/* 18px = mesmo tamanho dos ícones do cabeçalho do wizard. */}
        <button className='wiz-artifacts-close' onClick={onClose} title='Fechar' aria-label='Fechar'>
          <FiX size={18} />
        </button>
      </div>

      <div className='wiz-artifacts-body'>
        <PlanList draft={draft} onEdit={onEdit} />
      </div>
    </aside>
  );
};

export default ArtifactsPanel;
