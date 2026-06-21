import { FC, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { FiPlus, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useAppDispatch } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { EventModal } from '../../components/EventModal';
import { EVENT_TYPES } from '../../constants/maestra';
import * as eventsDb from '../../services/db/events';
import { applyEventDateToTasks } from '../../services/taskEventSync';
import type { AgendaEvent } from '../../interfaces/maestra';

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

const Agenda: FC = () => {
  const { artist } = useArtist();
  const artistId = artist?.id;
  const { canEdit } = useArtistCapabilities(artist);
  const dispatch = useAppDispatch();

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Dayjs>(dayjs());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [showTasks, setShowTasks] = useState(true);

  // Reflete no Plano de Ação a data (ou remoção) de um evento que veio de uma tarefa.
  const syncEventToTask = (taskId: string | null | undefined, newDate: string | null) => {
    if (!taskId || !artist) return;
    const next = applyEventDateToTasks(artist.content.strategies || [], taskId, newDate);
    if (!next) return;
    const content = { ...artist.content, strategies: next };
    dispatch(artistsActions.setArtistContentLocal({ id: artist.id, content }));
    dispatch(artistsActions.updateArtistContent({ id: artist.id, content }));
  };

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
    // Evento que veio de uma tarefa: propaga a nova data de volta para o Plano de Ação.
    if (e.task_id) syncEventToTask(e.task_id, e.date);
  };

  const onDeleted = (id: string) => {
    const removed = events.find((x) => x.id === id);
    setEvents((prev) => prev.filter((x) => x.id !== id));
    // Excluiu o evento de uma tarefa: a tarefa permanece, mas fica sem data.
    if (removed?.task_id) syncEventToTask(removed.task_id, null);
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

  if (!artist) return <Spinner loading>{null as any}</Spinner>;

  const today = dayjs().format('YYYY-MM-DD');
  const upcoming = visibleEvents
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 32, color: '#fff', margin: 0 }}>
          Agenda
        </h1>
        {canEdit && (
          <button
            onClick={() => openCreate()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#af2896', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700 }}
          >
            <FiPlus /> Compromisso
          </button>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
            <button onClick={() => setCursor(cursor.subtract(1, 'month'))} style={navBtn}>
              <FiChevronLeft />
            </button>
            <span style={{ fontWeight: 700, minWidth: 160, textAlign: 'center', textTransform: 'capitalize' }}>
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
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 6 }}>
              {WEEKDAYS.map((w) => (
                <div key={w} style={{ color: '#b3b3b3', fontSize: 12, fontWeight: 700, textAlign: 'center' }}>
                  {w}
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {monthDays.map((d) => {
                const key = d.format('YYYY-MM-DD');
                const dayEvents = byDate[key] || [];
                const inMonth = d.month() === cursor.month();
                const isToday = key === today;
                return (
                  <div
                    key={key}
                    onClick={() => openCreate(key)}
                    style={{
                      minHeight: 96,
                      background: inMonth ? '#181818' : '#101010',
                      borderRadius: 8,
                      padding: 6,
                      cursor: 'pointer',
                      border: isToday ? '1px solid #af2896' : '1px solid transparent',
                      opacity: inMonth ? 1 : 0.5,
                    }}
                  >
                    <div style={{ color: isToday ? '#af2896' : '#b3b3b3', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      {d.date()}
                    </div>
                    {dayEvents.slice(0, 3).map((e) => (
                      <div
                        key={e.id}
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
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {e.start_time ? e.start_time.slice(0, 5) + ' ' : ''}
                        {e.title}
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
              <div style={{ color: '#b3b3b3', padding: 32, textAlign: 'center' }}>Nenhum evento agendado.</div>
            ) : (
              upcoming.map((e) => (
                <div
                  key={e.id}
                  onClick={() => openEdit(e)}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12, borderRadius: 8, background: '#181818', cursor: 'pointer' }}
                >
                  <div style={{ width: 4, height: 40, borderRadius: 2, background: typeColor(e.type) }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#fff', fontWeight: 700 }}>{e.title}</div>
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
        />
      )}
    </div>
  );
};

export default Agenda;
