import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, DatePicker, message } from 'antd';
import { createPortal } from 'react-dom';
import dayjs from 'dayjs';
import { FiArchive, FiCheck, FiCheckCircle, FiChevronDown, FiCircle, FiLock, FiMoreVertical, FiPlus, FiX } from 'react-icons/fi';

import { useNytaModal } from '@maestra/core/hooks/useNytaModal';
import { buildActionPlan } from '@maestra/core/wizard/motores';

import { useArtist } from '@maestra/core/hooks/useArtist';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { useGlobalSearch, normalizar } from '@maestra/core/stores/globalSearchStore';
import EnhancedEmptyState from '../../components/action-plan/EnhancedEmptyState';
import { UpsellModal } from '../../components/UpsellModal';
import { TaskDate, TaskCategory, TaskOwner, type Assignee } from './TaskControls';
import { TaskDetailModal } from './TaskDetailModal';
import { TASK_OWNER_SELF, isOnboardingComplete } from '@maestra/core/constants/maestra';
import { listMembers } from '@maestra/core/services/db/members';
import * as eventsDb from '@maestra/core/services/db/events';
import type { ActionPlanAction, ActionTask, ArtistContent, ArtistMember, Strategy } from '@maestra/core/interfaces/maestra';
import { migrateContentToV13 } from '@maestra/core/services/migracaoV13';
import { buildV13Actions, defaultV13Schedule } from '@maestra/core/services/cronogramaV13';
import './actionPlan.scss';

const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toISOString().split('T')[0];

const isDone = (t: ActionTask) => t.status === 'done';
const isActive = (t: ActionTask) => t.status !== 'archived';
// fmtDate vive em TaskControls/TaskComposer (componentes que exibem datas).

const ActionPlanScheduleView: FC<{
  strategies: Strategy[];
  canEdit: boolean;
  onBlocked: () => void;
  onChange: (strategyId: string, taskId: string, deadline?: string) => void;
}> = ({ strategies, canEdit, onBlocked, onChange }) => {
  const rows = useMemo(
    () => strategies.flatMap((strategy) => (strategy.tasks || []).filter(isActive).map((task, index) => ({ strategy, task, index }))),
    [strategies]
  );
  const dates = rows.map(({ task }) => task.deadline).filter(Boolean) as string[];
  const orderedDates = dates.map((date) => dayjs(date)).sort((a, b) => a.valueOf() - b.valueOf());
  const start = (orderedDates.length ? orderedDates[0] : dayjs()).startOf('month');
  const endDate = orderedDates.length ? orderedDates[orderedDates.length - 1] : start;
  const end = endDate.endOf('month');
  const monthCount = Math.max(1, end.diff(start, 'month') + 1);
  const width = Math.max(720, monthCount * 150);
  const span = Math.max(1, end.diff(start, 'day'));
  const months = Array.from({ length: monthCount }, (_, index) => start.add(index, 'month'));
  const position = (date?: string) => date ? Math.max(0, Math.min(100, (dayjs(date).diff(start, 'day') / span) * 100)) : 0;

  return (
    <section className="action-plan-schedule" aria-label="Cronograma do plano de ação">
      <header className="action-plan-schedule-header">
        <div>
          <span>CRONOGRAMA</span>
          <h2>Organize as ações do seu plano</h2>
          <p>Edite o início de cada ação diretamente no Gantt e acompanhe a distribuição do trabalho.</p>
        </div>
        <strong>{rows.length}<small>ações</small></strong>
      </header>
      {rows.length ? (
        <div className="action-plan-gantt" aria-label="Gantt editável">
          <div className="action-plan-gantt-content" style={{ width: 300 + width }}>
            <div className="action-plan-gantt-corner">Ações</div>
            <div className="action-plan-gantt-months" style={{ width }}>
              {months.map((month) => <span key={month.format('YYYY-MM')} style={{ width: width / monthCount }}>{month.format('MMM YYYY')}</span>)}
            </div>
            {rows.map(({ strategy, task, index }) => (
              <div className="action-plan-gantt-row" key={`${strategy.id}-${task.id || index}`}>
                <div className="action-plan-gantt-task">
                  <small>{String(index + 1).padStart(2, '0')}</small>
                  <span><b>{strategy.title}</b>{task.description}</span>
                </div>
                <div className="action-plan-gantt-timeline" style={{ width }}>
                  {months.map((month) => <i key={month.format('YYYY-MM')} style={{ width: width / monthCount }} />)}
                  <DatePicker
                    allowClear
                    inputReadOnly
                    disabled={!canEdit}
                    aria-label={`Início: ${task.description}`}
                    className="action-plan-gantt-marker"
                    value={task.deadline ? dayjs(task.deadline) : null}
                    onClick={!canEdit ? onBlocked : undefined}
                    onChange={(value) => onChange(strategy.id, task.id, value?.format('YYYY-MM-DD'))}
                    format="DD MMM"
                    style={{ left: `${position(task.deadline)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="action-plan-schedule-empty">Nenhuma ação ativa para organizar no cronograma.</div>
      )}
    </section>
  );
};


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
      style={{ position: 'fixed', inset: 0, zIndex: 'var(--z-overlay)', background: 'rgba(20, 30, 55, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 720, maxHeight: '86vh', background: '#ffffff', border: '1px solid #e3eaf3', borderRadius: 16, boxShadow: '0 24px 60px rgba(24, 40, 80, 0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ padding: '22px 22px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontFamily: 'var(--font-display)', color: '#2c3f63', fontWeight: 800, fontSize: 22, lineHeight: 1.2 }}>Estratégias arquivadas</div>
            <button onClick={onClose} aria-label="Fechar" style={{ background: 'none', border: 'none', color: '#93a4c0', cursor: 'pointer', display: 'inline-flex', padding: 4 }}><FiX size={20} /></button>
          </div>
          <div style={{ color: '#7c8da8', fontSize: 13.5, marginTop: 8, lineHeight: 1.5 }}>
            Estratégias que você não priorizou. Selecione as que quer <b style={{ color: '#2c3f63' }}>trazer pro plano</b> — elas ganham tarefas e entram na lista principal, saindo do arquivo.
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 22px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => {
            const on = sel.includes(it.id);
            return (
              <button
                key={it.id}
                onClick={() => toggle(it.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer', background: on ? 'rgba(51, 97, 255, 0.08)' : '#f7f8fb', border: `1px solid ${on ? '#3361ff' : 'transparent'}`, borderRadius: 12, padding: '14px 16px', transition: 'background .15s, border-color .15s' }}
              >
                <span aria-hidden style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 6, border: `2px solid ${on ? '#3361ff' : '#c9d6ea'}`, background: on ? '#3361ff' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF' }}>{on && <FiCheck size={14} />}</span>
                <span style={{ color: '#405985', fontWeight: 600, fontSize: 14.5, lineHeight: 1.4 }}>{it.title}</span>
              </button>
            );
          })}
        </div>
        <div style={{ padding: '12px 22px 18px', borderTop: '1px solid #eef2f8', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#93a4c0', fontSize: 13 }}>{sel.length} selecionada{sel.length === 1 ? '' : 's'}</span>
          <button className="ap-btn ap-btn--ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>Cancelar</button>
          <button
            disabled={!sel.length}
            onClick={() => onConfirm(sel)}
            style={{ border: 'none', borderRadius: 9999, padding: '10px 20px', fontWeight: 700, fontSize: 13.5, cursor: sel.length ? 'pointer' : 'not-allowed', color: '#FFFFFF', background: '#3361ff', opacity: sel.length ? 1 : 0.5 }}
          >
            Trazer pro plano{sel.length ? ` (${sel.length})` : ''}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ActionPlan: FC<{ embedded?: boolean }> = ({ embedded = false }) => {
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
  const [activeView, setActiveView] = useState<'strategies' | 'schedule'>('strategies');
  const [archiveOpen, setArchiveOpen] = useState(false); // modal "Arquivadas": traz estratégia pro plano
  const [proModalOpen, setProModalOpen] = useState(false);
  const [selectedTaskRef, setSelectedTaskRef] = useState<{ strategyId: string; taskId: string } | null>(null);
  const { openWithPrompt } = useNytaModal(); // botão "Nova estratégia" abre a Nyta com o protocolo
  const [, setSaving] = useState(false);
  const showProRequired = () => setProModalOpen(true);
  const migrationStarted = useRef(false);

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
    // Só a foto de quem está logado existe: `artist_members` não tem coluna de avatar e o
    // `user_metadata` dos outros o cliente não lê. Quem não tem cai no avatar padrão.
    const meta = (user?.user_metadata || {}) as Record<string, string | undefined>;
    const minhaFoto = meta.avatar_url || meta.picture || null;
    const list: Assignee[] = [
      { value: TASK_OWNER_SELF, label: ownerName, avatar: isOwner ? minhaFoto : null },
    ];
    members
      .filter((m) => m.status === 'active')
      .forEach((m) => list.push({
        value: m.email,
        label: m.name || m.email,
        avatar: user?.email && m.email.toLowerCase() === user.email.toLowerCase() ? minhaFoto : null,
      }));
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

  // Converte planos antigos somente quando o usuário pode editá-los. A conversão mantém `tasks`
  // para compatibilidade e grava as ações v1.3 em paralelo, permitindo rollback por versão.
  useEffect(() => {
    if (!artist || !editPlanning || migrationStarted.current) return;
    if (!artist.content?.strategies?.some((strategy) => strategy.bankId && !strategy.actions?.length)) return;
    migrationStarted.current = true;
    const migrated = migrateContentToV13(artist.content, todayStr());
    if (!migrated.report.migratedStrategyIds.length) return;
    dispatch(artistsActions.setArtistContentLocal({ id: artist.id, content: migrated.content }));
    void dispatch(artistsActions.updateArtistContent({ id: artist.id, content: migrated.content })).unwrap().catch(() => {
      message.warning('O plano antigo continua disponível, mas a migração v1.3 será repetida depois.');
    });
  // `artist` is intentionally read from the current snapshot; the ref prevents duplicate migrations.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist?.id, editPlanning, dispatch]);

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
    if (!artist || (!Object.prototype.hasOwnProperty.call(patch, 'deadline') && !Object.prototype.hasOwnProperty.call(patch, 'description') && !Object.prototype.hasOwnProperty.call(patch, 'status') && !Object.prototype.hasOwnProperty.call(patch, 'owner'))) return;
    const nextTask = { ...task, ...patch };
    const assignedMember = nextTask.owner && nextTask.owner !== TASK_OWNER_SELF
      ? members.find((member) => member.status === 'active' && member.email.toLowerCase() === nextTask.owner?.toLowerCase())
      : undefined;
    void eventsDb.syncActionPlanTaskEvent({
      artistId: artist.id,
      taskId: task.id,
      title: nextTask.description,
      strategyTitle: strategy.title,
      deadline: nextTask.deadline,
      completed: nextTask.status === 'done',
      recurrence: nextTask.schedule?.recurrence,
      assigneeKind: nextTask.owner ? (nextTask.owner === TASK_OWNER_SELF ? 'owner' : assignedMember ? 'member' : 'unassigned') : 'unassigned',
      assigneeMemberId: assignedMember?.id || null,
    }).catch((error: unknown) => {
      console.error('[ActionPlan] Não foi possível sincronizar o prazo na Agenda:', error);
      const dbError = error as { message?: string; details?: string; hint?: string; code?: string } | null;
      const detailText = [dbError?.message, dbError?.details, dbError?.hint].filter(Boolean).join(' — ');
      const detail = detailText ? ` [${dbError?.code || 'agenda_sync'}] ${detailText}` : '';
      toast.error(`A ação foi salva, mas a Agenda não foi sincronizada.${detail || ' Tente novamente em instantes.'}`);
    });
  };

  const syncActionEvent = (strategy: Strategy, action: ActionPlanAction, patch: Partial<ActionPlanAction>) => {
    if (!artist) return;
    const nextAction = { ...action, ...patch };
    const assignedMember = nextAction.owner && nextAction.owner !== TASK_OWNER_SELF
      ? members.find((member) => member.status === 'active' && member.email.toLowerCase() === nextAction.owner?.toLowerCase())
      : undefined;
    void eventsDb.syncActionPlanTaskEvent({
      artistId: artist.id,
      taskId: action.id,
      title: nextAction.title,
      strategyTitle: strategy.title,
      deadline: nextAction.date,
      completed: nextAction.status === 'done',
      recurrence: nextAction.cadence === 'semanal' ? 'weekly' : undefined,
      assigneeKind: nextAction.owner
        ? (nextAction.owner === TASK_OWNER_SELF ? 'owner' : assignedMember ? 'member' : 'unassigned')
        : 'unassigned',
      assigneeMemberId: assignedMember?.id || null,
    }).catch((error: unknown) => {
      console.error('[ActionPlan] Não foi possível sincronizar a ação v1.3 na Agenda:', error);
      toast.error('A ação foi salva, mas a Agenda não foi sincronizada.');
    });
  };

  const patchTask = (sid: string, tid: string, patch: Partial<ActionTask>) => {
    const strategy = artist?.content?.strategies?.find((s) => s.id === sid);
    const task = strategy?.tasks?.find((t) => t.id === tid);
    commit((ss) => ss.map((s) => (s.id !== sid ? s : { ...s, tasks: (s.tasks || []).map((t) => (t.id === tid ? { ...t, ...patch } : t)) })), editPlanning);
    if (strategy && task) syncTaskEvent(strategy, task, patch);
  };

  const patchAction = (sid: string, action: ActionPlanAction, date?: string) => {
    void commit((ss) => ss.map((s) => s.id !== sid ? s : {
      ...s,
      actions: (s.actions || []).map((item) => item.id === action.id ? { ...item, date } : item),
    }), editPlanning);
    const strategy = artist?.content?.strategies?.find((s) => s.id === sid);
    if (strategy) syncActionEvent(strategy, action, { date });
  };

  const toggleActionChecklist = (sid: string, actionId: string, taskId: string) => {
    void commit((ss) => ss.map((s) => s.id !== sid ? s : {
      ...s,
      actions: (s.actions || []).map((action) => action.id !== actionId ? action : {
        ...action,
        tasks: action.tasks.map((task) => task.id === taskId ? { ...task, status: task.status === 'done' ? 'todo' : 'done' } : task),
      }),
    }), editPlanning);
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
    if (!content) return;
    const schedule = content.actionPlanScheduleV13 || defaultV13Schedule(todayStr());
    commit((ss) => ss.map((s) => {
      if (!ids.includes(s.id)) return s;
      const activated = { ...s, tasks: buildActionPlan(s) };
      return {
        ...activated,
        actions: buildV13Actions(activated, schedule, { today: todayStr(), existing: s.actions }),
        actionPlanVersion: 'v3' as const,
      };
    }));
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
    const v13Rows: ActionTask[] = (s.actions || []).filter((action) => action.status !== 'archived').map((action) => ({
      id: action.id,
      description: action.title,
      owner: action.owner,
      deadline: action.date,
      status: action.status,
      schedule: {
        anchor: action.anchor,
        order: action.number,
        tight: action.tight,
        continuous: action.dateType === 'rotina',
        recurrence: action.cadence === 'semanal' ? 'weekly' : undefined,
        strategyId: s.id,
      },
    }));
    const ts = (s.actions?.length ? v13Rows : s.tasks || []).filter(isActive).filter(casa);
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
  const totalActions = info.reduce((sum, item) => sum + item.total, 0);
  const completedActions = info.reduce((sum, item) => sum + item.done, 0);
  const focusIdx = displayed.findIndex((p) => p.total > 0 && !p.complete); // -1 = todas concluídas
  // `undefined` (estado inicial) e '__none__' (fechou explicitamente) NAO sao a mesma coisa —
  // antes eram tratados igual, e isso escondia um bug: fechar a PROPRIA estrategia em foco (a
  // primeira incompleta) caia de novo nesse mesmo fallback, reabrindo ela mesma. Parecia que o
  // clique de fechar simplesmente nao funcionava — e so nessa estrategia especifica, o que tornava
  // mais dificil perceber a causa. So `undefined` (ninguem escolheu nada ainda) usa o
  // auto-foco; '__none__' fecha de verdade, sem nada reabrindo sozinho.
  const activePlanId = openId === undefined
    ? displayed[focusIdx >= 0 ? focusIdx : 0]?.s.id
    : (openId === '__none__' ? undefined : openId);

  return (
    <div className={`ap action-plan-page${embedded ? ' action-plan-page--embedded' : ''}`}>
      {embedded ? (
        <header className="module-page-heading action-plan-method-header">
          <div className="action-plan-header-top">
            <div className="action-plan-header-copy">
              <p>EXECUÇÃO DIÁRIA</p>
              <div className="action-plan-header-result">
                <h1>Plano de Ação</h1>
                <span>Execute suas estratégias em ações, conclua cada etapa e acompanhe o avanço do seu plano.</span>
              </div>
            </div>
          </div>
          <div className="action-plan-header-summary">
            <div className="action-plan-header-side">
              <span>AÇÕES DO CICLO</span>
              <strong>{completedActions}/{totalActions}</strong>
            </div>
          </div>
        </header>
      ) : (
        <header className="module-page-heading action-plan-standalone-heading">
          <div>
            <p>EXECUÇÃO DIÁRIA</p>
            <h1>Plano de Ação</h1>
            <span>Execute suas estratégias em ações, conclua cada etapa e acompanhe o avanço do seu plano.</span>
          </div>
        </header>
      )}

      <div className="action-plan-tabs-row">
        <nav className="action-plan-view-tabs" role="tablist" aria-label="Visualização do plano de ação">
          <button type="button" role="tab" className={activeView === 'strategies' ? 'is-active' : ''} aria-selected={activeView === 'strategies'} onClick={() => setActiveView('strategies')}>
            Estratégias
          </button>
          <button type="button" role="tab" className={activeView === 'schedule' ? 'is-active' : ''} aria-selected={activeView === 'schedule'} onClick={() => setActiveView('schedule')}>
            Cronograma
          </button>
        </nav>
        <div className="action-plan-tabs-actions">
          {activeView === 'strategies' && (
            <button
              type="button"
              className="action-plan-new-strategy"
              onClick={() => manageTasks ? openWithPrompt('Quero criar uma nova estratégia para o meu plano de ação.') : showProRequired()}
            >
              <FiPlus aria-hidden />
              Nova estratégia
            </button>
          )}
          {hasArchive && (
            <button className="action-plan-archived-button" type="button" onClick={() => manageTasks ? setArchiveOpen(true) : showProRequired()}>
              <FiArchive size={13} />
              Arquivadas ({archived.length})
            </button>
          )}
        </div>
      </div>

      {activeView === 'strategies' ? <section className="action-strategy-overview" aria-label="Estratégias do plano">
        {/* Acordeão: cada estratégia é uma linha que abre as PRÓPRIAS tarefas embaixo dela — não
            mais um cartão aqui em cima e uma tabela solta mais abaixo na página. Era esse salto,
            escolher a estratégia e ter que procurar a lista de tarefas alguns scrolls depois, que
            motivou a reclamação. Só uma aberta por vez, como já era (activePlanId decide qual);
            clicar na que já está aberta fecha — usa o sentinela '__none__', que já existia no
            código sem nada que o disparasse (a lógica de fechar nunca tinha sido ligada). */}
        <div
          className="ap-plan-list"
          style={{ ['--action-plan-progress' as string]: `${displayed.length ? ((focusIdx >= 0 ? focusIdx + 1 : displayed.length) / displayed.length) * 100 : 0}%` }}
        >
          {displayed.map((p, idx) => {
            const isOpen = p.s.id === activePlanId;
            const isCurrent = idx === focusIdx;
            const strategyContext = p.s.description || p.s.why;
            return (
              <div key={p.s.id} className={`ap-plan-row${isOpen ? ' is-open' : ''}${p.complete ? ' is-complete' : ''}${isCurrent ? ' is-current' : ''}`}>
                <button
                  type="button"
                  className="ap-plan-row-head"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? '__none__' : p.s.id)}
                >
                  <FiChevronDown className="ap-plan-chevron" aria-hidden />
                  <span className="ap-plan-row-main">
                    <em>
                      ESTRATÉGIA #{String(idx + 1).padStart(2, '0')}
                    </em>
                    <strong>{p.s.title}</strong>
                    {strategyContext && <span className="ap-plan-row-description">{strategyContext}</span>}
                  </span>
                  {/* Sem a barra: só o "1/10" já diz a mesma coisa, e num cabeçalho que agora
                      pode ter várias linhas de título (título não trunca mais), a barra virava
                      um segundo elemento solto competindo por espaço sem acrescentar informação. */}
                  <span className="ap-plan-row-progress">
                    <small>{p.complete ? 'Concluída' : `${p.done}/${p.total}`}</small>
                  </span>
                </button>

                {isOpen && (
                  <div className="ap-plan-row-body">
                    <section className="action-task-register">
                      {/* Nem o rótulo "ESTRATÉGIA #0N" nem "Tarefas" aparecem aqui: a linha do
                          acordeão logo acima já diz numeração e título, e dentro de uma estratégia
                          aberta não há ambiguidade sobre o que a lista embaixo contém — o
                          cabeçalho só ocupava altura pra repetir contexto que já estava a poucos
                          pixels dali. O "Adicionar tarefa" desce pro fim da lista, onde uma ação
                          de "adicionar mais um item" costuma ficar. */}
                      {p.s.actions?.length ? (
                        <ul className="ap-v13-actionlist">
                          {p.s.actions.filter((action) => action.status !== 'archived').map((action) => {
                            const done = action.status === 'done';
                            const checklistDone = action.tasks.filter((task) => task.status === 'done').length;
                            return (
                              <li key={action.id} className={`ap-v13-action${done ? ' is-done' : ''}`}>
                                <div className="ap-v13-action-head">
                                  <strong>{action.title}</strong>
                                  <span className="ap-v13-action-meta ap-plan-task-meta">
                                    <TaskOwner className="ap-owner" value={action.owner} assignees={assignees} disabled={!editPlanning} onBlocked={showProRequired} onChange={(owner) => {
                                      void commit((ss) => ss.map((s) => s.id !== p.s.id ? s : { ...s, actions: (s.actions || []).map((item) => item.id === action.id ? { ...item, owner } : item) }), editPlanning);
                                    }} />
                                    <TaskDate className="ap-date" value={action.date} overdue={!!(action.date && action.date < today && !done)} disabled={!editPlanning} onBlocked={showProRequired} onChange={(date) => patchAction(p.s.id, action, date)} />
                                    <span className="ap-schedule-badge">{checklistDone}/{action.tasks.length}</span>
                                  </span>
                                </div>
                                <ul className="ap-v13-checklist" aria-label={`Checklist de ${action.title}`}>
                                  {action.tasks.map((task) => (
                                    <li key={task.id} className={task.status === 'done' ? 'is-done' : ''}>
                                      <button type="button" aria-label={task.status === 'done' ? `Reabrir ${task.description}` : `Concluir ${task.description}`} onClick={() => editPlanning ? toggleActionChecklist(p.s.id, action.id, task.id) : showProRequired()}>
                                        {task.status === 'done' ? <FiCheck size={13} /> : <FiCircle size={13} />}
                                      </button>
                                      <span>{task.description}</span>
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            );
                          })}
                        </ul>
                      ) : p.ts.length === 0 ? (
                        <div className="ap-empty-tasks">Nenhuma ação ainda. Crie a primeira com a Nyta no botão abaixo.</div>
                      ) : (
                        <ul className="ap-plan-tasklist">
                          {p.ts.map((t, index) => {
                            const done = isDone(t);
                            const overdue = !!(t.deadline && t.deadline < today && !done);
                            return (
                              <li key={t.id || `${p.s.id}-${index}`} className="ap-plan-task">
                                <button type="button" className={`action-task-check${done ? ' is-done' : ''}`} title={done ? 'Reabrir ação' : 'Concluir ação'} onClick={() => editPlanning ? toggleDone(p.s.id, t) : showProRequired()}>
                                  {done ? <FiCheckCircle size={25} /> : <FiCircle size={25} />}
                                </button>
                                <span className="ap-plan-task-main">
                                  <strong>{t.description}{t.comments?.length ? <small>{`${t.comments.length} comentário${t.comments.length === 1 ? '' : 's'}`}</small> : null}</strong>
                                  <span className="ap-plan-task-meta">
                                    <TaskCategory className="ap-type" value={t.type} disabled={!editPlanning} onBlocked={showProRequired} onChange={(v) => patchTask(p.s.id, t.id, { type: v })} />
                                    <TaskOwner className="ap-owner" value={t.owner} assignees={assignees} disabled={!editPlanning} onBlocked={showProRequired} onChange={(o) => patchTask(p.s.id, t.id, { owner: o })} />
                                    {/* O status textual ("A fazer"/"Concluída") saiu: o checkbox ao lado já
                                        distingue feito de não-feito, e repetir isso aqui era o
                                        mesmo dado duas vezes. "Em andamento" deixa de ter um sinal
                                        visual próprio na lista — quem quiser marcar ou ver esse
                                        estado especificamente abre os detalhes da tarefa (botão
                                        "···"), onde o campo Status continua existindo. */}
                                    <TaskDate className="ap-date" value={t.deadline} overdue={overdue} disabled={!editPlanning} onBlocked={showProRequired} onChange={(d) => patchTask(p.s.id, t.id, { deadline: d })} />
                                    {t.schedule?.continuous && <span className="ap-schedule-badge">Contínua</span>}
                                    {t.schedule?.tight && <span className="ap-schedule-badge ap-schedule-badge--tight">Apertada</span>}
                                  </span>
                                </span>
                                <button type="button" className="action-task-more" aria-label="Abrir detalhes da tarefa" onClick={() => setSelectedTaskRef({ strategyId: p.s.id, taskId: t.id })}><FiMoreVertical size={17} /></button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <button
                        type="button"
                        className="ap-plan-add-task"
                        onClick={() => manageTasks ? openWithPrompt(`Quero criar uma ação para a estratégia "${p.s.title}"`) : showProRequired()}
                      >
                        {!manageTasks ? <FiLock size={14} /> : <FiPlus size={14} />} Adicionar ação
                      </button>
                    </section>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section> : (
        <ActionPlanScheduleView
          strategies={displayed.map((item) => item.s)}
          canEdit={editPlanning}
          onBlocked={showProRequired}
          onChange={(strategyId, taskId, deadline) => patchTask(strategyId, taskId, { deadline })}
        />
      )}


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
