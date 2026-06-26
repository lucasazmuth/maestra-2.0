import { FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Popover } from 'antd';
import { createPortal } from 'react-dom';
import { FiArchive, FiCheck, FiChevronDown, FiHelpCircle, FiPlus, FiRefreshCw, FiX } from 'react-icons/fi';

import { useNytaModal } from '../../hooks/useNytaModal';
import { buildActionPlan } from '../Wizard/method/engines';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import EnhancedEmptyState from '../../components/action-plan/EnhancedEmptyState';
import { TaskProgress } from '../../components/RealCareerCard';
import { PageHeader } from '../../components/PageHeader';
import { PRODUCT_THEME, pageBg } from '../../components/productTheme';
import { NytaDashboardHero } from '../../components/nyta/NytaDashboardHero';
import { TaskDate, TaskCategory, TaskOwner, TaskDelete, AutoTextarea, type Assignee } from './TaskControls';
import { TASK_OWNER_SELF } from '../../constants/maestra';
import { listMembers } from '../../services/db/members';
import type { ActionTask, ArtistContent, ArtistMember, Strategy } from '../../interfaces/maestra';
import './actionPlan.scss';

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().split('T')[0];

const isDone = (t: ActionTask) => t.status === 'done';
const isActive = (t: ActionTask) => t.status !== 'archived';
// fmtDate vive em TaskControls/TaskComposer (componentes que exibem datas).


// Modal "Arquivadas": estratégias que o artista NÃO priorizou (sem tarefa). Ele seleciona quais
// trazer pro plano — ao confirmar, cada uma ganha as tarefas do banco e entra na lista principal.
const ArchiveModal: FC<{
  items: { id: string; title: string }[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}> = ({ items, onConfirm, onClose }) => {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 720, maxHeight: '86vh', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ padding: '22px 22px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontFamily: 'SpotifyMixUITitle', color: '#fff', fontWeight: 800, fontSize: 22, lineHeight: 1.2 }}>Estratégias arquivadas</div>
            <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', color: '#9a9a9a', cursor: 'pointer', display: 'inline-flex', padding: 4 }}><FiX size={20} /></button>
          </div>
          <div style={{ color: '#b3b3b3', fontSize: 13.5, marginTop: 8, lineHeight: 1.5 }}>
            Estratégias que você não priorizou. Selecione as que quer <b style={{ color: '#fff' }}>trazer pro plano</b> — elas ganham tarefas e entram na lista principal, saindo do arquivo.
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => {
            const on = sel.includes(it.id);
            return (
              <button
                key={it.id}
                onClick={() => toggle(it.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer', background: on ? 'rgba(175,40,150,0.12)' : '#202020', border: `1px solid ${on ? '#af2896' : 'transparent'}`, borderRadius: 12, padding: '14px 16px', transition: 'background .15s, border-color .15s' }}
              >
                <span aria-hidden style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? '#af2896' : '#4a4a4a'}`, background: on ? '#af2896' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{on && <FiCheck size={14} />}</span>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 14.5, lineHeight: 1.4 }}>{it.title}</span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: '12px 22px 18px', borderTop: '1px solid #232323', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#7a7a7a', fontSize: 13 }}>{sel.length} selecionada{sel.length === 1 ? '' : 's'}</span>
          <button className="ap-btn ap-btn--ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>Cancelar</button>
          <button
            disabled={!sel.length}
            onClick={() => onConfirm(sel)}
            style={{ border: 'none', borderRadius: 9999, padding: '10px 20px', fontWeight: 700, fontSize: 13.5, cursor: sel.length ? 'pointer' : 'not-allowed', color: '#fff', background: 'linear-gradient(135deg, #af2896, #6d3bd1)', opacity: sel.length ? 1 : 0.5 }}
          >
            Trazer pro plano{sel.length ? ` (${sel.length})` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ActionPlan: FC = () => {
  const { artist } = useArtist();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  // Gerir tarefas exige PRO. (Editar o dossiê — fundamentos/objetivos etc. — agora é no Perfil.)
  const { manageTasks } = useArtistCapabilities(artist);
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
  const [archiveOpen, setArchiveOpen] = useState(false); // modal "Arquivadas": traz estratégia pro plano
  const { openWithPrompt } = useNytaModal(); // botão "Nova estratégia" abre a Nyta com o protocolo
  const [, setSaving] = useState(false);

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
  // "Arquivadas" → trazer pro plano: semeia as tarefas do banco (buildActionPlan) nas selecionadas.
  // Como passam a ter tarefa, saem do arquivo e entram na lista principal (na prioridade salva).
  const activateArchived = (ids: string[]) => {
    if (!ids.length) return;
    commit((ss) => ss.map((s) => (ids.includes(s.id) ? { ...s, tasks: buildActionPlan(s) } : s)));
    setArchiveOpen(false);
    message.success(ids.length === 1 ? 'Estratégia trazida pro plano de ação.' : `${ids.length} estratégias trazidas pro plano de ação.`);
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
  // A lista principal mostra só as estratégias que o artista PRIORIZOU (geraram tarefa). As demais
  // (sem tarefa) ficam ARQUIVADAS — acessíveis pelo botão/modal "Arquivadas", de onde o artista
  // traz pro plano (ganham tarefas e entram na lista). Não aparecem soltas embaixo (confundia).
  const withTasks = info.filter((p) => p.total > 0);
  const archived = info.filter((p) => p.total === 0);
  const hasArchive = withTasks.length > 0 && archived.length > 0;
  const displayed = withTasks.length ? withTasks : info; // sem nenhuma priorizada, mostra tudo
  const focusIdx = displayed.findIndex((p) => p.total > 0 && !p.complete); // -1 = todas concluídas

  // Contagem das tarefas (mesma fonte do Dashboard) — alimenta a barra de progresso do RealCareerCard.
  const allTasks = ranked.flatMap((s) => (s.tasks || []).filter(isActive));
  const taskCounts = {
    todo: allTasks.filter((t) => !t.status || t.status === 'todo').length,
    inProgress: allTasks.filter((t) => t.status === 'in_progress').length,
    done: doneTasks,
    total: totalTasks,
  };

  return (
    <div className="ap" style={{ minHeight: '100%', ...pageBg(PRODUCT_THEME.action.accent) }}>
      {/* CABEÇALHO padronizado (mesmo padrão de Diagnóstico/Planejamento — grupo CRESCIMENTO). */}
      <PageHeader
        kicker="Crescimento"
        title="Plano de Ação"
        subtitle="Execute suas estratégias em tarefas e acompanhe o progresso até subir de fase."
      />

      {/* Progresso das tarefas (só execução; a FASE REAL agora vive no Perfil). */}
      <div style={{ background: 'radial-gradient(120% 130% at 0% 0%, rgba(175,40,150,0.10), #181818 60%)', border: '1px solid rgba(175,40,150,0.22)', borderRadius: 14, padding: 22, marginBottom: 24 }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#af2896' }}>Progresso do plano</span>
        <h2 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 24, color: '#fff', margin: '6px 0 0', lineHeight: 1.1 }}>Suas tarefas</h2>
        <TaskProgress counts={taskCounts} />

        {/* Loop com o REAL: executar tarefas → crescer → refazer o diagnóstico → subir de fase. */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#b3b3b3', fontSize: 13.5, lineHeight: 1.5 }}>
            Concluir tarefas faz sua carreira evoluir. Quando avançar, <b style={{ color: '#fff' }}>refaça o REAL</b> pra ver sua fase subir.
          </span>
          <button
            onClick={() => navigate(`/artists/${artist.id}/diagnostico/refazer`)}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid rgba(175,40,150,0.5)', color: '#d264bb', padding: '8px 16px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
          >
            <FiRefreshCw size={14} /> Refazer diagnóstico
          </button>
        </div>
      </div>

      {/* ESTRATÉGIAS — em ordem de prioridade (a "etapa atual" do artista) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="ap-section-title" style={{ margin: 0 }}>Estratégias por prioridade</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="ap-btn ap-btn--ghost" onClick={() => openWithPrompt('Quero criar uma nova estratégia')}>
            <FiPlus size={14} /> Nova estratégia
          </button>
          {hasArchive && (
            <button className="ap-btn ap-btn--ghost" onClick={() => setArchiveOpen(true)}>
              <FiArchive size={14} /> Arquivadas ({archived.length})
            </button>
          )}
        </div>
      </div>
      <div className="ap-strats" style={{ marginTop: 16 }}>
        {displayed.map((p, idx) => {
          const s = p.s;
          const state = p.complete ? 'done' : idx === focusIdx ? 'current' : 'next';
          const isOpen = openId === undefined ? state === 'current' : openId === s.id;
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
                      <FiHelpCircle size={15} />
                    </span>
                  </Popover>
                )}
                <span className="ap-strat-count">{p.done}/{p.total}</span>
                <FiChevronDown className="ap-chevron" />
              </button>

              {isOpen && (
                <div className="ap-strat-body">
                  {/* TAREFAS — linha do tempo (diferencial do modo básico) */}
                  {p.ts.length === 0 && <div className="ap-empty-tasks">Nenhuma tarefa ainda. Crie a primeira com a Nyta no botão abaixo.</div>}
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

                  {/* "Nova tarefa" abre o chat da Nyta pra criar a tarefa NESTA estratégia (guiado + confirmação). */}
                  {manageTasks && (
                    <div className="ap-add">
                      <button
                        className="ap-btn ap-btn--ghost ap-btn--accent"
                        onClick={() => openWithPrompt(`Quero criar uma tarefa para a estratégia "${s.title}"`)}
                      >
                        <FiPlus size={15} /> Nova tarefa
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Consultora da Nyta (mesma seção do rodapé do Dashboard) no lugar do texto simples de objetivos */}
      <NytaDashboardHero />

      {archiveOpen && (
        <ArchiveModal
          items={archived.map((p) => ({ id: p.s.id, title: p.s.title }))}
          onConfirm={activateArchived}
          onClose={() => setArchiveOpen(false)}
        />
      )}
    </div>
  );
};

export default ActionPlan;
