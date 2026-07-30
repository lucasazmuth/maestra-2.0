import { FC, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { FiCheck, FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useAppDispatch } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { EventModal } from '../../components/EventModal';
import { EVENT_TYPES } from '../../constants/maestra';
import * as eventsDb from '../../services/db/events';
import type { AgendaEvent, ArtistContent } from '../../interfaces/maestra';
import './agenda.scss';

type View = 'month' | 'list';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const typeColor = (type: string) => (EVENT_TYPES as any)[type]?.color || '#6b7280';
const typeLabel = (type: string) => (EVENT_TYPES as any)[type]?.label || type;

const navBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.1)',
  border: 'none',
  color: '#fff',
  width: 32,
  height: 32,
  borderRadius: '50%',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const isTaskEvent = (e: AgendaEvent) => e.type === 'task' || e.source === 'action_plan';

const calendarTitle = (title: string, maxLength = 28) =>
  title.length > maxLength ? `${title.slice(0, maxLength).trimEnd()}…` : title;

const Agenda: FC = () => {
  const { artist } = useArtist();
  const dispatch = useAppDispatch();
  const artistId = artist?.id;
  const { canEditAgenda: canEdit, editPlanning } = useArtistCapabilities(artist);

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Dayjs>(dayjs());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [showTasks, setShowTasks] = useState(true);

  useEffect(() => {
    if (!artistId) return;
    setLoading(true);
    eventsDb
      .listEvents(artistId)
      .then(setEvents)
      .catch(() => message.error('Erro ao carregar agenda'))
      .finally(() => setLoading(false));
  }, [artistId]);

  // Eventos visíveis: o filtro "mostrar tarefas" oculta os eventos gerados pelo Plano de Ação.
  const visibleEvents = useMemo(
    () => (showTasks ? events : events.filter((e) => !isTaskEvent(e))),
    [events, showTasks]
  );
  const hasTaskEvents = useMemo(() => events.some(isTaskEvent), [events]);

  const byDate = useMemo(() => {
    const map: Record<string, AgendaEvent[]> = {};
    for (const e of visibleEvents) {
      (map[e.date] = map[e.date] || []).push(e);
    }
    return map;
  }, [visibleEvents]);

  const monthDays = useMemo(() => {
    const start = cursor.startOf('month').startOf('week');
    const end = cursor.endOf('month').endOf('week');
    const days: Dayjs[] = [];
    let d = start;
    while (d.isBefore(end) || d.isSame(end, 'day')) {
      days.push(d);
      d = d.add(1, 'day');
    }
    return days;
  }, [cursor]);

  const onSaved = (e: AgendaEvent) => {
    setEvents((prev) => {
      const idx = prev.findIndex((x) => x.id === e.id);
      if (idx === -1) return [...prev, e];
      const next = prev.slice();
      next[idx] = e;
      return next;
    });
  };

  const onDeleted = (id: string) => {
    setEvents((prev) => prev.filter((x) => x.id !== id));
  };

  const deleteAgendaEvent = async (event: AgendaEvent) => {
    if (!artist) throw new Error('Artista não encontrado.');

    if (!isTaskEvent(event) || !event.task_id) {
      await eventsDb.deleteEvent(event.id);
      onDeleted(event.id);
      return;
    }

    if (!editPlanning) throw new Error('Você não tem permissão para editar tarefas deste artista.');

    let found = false;
    const content: ArtistContent = {
      ...artist.content,
      strategies: (artist.content.strategies || []).map((strategy) => ({
        ...strategy,
        tasks: (strategy.tasks || []).map((task) => {
          if (task.id !== event.task_id) return task;
          found = true;
          // Remover o evento da Agenda não apaga a tarefa: somente retira seu prazo.
          return { ...task, deadline: undefined };
        }),
      })),
    };

    if (!found) throw new Error('Não encontrei a tarefa vinculada a este evento.');

    await dispatch(artistsActions.updateArtistContent({ id: artist.id, content })).unwrap();
    await eventsDb.deleteEvent(event.id);
    onDeleted(event.id);
    message.success('Prazo removido da tarefa e evento excluído.');
  };

  const openCreate = (date?: string) => {
    if (!canEdit) return; // colaborador sem PRO: somente-leitura
    setEditing(null);
    setDefaultDate(date);
    setModalOpen(true);
  };
  const openEdit = (e: AgendaEvent) => {
    if (!canEdit) return;
    setEditing(e);
    setModalOpen(true);
  };

  // Eventos vindos do Plano de Ação podem ser concluídos sem abrir o modal.
  // A tarefa é a fonte de verdade; o evento espelha apenas seu status na Agenda.
  const toggleTaskEvent = async (event: AgendaEvent) => {
    if (!artist || !event.task_id) return;
    if (!editPlanning) {
      message.error('Você não tem permissão para editar tarefas deste artista.');
      return;
    }

    let found = false;
    const nextStatus = event.status === 'completed' ? 'todo' : 'done';
    const content: ArtistContent = {
      ...artist.content,
      strategies: (artist.content.strategies || []).map((strategy) => ({
        ...strategy,
        tasks: (strategy.tasks || []).map((task) => {
          if (task.id !== event.task_id) return task;
          found = true;
          return { ...task, status: nextStatus };
        }),
      })),
    };

    if (!found) {
      message.error('Não encontrei a tarefa vinculada a este evento.');
      return;
    }

    const completed = nextStatus === 'done';
    try {
      await dispatch(artistsActions.updateArtistContent({ id: artist.id, content })).unwrap();
      const savedEvent = await eventsDb.updateEvent(event.id, { status: completed ? 'completed' : 'scheduled' });
      onSaved(savedEvent);
      message.success(completed ? 'Tarefa concluída.' : 'Tarefa reaberta.');
    } catch {
      message.error('Não consegui atualizar a tarefa agora.');
    }
  };

  const taskCheckbox = (event: AgendaEvent) => {
    const completed = event.status === 'completed';
    return (
      <button
        type="button"
        aria-label={completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
        title={completed ? 'Reabrir tarefa' : 'Concluir tarefa'}
        onClick={(clickEvent) => {
          clickEvent.stopPropagation();
          void toggleTaskEvent(event);
        }}
        style={{
          width: 16,
          height: 16,
          minWidth: 16,
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 4,
          border: `1.5px solid ${typeColor(event.type)}`,
          background: completed ? typeColor(event.type) : 'transparent',
          color: '#15121c',
          cursor: 'pointer',
        }}
      >
        {completed && <FiCheck size={12} strokeWidth={3} />}
      </button>
    );
  };

  if (!artist) return <Spinner loading>{null as any}</Spinner>;

  const today = dayjs().format('YYYY-MM-DD');
  const upcoming = visibleEvents
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return (
    <div className="agenda-page agenda-reference-page" style={{ padding: 24 }}>
      <div className="agenda-page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(24px, 3vw, 28px)', color: '#fff', margin: 0 }}>
          Agenda
        </h1>
        {canEdit && (
          <button
            onClick={() => openCreate()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#9A4FD1', border: 'none', color: '#FFFFFF', padding: '10px 20px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700 }}
          >
            <FiPlus /> Compromisso
          </button>
        )}
      </div>

      <div className="agenda-toolbar">
        <div className="agenda-toolbar-filters">
          {(['month', 'list'] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                background: view === v ? '#fff' : 'rgba(255,255,255,0.1)',
                color: view === v ? '#000' : '#fff',
                border: 'none',
                borderRadius: 9999,
                padding: '6px 16px',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              {v === 'month' ? 'Mês' : 'Lista'}
            </button>
          ))}
          {hasTaskEvents && (
            <button
              onClick={() => setShowTasks((s) => !s)}
              title='Mostrar/ocultar as tarefas do Plano de Ação'
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: showTasks ? `${EVENT_TYPES.task.color}26` : 'rgba(255,255,255,0.1)',
                color: showTasks ? EVENT_TYPES.task.color : '#b3b3b3',
                border: `1px solid ${showTasks ? `${EVENT_TYPES.task.color}80` : 'transparent'}`,
                borderRadius: 9999,
                padding: '6px 14px',
                cursor: 'pointer',
                fontWeight: 700,
                marginLeft: 4,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: EVENT_TYPES.task.color, opacity: showTasks ? 1 : 0.4 }} />
              Tarefas
            </button>
          )}
        </div>
        {view === 'month' && (
          <div className="agenda-toolbar-navigation">
            <button onClick={() => setCursor(cursor.subtract(1, 'month'))} style={navBtn}>
              <FiChevronLeft />
            </button>
            <span className="agenda-toolbar-month">
              {cursor.format('MMMM [de] YYYY')}
            </span>
            <button onClick={() => setCursor(cursor.add(1, 'month'))} style={navBtn}>
              <FiChevronRight />
            </button>
          </div>
        )}
      </div>

      <Spinner loading={loading && !events.length}>
        {view === 'month' ? (
          <div className="agenda-month-view">
            <div className="agenda-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: 6 }}>
              {WEEKDAYS.map((w) => (
                <div key={w}>
                  {w}
                </div>
              ))}
            </div>
            <div className="agenda-month-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
              {monthDays.map((d) => {
                const key = d.format('YYYY-MM-DD');
                const dayEvents = byDate[key] || [];
                const inMonth = d.month() === cursor.month();
                const isToday = key === today;
                return (
                  <div
                    key={key}
                    className={`agenda-day${inMonth ? '' : ' agenda-day-outside'}${isToday ? ' agenda-day-today' : ''}`}
                    onClick={() => openCreate(key)}
                    style={{
                      minHeight: 96,
                      background: inMonth ? '#181818' : '#101010',
                      borderRadius: 8,
                      padding: 6,
                      cursor: 'pointer',
                      border: isToday ? '1px solid #9A4FD1' : '1px solid transparent',
                      opacity: inMonth ? 1 : 0.5,
                    }}
                  >
                    <div className="agenda-day-number">
                      {d.date()}
                    </div>
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
                        className="agenda-event-chip"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          openEdit(e);
                        }}
                        style={{
                          background: `${typeColor(e.type)}33`,
                          color: typeColor(e.type),
                          borderLeft: `3px solid ${typeColor(e.type)}`,
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 11,
                          marginBottom: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          minWidth: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {isTaskEvent(e) && taskCheckbox(e)}
                        <span
                          title={e.title}
                          style={{
                            minWidth: 0,
                            flex: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textDecoration: e.status === 'completed' ? 'line-through' : undefined,
                            opacity: e.status === 'completed' ? 0.7 : 1,
                          }}
                        >
                          {e.start_time ? e.start_time.slice(0, 5) + ' ' : ''}
                          {calendarTitle(e.title)}
                        </span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div style={{ color: '#b3b3b3', fontSize: 11 }}>+{dayEvents.length - 3}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {!upcoming.length ? (
              <div className="agenda-empty" style={{ color: '#b3b3b3', padding: 32, textAlign: 'center' }}>Nenhum evento agendado.</div>
            ) : (
              upcoming.map((e) => (
                <div
                  key={e.id}
                  className="agenda-list-item"
                  onClick={() => openEdit(e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, borderRadius: 8, background: '#181818', cursor: 'pointer' }}
                >
                  <div style={{ width: 4, height: 40, borderRadius: 2, background: typeColor(e.type) }} />
                  {isTaskEvent(e) && taskCheckbox(e)}
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: 700, textDecoration: e.status === 'completed' ? 'line-through' : undefined, opacity: e.status === 'completed' ? 0.65 : 1 }}>{e.title}</div>
                    <div style={{ color: '#b3b3b3', fontSize: 13 }}>
                      {dayjs(e.date).format('DD/MM/YYYY')}
                      {e.start_time ? ` · ${e.start_time.slice(0, 5)}` : ''}
                      {e.location ? ` · ${e.location}` : ''}
                    </div>
                  </div>
                  <span style={{ color: typeColor(e.type), fontSize: 12, fontWeight: 700 }}>{typeLabel(e.type)}</span>
                </div>
              ))
            )}
          </div>
        )}
      </Spinner>

      {artistId && (
        <EventModal
          open={modalOpen}
          artistId={artistId}
          event={editing}
          defaultDate={defaultDate}
          onClose={() => setModalOpen(false)}
          onSaved={onSaved}
          onDeleted={onDeleted}
          onDeleteEvent={deleteAgendaEvent}
          deleteLabel={editing && isTaskEvent(editing) ? 'Remover prazo' : 'Excluir'}
          deleteConfirmTitle={editing && isTaskEvent(editing) ? 'Remover o prazo da tarefa e excluir o evento?' : 'Excluir evento?'}
        />
      )}
    </div>
  );
};

export default Agenda;
