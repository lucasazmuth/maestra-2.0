import { FC, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { App, DatePicker, Input, Select } from 'antd';
import dayjs from 'dayjs';
import { FiCheck, FiEdit3, FiPlus, FiRefreshCw, FiTrash2, FiX } from 'react-icons/fi';

import { listGenres } from '@maestra/core/services/db/genres';
import { searchCities } from '@maestra/core/services/db/cities';
import { TASK_OWNER_SELF, MAX_OBJECTIVES } from '@maestra/core/constants/maestra';
import { AiButton, disabledBtn, ghostBtn, primaryBtn } from '../components';
import { ReferenceMindMap } from '../../../components/ReferenceMindMap';
import { normalizeQuizQuestion } from '../types';
import {
  ADJETIVO_SEEDS,
  GENDER_OPTIONS,
  MISSION_FINANCIAL_OPTIONS,
  STAGE_OPTIONS,
  SUBSTANTIVO_OPTIONS,
  VISION_ONDE_OPTIONS,
  VISION_PORQUEM_OPTIONS,
  flex,
  seedValues,
} from '@maestra/core/wizard/dados';
import { SWOT_INTERNAL, type InternalClass } from '@maestra/core/wizard/swot';
import { generateObjectives } from '@maestra/core/wizard/motores';
import { stripEmDash } from '@maestra/core/wizard/limpar';
import type {
  ActionTask,
  ActionPlanSchedule,
  ArtistGender,
  ArtistIdentity,
  ArtistStage,
  MissionFinancialTier,
  MissionParts,
  QuizQuestion,
  ReferenceHorizons as ReferenceHorizonsData,
  SpotifyProfile,
  Strategy,
  SwotAnalysis,
} from '@maestra/core/interfaces/maestra';
import { scheduleBankFor, scheduleStrategy } from '@maestra/core/services/cronograma';

// Widgets interativos renderizados dentro do chat da Nyta. Cada um coleta uma resposta
// estruturada e devolve via callback — o orquestrador (NytaChat) ecoa a resposta como
// mensagem do usuário e persiste no draft.

const uid = () => Math.random().toString(36).slice(2, 10);

// O cronograma não é texto gerado pela IA: o card só coleta as âncoras e aplica o motor
// determinístico do núcleo. Assim o mesmo resultado pode ser reproduzido no aplicativo nativo.
export const ScheduleApprovalCard: FC<{
  strategies: Strategy[];
  schedule: ActionPlanSchedule;
  texts: { aceite: string; apertadas: string; continua: string; ancora_mudou: string; caminho_apoio: string };
  onConfirm: (schedule: ActionPlanSchedule, strategies: Strategy[]) => void;
}> = ({ strategies, schedule: initial, texts, onConfirm }) => {
  const today = dayjs().format('YYYY-MM-DD');
  const [schedule, setSchedule] = useState<ActionPlanSchedule>(initial);
  const [activeIndex, setActiveIndex] = useState(0);
  const [view, setView] = useState<'timeline' | 'list'>('timeline');
  const [editorOpen, setEditorOpen] = useState(false);
  const calculated = useMemo(() => strategies.map((strategy) => scheduleStrategy(strategy, schedule, today)), [strategies, schedule, today]);
  const update = (patch: Partial<ActionPlanSchedule>) => setSchedule((current) => ({ ...current, ...patch,
    strategies: Object.fromEntries(Object.entries(current.strategies).map(([id, state]) => {
      const source = strategies.find(strategy => strategy.id === id);
      const anchor = source ? scheduleBankFor(source)?.ancora : undefined;
      const affected = (patch.releaseDate !== undefined && anchor === 'lancamento') || (patch.startDate !== undefined && anchor === 'inicio');
      return [id, affected ? { ...state, accepted: false, manualDates: {}, adjusted: false } : state];
    })),
  }));
  const updateState = (strategyId: string, patch: Record<string, unknown>) => setSchedule((current) => ({
    ...current,
    strategies: { ...current.strategies, [strategyId]: { ...current.strategies[strategyId], ...patch } },
  }));
  const moveTask = (strategyId: string, order: number, date?: string) => {
    if (!date) return;
    const previous = schedule.strategies[strategyId]?.manualDates || {};
    updateState(strategyId, { manualDates: { ...previous, [order]: date }, adjusted: true, accepted: false });
  };
  const accepted = calculated.every((strategy) => schedule.strategies[strategy.id]?.accepted);
  const gantt = useMemo(() => {
    const dates = (calculated[activeIndex]?.tasks || []).map(task => task.deadline).filter(Boolean) as string[];
    if (!dates.length) dates.push(today);
    const ordered = dates.map((date) => dayjs(date)).sort((a, b) => a.valueOf() - b.valueOf());
    const start = ordered[0].startOf('month');
    const end = ordered[ordered.length - 1].endOf('month');
    const span = Math.max(1, end.diff(start, 'day'));
    const position = (date?: string) => date ? Math.max(0, Math.min(100, dayjs(date).diff(start, 'day') / span * 100)) : 0;
    const monthCount = Math.max(1, end.diff(start, 'month') + 1);
    return {
      start,
      end,
      position,
      months: Array.from({ length: monthCount }, (_, index) => start.add(index, 'month')),
      width: Math.max(620, monthCount * 150),
    };
  }, [calculated, activeIndex, today]);

  return (
    <div className='nyta-card schedule-studio'>
      <div className='wiz-card-title'>Seu cronograma</div>
      <details className='schedule-studio__dates'>
      <summary><span>Início {schedule.startDate ? dayjs(schedule.startDate).format('DD/MM/YYYY') : 'a definir'}</span><span>Lançamento {schedule.releaseDate ? dayjs(schedule.releaseDate).format('DD/MM/YYYY') : 'a definir'}</span><span>Editar datas</span></summary>
      <div className='schedule-studio__date-fields'>
        <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>Próximo lançamento (Dia D)
          <DatePicker allowClear={false} value={schedule.releaseDate ? dayjs(schedule.releaseDate) : null} onChange={(value) => update({ releaseDate: value?.format('YYYY-MM-DD') })} format='DD/MM/YYYY' />
        </label>
        <label style={{ display: 'grid', gap: 6, fontWeight: 700 }}>Início do plano
          <DatePicker allowClear={false} value={schedule.startDate ? dayjs(schedule.startDate) : null} onChange={(value) => update({ startDate: value?.format('YYYY-MM-DD') })} format='DD/MM/YYYY' />
        </label>
      </div>
      </details>
      <nav className='schedule-studio__progress' aria-label='Estratégias do cronograma'>
        <span>{calculated.filter(strategy => schedule.strategies[strategy.id]?.accepted).length} de {calculated.length} aprovadas</span>
        <span>Estratégia {activeIndex + 1} de {calculated.length}</span>
      </nav>
      <div style={{ display: 'grid', gap: 14 }}>
        {calculated.slice(activeIndex, activeIndex + 1).map((strategy) => {
          const definition = scheduleBankFor(strategy)!;
          const state = schedule.strategies[strategy.id] || {};
          const tight = strategy.tasks.filter((task) => task.schedule?.tight).length;
          const ready = !!definition && !!(definition.ancora === 'propria' ? state.ownDate : definition.ancora === 'inicio' ? schedule.startDate : schedule.releaseDate) && (!definition.caminho || !!state.path);
          return <section key={strategy.id} className='schedule-studio__strategy'>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
              <div><strong>{strategy.title}</strong><div style={{ color: '#71809e', fontSize: 13, marginTop: 4 }}>{definition.ancora === 'lancamento' ? 'Ancorada no lançamento' : definition.ancora === 'inicio' ? 'Ancorada no início do plano' : 'Ancorada em uma data própria'}</div></div>
              <span className='schedule-studio__status'>{state.accepted ? 'Aprovada' : `${strategy.tasks.length} tarefas`}</span>
            </div>
            {definition.pergunta_propria && <label style={{ display: 'grid', gap: 6, marginTop: 14, fontSize: 13, fontWeight: 700 }}>{definition.pergunta_propria}
              <DatePicker value={state.ownDate ? dayjs(state.ownDate) : null} onChange={(value) => updateState(strategy.id, { ownDate: value?.format('YYYY-MM-DD'), accepted: false, manualDates: {}, adjusted: false })} format='DD/MM/YYYY' />
            </label>}
            {definition.caminho && <label style={{ display: 'grid', gap: 6, marginTop: 14, fontSize: 13, fontWeight: 700 }}>Como você quer seguir?
              <Select value={state.path} placeholder='Escolha um caminho' options={definition.caminho.opcoes.map((option) => ({ value: option.rotulo, label: option.rotulo }))} onChange={(path) => updateState(strategy.id, { path, accepted: false, manualDates: {}, adjusted: false })} />
              <small style={{ color: '#71809e', fontWeight: 400 }}>{texts.caminho_apoio}</small>
            </label>}
            {ready && <div className='schedule-studio__overview'><div><span>Primeira tarefa</span><strong>{strategy.tasks.filter(task => task.deadline).map(task => task.deadline!).sort()[0] ? dayjs(strategy.tasks.filter(task => task.deadline).map(task => task.deadline!).sort()[0]).format('DD MMM') : 'A definir'}</strong></div><div className='schedule-studio__overview-line' aria-hidden='true'>{strategy.tasks.map((task, index) => task.deadline && <i key={index} style={{ left: `${gantt.position(task.deadline)}%` }} />)}</div><div><span>Último início</span><strong>{strategy.tasks.filter(task => task.deadline).map(task => task.deadline!).sort().at(-1) ? dayjs(strategy.tasks.filter(task => task.deadline).map(task => task.deadline!).sort().at(-1)).format('DD MMM') : 'A definir'}</strong></div></div>}
            <button type='button' className='schedule-studio__open-editor' onClick={() => setEditorOpen(true)}>Ver e ajustar cronograma <span>{strategy.tasks.length} tarefas</span></button>
            {editorOpen && createPortal(<div className='schedule-editor' role='dialog' aria-modal='true' aria-labelledby='scheduleEditorTitle'>
            <section className='schedule-editor__panel'>
            <header className='schedule-editor__header'><div><small>Estratégia {activeIndex + 1} de {calculated.length}</small><h2 id='scheduleEditorTitle'>{strategy.title}</h2><p>Confira quando cada tarefa começa. Clique em uma data para ajustar.</p></div><button type='button' onClick={() => setEditorOpen(false)} aria-label='Fechar cronograma' title='Fechar'><FiX size={20} /></button></header>
            <div className='schedule-editor__body'>
            <div className='schedule-studio__toolbar'><span>{strategy.tasks.length} tarefas · {definition.ancora === 'lancamento' ? 'Organizadas pelo lançamento' : definition.ancora === 'inicio' ? 'Organizadas pelo início do plano' : 'Organizadas pela data escolhida'}</span><div role='group' aria-label='Visualização'><button type='button' aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}>Gantt</button><button type='button' aria-pressed={view === 'list'} onClick={() => setView('list')}>Lista</button></div></div>
            {view === 'timeline' ? <div className='schedule-gantt' aria-label='Cronograma em Gantt'>
              <div className='schedule-gantt__content' style={{ width: 300 + gantt.width }}>
                <div className='schedule-gantt__corner'>Tarefas</div>
                <div className='schedule-gantt__months' style={{ width: gantt.width }}>{gantt.months.map(month => <span key={month.format('YYYY-MM')} style={{ width: gantt.width / gantt.months.length }}>{month.format('MMM YYYY')}</span>)}</div>
                {strategy.tasks.map((task, index) => <div className='schedule-gantt__row' key={task.id}>
                  <div className='schedule-gantt__task'><small>{String(index + 1).padStart(2, '0')}</small><span>{task.description}</span>{task.schedule?.continuous && <b>Semanal</b>}{task.schedule?.tight && <b className='is-tight'>Apertada</b>}</div>
                  <div className='schedule-gantt__timeline' style={{ width: gantt.width }}>
                    {gantt.months.map(month => <i key={month.format('YYYY-MM')} style={{ width: gantt.width / gantt.months.length }} />)}
                    {task.schedule?.continuous && <span className='schedule-gantt__recurrence' style={{ left: `${gantt.position(task.deadline)}%` }} />}
                    <DatePicker allowClear={false} inputReadOnly aria-label={`Início: ${task.description}`} className={`schedule-gantt__marker${task.schedule?.tight ? ' is-tight' : ''}`} value={task.deadline ? dayjs(task.deadline) : null} onChange={(value) => moveTask(strategy.id, task.schedule?.order || 0, value?.format('YYYY-MM-DD'))} format='DD MMM' style={{ left: `${gantt.position(task.deadline)}%` }} />
                  </div>
                </div>)}
              </div>
            </div> : <div className='schedule-list'>{strategy.tasks.map((task, index) => <label key={task.id}><span><small>{String(index + 1).padStart(2, '0')}</small>{task.description}</span><DatePicker allowClear={false} aria-label={`Início: ${task.description}`} size='small' value={task.deadline ? dayjs(task.deadline) : null} onChange={(value) => moveTask(strategy.id, task.schedule?.order || 0, value?.format('YYYY-MM-DD'))} format='DD/MM' /></label>)}</div>}
            <p className='schedule-studio__note'>{texts.aceite}</p>
            </div>
            <footer className='schedule-editor__footer'><span>{tight ? `${tight} tarefa${tight === 1 ? '' : 's'} apertada${tight === 1 ? '' : 's'}` : 'Datas prontas para aprovação'}</span><button type='button' onClick={() => setEditorOpen(false)}>Concluir revisão</button></footer>
            </section>
            </div>, document.body)}
            {tight > 0 && <p style={{ color: '#9a6400', margin: '12px 0 0', fontSize: 13 }}>{texts.apertadas.replace('{n}', String(tight))}</p>}
            <footer className='schedule-studio__footer'><button type='button' disabled={activeIndex === 0} onClick={() => setActiveIndex(value => value - 1)}>Anterior</button><button type='button' className='schedule-studio__approve' disabled={!ready} onClick={() => { updateState(strategy.id, { accepted: true }); if (activeIndex + 1 < calculated.length) setActiveIndex(value => value + 1); }}>{state.accepted ? 'Aprovada' : 'Aprovar estratégia'}{activeIndex + 1 < calculated.length ? ' e continuar' : ''}</button></footer>
          </section>;
        })}
      </div>
      {accepted && <button type='button' className='schedule-studio__save' onClick={() => onConfirm(schedule, calculated)}>Salvar cronograma na Agenda</button>}
    </div>
  );
};

// Revela listas longas (estratégias, SWOT, oportunidades/ameaças) item por item em vez de tudo de
// uma vez. Sem isso, um card com 20+ itens nasce já com a altura final, e o `ResizeObserver` do
// chat (NytaChat) — que rola pra baixo sozinho a cada crescimento do conteúdo — pula direto pro
// fim numa só tacada, escondendo o título e a explicação logo acima da lista. Fazendo o card
// crescer aos poucos, o mesmo auto-scroll acompanha em passos pequenos, e quem está lendo já viu
// o começo antes dele sair da tela.
//
// Revela só na primeira vez: uma vez que `total` já foi alcançado, mudanças posteriores (editar um
// chip do board da SWOT) aparecem na hora, sem re-tocar a animação da lista inteira.
const useStaggerReveal = (total: number, stepMs = 80): number => {
  const doneRef = useRef(false);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (doneRef.current) { setShown(total); return; }
    if (shown >= total) { doneRef.current = true; return; }
    const t = window.setTimeout(() => setShown((s) => Math.min(s + 1, total)), shown === 0 ? 260 : stepMs);
    return () => window.clearTimeout(t);
  }, [shown, total, stepMs]);
  return shown;
};

// ---- Gênero musical ----------------------------------------------------------------------------

export const GenreChips: FC<{
  sp?: SpotifyProfile;
  // Metodologia v2, Q2: gêneros (principal + secundários) vindos da Chartmetric. Vêm pré-selecionados.
  cmGenres?: string[];
  onConfirm: (genres: string[]) => void;
}> = ({ sp, cmGenres, onConfirm }) => {
  const [options, setOptions] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string[]>(() => cmGenres || []);

  useEffect(() => {
    listGenres()
      .then((g) => setOptions(g.map((x) => x.name)))
      .catch(() => setOptions([]));
  }, []);

  // Todos os gêneros visíveis como bolhas: os da Chartmetric e os do Spotify primeiro,
  // depois a lista curada (sem duplicar, case-insensitive).
  const allGenres = useMemo(() => {
    const map = new Map<string, string>();
    [...(cmGenres || []), ...(sp?.genres || []), ...(options || [])].forEach((g) => {
      if (g) map.set(g.toLowerCase(), g);
    });
    return Array.from(map.values());
  }, [options, sp?.genres, cmGenres]);

  const toggle = (g: string) =>
    setSelected((sel) => {
      const has = sel.some((x) => x.toLowerCase() === g.toLowerCase());
      return has ? sel.filter((x) => x.toLowerCase() !== g.toLowerCase()) : [...sel, g];
    });

  return (
    <div className='nyta-card'>
      <div className='wiz-card-title'>Seu estilo musical</div>
      {options === null ? (
        <p style={{ color: 'var(--wz-muted)', margin: 0, fontSize: 14 }}>Carregando gêneros…</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {allGenres.map((g, i) => {
            const active = selected.some((x) => x.toLowerCase() === g.toLowerCase());
            return (
              <button
                key={g}
                className={`wiz-genre-chip${active ? ' wiz-genre-chip--active' : ''}`}
                style={{ animationDelay: `${Math.min(i * 25, 600)}ms` }}
                onClick={() => toggle(g)}
              >
                {g}
              </button>
            );
          })}
        </div>
      )}
      <div className='nyta-card-actions'>
        {!!selected.length && (
          <span style={{ color: 'var(--wz-muted)', fontSize: 13, alignSelf: 'center' }}>
            {selected.length} selecionado{selected.length > 1 ? 's' : ''}
          </span>
        )}
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: selected.length ? 1 : 0.5 }}
          disabled={!selected.length}
          onClick={() => onConfirm(selected)}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
};

// ---- Escolha única (genérico) ------------------------------------------------------------------

// Lista de opções como pílulas; clicar confirma na hora (sem botão extra). Usado na abertura
// (gênero gramatical, estágio) e na Visão (onde). Opcionalmente um campo livre ("outro").
const SingleChoiceCard: FC<{
  options: { value: string; label: string }[];
  onConfirm: (value: string) => void;
  custom?: { placeholder: string };
  title?: string;
}> = ({ options, onConfirm, custom, title }) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  return (
    <div className='nyta-card'>
      {title && <div className='wiz-card-title'>{title}</div>}
      <div className='wiz-option-grid'>
        {options.map((o, i) => (
          <button
            key={o.value}
            className='wiz-option-pill wiz-option-pill--single'
            style={{ animationDelay: `${i * 50}ms` }}
            onClick={() => onConfirm(o.value)}
          >
            {o.label}
          </button>
        ))}
        {custom && (
          <button className='wiz-option-pill wiz-option-pill--custom' onClick={() => setOpen((v) => !v)}>
            <FiEdit3 size={14} /> Outro
          </button>
        )}
      </div>
      {custom && open && (
        <div className='wiz-custom-row'>
          <input
            className='wiz-custom-input'
            autoFocus
            value={text}
            placeholder={custom.placeholder}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) {
                e.preventDefault();
                onConfirm(text.trim());
              }
            }}
          />
          <button
            style={{ ...primaryBtn, padding: '8px 16px', opacity: text.trim() ? 1 : 0.5 }}
            disabled={!text.trim()}
            onClick={() => onConfirm(text.trim())}
          >
            Usar
          </button>
        </div>
      )}
    </div>
  );
};

export const GenderChoice: FC<{ onConfirm: (g: ArtistGender) => void }> = ({ onConfirm }) => (
  <SingleChoiceCard
    options={GENDER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
    onConfirm={(v) => onConfirm(v as ArtistGender)}
  />
);

export const StageChoice: FC<{ onConfirm: (s: ArtistStage) => void }> = ({ onConfirm }) => (
  <SingleChoiceCard
    options={STAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
    onConfirm={(v) => onConfirm(v as ArtistStage)}
    custom={{ placeholder: 'Descrever o meu momento…' }}
  />
);

// ---- Visão (fórmula por partes) ----------------------------------------------------------------

export const VisionOndeChoice: FC<{ onConfirm: (value: string) => void }> = ({ onConfirm }) => (
  <SingleChoiceCard
    title='Até onde você quer chegar'
    options={VISION_ONDE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
    onConfirm={onConfirm}
    custom={{ placeholder: 'Outro alcance…' }}
  />
);

// Q2 — múltipla escolha, teto 2 (+ campo livre). Devolve os rótulos escolhidos (etiquetas derivadas fora).
export const VisionPorQuemChoice: FC<{ onConfirm: (labels: string[]) => void }> = ({ onConfirm }) => {
  // O `message` estático do antd é no-op dentro do <App> (não renderiza). Pega a instância do
  // contexto pra o toast realmente aparecer — mesmo padrão do bloqueio de criar perfil.
  const { message: toast } = App.useApp();
  const [sel, setSel] = useState<string[]>([]);
  const MAX = 2;
  // Ao tentar passar de 2, mostra um toast. Checa FORA do updater (sem efeito colateral no reducer).
  // `key` fixa evita empilhar vários toasts iguais em cliques repetidos (atualiza o mesmo).
  const warnLimit = () => toast.warning({ content: 'Você pode escolher até 2 opções. Desmarque uma para trocar.', key: 'vision-porquem-max' });
  const toggle = (label: string) => {
    if (!sel.includes(label) && sel.length >= MAX) { warnLimit(); return; }
    setSel((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]));
  };
  const addOwn = (t: string) => {
    if (sel.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    if (sel.length >= MAX) { warnLimit(); return; }
    setSel((s) => [...s, t]);
  };
  const custom = sel.filter((s) => !VISION_PORQUEM_OPTIONS.some((o) => o.label === s));
  const atMax = sel.length >= MAX;
  return (
    <div className='nyta-card'>
      <div className='wiz-card-title'>Seus sinais de reconhecimento</div>
      <div style={{ color: 'var(--wz-muted)', fontSize: 12, marginBottom: 8 }}>Escolha até 2 opções (as que mais traduzem o que você sente).</div>
      <div className='wiz-option-grid'>
        {VISION_PORQUEM_OPTIONS.map((o, i) => {
          const active = sel.includes(o.label);
          return (
            <button
              key={o.label}
              className={`wiz-option-pill${active ? ' wiz-option-pill--selected' : ''}`}
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => toggle(o.label)}
            >
              {active && (
                <span className='wiz-option-check'>
                  <FiCheck size={14} />
                </span>
              )}
              {o.label}
            </button>
          );
        })}
        {custom.map((c) => (
          <button key={c} className='wiz-option-pill wiz-option-pill--selected' onClick={() => toggle(c)} title='Toque para remover'>
            <span className='wiz-option-check'>
              <FiCheck size={14} />
            </span>
            {c}
          </button>
        ))}
      </div>
      <AddOwnField placeholder='Escrever do meu jeito…' label='Escrever do meu jeito' onAdd={addOwn} />
      <div className='nyta-card-actions'>
        <span style={{ color: atMax ? 'var(--wz-warn)' : 'var(--wz-muted)', fontSize: 13, fontWeight: atMax ? 700 : 400, alignSelf: 'center' }}>{sel.length}/{MAX}</span>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: sel.length ? 1 : 0.5 }}
          disabled={!sel.length}
          onClick={() => onConfirm(sel)}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
};

// Campo "escrever o meu" COLAPSADO: por padrão mostra só um botão "+"; ao clicar, abre o input
// (autofocus). Some de volta após adicionar (ou se sair vazio). Evita o campo competir visualmente
// com as opções (usuário leigo achava que o campo era a ação principal). Usado em todos os widgets
// de escolha com opção de adicionar o próprio item.
const AddOwnField: FC<{ placeholder: string; label: string; onAdd: (value: string) => void }> = ({ placeholder, label, onAdd }) => {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');
  const commit = () => {
    const t = val.trim();
    if (t) onAdd(t);
    setVal('');
    setOpen(false);
  };
  if (!open) {
    return (
      <button
        type='button'
        onClick={() => setOpen(true)}
        style={{ ...ghostBtn, marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}
      >
        <FiPlus size={15} /> {label}
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
      <Input
        autoFocus
        placeholder={placeholder}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onPressEnter={commit}
        onBlur={() => { if (!val.trim()) setOpen(false); }}
      />
      <button style={{ ...ghostBtn, padding: '8px 14px' }} onClick={commit}>
        <FiPlus />
      </button>
    </div>
  );
};

// Múltipla escolha (chips) + campo livre. Junta os escolhidos numa string (ex.: "cantor e compositor").
const MultiChoiceCard: FC<{
  options: string[];
  placeholder: string;
  title?: string;
  joiner?: string;
  onConfirm: (joined: string) => void;
}> = ({ options, placeholder, title, joiner = ' e ', onConfirm }) => {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (o: string) => setSel((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]));
  const addOwn = (t: string) =>
    setSel((s) => (s.some((x) => x.toLowerCase() === t.toLowerCase()) ? s : [...s, t]));
  const custom = sel.filter((s) => !options.includes(s));
  return (
    <div className='nyta-card'>
      {title && <div className='wiz-card-title'>{title}</div>}
      <div className='wiz-option-grid'>
        {options.map((o, i) => {
          const active = sel.includes(o);
          return (
            <button
              key={o}
              className={`wiz-option-pill${active ? ' wiz-option-pill--selected' : ''}`}
              style={{ animationDelay: `${i * 40}ms` }}
              onClick={() => toggle(o)}
            >
              {active && (
                <span className='wiz-option-check'>
                  <FiCheck size={14} />
                </span>
              )}
              {o}
            </button>
          );
        })}
        {custom.map((c) => (
          <button key={c} className='wiz-option-pill wiz-option-pill--selected' onClick={() => toggle(c)} title='Toque para remover'>
            <span className='wiz-option-check'>
              <FiCheck size={14} />
            </span>
            {c}
          </button>
        ))}
      </div>
      <AddOwnField placeholder={placeholder} label='Escrever o meu' onAdd={addOwn} />
      <div className='nyta-card-actions'>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: sel.length ? 1 : 0.5 }}
          disabled={!sel.length}
          onClick={() => onConfirm(sel.join(joiner))}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
};

// Q3 — substantivo (múltipla escolha flexionada + campo livre).
export const VisionSubstantivoChoice: FC<{ gender?: ArtistGender; onConfirm: (value: string) => void }> = ({ gender, onConfirm }) => (
  <MultiChoiceCard title='Como você se define' options={SUBSTANTIVO_OPTIONS.map((s) => flex(gender, s))} placeholder='Como você se define…' onConfirm={onConfirm} />
);

// Q4 — atributo (múltipla escolha seedada + campo livre).
export const VisionAdjetivoChoice: FC<{ onConfirm: (value: string) => void }> = ({ onConfirm }) => (
  <MultiChoiceCard title='Seu atributo' options={ADJETIVO_SEEDS} placeholder='Escreva o seu atributo…' onConfirm={onConfirm} />
);

// ---- Referências de posicionamento (3 horizontes — Metodologia v2, Q5) -------------------------

const HORIZON_FIELDS: { key: keyof ReferenceHorizonsData; label: string; question: string }[] = [
  { key: 'curto', label: 'Curto prazo · 1 ano', question: 'Daqui a 1 ano, com quais artistas você quer estar disputando espaço?' },
  { key: 'medio', label: 'Médio prazo · 3 anos', question: 'E em 3 anos, com quem você quer dividir palco e playlist?' },
  { key: 'longo', label: 'Longo prazo · +5 anos', question: 'Lá na frente, +5 anos: qual o tamanho do sonho? Com quem você quer estar lado a lado?' },
];

// Uma pergunta por vez (stepper): cada horizonte (curto/médio/longo) usa o MESMO formato dos outros
// seletores do wizard (MultiChoiceCard) — pills selecionáveis dos relacionados no Spotify + campo pra
// escrever o seu. Mantém o contrato {curto,medio,longo} (strings), montado no fim.
export const ReferenceHorizons: FC<{
  onConfirm: (h: ReferenceHorizonsData) => void;
}> = ({ onConfirm }) => {
  const [step, setStep] = useState(0);
  const [sel, setSel] = useState<Record<string, string[]>>({ curto: [], medio: [], longo: [] });
  const [own, setOwn] = useState('');

  const field = HORIZON_FIELDS[step];
  const chosen = sel[field.key] || [];
  const isLast = step === HORIZON_FIELDS.length - 1;
  // Removidas as sugestões do Spotify (vinham internacionais/irrelevantes p/ artista BR). Só o que
  // o artista digita — mostrado como pills removíveis.
  const customPills = chosen;

  const parseNames = (txt: string) => txt.split(',').map((x) => x.trim()).filter(Boolean);
  const toggle = (name: string) =>
    setSel((s) => {
      const cur = s[field.key] || [];
      return { ...s, [field.key]: cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name] };
    });
  const mergeOwn = (base: Record<string, string[]>) => {
    const ns = parseNames(own);
    if (!ns.length) return base;
    const cur = base[field.key] || [];
    const merged = [...cur];
    ns.forEach((p) => { if (!merged.some((x) => x.toLowerCase() === p.toLowerCase())) merged.push(p); });
    return { ...base, [field.key]: merged };
  };
  const addNames = (names: string[]) =>
    setSel((s) => {
      const cur = s[field.key] || [];
      const merged = [...cur];
      names.forEach((p) => { if (p && !merged.some((x) => x.toLowerCase() === p.toLowerCase())) merged.push(p); });
      return { ...s, [field.key]: merged };
    });
  // Sem botão "+": o campo é a única forma de adicionar. Enter adiciona o que está escrito; digitar
  // vírgula também (o trecho após a última vírgula continua no campo).
  const addOwn = () => { if (!own.trim()) return; addNames(parseNames(own)); setOwn(''); };
  const onInputChange = (raw: string) => {
    if (!raw.includes(',')) { setOwn(raw); return; }
    const parts = raw.split(',');
    const trailing = parts.pop() ?? '';
    addNames(parts.map((x) => x.trim()).filter(Boolean));
    setOwn(trailing);
  };
  // O que estiver digitado também conta ao avançar (sem precisar adicionar antes).
  const canNext = chosen.length > 0 || !!own.trim();
  const next = () => {
    if (!canNext) return;
    const s2 = mergeOwn(sel);
    if (own.trim()) { setSel(s2); setOwn(''); }
    if (isLast) onConfirm({ curto: s2.curto.join(', '), medio: s2.medio.join(', '), longo: s2.longo.join(', ') });
    else setStep((n) => n + 1);
  };

  return (
    <div className='nyta-card'>
      <div className='wiz-card-title'>Referências de posicionamento</div>
      {/* Progresso (3 horizontes) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {HORIZON_FIELDS.map((f, i) => (
          <div key={f.key} style={{ height: 4, flex: 1, borderRadius: 2, background: i <= step ? 'var(--wz-blue)' : 'var(--wz-line)', transition: 'background .25s' }} />
        ))}
      </div>

      <div style={{ color: 'var(--wz-muted)', fontSize: 12, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', marginBottom: 6 }}>
        Passo {step + 1} de {HORIZON_FIELDS.length} · {field.label}
      </div>
      <div style={{ color: 'var(--wz-ink)', fontSize: 16, fontWeight: 700, lineHeight: 1.4, marginBottom: 14 }}>{field.question}</div>

      {/* Só o campo de digitar. O artista escreve os nomes (vírgula separa vários); cada um vira uma
          pill removível. (Removidas as sugestões do Spotify — vinham internacionais/irrelevantes.) */}
      <div style={{ color: 'var(--wz-muted)', fontSize: 12, marginBottom: 8 }}>Digite um nome e tecle Enter para adicionar. Toque numa pill pra remover.</div>
      {customPills.length > 0 && (
        <div className='wiz-option-grid' style={{ marginBottom: 4 }}>
          {customPills.map((c) => (
            <button key={c} className='wiz-option-pill wiz-option-pill--selected' onClick={() => toggle(c)} title='Toque para remover'>
              <span className='wiz-option-check'><FiCheck size={14} /></span>
              {c}
            </button>
          ))}
        </div>
      )}
      <Input
        style={{ marginTop: 8 }}
        placeholder='Digite um nome e tecle Enter…'
        value={own}
        onChange={(e) => onInputChange(e.target.value)}
        onPressEnter={addOwn}
      />

      <div className='nyta-card-actions'>
        {step > 0 && (
          <button style={ghostBtn} onClick={() => setStep((n) => Math.max(0, n - 1))}>Voltar</button>
        )}
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: canNext ? 1 : 0.5 }}
          disabled={!canNext}
          onClick={next}
        >
          {isLast ? 'Concluir' : 'Próximo'}
        </button>
      </div>
    </div>
  );
};

// ---- Mapa de referências (mind-map — Metodologia v2, Q6/Q13) -----------------------------------
// A renderização vive em src/components/ReferenceMindMap (compartilhada com o Plano de Ação
// avançado); aqui só o card do chat com o título.

export const ReferenceMapCard: FC<{ references?: ArtistIdentity['references'] }> = ({ references }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ color: 'var(--wz-ink)', fontWeight: 800, fontSize: 13, marginBottom: 10 }}>Seu mapa de referências</div>
    <ReferenceMindMap references={references} />
  </div>
);

// ---- Cidade/UF + mapa de referências (Metodologia v2, Q6) --------------------------------------

// Dropdown de cidade (busca na tabela br_cities) com preenchimento automático da UF. Ao escolher,
// devolve cidade + UF. Tem fallback manual caso o local não esteja na base do IBGE.
const CitySelect: FC<{ onPick: (city: string, uf: string) => void }> = ({ onPick }) => {
  const [opts, setOpts] = useState<{ value: string; label: string; city: string; uf: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onSearch = (text: string) => {
    if (tRef.current) clearTimeout(tRef.current);
    if (text.trim().length < 2) {
      setOpts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    tRef.current = setTimeout(async () => {
      const cities = await searchCities(text);
      setOpts(
        cities.map((c) => ({ value: `${c.name}|${c.uf}`, label: `${c.name}, ${c.uf}`, city: c.name, uf: c.uf }))
      );
      setLoading(false);
    }, 300);
  };

  return (
    <Select
      showSearch
      size='large'
      filterOption={false}
      className='wiz-city-select'
      popupClassName='wiz-city-dropdown'
      placeholder='Digite sua cidade…'
      onSearch={onSearch}
      notFoundContent={loading ? 'Buscando…' : null}
      options={opts}
      style={{ width: '100%' }}
      onChange={(val) => {
        const o = opts.find((x) => x.value === val);
        if (o) onPick(o.city, o.uf);
      }}
    />
  );
};

// Card de cidade/UF (Metodologia v2, Q6) — exibido SEPARADO do mapa de referências (o mapa é
// mostrado inline pela Nyta antes desta pergunta). Dropdown com auto-UF + fallback manual.
export const CityInputCard: FC<{
  onConfirm: (city: string, state: string) => void;
}> = ({ onConfirm }) => {
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [manual, setManual] = useState(false);
  return (
    <div className='nyta-card'>
      {manual ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input size='large' style={{ flex: 2, minWidth: 160 }} placeholder='Cidade' value={city} onChange={(e) => setCity(e.target.value)} />
          <Input size='large' style={{ flex: 1, minWidth: 70 }} placeholder='UF' maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} />
        </div>
      ) : (
        <CitySelect
          onPick={(c, u) => {
            setCity(c);
            setState(u);
          }}
        />
      )}
      <div className='nyta-card-actions' style={{ alignItems: 'center' }}>
        <button
          style={{ background: 'none', border: 'none', color: 'var(--wz-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}
          onClick={() => {
            setManual((m) => !m);
            setCity('');
            setState('');
          }}
        >
          {manual ? '← Buscar na lista' : 'Não achou? Preencher manualmente'}
        </button>
        <button
          style={{
            ...primaryBtn,
            marginLeft: 'auto',
            ...(city.trim()
              ? {}
              : disabledBtn),
          }}
          disabled={!city.trim()}
          onClick={() => city.trim() && onConfirm(city.trim(), state.trim())}
        >
          Continuar
        </button>
      </div>
    </div>
  );
};

// ---- Missão: tier financeiro (Metodologia v2, Q12) ---------------------------------------------

export const MissionFinancialChoice: FC<{ onConfirm: (tier: MissionFinancialTier) => void }> = ({ onConfirm }) => (
  <div className='nyta-card'>
    <div className='wiz-card-title'>O retorno que você quer</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {MISSION_FINANCIAL_OPTIONS.map((o, i) => (
        <button
          key={o.value}
          className='wiz-option-pill wiz-option-pill--single'
          style={{ textAlign: 'left', animationDelay: `${i * 50}ms` }}
          onClick={() => onConfirm(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

// ---- Revisão de frase montada (visão / missão) -------------------------------------------------

const ReviewCard: FC<{ title: string; text: string; onConfirm: (text: string) => void }> = ({ title, text, onConfirm }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  useEffect(() => setVal(text), [text]);
  return (
    <div className='nyta-card'>
      <div style={{ color: 'var(--wz-muted)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        {title}
      </div>
      {editing ? (
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
      ) : (
        <p style={{ color: 'var(--wz-ink)', fontSize: 15, lineHeight: 1.6, margin: 0, fontWeight: 600 }}>{val}</p>
      )}
      <div className='nyta-card-actions'>
        <button style={ghostBtn} onClick={() => setEditing((e) => !e)}>
          {editing ? 'Pronto' : 'Quero ajustar'}
        </button>
        <button style={{ ...primaryBtn, marginLeft: 'auto', opacity: val.trim() ? 1 : 0.5 }} disabled={!val.trim()} onClick={() => onConfirm(val.trim())}>
          Faz sentido, seguir
        </button>
      </div>
    </div>
  );
};

export const VisionReviewCard: FC<{ text: string; onConfirm: (text: string) => void }> = (p) => (
  <ReviewCard title='Sua visão' {...p} />
);
export const MissionReviewCard: FC<{ text: string; onConfirm: (text: string) => void }> = (p) => (
  <ReviewCard title='Sua missão' {...p} />
);

// ---- Visão / Missão com sugestão da IA ---------------------------------------------------------

// "Sugerir com IA" não gera direto: dispara a mini-entrevista da Nyta (perguntas guiadas);
// a IA compõe a versão final a partir das respostas do usuário.
export const TextPromptHelper: FC<{
  onStart: () => void;
}> = ({ onStart }) => (
  <div>
    <AiButton small onClick={onStart}>
      Me ajuda a responder
    </AiButton>
    <p style={{ color: 'var(--wz-faint)', fontSize: 12, margin: '8px 0 0' }}>
      A Nyta te faz umas perguntas e monta a resposta. Ou escreva do seu jeito no campo abaixo.
    </p>
  </div>
);

// Proposta composta pela IA ao fim da mini-entrevista: o resultado fica em destaque (editável),
// com um botão primário CLARO para seguir e a opção de refazer as perguntas.
export const ProposalPick: FC<{
  text: string;
  onUse: (text: string) => void;
  onRedo: () => void;
}> = ({ text, onUse, onRedo }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(text);
  useEffect(() => setVal(text), [text]);
  return (
    <div className='nyta-card'>
      {editing ? (
        <Input.TextArea autoSize={{ minRows: 2, maxRows: 6 }} value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
      ) : (
        <p style={{ color: 'var(--wz-ink)', fontSize: 15, lineHeight: 1.6, margin: 0, fontWeight: 600 }}>{val}</p>
      )}
      <div className='nyta-card-actions' style={{ flexWrap: 'wrap', gap: 8 }}>
        <button style={ghostBtn} onClick={onRedo}>
          <FiRefreshCw size={13} style={{ marginRight: 6 }} /> Refazer perguntas
        </button>
        <button style={ghostBtn} onClick={() => setEditing((e) => !e)}>
          {editing ? 'Pronto' : 'Quero ajustar'}
        </button>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: val.trim() ? 1 : 0.5 }}
          disabled={!val.trim()}
          onClick={() => onUse(val.trim())}
        >
          Faz sentido, seguir
        </button>
      </div>
    </div>
  );
};

// ---- Valores do projeto ------------------------------------------------------------------------

// Chips seedados a partir da entrega da missão (Metodologia v2) — não é lista fixa. Teto 3–5.
export const ValueChips: FC<{
  seed?: string[];
  onConfirm: (values: string[]) => void;
}> = ({ seed, onConfirm }) => {
  const { message: toast } = App.useApp(); // `message` estático é no-op dentro do <App>
  const [options, setOptions] = useState<string[]>(() => (seed?.length ? seed : seedValues()).slice(0, 12));
  const [selected, setSelected] = useState<string[]>([]);
  const MAX = 5;
  const MIN = 3;

  const limitMsg = `Você já selecionou ${MAX} valores. Remova um para escolher outro.`;
  const toggle = (v: string) =>
    setSelected((sel) => {
      if (sel.includes(v)) return sel.filter((x) => x !== v);
      if (sel.length >= MAX) {
        toast.warning(limitMsg);
        return sel;
      }
      return [...sel, v];
    });

  const addOwn = (t: string) => {
    setOptions((opts) =>
      opts.some((o) => o.toLowerCase() === t.toLowerCase()) ? opts : [...opts, t]
    );
    setSelected((sel) => {
      if (sel.some((s) => s.toLowerCase() === t.toLowerCase())) return sel;
      if (sel.length >= MAX) {
        toast.warning(limitMsg);
        return sel;
      }
      return [...sel, t];
    });
  };

  return (
    <div className='nyta-card'>
      <div className='wiz-card-title'>Seus valores</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {options.map((v, i) => {
          const active = selected.includes(v);
          return (
            <button
              key={v}
              className={`wiz-genre-chip${active ? ' wiz-genre-chip--active' : ''}`}
              style={{ animationDelay: `${Math.min(i * 30, 500)}ms` }}
              onClick={() => toggle(v)}
            >
              {v}
            </button>
          );
        })}
      </div>
      <AddOwnField placeholder='Escrever meu próprio valor…' label='Escrever meu valor' onAdd={addOwn} />
      <div className='nyta-card-actions'>
        <span style={{ color: 'var(--wz-muted)', fontSize: 13, alignSelf: 'center' }}>
          {selected.length}/{MAX}
          {selected.length < MIN && `, escolha ao menos ${MIN}`}
        </span>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: selected.length >= MIN ? 1 : 0.5 }}
          disabled={selected.length < MIN}
          onClick={() => onConfirm(selected)}
        >
          Confirmar valores
        </button>
      </div>
    </div>
  );
};

// ---- Objetivos (determinístico; cap 5, financeiro sem trava — Metodologia v2) -------------------

export const ObjectiveChips: FC<{
  identity: ArtistIdentity;
  missionParts: MissionParts;
  onConfirm: (objectives: string[]) => void;
}> = ({ identity, missionParts, onConfirm }) => {
  const { message: toast } = App.useApp(); // `message` estático é no-op dentro do <App>
  // Universo determinístico oferecido pela Nyta (Fontes 1–4, dedup). Sem IA, sem rede.
  const universe = useMemo(() => generateObjectives(identity, missionParts), [identity, missionParts]);
  const [options, setOptions] = useState<string[]>(universe);
  // Começa sem nada marcado: o artista escolhe ativamente os que vão pro plano (até MAX_OBJECTIVES).
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (o: string) =>
    setSelected((sel) => {
      if (sel.includes(o)) return sel.filter((x) => x !== o);
      if (sel.length >= MAX_OBJECTIVES) {
        toast.warning(`O limite é ${MAX_OBJECTIVES}, pra manter foco. Desmarque um pra trocar.`);
        return sel;
      }
      return [...sel, o];
    });

  const addOwn = (t: string) => {
    if (selected.length >= MAX_OBJECTIVES) {
      toast.warning(`O limite é ${MAX_OBJECTIVES}, pra manter foco. Qual desses você gostaria de trocar?`);
      return;
    }
    setOptions((s) => (s.some((x) => x.toLowerCase() === t.toLowerCase()) ? s : [...s, t]));
    setSelected((sel) => (sel.some((x) => x.toLowerCase() === t.toLowerCase()) ? sel : [...sel, t]));
  };

  return (
    <div className='nyta-card'>
      <div className='wiz-card-title'>Seus objetivos</div>
      <div className='wiz-option-grid'>
        {options.map((s, i) => {
          const active = selected.includes(s);
          return (
            <button
              key={s}
              className={`wiz-option-pill${active ? ' wiz-option-pill--selected' : ''}`}
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => toggle(s)}
            >
              {active && (
                <span className='wiz-option-check'>
                  <FiCheck size={14} />
                </span>
              )}
              {s}
            </button>
          );
        })}
      </div>
      <AddOwnField placeholder='Acrescentar um objetivo…' label='Acrescentar objetivo' onAdd={addOwn} />
      <div className='nyta-card-actions'>
        <span style={{ color: 'var(--wz-muted)', fontSize: 13, alignSelf: 'center' }}>
          {selected.length}/{MAX_OBJECTIVES}
        </span>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: selected.length ? 1 : 0.4 }}
          disabled={!selected.length}
          onClick={() => onConfirm(selected)}
        >
          Confirmar objetivos
        </button>
      </div>
    </div>
  );
};

// ---- Pergunta de quiz (bolhas) -----------------------------------------------------------------

export const QuizOptions: FC<{
  question: QuizQuestion | string;
  onAnswer: (value: string) => void;
  // Volta para a pergunta anterior (disponível a partir da 2ª pergunta).
  onBack?: () => void;
  // Conteúdo opcional no topo (ex.: legenda SO/ST/WO/WT no quiz de estratégia).
  headerExtra?: ReactNode;
  // Gate de qualidade da opção própria: valida ANTES de virar chip (qualidade importa).
  // Retorna ok:false + reask gentil quando o texto é lixo/fora do tema. Fail-open no erro.
  validateCustom?: (text: string) => Promise<{ ok: boolean; reask: string }>;
  // (legado) focar o input do chat — o fluxo atual usa o campo custom inline.
  focusInput?: () => void;
}> = ({ question, onAnswer, onBack, headerExtra, validateCustom }) => {
  const q = normalizeQuizQuestion(question);
  // Toda pergunta aceita múltiplas escolhas + opções próprias do artista (ele decide
  // quantas marcar e quando confirmar). Nada de auto-avançar na 1ª opção tocada.
  const [selected, setSelected] = useState<string[]>([]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [checking, setChecking] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const toggle = (opt: string) =>
    setSelected((s) => (s.includes(opt) ? s.filter((x) => x !== opt) : [...s, opt]));

  const addCustom = async () => {
    const t = customText.trim();
    if (!t || checking) return;
    if (selected.some((x) => x.toLowerCase() === t.toLowerCase())) {
      setCustomText('');
      return;
    }
    // Mesmo gate das respostas digitadas: a opção própria só entra se for aproveitável.
    if (validateCustom) {
      setChecking(true);
      setCustomError(null);
      const { ok, reask } = await validateCustom(t);
      setChecking(false);
      if (!ok) {
        setCustomError(reask || 'Tenta deixar essa ideia um pouco mais clara pra eu aproveitar.');
        return;
      }
    }
    setSelected((s) => [...s, t]);
    setCustomText('');
    setCustomError(null);
    // Sucesso: oculta o campo. Pra adicionar outra, o artista toca "Escrever do meu jeito" de novo.
    setCustomOpen(false);
  };

  if (!q.options.length) {
    return (
      <p style={{ color: 'var(--wz-faint)', fontSize: 13, margin: 0 }}>
        Responda no campo de mensagem abaixo.
      </p>
    );
  }

  // Itens escritos pelo artista (fora da lista da IA) viram chips selecionados extras.
  const customSelected = selected.filter((s) => !q.options.includes(s));

  return (
    <div>
      {headerExtra}
      <p style={{ color: 'var(--wz-blue)', fontSize: 13, fontWeight: 700, margin: '0 0 10px' }}>
        Escolha uma ou mais, ou escreva a sua
      </p>
      <div className='wiz-option-grid'>
        {q.options.map((opt, i) => {
          const isSel = selected.includes(opt);
          return (
            <button
              key={opt}
              className={`wiz-option-pill${isSel ? ' wiz-option-pill--selected' : ''}`}
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => toggle(opt)}
            >
              {isSel && (
                <span className='wiz-option-check'>
                  <FiCheck size={14} />
                </span>
              )}
              {opt}
            </button>
          );
        })}
        {customSelected.map((opt) => (
          <button
            key={opt}
            className='wiz-option-pill wiz-option-pill--selected'
            onClick={() => toggle(opt)}
            title='Toque para remover'
          >
            <span className='wiz-option-check'>
              <FiCheck size={14} />
            </span>
            {opt}
          </button>
        ))}
        <button
          className='wiz-option-pill wiz-option-pill--custom'
          style={{ animationDelay: `${q.options.length * 50}ms` }}
          onClick={() => setCustomOpen((o) => !o)}
        >
          <FiEdit3 size={14} />
          Escrever do meu jeito
        </button>
      </div>

      {customOpen && (
        <>
          <div className='wiz-custom-row'>
            <input
              className='wiz-custom-input'
              value={customText}
              autoFocus
              disabled={checking}
              placeholder='Escreva sua opção e toque em Adicionar'
              onChange={(e) => {
                setCustomText(e.target.value);
                if (customError) setCustomError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <button
              style={{
                ...primaryBtn,
                padding: '8px 16px',
                opacity: customText.trim() && !checking ? 1 : 0.5,
              }}
              disabled={!customText.trim() || checking}
              onClick={addCustom}
            >
              {checking ? 'Verificando…' : 'Adicionar'}
            </button>
          </div>
          {customError && (
            <p style={{ color: 'var(--wz-warn)', fontSize: 13, margin: '8px 2px 0', maxWidth: 720 }}>
              {customError}
            </p>
          )}
        </>
      )}

      <div className='nyta-card-actions' style={{ justifyContent: 'space-between' }}>
        {onBack ? (
          <button style={{ ...ghostBtn, padding: '6px 14px', fontSize: 12 }} onClick={onBack}>
            ← Voltar
          </button>
        ) : (
          <span />
        )}
        <button
          style={{ ...primaryBtn, opacity: selected.length ? 1 : 0.5 }}
          disabled={!selected.length}
          onClick={() => onAnswer(selected.join('; '))}
        >
          {selected.length > 1 ? `Confirmar (${selected.length})` : 'Confirmar'}
        </button>
      </div>
    </div>
  );
};

// ---- Diagnóstico interno: 20 itens, um a um (Metodologia v2) ------------------------------------


export const SwotInternalCard: FC<{
  onConfirm: (internal: Record<number, InternalClass>) => void;
}> = ({ onConfirm }) => {
  const [internal, setInternal] = useState<Record<number, InternalClass>>({});
  const [idx, setIdx] = useState(0);
  const [advancing, setAdvancing] = useState(false);
  const total = SWOT_INTERNAL.length;
  const item = SWOT_INTERNAL[idx];
  const options: [InternalClass, string, string][] = [
    ['forte', 'É um ponto forte', 'var(--wz-blue)'],
    ['melhorar', 'Preciso melhorar nisso', 'var(--wz-warn)'],
    // Neutro escuro (não o --wz-faint): quando vira preenchimento, precisa carregar texto branco.
    ['na', 'Não se aplica', 'var(--wz-text)'],
  ];
  const answer = (val: InternalClass) => {
    if (advancing) return;
    const updated = { ...internal, [item.id]: val };
    setInternal(updated);
    setAdvancing(true);
    window.setTimeout(() => {
      setAdvancing(false);
      if (idx + 1 >= total) onConfirm(updated);
      else setIdx((i) => i + 1);
    }, 380);
  };
  const barPct = ((idx + (advancing ? 1 : 0)) / total) * 100;
  return (
    <div className='nyta-card'>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
        <span style={{ color: 'var(--wz-blue)', fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          Diagnóstico interno
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ color: 'var(--wz-muted)', fontSize: 12, fontWeight: 600 }}>{idx + 1} de {total}</span>
          {idx > 0 && (
            <button
              disabled={advancing}
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              style={{ background: 'none', border: 'none', color: 'var(--wz-muted)', fontSize: 12, cursor: 'pointer', padding: 0 }}
            >
              ← Voltar
            </button>
          )}
        </span>
      </div>
      <div style={{ height: 3, borderRadius: 3, background: 'var(--wz-line)', marginBottom: 14, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${barPct}%`, background: 'var(--wz-blue)', borderRadius: 3, transition: 'width .3s ease' }} />
      </div>
      <div key={idx} style={{ animation: 'wizSlideInRight .28s ease both' }}>
        <p style={{ fontSize: 16.5, marginBottom: 4, lineHeight: 1.35, color: 'var(--wz-ink)', fontWeight: 700 }}>{stripEmDash(item.label)}</p>
        <p style={{ fontSize: 13.5, marginBottom: 14, lineHeight: 1.45, color: 'var(--wz-muted)' }}>{stripEmDash(item.question)}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map(([val, label, color]) => {
            const active = internal[item.id] === val;
            const dim = advancing && !active;
            return (
              <button
                key={val}
                disabled={advancing}
                onClick={() => answer(val)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  border: `1px solid ${active ? color : 'var(--wz-line-2)'}`,
                  background: active ? color : 'var(--wz-surface-2)',
                  color: active ? '#fff' : 'var(--wz-text)',
                  borderRadius: 10,
                  fontSize: 13.5,
                  fontWeight: 600,
                  padding: '12px 14px',
                  cursor: advancing ? 'default' : 'pointer',
                  opacity: dim ? 0.35 : 1,
                  transform: active && advancing ? 'scale(1.015)' : 'scale(1)',
                  transition: 'opacity .2s ease, background .2s ease, border-color .2s ease, transform .2s ease',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    flexShrink: 0,
                    border: active ? 'none' : '1.5px solid var(--wz-faint)',
                    background: active ? 'rgba(0,0,0,0.18)' : 'transparent',
                  }}
                >
                  {active && <FiCheck size={13} />}
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---- Checklist de oportunidades / ameaças (checkbox à esquerda — Metodologia v2) ----------------

export const SwotChecklist: FC<{
  items: { id: number; label: string }[];
  confirmLabel: string;
  onConfirm: (ids: number[]) => void;
  title?: string;
  accent?: string;
}> = ({ items, confirmLabel, onConfirm, title, accent = 'var(--wz-blue)' }) => {
  const [sel, setSel] = useState<number[]>([]);
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const shown = useStaggerReveal(items.length, 55);
  return (
    <div className='nyta-card'>
      {title && (
        <div style={{ color: accent, fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>
          {title}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.slice(0, shown).map((c) => {
          const active = sel.includes(c.id);
          return (
            <button
              key={c.id}
              className='wiz-rank-item'
              onClick={() => toggle(c.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                border: `1px solid ${active ? 'var(--wz-blue)' : 'var(--wz-line-2)'}`,
                background: active ? 'var(--wz-blue-soft)' : 'var(--wz-surface-2)',
                color: 'var(--wz-text)',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                padding: '11px 14px',
                cursor: 'pointer',
                transition: 'background .15s ease, border-color .15s ease',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  flexShrink: 0,
                  border: active ? 'none' : '1.5px solid var(--wz-faint)',
                  background: active ? 'var(--wz-blue)' : 'transparent',
                  color: '#fff',
                }}
              >
                {active && <FiCheck size={14} />}
              </span>
              {c.label}
            </button>
          );
        })}
      </div>
      <div className='nyta-card-actions'>
        <span style={{ color: 'var(--wz-muted)', fontSize: 13, alignSelf: 'center' }}>
          {sel.length} selecionada{sel.length === 1 ? '' : 's'}
        </span>
        <button style={{ ...primaryBtn, marginLeft: 'auto' }} onClick={() => onConfirm(sel)}>
          {confirmLabel}
        </button>
      </div>
    </div>
  );
};

// ---- Inventário SWOT editável ------------------------------------------------------------------

const SWOT_COLS: { key: keyof SwotAnalysis; label: string; color: string }[] = [
  { key: 'strengths', label: 'Forças', color: 'var(--wz-blue)' },
  { key: 'weaknesses', label: 'Fraquezas', color: 'var(--wz-danger)' },
  { key: 'opportunities', label: 'Oportunidades', color: '#29cc39' },
  { key: 'threats', label: 'Ameaças', color: 'var(--wz-warn)' },
];

// Uma coluna do board (Forças/Fraquezas/Oportunidades/Ameaças), com stagger PRÓPRIO: cada
// quadrante revela seus chips no seu próprio ritmo, em paralelo com os outros três — extraído à
// parte porque `useStaggerReveal` é um hook e não pode ser chamado dentro do `.map` do pai.
const SwotBoardColumn: FC<{
  label: string;
  color: string;
  items: string[];
  onRemove: (i: number) => void;
  onAdd: (v: string) => void;
}> = ({ label, color, items, onRemove, onAdd }) => {
  const shown = useStaggerReveal(items.length, 60);
  return (
    <div style={{ background: 'var(--wz-surface-2)', borderRadius: 8, padding: 12, borderTop: `3px solid ${color}` }}>
      <div style={{ color, fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
        {label} <span style={{ color: 'var(--wz-faint)', fontWeight: 700 }}>({items.length})</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {items.slice(0, shown).map((item, i) => (
          <span key={`${item}-${i}`} className='wiz-swot-chip wiz-rank-item'>
            <span style={{ width: 6, height: 6, minWidth: 6, borderRadius: '50%', background: color }} />
            {item}
            <button className='wiz-swot-chip-del' title='Remover' onClick={() => onRemove(i)}>
              <FiX size={12} />
            </button>
          </span>
        ))}
      </div>
      <AddOwnField placeholder='Adicionar…' label='Adicionar' onAdd={onAdd} />
    </div>
  );
};

export const SwotBoardCard: FC<{
  swot: SwotAnalysis;
  onConfirm: (swot: SwotAnalysis, userEdits: string[]) => void;
}> = ({ swot, onConfirm }) => {
  const [board, setBoard] = useState<SwotAnalysis>(swot);

  const update = (key: keyof SwotAnalysis, list: string[]) =>
    setBoard((b) => ({ ...b, [key]: list }));

  // Itens que o artista escreveu/alterou: presentes no board final mas não na
  // versão original gerada pela IA. Viram "fatos absolutos" nas etapas seguintes.
  const computeUserEdits = (): string[] => {
    const original = new Set(
      SWOT_COLS.flatMap((c) => (swot[c.key] || []).map((s) => s.trim().toLowerCase()))
    );
    return SWOT_COLS.flatMap((c) => board[c.key] || []).filter(
      (item) => !original.has(item.trim().toLowerCase())
    );
  };

  return (
    <div className='nyta-card'>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {SWOT_COLS.map((c) => {
          const items = board[c.key] || [];
          return (
            <SwotBoardColumn
              key={c.key}
              label={c.label}
              color={c.color}
              items={items}
              onRemove={(i) => update(c.key, items.filter((_, j) => j !== i))}
              onAdd={(v) => update(c.key, [...items, v])}
            />
          );
        })}
      </div>
      <div className='nyta-card-actions'>
        <button style={primaryBtn} onClick={() => onConfirm(board, computeUserEdits())}>
          Está ótimo, seguir
        </button>
      </div>
    </div>
  );
};

// ---- Revisão de estratégias --------------------------------------------------------------------

// Monta o texto "responde a:" a partir dos itens da SWOT que a estratégia endereça (tooltip + linha).
const swotRefsLine = (s: Strategy): string => {
  const r = s.swotRefs || {};
  const parts: string[] = [];
  if (r.weaknesses?.length) parts.push(`Fraquezas: ${r.weaknesses.join(', ')}`);
  if (r.opportunities?.length) parts.push(`Oportunidades: ${r.opportunities.join(', ')}`);
  if (r.strengths?.length) parts.push(`Forças: ${r.strengths.join(', ')}`);
  return parts.join(' · ');
};

export const StrategyCards: FC<{
  strategies: Strategy[];
  onConfirm: (strategies: Strategy[]) => void;
}> = ({ strategies, onConfirm }) => {
  // Lista somente-leitura: as estratégias vêm das matrizes determinísticas e não são editáveis
  // aqui (sem adicionar nem excluir). O artista revisa e segue pra priorização.
  const shown = useStaggerReveal(strategies.length, 70);
  return (
    <div className='nyta-card'>
      <div
        style={{
          color: 'var(--wz-muted)',
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 4,
        }}
      >
        Suas estratégias <span style={{ color: 'var(--wz-faint)' }}>({strategies.length})</span>
      </div>
      <p style={{ color: 'var(--wz-muted)', fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.45 }}>
        Construídas a partir do seu diagnóstico, cruzando suas forças, fraquezas e oportunidades.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {strategies.slice(0, shown).map((s) => {
          const refsLine = swotRefsLine(s);
          return (
            <div
              key={s.id}
              className='wiz-rank-item'
              title={refsLine || undefined}
              style={{ position: 'relative', background: 'var(--wz-surface)', border: '1px solid var(--wz-line-2)', borderRadius: 8, padding: '14px 16px' }}
            >
              <div style={{ color: 'var(--wz-ink)', fontWeight: 700, fontSize: 14 }}>{stripEmDash(s.title)}</div>
              {s.description && <p style={{ color: 'var(--wz-muted)', fontSize: 13, lineHeight: 1.5 }}>{s.description}</p>}
              {s.description && (
                <p style={{ color: 'var(--wz-muted)', fontSize: 13, margin: '6px 0 0', lineHeight: 1.55 }}>{s.description}</p>
              )}
              {s.why && (
                <p style={{ color: 'var(--wz-muted)', fontSize: 12, margin: '8px 0 0', lineHeight: 1.5 }}>{s.why}</p>
              )}
              {refsLine && (
                <p style={{ color: 'var(--wz-faint)', fontSize: 11.5, margin: '8px 0 0', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--wz-blue)', fontWeight: 700 }}>Responde a:</span> {refsLine}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className='nyta-card-actions'>
        <button
          style={{ ...primaryBtn, marginLeft: 'auto', opacity: strategies.length ? 1 : 0.5 }}
          disabled={!strategies.length}
          onClick={() => onConfirm(strategies)}
        >
          Curti, vamos priorizar
        </button>
      </div>
    </div>
  );
};

export { PriorityScale } from './PriorityScale';

const DURATION_OPTIONS: { months: number; label: string; hint: string }[] = [
  { months: 6, label: '6 meses', hint: 'ritmo intenso' },
  { months: 12, label: '12 meses', hint: 'mais comum' },
  { months: 18, label: '18 meses', hint: 'mais folga' },
  { months: 24, label: '24 meses', hint: 'longo prazo' },
];

export const PlanScheduleSetup: FC<{
  onConfirm: (startISO: string, months: number) => void;
}> = ({ onConfirm }) => {
  const [start, setStart] = useState(() => dayjs());
  const [months, setMonths] = useState(12);
  return (
    <div className='nyta-card'>
      <div style={{ marginBottom: 4, color: 'var(--wz-ink)', fontWeight: 800, fontSize: 16 }}>Quando você quer começar?</div>
      <p style={{ color: 'var(--wz-muted)', fontSize: 12.5, margin: '0 0 16px', lineHeight: 1.45 }}>
        Com a data de início e o prazo, eu já distribuo as tarefas pelo período, começando pelas
        estratégias mais prioritárias. Você ajusta tudo depois.
      </p>

      <div style={{ color: 'var(--wz-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Data de início
      </div>
      <DatePicker
        size='large'
        style={{ width: '100%', marginBottom: 18 }}
        value={start}
        allowClear={false}
        format='DD/MM/YYYY'
        disabledDate={(d) => d.isBefore(dayjs(), 'day')}
        onChange={(d) => d && setStart(d)}
      />

      <div style={{ color: 'var(--wz-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Em quanto tempo quer realizar
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        {DURATION_OPTIONS.map((o) => {
          const active = months === o.months;
          return (
            <button
              key={o.months}
              onClick={() => setMonths(o.months)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 2,
                textAlign: 'left',
                border: `1px solid ${active ? 'var(--wz-blue)' : 'var(--wz-line-2)'}`,
                background: active ? 'var(--wz-blue-soft)' : 'var(--wz-surface-2)',
                color: 'var(--wz-text)',
                borderRadius: 10,
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'background .15s ease, border-color .15s ease',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14, color: active ? 'var(--wz-blue)' : 'var(--wz-text)' }}>{o.label}</span>
              <span style={{ fontSize: 11.5, color: 'var(--wz-muted)' }}>{o.hint}</span>
            </button>
          );
        })}
      </div>

      <div className='nyta-card-actions'>
        <button style={{ ...primaryBtn, marginLeft: 'auto' }} onClick={() => onConfirm(start.format('YYYY-MM-DD'), months)}>
          Montar meu cronograma
        </button>
      </div>
    </div>
  );
};

// ---- Cronograma (timeline editável) ------------------------------------------------------------

const fmtDate = (iso?: string) =>
  iso ? dayjs(iso).toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : 'sem data';

export const TimelineCard: FC<{
  strategies: Strategy[];
  onChange: (strategies: Strategy[]) => void;
  onConfirm: () => void;
}> = ({ strategies, onChange, onConfirm }) => {
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingDesc, setEditingDesc] = useState<string | null>(null);

  const ordered = strategies
    .slice()
    .sort((a, b) => (b.finalScore ?? b.score ?? 0) - (a.finalScore ?? a.score ?? 0));

  const updateTask = (sid: string, tid: string, patch: Partial<ActionTask>) =>
    onChange(
      strategies.map((s) =>
        s.id === sid ? { ...s, tasks: (s.tasks || []).map((t) => (t.id === tid ? { ...t, ...patch } : t)) } : s
      )
    );

  const removeTask = (sid: string, tid: string) =>
    onChange(strategies.map((s) => (s.id === sid ? { ...s, tasks: (s.tasks || []).filter((t) => t.id !== tid) } : s)));

  const addTask = (sid: string) => {
    const id = uid();
    onChange(
      strategies.map((s) =>
        s.id === sid
          ? {
              ...s,
              tasks: [
                ...(s.tasks || []),
                { id, description: 'Nova tarefa', type: 'acoes', owner: TASK_OWNER_SELF, deadline: dayjs().add(7, 'day').format('YYYY-MM-DD'), status: 'todo' as const },
              ],
            }
          : s
      )
    );
    setEditingDesc(id);
  };

  return (
    <div className='nyta-card'>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ordered.map((s, si) => {
          const tasks = (s.tasks || []).slice().sort((a, b) => ((a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1));
          return (
            <div key={s.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span className='wiz-slot-rank' style={{ minWidth: 'auto', fontSize: 18, color: 'var(--wz-blue)' }}>#{si + 1}</span>
                <span style={{ color: 'var(--wz-ink)', fontWeight: 700, fontSize: 13, flex: 1 }}>{stripEmDash(s.title)}</span>
              </div>
              <div className='wiz-timeline'>
                {tasks.map((t) => (
                  <div key={t.id} className='wiz-timeline-item'>
                    {editingDate === t.id ? (
                      <DatePicker
                        size='small'
                        autoFocus
                        open
                        value={t.deadline ? dayjs(t.deadline) : undefined}
                        disabledDate={(d) => d.isBefore(dayjs(), 'day')}
                        onChange={(d) => {
                          if (d) updateTask(s.id, t.id, { deadline: d.format('YYYY-MM-DD') });
                          setEditingDate(null);
                        }}
                        onOpenChange={(open) => !open && setEditingDate(null)}
                      />
                    ) : (
                      <button className='wiz-date-pill' style={{ border: 'none' }} onClick={() => setEditingDate(t.id)}>
                        {fmtDate(t.deadline)}
                      </button>
                    )}
                    {editingDesc === t.id ? (
                      <Input
                        size='small'
                        autoFocus
                        defaultValue={t.description}
                        onBlur={(e) => {
                          updateTask(s.id, t.id, { description: e.target.value.trim() || t.description });
                          setEditingDesc(null);
                        }}
                        onPressEnter={(e) => {
                          updateTask(s.id, t.id, { description: (e.target as HTMLInputElement).value.trim() || t.description });
                          setEditingDesc(null);
                        }}
                      />
                    ) : (
                      <span
                        style={{ color: 'var(--wz-text)', fontSize: 13, flex: 1, cursor: 'text', lineHeight: '22px' }}
                        onClick={() => setEditingDesc(t.id)}
                      >
                        {t.description}
                      </span>
                    )}
                    <button className='wiz-timeline-del' title='Remover' onClick={() => removeTask(s.id, t.id)}>
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => addTask(s.id)}
                  style={{ background: 'transparent', border: '1px dashed var(--wz-faint)', borderRadius: 9999, color: 'var(--wz-muted)', fontSize: 12, fontWeight: 600, padding: '4px 12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 2 }}
                >
                  <FiPlus size={12} /> Adicionar tarefa
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className='nyta-card-actions'>
        <button style={primaryBtn} onClick={onConfirm}>
          Aprovar plano de ação
        </button>
      </div>
    </div>
  );
};

// ---- Resumo final ------------------------------------------------------------------------------

export const FinalSummaryCard: FC<{
  summary: string;
  concluded: boolean;
  onFinish: () => void;
}> = ({ summary, concluded, onFinish }) => (
  <div className='nyta-card'>
    <div className='nyta-md' style={{ color: 'var(--wz-text)', lineHeight: 1.7, fontSize: 14 }}>
      <ReactMarkdown>{summary}</ReactMarkdown>
    </div>
    <div className='nyta-card-actions'>
      <button style={{ ...primaryBtn, marginLeft: 'auto' }} onClick={onFinish}>
        {concluded ? 'Ir para o painel' : 'Concluir e liberar o painel'}
      </button>
    </div>
  </div>
);

// ---- Retry (falha de IA) -----------------------------------------------------------------------

export const RetryPill: FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <button className='wiz-option-pill wiz-option-pill--custom' onClick={onRetry}>
    <FiRefreshCw size={14} /> Tentar novamente
  </button>
);
