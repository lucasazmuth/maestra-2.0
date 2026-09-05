import { CSSProperties, FC, ReactNode, useEffect, useState } from 'react';
import { FiCheck, FiChevronDown, FiEdit3, FiLock, FiX } from 'react-icons/fi';

import { STEP_LABELS, currentStepIndex } from '@maestra/core/wizard/script';
import { stripEmDash } from '@maestra/core/wizard/limpar';
import {
  GENDER_OPTIONS,
  MISSION_FINANCIAL_OPTIONS,
  STAGE_OPTIONS,
  VISION_ONDE_OPTIONS,
} from '@maestra/core/wizard/dados';
import type { ArtistContent, ArtistIdentity } from '@maestra/core/interfaces/maestra';

// Coluna lateral de resultados do Planejamento Estratégico: lista limpa do que já foi produzido
// (visão, missão, valores, objetivos, SWOT, estratégias, cronograma) conforme a Nyta os gera —
// sem ícones nem cores, só texto, para o artista acompanhar sem rolar a conversa.

const splitRefItems = (s?: string): string[] =>
  (s || '').split(/[,;\n·]+/).map((x) => x.trim()).filter(Boolean);

// ---- Primitivas do corpo do cartão -------------------------------------------------------------
//
// Tudo que aparece dentro de um cartão de etapa é um CAMPO: micro-rótulo (a pergunta) + corpo (a
// resposta). Nada de conteúdo solto sem rótulo, e nenhuma margem definida caso a caso — o ritmo
// inteiro sai de `.wiz-art-fields` no SCSS. Ter uma primitiva só é o que mantém as nove etapas
// com a mesma respiração.

// Os campos são montados como ARRAY, não como filhos JSX, porque a decisão "esta etapa ainda não
// tem nada a mostrar" precisa ser tomada antes de existir elemento: um `<Fields>` vazio continuaria
// sendo um elemento truthy, e o cartão renderizaria um corpo em branco com a linha divisória.
const renderFields = (nodes: ReactNode[]): ReactNode => {
  const real = nodes.filter(Boolean);
  return real.length ? <div className='wiz-art-fields'>{real}</div> : null;
};

/**
 * Quais campos o painel sabe gravar.
 *
 * É deliberadamente curto. Todo o resto da árvore (pronome, momento de carreira, as partes da
 * fórmula da visão, as da missão, as referências) é resposta de uma pergunta específica da conversa
 * e alimenta os motores determinísticos: mudar só o texto aqui desincronizaria o plano — trocar o
 * "por quem" não regeraria as `recognitionTags`, trocar o substantivo não remontaria a frase da
 * visão. Esses se refazem voltando a pergunta no chat, e por isso não ganham lápis: um lápis que
 * não grava é pior do que nenhum.
 */
type EditKind = 'genre' | 'city' | 'vision' | 'mission' | 'values';

interface EditCtx {
  /** Sem `onEdit` (folha somente-leitura) nenhum lápis aparece. */
  enabled: boolean;
  active: EditKind | null;
  begin: (k: EditKind) => void;
  cancel: () => void;
  save: (patch: Partial<ArtistContent>) => Promise<void> | void;
  draft: ArtistContent;
}

const field = (label: string, body: ReactNode, edit?: { kind: EditKind; ctx: EditCtx }): ReactNode => {
  const canEdit = !!edit && edit.ctx.enabled;
  const editando = !!edit && edit.ctx.active === edit.kind;
  return (
    <div className='wiz-art-field' key={label}>
      {/* O lápis fica na linha do RÓTULO, ao lado do dado que ele edita — antes vivia no cabeçalho
          da etapa, onde prometia "editar identidade" mas o editor só mexia no estilo musical. */}
      <span className='wiz-art-field-head'>
        <span className='wiz-art-k'>{label}</span>
        {canEdit && !editando && (
          <button
            className='wiz-art-pencil'
            onClick={() => edit.ctx.begin(edit.kind)}
            title={`Editar ${label.toLowerCase()}`}
            aria-label={`Editar ${label.toLowerCase()}`}
          >
            <FiEdit3 size={11} />
          </button>
        )}
      </span>
      {editando ? <FieldEditor kind={edit.kind} ctx={edit.ctx} /> : body}
    </div>
  );
};

// Campo de texto: valor curto (pronome, cidade) ou frase montada (visão, missão, resumo).
const textField = (label: string, text?: string, edit?: { kind: EditKind; ctx: EditCtx }): ReactNode =>
  text ? field(label, <p className='wiz-art-v'>{stripEmDash(text)}</p>, edit) : null;

/**
 * Campo de lista.
 *
 * `kind` não é decoração: 'num' é para o que tem ordem real (objetivos, estratégias, ranking de
 * prioridade) e 'dot' para conjuntos sem ordem (quadrantes da SWOT, valores, referências) —
 * numerar um conjunto sem ordem sugeriria um ranking que não existe.
 */
const listField = (
  label: string,
  items: string[],
  kind: 'num' | 'dot',
  opts: {
    /** Cor do marcador (quadrantes da SWOT reusam a paleta do board da conversa). */
    dotColor?: string;
    /** Quantos itens cabem antes de resumir o resto num "+N". */
    cap?: number;
    /** Rodapé do campo (ex.: "8 no plano de ação"). */
    note?: string;
    /** Lápis no rótulo, quando a lista é gravável (só os valores, hoje). */
    edit?: { kind: EditKind; ctx: EditCtx };
  } = {}
): ReactNode => {
  if (!items.length) return null;
  const shown = opts.cap ? items.slice(0, opts.cap) : items;
  const rest = items.length - shown.length;
  return field(
    label,
    <>
      <ol
        className={`wiz-art-items wiz-art-items--${kind}`}
        style={opts.dotColor ? ({ '--wz-dot': opts.dotColor } as CSSProperties) : undefined}
      >
        {shown.map((it, k) => (
          <li key={k}>{stripEmDash(it)}</li>
        ))}
      </ol>
      {rest > 0 && <div className='wiz-art-more'>+{rest}</div>}
      {opts.note && <div className='wiz-art-more'>{opts.note}</div>}
    </>,
    opts.edit
  );
};

// Quadrantes da SWOT na mesma ordem e cor do board da conversa (widgets.tsx), para a coluna e o
// board não parecerem duas leituras diferentes do mesmo diagnóstico.
const SWOT_FIELDS: { key: 'strengths' | 'weaknesses' | 'opportunities' | 'threats'; label: string; color: string }[] = [
  { key: 'strengths', label: 'Forças', color: 'var(--wz-blue, #3361ff)' },
  { key: 'weaknesses', label: 'Fraquezas', color: 'var(--wz-danger, #e5484d)' },
  { key: 'opportunities', label: 'Oportunidades', color: '#29cc39' },
  { key: 'threats', label: 'Ameaças', color: 'var(--wz-warn, #f5a623)' },
];

// Corta um markdown curto pra caber num cartão: tira marcação básica e para na 1ª quebra dupla
// ou num limite de caracteres, sempre no fim de uma palavra.
const previewFrom = (md: string, max = 220): string => {
  const plain = md.replace(/^#+\s*/gm, '').replace(/[*_`]/g, '').trim();
  const firstBlock = plain.split(/\n\s*\n/)[0] || plain;
  if (firstBlock.length <= max) return firstBlock;
  return `${firstBlock.slice(0, max).replace(/\s+\S*$/, '')}…`;
};

// Conteúdo do artefato de cada etapa (ou null se ainda não foi gerado). Espelha, campo a campo,
// tudo que `chat/script.ts` pergunta naquela etapa — nenhum input fica de fora do cartão.
const artifactFor = (i: number, d: ArtistContent, ctx: EditCtx): ReactNode => {
  const id = d.identity || {};
  switch (i) {
    case 0: { // Identidade — abertura + mapa de referências (script STEP 0)
      const refs = id.references || {};
      const pos = refs.posicionamento || {};
      const posItems = [pos.curto, pos.medio, pos.longo].flatMap(splitRefItems);
      return renderFields([
        textField('Pronome', GENDER_OPTIONS.find((o) => o.value === id.gender)?.label || id.gender),
        textField('Estilo musical', id.genre, { kind: 'genre', ctx }),
        textField('Momento de carreira', STAGE_OPTIONS.find((o) => o.value === id.stage)?.label || id.stage),
        listField('Referências artísticas', splitRefItems(refs.artisticas), 'dot'),
        listField('Referências de comunicação', splitRefItems(refs.comunicacao), 'dot'),
        listField('Referências de gestão', splitRefItems(refs.gestao), 'dot'),
        listField('Referências de posicionamento', posItems, 'dot'),
      ]);
    }
    case 1: { // Visão — cidade + as 5 partes da fórmula (script STEP 1) + o texto montado
      const vp = id.visionParts || {};
      return renderFields([
        textField('Cidade de origem', id.city ? `${id.city}${id.state ? `/${id.state}` : ''}` : undefined, { kind: 'city', ctx }),
        textField('Alcance geográfico', VISION_ONDE_OPTIONS.find((o) => o.value === vp.onde)?.label || vp.onde),
        listField('Reconhecido por', vp.porQuem || [], 'dot'),
        textField('Como o quê', vp.substantivo),
        textField('Atributo', vp.adjetivo),
        textField('O que falam de você', vp.oQueFalam),
        textField('Visão', id.vision, { kind: 'vision', ctx }),
      ]);
    }
    case 2: { // Missão — entrega + para quem + retorno financeiro (script STEP 2) + o texto montado
      const mp = id.missionParts || {};
      return renderFields([
        textField('O que a carreira entrega', mp.entrega),
        textField('Para quem', mp.paraQuem),
        textField(
          'Retorno financeiro esperado',
          MISSION_FINANCIAL_OPTIONS.find((o) => o.value === mp.financialTier)?.label || mp.financialTier
        ),
        textField('Missão', id.mission, { kind: 'mission', ctx }),
      ]);
    }
    case 3: // Valores
      return renderFields([listField('Valores escolhidos', id.values || [], 'dot', { edit: { kind: 'values', ctx } })]);
    case 4: // Objetivos (derivados da identidade/visão/missão — sem pergunta própria)
      return renderFields([listField('Objetivos definidos', d.objectives || [], 'num')]);
    case 5: { // Diagnóstico (SWOT) — o conteúdo de cada quadrante, não só a contagem
      const s = d.swotAnalysis;
      if (!s) return null;
      return renderFields(
        SWOT_FIELDS.map((q) => listField(q.label, s[q.key] || [], 'dot', { dotColor: q.color }))
      );
    }
    case 6: // Estratégias
      return renderFields([
        listField('Estratégias geradas', (d.strategies || []).map((s) => s.title), 'num', { cap: 6 }),
      ]);
    case 7: { // Prioridades — top 3 + nº de estratégias que viraram plano de ação
      const ranked = (d.strategies || []).filter((s) => typeof s.finalScore === 'number');
      if (!ranked.length) return null;
      const top = ranked.slice().sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)).slice(0, 3);
      const withTasks = (d.strategies || []).filter((s) => (s.tasks?.length || 0) > 0).length;
      return renderFields([
        listField('No topo da prioridade', top.map((s) => s.title), 'num', {
          note: withTasks > 0 ? `${withTasks} no plano de ação` : undefined,
        }),
      ]);
    }
    case 8: // Seu plano — prévia do resumo executivo, não só "Plano concluído"
      return renderFields([
        textField('Resumo executivo', d.executiveSummary ? previewFrom(d.executiveSummary) : undefined),
      ]);
    default:
      return null;
  }
};

// Editor de UM campo. Cada tipo sabe só o que grava, então o lápis nunca abre um formulário
// maior do que o dado que ele estava oferecendo para editar.
const FieldEditor: FC<{ kind: EditKind; ctx: EditCtx }> = ({ kind, ctx }) => {
  const id = ctx.draft.identity || {};
  const inicial =
    kind === 'genre' ? id.genre || ''
    : kind === 'vision' ? id.vision || ''
    : kind === 'mission' ? id.mission || ''
    : kind === 'values' ? (id.values || []).join('\n')
    : id.city || '';
  const [text, setText] = useState(inicial);
  const [uf, setUf] = useState(id.state || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const identity: ArtistIdentity = { ...id };
    if (kind === 'genre') identity.genre = text.trim();
    else if (kind === 'vision') identity.vision = text.trim();
    else if (kind === 'mission') identity.mission = text.trim();
    else if (kind === 'values') identity.values = text.split('\n').map((v) => v.trim()).filter(Boolean);
    else {
      identity.city = text.trim();
      identity.state = uf.trim().toUpperCase();
    }
    setSaving(true);
    try {
      await ctx.save({ identity });
      ctx.cancel();
    } finally {
      setSaving(false);
    }
  };

  const multilinha = kind === 'vision' || kind === 'mission' || kind === 'values';

  return (
    <div className='wiz-art-edit'>
      {multilinha ? (
        <textarea
          className='wiz-art-edit-area'
          rows={kind === 'values' ? 4 : 3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      ) : kind === 'city' ? (
        // Cidade e UF são um dado só; separá-los em campos diferentes deixaria o lápis do estado
        // sem rótulo próprio na árvore.
        <div className='wiz-art-edit-row'>
          <div style={{ flex: 1 }}>
            <label className='wiz-art-edit-label'>Cidade</label>
            <input className='wiz-art-edit-input' value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </div>
          <div style={{ width: 56 }}>
            <label className='wiz-art-edit-label'>UF</label>
            <input className='wiz-art-edit-input' value={uf} maxLength={2} onChange={(e) => setUf(e.target.value.toUpperCase())} />
          </div>
        </div>
      ) : (
        <input className='wiz-art-edit-input' value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      )}
      {kind === 'values' && <div className='wiz-art-edit-hint'>Um valor por linha.</div>}
      <div className='wiz-art-edit-actions'>
        <button className='wiz-art-edit-save' disabled={saving} onClick={save}>
          <FiCheck size={12} /> {saving ? 'Salvando…' : 'Salvar'}
        </button>
        <button className='wiz-art-edit-cancel' disabled={saving} onClick={ctx.cancel}>
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
 * Só existe UMA instância montada por vez (ver `useIsDesktop` no Wizard): o `FieldEditor` guarda
 * estado local de edição, e duas cópias montadas seriam dois editores divergentes gravando pelo
 * mesmo `onEdit`.
 */
export const PlanList: FC<{
  draft: ArtistContent;
  // Quando presente, habilita a edição inline — lápis por CAMPO, nos poucos que o painel grava.
  onEdit?: (patch: Partial<ArtistContent>) => Promise<void> | void;
}> = ({ draft, onEdit }) => {
  const cur = currentStepIndex(draft);
  // Qual campo está em edição. Os tipos já são únicos entre as etapas, então um valor só basta —
  // e garante que nunca haja dois editores abertos gravando pelo mesmo `onEdit`.
  const [editing, setEditing] = useState<EditKind | null>(null);
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
  // As NOVE etapas, sempre. Antes a coluna só listava até a atual, então quem estava na etapa 2
  // não tinha como saber o que vinha depois nem quanto faltava. As que ainda não chegaram entram
  // bloqueadas: aparecem, dão o nome do que vem, e não prometem interação.
  const ctx: EditCtx = {
    enabled: !!onEdit,
    active: editing,
    begin: setEditing,
    cancel: () => setEditing(null),
    save: onEdit ?? (() => {}),
    draft,
  };
  const steps = STEP_LABELS.map((label, i) => ({ label, i, art: artifactFor(i, draft, ctx) }));
  const anyArtifact = steps.some((s) => s.i <= cur && s.art);

  return (
    <>
      {!anyArtifact && (
        <p className='wiz-art-empty'>Seus resultados aparecem aqui conforme você avança com a Nyta.</p>
      )}
      {steps.map(({ label, i, art }) =>
        i > cur ? (
          <div key={label} className='wiz-art-step wiz-art-step--locked'>
            <div className='wiz-art-step-name'>
              {/* `<span>`, não `<button>`: não há o que abrir aqui, e um botão que não faz nada é
                  pior do que nenhum — promete interação e não entrega. */}
              <span
                className='wiz-art-toggle wiz-art-toggle--static'
                title={`${label} — disponível depois das etapas anteriores`}
              >
                <i className='wiz-art-num' aria-hidden><FiLock size={11} /></i>
                <span className='wiz-art-label'>{label}</span>
              </span>
            </div>
          </div>
        ) : (
        <div key={label} className={`wiz-art-step${i === cur ? ' wiz-art-step--now' : ''}${i < cur ? ' wiz-art-step--done' : ''}${estaAberta(i) ? ' is-open' : ''}`}>
          {/* Só o botão de abrir/fechar. O lápis saiu daqui: no cabeçalho ele dizia "editar
              identidade" mas o editor por trás só gravava o estilo musical, enquanto o cartão
              mostrava sete campos. Agora cada lápis mora ao lado do dado que ele realmente grava. */}
          <div className='wiz-art-step-name'>
            <button
              type='button'
              className='wiz-art-toggle'
              onClick={() => alternar(i)}
              aria-expanded={estaAberta(i)}
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
          </div>
          {/* O editor não troca mais o corpo inteiro do cartão: ele abre DENTRO do campo, no lugar
              do valor, então o resto da etapa continua à vista enquanto se edita um dado só.
              Sem vídeo aqui: ele é de PERGUNTA, não de etapa — reforça um momento específico da
              conversa, e por isso vive lá, no fio do diálogo. */}
          {estaAberta(i) && art && <div className='wiz-art-step-body'>{art}</div>}
        </div>
        )
      )}
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
