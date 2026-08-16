import { FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, message } from 'antd';
import { createPortal } from 'react-dom';
import { FiArchive, FiCheck, FiCheckCircle, FiCircle, FiLock, FiMoreVertical, FiPlus, FiX } from 'react-icons/fi';

import { useNytaModal } from '../../hooks/useNytaModal';
import { buildActionPlan } from '../Wizard/method/engines';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { useGlobalSearch, normalizar } from '../../stores/globalSearchStore';
import EnhancedEmptyState from '../../components/action-plan/EnhancedEmptyState';
import { NytaDashboardHero } from '../../components/nyta/NytaDashboardHero';
import { UpsellModal } from '../../components/UpsellModal';
import { TaskDate, TaskCategory, TaskOwner, type Assignee } from './TaskControls';
import { TaskDetailModal } from './TaskDetailModal';
import { TASK_OWNER_SELF, isOnboardingComplete } from '../../constants/maestra';
import { listMembers } from '../../services/db/members';
import * as eventsDb from '../../services/db/events';
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
            <div style={{ fontFamily: 'var(--font-display)', color: '#fff', fontWeight: 800, fontSize: 22, lineHeight: 1.2 }}>Estratégias arquivadas</div>
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
                style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer', background: on ? 'rgba(154, 79, 209,0.12)' : '#202020', border: `1px solid ${on ? '#9A4FD1' : 'transparent'}`, borderRadius: 12, padding: '14px 16px', transition: 'background .15s, border-color .15s' }}
              >
                <span aria-hidden style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? '#9A4FD1' : '#4a4a4a'}`, background: on ? '#9A4FD1' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>{on && <FiCheck size={14} />}</span>
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
            style={{ border: 'none', borderRadius: 9999, padding: '10px 20px', fontWeight: 700, fontSize: 13.5, cursor: sel.length ? 'pointer' : 'not-allowed', color: '#FFFFFF', background: '#9A4FD1', opacity: sel.length ? 1 : 0.5 }}
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
  const { message: toast } = App.useApp();
  const { artist } = useArtist();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);

  // Gerir tarefas exige PRO. (Editar o dossiê — fundamentos/objetivos etc. — agora é no Perfil.)
  const { manageTasks, editPlanning } = useArtistCapabilities(artist);
  // Busca do topo — ver globalSearchStore.
  const termoBusca = useGlobalSearch((st) => st.termo);
  const content = artist?.content;
  const strategies = useMemo<Strategy[]>(() => content?.strategies || [], [content]);
  // As estratégias do plano em ORDEM DE PRIORIDADE (finalScore desc); fallback mantém a ordem salva.
  const ranked = useMemo(
    () => [...strategies].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)),
    [strategies]
  );

  // openId === undefined → a estratégia em foco fica aberta sozinha; clicar abre outra.
  const [openId, setOpenId] = useState<string | undefined>(undefined);
  const [archiveOpen, setArchiveOpen] = useState(false); // modal "Arquivadas": traz estratégia pro plano
  const [proModalOpen, setProModalOpen] = useState(false);
  const [selectedTaskRef, setSelectedTaskRef] = useState<{ strategyId: string; taskId: string } | null>(null);
  const { openWithPrompt } = useNytaModal(); // botão "Nova estratégia" abre a Nyta com o protocolo
  const [, setSaving] = useState(false);
  const showProRequired = () => setProModalOpen(true);

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

  const selectedStrategy = useMemo(
    () => strategies.find((strategy) => strategy.id === selectedTaskRef?.strategyId),
    [strategies, selectedTaskRef?.strategyId]
  );
  const selectedTask = useMemo(
    () => selectedStrategy?.tasks?.find((task) => task.id === selectedTaskRef?.taskId),
    [selectedStrategy, selectedTaskRef?.taskId]
  );
  const commenterName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    'Usuário';
  const commenterAvatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    undefined;

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

  // Edições da tarefa e acompanhamento usam editPlanning: manter tarefas existentes
  // não exige assinatura PRO; criação/remoção de estruturas continua usando manageTasks.
  // Criação/remoção de estruturas continua usando manageTasks (PRO).
  const commit = async (mut: (ss: Strategy[]) => Strategy[], cap: boolean = manageTasks) => {
    if (!artist || !cap) return;
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

  const syncTaskEvent = (strategy: Strategy, task: ActionTask, patch: Partial<ActionTask>) => {
    if (!artist || (!Object.prototype.hasOwnProperty.call(patch, 'deadline') && !Object.prototype.hasOwnProperty.call(patch, 'description') && !Object.prototype.hasOwnProperty.call(patch, 'status'))) return;
    const nextTask = { ...task, ...patch };
    void eventsDb.syncActionPlanTaskEvent({
      artistId: artist.id,
      taskId: task.id,
      title: nextTask.description,
      strategyTitle: strategy.title,
      deadline: nextTask.deadline,
      completed: nextTask.status === 'done',
    }).catch(() => toast.error('A tarefa foi salva, mas não consegui atualizar a Agenda.'));
  };

  const patchTask = (sid: string, tid: string, patch: Partial<ActionTask>) => {
    const strategy = artist?.content?.strategies?.find((s) => s.id === sid);
    const task = strategy?.tasks?.find((t) => t.id === tid);
    commit((ss) => ss.map((s) => (s.id !== sid ? s : { ...s, tasks: (s.tasks || []).map((t) => (t.id === tid ? { ...t, ...patch } : t)) })), editPlanning);
    if (strategy && task) syncTaskEvent(strategy, task, patch);
  };
  // Marcar como concluída é ACOMPANHAR (não estrutural): liberado pra quem cria/acessa o plano
  // (dono do perfil ou membro com nível plan), via editPlanning em vez de manageTasks.
  const toggleDone = (sid: string, t: ActionTask) => {
    const nextDone = !isDone(t);
    void commit(
      (ss) => ss.map((s) => (s.id !== sid ? s : { ...s, tasks: (s.tasks || []).map((x) => (x.id === t.id ? { ...x, status: nextDone ? 'done' : 'todo' } : x)) })),
      editPlanning
    );
    const strategy = artist?.content?.strategies?.find((s) => s.id === sid);
    if (strategy) syncTaskEvent(strategy, t, { status: nextDone ? 'done' : 'todo' });
    toast.success(nextDone ? 'Tarefa concluída.' : 'Tarefa reaberta.');
  };
  const delTask = (sid: string, tid: string) => {
    const strategy = artist?.content?.strategies?.find((s) => s.id === sid);
    const task = strategy?.tasks?.find((t) => t.id === tid);
    commit((ss) => ss.map((s) => (s.id !== sid ? s : { ...s, tasks: (s.tasks || []).filter((t) => t.id !== tid) })));
    if (strategy && task?.deadline) syncTaskEvent(strategy, task, { deadline: undefined });
    setSelectedTaskRef(null);
    toast.success('Tarefa excluída.');
  };
  const addTaskComment = (sid: string, tid: string, body: string) => {
    if (!editPlanning) { showProRequired(); return; }
    const task = artist?.content?.strategies
      ?.find((strategy) => strategy.id === sid)
      ?.tasks?.find((item) => item.id === tid);
    if (!task) return;
    patchTask(sid, tid, {
      comments: [
        ...(task.comments || []),
        {
          id: uid(),
          body,
          authorId: user?.id,
          authorName: commenterName,
          authorAvatarUrl: commenterAvatarUrl,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    toast.success('Comentário adicionado.');
  };
  const editTaskComment = (sid: string, tid: string, commentId: string, body: string) => {
    if (!editPlanning && !manageTasks) { showProRequired(); return; }
    const task = artist?.content?.strategies
      ?.find((strategy) => strategy.id === sid)
      ?.tasks?.find((item) => item.id === tid);
    if (!task) return;
    patchTask(sid, tid, {
      comments: (task.comments || []).map((comment) => (
        comment.id === commentId
          ? { ...comment, body, updatedAt: new Date().toISOString() }
          : comment
      )),
    });
    toast.success('Comentário atualizado.');
  };
  const deleteTaskComment = (sid: string, tid: string, commentId: string) => {
    if (!editPlanning && !manageTasks) { showProRequired(); return; }
    const task = artist?.content?.strategies
      ?.find((strategy) => strategy.id === sid)
      ?.tasks?.find((item) => item.id === tid);
    if (!task) return;
    patchTask(sid, tid, {
      comments: (task.comments || []).filter((comment) => comment.id !== commentId),
    });
    toast.success('Comentário excluído.');
  };
  // "Arquivadas" → trazer pro plano: semeia as tarefas do banco (buildActionPlan) nas selecionadas.
  // Como passam a ter tarefa, saem do arquivo e entram na lista principal (na prioridade salva).
  const activateArchived = (ids: string[]) => {
    if (!manageTasks) { showProRequired(); return; }
    if (!ids.length) return;
    commit((ss) => ss.map((s) => (ids.includes(s.id) ? { ...s, tasks: buildActionPlan(s) } : s)));
    setArchiveOpen(false);
    message.success(ids.length === 1 ? 'Estratégia trazida pro plano de ação.' : `${ids.length} estratégias trazidas pro plano de ação.`);
  };
  if (!artist) return <Spinner loading>{null as any}</Spinner>;

  // Só libera o Plano de Ação quando o wizard foi CONCLUÍDO (Finalizar). Ter estratégias geradas mas
  // não ter selecionado quais viram tarefa (step 7) nem finalizado (step 8) → volta pro wizard.
  if (!isOnboardingComplete(artist)) {
    // Sem wrapper .ap: ocupa a tela toda (full-bleed), igual à tela de feature bloqueada.
    return (
      <EnhancedEmptyState
        artistId={artist.id}
        artistName={content?.identity?.name || artist.name || ''}
        // `convidado` diz ao wizard que o convite já foi feito aqui — sem ele a pessoa veria a
        // mesma mensagem duas vezes seguidas, e clicaria em "começar" duas vezes.
        onStartWizard={() => navigate(`/artists/${artist.id}/wizard`, { state: { convidado: true } })}
        canStart={editPlanning}
      />
    );
  }

  // ---- Progresso das estratégias da fase atual ----
  //
  // A busca do topo filtra as TAREFAS; a estratégia continua visível se alguma das suas casar.
  // Filtrar estratégias pelo título esconderia tarefas que batem dentro de uma estratégia cujo
  // nome não bate — e é a tarefa que a pessoa está procurando.
  const q = normalizar(termoBusca);
  const casa = (t: { title?: string; description?: string }) =>
    !q || normalizar(t.title || '').includes(q) || normalizar(t.description || '').includes(q);

  const info = ranked.map((s) => {
    const ts = (s.tasks || []).filter(isActive).filter(casa);
    const done = ts.filter(isDone).length;
    return { s, ts, done, total: ts.length, complete: ts.length > 0 && done === ts.length };
  });
  // A lista principal mostra só as estratégias que o artista PRIORIZOU (geraram tarefa). As demais
  // (sem tarefa) ficam ARQUIVADAS — acessíveis pelo botão/modal "Arquivadas", de onde o artista
  // traz pro plano (ganham tarefas e entram na lista). Não aparecem soltas embaixo (confundia).
  const withTasks = info.filter((p) => p.total > 0);
  const archived = info.filter((p) => p.total === 0);
  const hasArchive = withTasks.length > 0 && archived.length > 0;
  const displayed = withTasks.length ? withTasks : info; // sem nenhuma priorizada, mostra tudo
  const focusIdx = displayed.findIndex((p) => p.total > 0 && !p.complete); // -1 = todas concluídas
  const activePlanId = openId && openId !== '__none__' ? openId : displayed[focusIdx >= 0 ? focusIdx : 0]?.s.id;
  const activePlan = displayed.find((p) => p.s.id === activePlanId) || displayed[0];

  return (
    <div className="ap action-plan-page">
      <header className="module-page-heading">
        <div>
          <p>EXECUÇÃO DIÁRIA</p>
          <h1>Plano de Ação</h1>
          <span>Execute suas estratégias em tarefas e acompanhe o progresso até subir de fase.</span>
        </div>
      </header>

      <section className="action-strategy-overview" aria-label="Estratégias do plano">
        <header>
          <div><p>ESTRATÉGIAS DO PLANO</p><h3>Ranking de execução</h3></div>
          <div className="action-overview-actions">
            <span>{displayed.length} estratégias</span>
            {hasArchive && <button type="button" onClick={() => manageTasks ? setArchiveOpen(true) : showProRequired()}><FiArchive size={13} /> Arquivadas ({archived.length})</button>}
          </div>
        </header>
        <div className="action-strategy-scroll">
          {displayed.map((p, idx) => {
            const progress = p.total ? Math.round((p.done / p.total) * 100) : 0;
            return (
              <button type="button" className={p.s.id === activePlan?.s.id ? 'active' : ''} key={p.s.id} onClick={() => setOpenId(p.s.id)}>
                <span>ESTRATÉGIA #{String(idx + 1).padStart(2, '0')}</span>
                <strong>{p.s.title}</strong>
                <small>{p.complete ? 'Concluída' : `${p.done} de ${p.total} tarefas`}</small>
                <i><b style={{ width: `${progress}%` }} /></i>
                <em>{progress}%</em>
              </button>
            );
          })}
        </div>
      </section>

      {activePlan && (
        <section className="action-active-strategy">
          <div className="action-strategy-grid">
            <section className="action-task-register">
              <header>
                <div><p>ESTRATÉGIA #{String(displayed.findIndex((p) => p.s.id === activePlan.s.id) + 1).padStart(2, '0')}</p><h3>Tarefas</h3></div>
                <button type="button" onClick={() => manageTasks ? openWithPrompt(`Quero criar uma tarefa para a estratégia "${activePlan.s.title}"`) : showProRequired()}>
                  {!manageTasks ? <FiLock size={14} /> : <FiPlus size={14} />} Adicionar tarefa
                </button>
              </header>
              {activePlan.ts.length === 0 ? (
                <div className="ap-empty-tasks">Nenhuma tarefa ainda. Crie a primeira com a Nyta no botão acima.</div>
              ) : (
                <div className="action-task-register-table">
                  <header><span>Tarefa</span><span>Tipo</span><span>Responsável</span><span>Prazo</span><span>Status</span><span /></header>
                  {activePlan.ts.map((t, index) => {
                    const done = isDone(t);
                    const overdue = !!(t.deadline && t.deadline < today && !done);
                    const statusLabel = done ? 'Concluída' : t.status === 'in_progress' ? 'Em andamento' : 'A fazer';
                    const statusClass = done ? 'priority-normal' : overdue ? 'priority-alta' : t.status === 'in_progress' ? 'priority-média' : 'priority-normal';
                    return (
                      <article key={t.id || `${activePlan.s.id}-${index}`} className={done ? '' : index === 0 ? 'selected' : ''}>
                    <span className="action-task-title"><button type="button" className={`action-task-check${done ? ' is-done' : ''}`} title={done ? 'Reabrir tarefa' : 'Concluir tarefa'} onClick={() => editPlanning ? toggleDone(activePlan.s.id, t) : showProRequired()}>{done ? <FiCheckCircle size={25} /> : <FiCircle size={25} />}</button><strong>{t.description}{t.comments?.length ? <small>{`${t.comments.length} comentário${t.comments.length === 1 ? '' : 's'}`}</small> : null}</strong></span>
                        <TaskCategory className="ap-type" value={t.type} disabled={!editPlanning} onBlocked={showProRequired} onChange={(v) => patchTask(activePlan.s.id, t.id, { type: v })} />
                        <span><TaskOwner className="ap-owner" value={t.owner} assignees={assignees} disabled={!editPlanning} onBlocked={showProRequired} onChange={(o) => patchTask(activePlan.s.id, t.id, { owner: o })} /></span>
                        <TaskDate className="ap-date" value={t.deadline} overdue={overdue} disabled={!editPlanning} onBlocked={showProRequired} onChange={(d) => patchTask(activePlan.s.id, t.id, { deadline: d })} />
                        <b className={statusClass}>{statusLabel}</b>
                        <button type="button" className="action-task-more" aria-label="Abrir detalhes da tarefa" onClick={() => setSelectedTaskRef({ strategyId: activePlan.s.id, taskId: t.id })}><FiMoreVertical size={17} /></button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </section>
      )}

      {/* Consultora da Nyta (mesma seção do rodapé do Dashboard) no lugar do texto simples de objetivos */}
      <NytaDashboardHero />

      <TaskDetailModal
        open={!!selectedTaskRef}
        task={selectedTask}
        strategyTitle={selectedStrategy?.title}
        assignees={assignees}
        canEdit={editPlanning}
        canDelete={manageTasks}
        currentUserId={user?.id}
        currentUserName={commenterName}
        currentUserAvatarUrl={commenterAvatarUrl}
        onClose={() => setSelectedTaskRef(null)}
        onSave={(patch) => {
          if (!selectedTaskRef) return;
          patchTask(selectedTaskRef.strategyId, selectedTaskRef.taskId, patch);
          toast.success('Tarefa atualizada.');
        }}
        onAddComment={(body) => {
          if (!selectedTaskRef) return;
          addTaskComment(selectedTaskRef.strategyId, selectedTaskRef.taskId, body);
        }}
        onEditComment={(commentId, body) => {
          if (!selectedTaskRef) return;
          editTaskComment(selectedTaskRef.strategyId, selectedTaskRef.taskId, commentId, body);
        }}
        onDeleteComment={(commentId) => {
          if (!selectedTaskRef) return;
          deleteTaskComment(selectedTaskRef.strategyId, selectedTaskRef.taskId, commentId);
        }}
        onDelete={() => {
          if (!selectedTaskRef) return;
          delTask(selectedTaskRef.strategyId, selectedTaskRef.taskId);
        }}
      />

      {archiveOpen && (
        <ArchiveModal
          items={archived.map((p) => ({ id: p.s.id, title: p.s.title }))}
          onConfirm={activateArchived}
          onClose={() => setArchiveOpen(false)}
        />
      )}
      <UpsellModal open={proModalOpen} context="action-plan" onClose={() => setProModalOpen(false)} />
    </div>
  );
};

export default ActionPlan;
