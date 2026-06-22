import { FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Popover } from 'antd';
import ReactMarkdown from 'react-markdown';
import { FiCheck, FiChevronDown, FiLayers, FiList, FiTarget } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import EnhancedEmptyState from '../../components/action-plan/EnhancedEmptyState';
import { RealProfileSummary } from '../../components/RealProfileSummary';
import { PhaseCard } from '../Dashboard/sections';
import { NytaDashboardHero } from '../../components/nyta/NytaDashboardHero';
import AdvancedPlan from './AdvancedPlan';
import TaskComposer from './TaskComposer';
import { TaskDate, TaskCategory, TaskOwner, TaskDelete, AutoTextarea, type Assignee } from './TaskControls';
import { getPhaseInfo, TASK_OWNER_SELF } from '../../constants/maestra';
import { listMembers } from '../../services/db/members';
import * as wizardAi from '../../services/wizardAi';
import type { ActionTask, ArtistContent, ArtistMember, Strategy } from '../../interfaces/maestra';
import './actionPlan.scss';

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().split('T')[0];

const isDone = (t: ActionTask) => t.status === 'done';
const isActive = (t: ActionTask) => t.status !== 'archived';
// fmtDate vive em TaskControls/TaskComposer (componentes que exibem datas).

interface SuggTask { description: string; type?: string; deadline?: string }

const ActionPlan: FC = () => {
  const { artist } = useArtist();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  // Gerir tarefas exige PRO; avançar de fase exige edição do plano (dono pago ou PRO).
  const { manageTasks, editPlanning, useNytaConsultora } = useArtistCapabilities(artist);
  const content = artist?.content;
  const objectives = useMemo<string[]>(() => content?.objectives || [], [content]);
  const strategies = useMemo<Strategy[]>(() => content?.strategies || [], [content]);
  // As estratégias do plano em ORDEM DE PRIORIDADE (finalScore desc); fallback mantém a ordem salva.
  const ranked = useMemo(
    () => [...strategies].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)),
    [strategies]
  );

  // openId === undefined → a estratégia em foco fica aberta sozinha; clicar abre outra.
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const [, setSaving] = useState(false);
  const [composer, setComposer] = useState<string | null>(null);
  const [sugg, setSugg] = useState<Record<string, SuggTask[]>>({});
  const [loadingSugg, setLoadingSugg] = useState<string | null>(null);
  // Modo de visualização: 'basic' (foco em executar) | 'advanced' (dossiê completo). Persiste a preferência.
  const [mode, setMode] = useState<'basic' | 'advanced'>(
    () => (localStorage.getItem('maestra_ap_mode') === 'advanced' ? 'advanced' : 'basic')
  );
  const [summaryOpen, setSummaryOpen] = useState(false); // resumo executivo expandido no modo básico
  const toggleMode = () => {
    const next = mode === 'basic' ? 'advanced' : 'basic';
    setMode(next);
    localStorage.setItem('maestra_ap_mode', next);
  };
  const [advancing, setAdvancing] = useState(false);

  // Equipe ativa do artista — alimenta o seletor de responsável das tarefas.
  const [members, setMembers] = useState<ArtistMember[]>([]);
  useEffect(() => {
    if (!artist?.id) return;
    let alive = true;
    listMembers(artist.id).then((d) => alive && setMembers(d)).catch(() => {});
    return () => { alive = false; };
  }, [artist?.id]);

  // Responsáveis atribuíveis: o DONO DO PERFIL (sentinela) + cada membro ativo (pelo e-mail).
  // O dono aparece com o nome de quem está logado quando é ele mesmo; senão, rótulo genérico.
  const assignees = useMemo<Assignee[]>(() => {
    const isOwner = artist?.user_id && user?.id && artist.user_id === user.id;
    const ownerName = isOwner
      ? (user?.user_metadata?.full_name || user?.email || 'Você (dono)')
      : 'Dono do perfil';
    const list: Assignee[] = [{ value: TASK_OWNER_SELF, label: ownerName }];
    members
      .filter((m) => m.status === 'active')
      .forEach((m) => list.push({ value: m.email, label: m.name || m.email }));
    return list;
  }, [artist?.user_id, user, members]);

  // Objetivo que a estratégia MAIS avança — o de maior score na priorização (etapa 7).
  // Serve de contexto sutil no cabeçalho ("por que essa estratégia importa").
  const topObjective = (s: Strategy): string | undefined => {
    const scores = s.objectiveScores;
    if (!scores || !objectives.length) return undefined;
    let bestIdx = -1;
    let best = 0; // score 0 não conta como "ajuda"
    for (const [k, v] of Object.entries(scores)) {
      const i = Number(k);
      if (typeof v === 'number' && v > best && objectives[i]) { best = v; bestIdx = i; }
    }
    return bestIdx >= 0 ? objectives[bestIdx] : undefined;
  };

  const today = todayStr();

  // Normaliza tarefas legadas (id + status) uma vez por artista.
  useEffect(() => {
    if (!artist) return;
    const ss = artist.content?.strategies || [];
    let changed = false;
    const fixed = ss.map((s) => ({
      ...s,
      tasks: (s.tasks || []).map((t) => {
        let nt = t;
        if (!t.id) { nt = { ...nt, id: uid() }; changed = true; }
        if (!t.status) { nt = { ...nt, status: 'todo' as const }; changed = true; }
        return nt;
      }),
    }));
    if (changed) {
      dispatch(artistsActions.updateArtistContent({ id: artist.id, content: { ...artist.content, strategies: fixed } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist?.id]);

  const commit = async (mut: (ss: Strategy[]) => Strategy[]) => {
    if (!artist || !manageTasks) return; // gestão de tarefas: livre no plano gratuito (dono do perfil)
    const next: ArtistContent = { ...artist.content, strategies: mut(artist.content.strategies || []) };
    // Otimista: atualiza a UI na hora; persiste em segundo plano.
    dispatch(artistsActions.setArtistContentLocal({ id: artist.id, content: next }));
    setSaving(true);
    try {
      await dispatch(artistsActions.updateArtistContent({ id: artist.id, content: next })).unwrap();
    } catch {
      message.error('Não consegui salvar agora, tenta de novo.');
      dispatch(artistsActions.fetchArtists(artist.user_id)); // reverte ao estado do servidor
    } finally {
      setSaving(false);
    }
  };

  const patchTask = (sid: string, tid: string, patch: Partial<ActionTask>) => {
    commit((ss) => ss.map((s) => (s.id !== sid ? s : { ...s, tasks: (s.tasks || []).map((t) => (t.id === tid ? { ...t, ...patch } : t)) })));
  };
  const toggleDone = (sid: string, t: ActionTask) => patchTask(sid, t.id, { status: isDone(t) ? 'todo' : 'done' });
  const delTask = (sid: string, tid: string) => {
    commit((ss) => ss.map((s) => (s.id !== sid ? s : { ...s, tasks: (s.tasks || []).filter((t) => t.id !== tid) })));
  };
  const addTask = (sid: string, task: SuggTask) => {
    // Toda tarefa nova nasce sob responsabilidade do dono do perfil (pode ser reatribuída).
    const nt: ActionTask = { id: uid(), status: 'todo', owner: TASK_OWNER_SELF, description: task.description, type: task.type, deadline: task.deadline };
    commit((ss) => ss.map((s) => (s.id !== sid ? s : { ...s, tasks: [...(s.tasks || []), nt] })));
  };

  const askNyta = async (s: Strategy) => {
    // "Pedir ideias pra Nyta" usa a Nyta IA → recurso PRO. Sem PRO, leva pra assinatura.
    if (!useNytaConsultora) { navigate('/assinatura'); return; }
    setLoadingSugg(s.id);
    try {
      const identity = content?.identity || { name: artist?.name };
      const tasks = await wizardAi.suggestTasks(s, objectives, identity, content?.spotifyProfile);
      setSugg((p) => ({ ...p, [s.id]: tasks }));
      if (!tasks.length) message.info('A Nyta não trouxe ideias agora. Tenta de novo num instante.');
    } finally {
      setLoadingSugg(null);
    }
  };

  // Avançar de fase: arquiva o ciclo atual no histórico, incrementa a fase, gera o novo
  // rótulo via IA, zera o planejamento e reabre o wizard em Objetivos. Mesma mecânica do
  // Dashboard (PhaseCard.onAdvance) — a fonte de verdade é única.
  const advancePhase = async () => {
    if (advancing || !artist || !editPlanning) return;
    setAdvancing(true);
    try {
      const c = artist.content || {};
      const ph = c.phase || 1;
      const np = ph + 1;
      const snapshot = {
        phase: ph,
        phaseLabel: c.phaseLabel || getPhaseInfo(ph).label,
        objectives: c.objectives,
        strategies: c.strategies,
        swotAnalysis: c.swotAnalysis,
        snapshotAt: new Date().toISOString(),
      };
      let nextLabel = getPhaseInfo(np).label;
      try {
        const ai = await wizardAi.generatePhaseLabel(c.identity || { name: artist.name }, np);
        if (ai?.trim()) nextLabel = ai.trim();
      } catch { /* mantém o fallback */ }
      const next: ArtistContent = {
        ...c,
        phase: np,
        phaseLabel: nextLabel,
        phaseHistory: [...(c.phaseHistory || []), snapshot],
        objectives: [],
        swotQuizQuestions: [],
        swotQuizAnswers: {},
        swotAnalysis: undefined,
        strategyQuizQuestions: [],
        strategyQuizAnswers: {},
        strategies: [],
        executiveSummary: undefined,
        step: 1, // reabre o wizard em Objetivos (identidade é transversal)
      };
      await dispatch(artistsActions.updateArtistContent({ id: artist.id, content: next })).unwrap();
      message.success(`Nova fase iniciada: ${nextLabel}`);
      navigate(`/artists/${artist.id}/wizard`);
    } catch {
      message.error('Não consegui avançar de fase agora. Tenta de novo.');
    } finally {
      setAdvancing(false);
    }
  };

  if (!artist) return <Spinner loading>{null as any}</Spinner>;

  if (!strategies.length) {
    // Sem wrapper .ap: ocupa a tela toda (full-bleed), igual à tela de feature bloqueada.
    return (
      <EnhancedEmptyState
        artistId={artist.id}
        artistName={content?.identity?.name || artist.name || ''}
        onStartWizard={() => navigate(`/artists/${artist.id}/wizard`)}
      />
    );
  }

  // ---- Progresso das estratégias da fase atual ----
  const info = ranked.map((s) => {
    const ts = (s.tasks || []).filter(isActive);
    const done = ts.filter(isDone).length;
    return { s, ts, done, total: ts.length, complete: ts.length > 0 && done === ts.length };
  });
  const totalTasks = info.reduce((a, p) => a + p.total, 0);
  const doneTasks = info.reduce((a, p) => a + p.done, 0);
  const focusIdx = info.findIndex((p) => !p.complete); // -1 = todas as estratégias concluídas

  // Contagem no formato do PhaseCard (mesma fonte do Dashboard) — barra de progresso + avançar de fase.
  const allTasks = ranked.flatMap((s) => (s.tasks || []).filter(isActive));
  const taskCounts = {
    todo: allTasks.filter((t) => !t.status || t.status === 'todo').length,
    inProgress: allTasks.filter((t) => t.status === 'in_progress').length,
    done: doneTasks,
    total: totalTasks,
  };

  return (
    <div className="ap">
      {/* CABEÇALHO — título + alternância de modo (básico ↔ avançado) */}
      <div className="ap-top">
        <h1 className="ap-top-title">Plano de Ação</h1>
        <button className="ap-btn ap-btn--ghost" onClick={toggleMode}>
          {mode === 'basic' ? <><FiLayers size={14} /> Ver dados completos</> : <><FiList size={14} /> Ver menos</>}
        </button>
      </div>

      {/* FASE — mesmo card do Dashboard (design system): progresso, Foco/Evite e avançar de fase.
          O resumo executivo (modo básico) entra DENTRO do card, abaixo do Foco/Evite. */}
      <PhaseCard
        artist={artist}
        taskCounts={taskCounts}
        advancing={advancing}
        onAdvance={advancePhase}
        hideFocus
        footer={
          content?.executiveSummary ? (
            <div className={`ap-phase-summary${summaryOpen ? ' is-open' : ''}`}>
              <div className="ap-phase-summary-body">
                <ReactMarkdown>{content.executiveSummary.replace(/([^\n])\n(?!\n)/g, '$1\n\n')}</ReactMarkdown>
              </div>
              <button
                className="ap-phase-summary-toggle"
                onClick={() => setSummaryOpen((o) => !o)}
                title={summaryOpen ? 'Minimizar' : 'Ver resumo completo'}
                aria-label={summaryOpen ? 'Minimizar resumo' : 'Ver resumo completo'}
              >
                <FiChevronDown size={18} />
              </button>
            </div>
          ) : undefined
        }
      />

      {mode === 'advanced' ? (
        <>
        {/* Diagnóstico REAL — perfil de carreira, no modo "ver dados completos" */}
        <RealProfileSummary artist={artist} style={{ marginTop: 4 }} />
        <AdvancedPlan
          content={content!}
          ranked={ranked}
          crud={{ today, canManage: manageTasks, canUseNyta: useNytaConsultora, toggleDone, patchTask, delTask, addTask, askNyta, sugg, setSugg, loadingSugg, composer, setComposer, assignees }}
        />
        </>
      ) : (
      <>
      {/* ESTRATÉGIAS — em ordem de prioridade (a "etapa atual" do artista) */}
      <h2 className="ap-section-title">Estratégias por prioridade</h2>
      <div className="ap-strats">
        {info.map((p, idx) => {
          const s = p.s;
          const state = p.complete ? 'done' : idx === focusIdx ? 'current' : 'next';
          const isOpen = openId === undefined ? state === 'current' : openId === s.id;
          const suggestions = sugg[s.id];
          const goal = topObjective(s);

          return (
            <div id={`strat-${s.id}`} className={`ap-strat ap-strat--${state}${isOpen ? ' is-open' : ''}`} key={s.id}>
              <button className="ap-strat-head" onClick={() => setOpenId(isOpen ? '__none__' : s.id)}>
                <span className={`ap-strat-badge ap-strat-badge--${state}`}>
                  {state === 'done' ? <FiCheck size={16} /> : idx + 1}
                </span>
                <span className="ap-strat-main">
                  <span className="ap-strat-kicker">
                    {state === 'done' ? 'Concluída' : state === 'current' ? 'Comece por aqui' : 'Em seguida'}
                  </span>
                  <span className="ap-strat-title">{s.title}</span>
                </span>
                {goal && (
                  <Popover
                    trigger="click"
                    placement="bottomRight"
                    overlayClassName="ap-goal-popover"
                    overlayStyle={{ maxWidth: 280 }}
                    content={
                      <span style={{ fontSize: 13, color: '#b3b3b3', lineHeight: 1.45 }}>
                        Essa estratégia ajuda a conquistar o objetivo{' '}
                        <strong style={{ color: '#fff' }}>“{goal}”</strong>.
                      </span>
                    }
                  >
                    <span
                      className="ap-strat-goal-btn"
                      role="button"
                      tabIndex={0}
                      title="Por que essa estratégia?"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FiTarget size={13} />
                    </span>
                  </Popover>
                )}
                <span className="ap-strat-count">{p.done}/{p.total}</span>
                <FiChevronDown className="ap-chevron" />
              </button>

              {isOpen && (
                <div className="ap-strat-body">
                  {/* TAREFAS — linha do tempo (diferencial do modo básico) */}
                  {p.ts.length === 0 && <div className="ap-empty-tasks">Nenhuma tarefa ainda. Adicione abaixo ou peça ideias pra Nyta.</div>}
                  {p.ts.length > 0 && (
                    <div className="ap-tl">
                      {p.ts.map((t, ti) => {
                        const done = isDone(t);
                        const od = !!(t.deadline && t.deadline < today && !done);
                        return (
                          <div className={`ap-tl-item${done ? ' is-done' : ''}`} key={t.id || `${s.id}-${ti}`}>
                            <button
                              className={`ap-tl-dot${done ? ' is-done' : ''}${od ? ' is-overdue' : ''}`}
                              title={done ? 'Concluída' : 'Marcar como concluída'}
                              onClick={manageTasks ? () => toggleDone(s.id, t) : undefined}
                              style={{ cursor: manageTasks ? 'pointer' : 'default' }}
                            >
                              {done && <FiCheck size={13} />}
                            </button>
                            <TaskDate className="ap-date" value={t.deadline} overdue={od} onChange={(d) => patchTask(s.id, t.id, { deadline: d })} />
                            <div className="ap-tl-body">
                              <AutoTextarea
                                key={t.description}
                                className="ap-task-desc"
                                defaultValue={t.description}
                                onCommit={(v) => patchTask(s.id, t.id, { description: v })}
                              />
                              <TaskCategory className="ap-type" value={t.type} onChange={(v) => patchTask(s.id, t.id, { type: v })} />
                            </div>
                            <TaskOwner className="ap-owner" value={t.owner} assignees={assignees} onChange={(o) => patchTask(s.id, t.id, { owner: o })} />
                            {manageTasks && <TaskDelete className="ap-task-del" onDelete={() => delTask(s.id, t.id)} />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ADICIONAR (livre no FREE) / Pedir ideias pra Nyta (PRO — gate em onAskNyta). */}
                  {manageTasks && (
                    <TaskComposer
                      strategy={s}
                      open={composer === s.id}
                      loading={loadingSugg === s.id}
                      suggestions={suggestions}
                      accent
                      canUseNyta={useNytaConsultora}
                      onOpen={() => setComposer(s.id)}
                      onClose={() => { setComposer(null); setSugg((pp) => ({ ...pp, [s.id]: [] })); }}
                      onAdd={(t) => addTask(s.id, t)}
                      onAskNyta={() => askNyta(s)}
                      onUseSugg={(i) => { addTask(s.id, suggestions![i]); setSugg((pp) => ({ ...pp, [s.id]: (pp[s.id] || []).filter((_, j) => j !== i) })); }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Consultora da Nyta (mesma seção do rodapé do Dashboard) no lugar do texto simples de objetivos */}
      <NytaDashboardHero />
      </>
      )}
    </div>
  );
};

export default ActionPlan;
