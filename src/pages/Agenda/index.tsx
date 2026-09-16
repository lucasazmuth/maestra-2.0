import { FC, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { FiCheck, FiChevronLeft, FiChevronRight, FiClock, FiUser } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';

import { BotaoFlutuante } from '../../components/BotaoFlutuante';

import { useArtist } from '@maestra/core/hooks/useArtist';
import { useGlobalSearch, normalizar } from '@maestra/core/stores/globalSearchStore';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { useAppDispatch } from '@maestra/core/store/store';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { EventModal } from '../../components/EventModal';
import { EVENT_TYPES } from '@maestra/core/constants/maestra';
import * as eventsDb from '@maestra/core/services/db/events';
import * as membersDb from '@maestra/core/services/db/members';
import type { AgendaEvent, ArtistContent, ArtistMember } from '@maestra/core/interfaces/maestra';
import { buildAssigneeOptions, eventDurationMinutes, eventMatchesAssignee, getEventStyle, getOverlapColumns, isToday, dateForPointer, type AgendaAssigneeOption, type AgendaEventWithAssignee, SLOT_HEIGHT } from './agendaUtils';
import './agenda.scss';

type CalendarView = 'day' | 'week' | 'month' | 'year';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const typeColor = (type: string) => (EVENT_TYPES as any)[type]?.color || '#6b7280';

const isTaskEvent = (e: AgendaEvent) => e.type === 'task' || e.source === 'action_plan';

const calendarTitle = (title: string, maxLength = 28) =>
  title.length > maxLength ? `${title.slice(0, maxLength).trimEnd()}…` : title;

const Agenda: FC = () => {
  const { artist } = useArtist();
  const dispatch = useAppDispatch();
  const artistId = artist?.id;
  const { canEditAgenda: canEdit, editPlanning } = useArtistCapabilities(artist);

  const [searchParams, setSearchParams] = useSearchParams();
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [members, setMembers] = useState<ArtistMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>('day');
  const [cursor, setCursor] = useState<Dayjs>(dayjs());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [defaultTime, setDefaultTime] = useState<string | undefined>();
  const [resizeState, setResizeState] = useState<{ event: AgendaEvent; startY: number; originalEnd: number } | null>(null);
  const assigneeFilter = searchParams.get('member') || 'all';

  useEffect(() => {
    if (!artistId) return;
    setLoading(true);
    Promise.all([eventsDb.listEvents(artistId), membersDb.listMembers(artistId)])
      .then(([nextEvents, nextMembers]) => { setEvents(nextEvents); setMembers(nextMembers); })
      .catch(() => message.error('Erro ao carregar agenda'))
      .finally(() => setLoading(false));
  }, [artistId]);

  // Antes havia um filtro "mostrar tarefas" que ocultava os eventos vindos do Plano de Ação.
  // O único botão que o acionava era a falsa aba "Atrasadas"; sem ela, tudo é visível.
  //
  // A busca do topo entra AQUI porque `visibleEvents` é o ponto por onde a tela inteira passa —
  // grade do mês, lista do dia e tarefas sem data. Filtrar em cada uma daria três filtros para
  // manter em sincronia.
  const termoBusca = useGlobalSearch((st) => st.termo);
  const visibleEvents = useMemo(() => {
    const q = normalizar(termoBusca);
    const filtered = q ? events.filter((e) =>
      normalizar(e.title || '').includes(q) ||
      normalizar(e.description || '').includes(q) ||
      normalizar(e.location || '').includes(q)
    ) : events;
    return filtered.filter((event) => eventMatchesAssignee(event, assigneeFilter));
  }, [events, termoBusca, assigneeFilter]);
  const byDate = useMemo(() => {
    const map: Record<string, AgendaEvent[]> = {};
    for (const event of visibleEvents) (map[event.date] = map[event.date] || []).push(event);
    return map;
  }, [visibleEvents]);

  const monthDays = useMemo(() => {
    const start = cursor.startOf('month').startOf('week');
    const end = cursor.endOf('month').endOf('week');
    const days: Dayjs[] = [];
    for (let day = start; day.isBefore(end) || day.isSame(end, 'day'); day = day.add(1, 'day')) days.push(day);
    return days;
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = cursor.startOf('week');
    return Array.from({ length: 7 }, (_, index) => start.add(index, 'day'));
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

  const onEventSaved = async (event: AgendaEvent) => {
    onSaved(event);
    if (!artist || event.source !== 'action_plan' || !event.task_id) return;

    const eventWithAssignee = event as AgendaEventWithAssignee;
    let found = false;
    const assigneeMember = eventWithAssignee.assignee_kind === 'member' && eventWithAssignee.assignee_member_id
      ? members.find((member) => member.id === eventWithAssignee.assignee_member_id)
      : undefined;
    const owner = eventWithAssignee.assignee_kind === 'owner'
      ? 'owner'
      : eventWithAssignee.assignee_kind === 'member'
        ? assigneeMember?.email
        : undefined;
    const content: ArtistContent = {
      ...artist.content,
      strategies: (artist.content.strategies || []).map((strategy) => ({
        ...strategy,
        tasks: (strategy.tasks || []).map((task) => {
          if (task.id !== event.task_id) return task;
          found = true;
          return { ...task, deadline: event.date, owner };
        }),
      })),
    };
    if (!found) return;
    try {
      await dispatch(artistsActions.updateArtistContent({ id: artist.id, content })).unwrap();
    } catch (error: any) {
      message.error(error?.message || 'O evento foi salvo, mas a tarefa não foi sincronizada.');
    }
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

  const openCreate = (date?: string, time?: string) => {
    if (!canEdit) return; // colaborador sem PRO: somente-leitura
    setEditing(null);
    setDefaultDate(date);
    setDefaultTime(time);
    setModalOpen(true);
  };
  const openEdit = (e: AgendaEvent) => {
    if (!canEdit) return;
    setEditing(e);
    setModalOpen(true);
  };

  const assigneeOptions = useMemo<AgendaAssigneeOption[]>(() => buildAssigneeOptions(members), [members]);
  const setAssigneeFilter = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('member');
    else next.set('member', value);
    setSearchParams(next, { replace: true });
  };

  const moveEvent = async (event: AgendaEvent, date: string, startTime: string, endTime?: string) => {
    if (!canEdit || event.source === 'action_plan') return;
    try {
      const saved = await eventsDb.updateEvent(event.id, { date, start_time: startTime, end_time: endTime || event.end_time || null });
      onSaved(saved);
    } catch (error: any) {
      message.error(error?.message || 'Não consegui mover o compromisso.');
    }
  };

  useEffect(() => {
    if (!resizeState) return undefined;
    const onMove = (event: PointerEvent) => {
      const delta = Math.round((event.clientY - resizeState.startY) / SLOT_HEIGHT) * 15;
      const start = Number(resizeState.event.start_time?.slice(0, 2) || 0) * 60 + Number(resizeState.event.start_time?.slice(3, 5) || 0);
      const end = Math.max(start + 15, Math.min(1440, resizeState.originalEnd + delta));
      setEvents((prev) => prev.map((item) => item.id === resizeState.event.id ? { ...item, end_time: `${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}:00` } : item));
    };
    const onUp = async () => {
      const current = events.find((item) => item.id === resizeState.event.id);
      setResizeState(null);
      if (current?.end_time) {
        try { onSaved(await eventsDb.updateEvent(current.id, { end_time: current.end_time })); }
        catch (error: any) { message.error(error?.message || 'Não consegui redimensionar o compromisso.'); }
      }
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [resizeState, events]);

  if (!artist) return <Spinner loading>{null as any}</Spinner>;

  const selectedDate = cursor.format('YYYY-MM-DD');
  const releaseDate = artist.content.actionPlanSchedule?.releaseDate;
  const dayEvents = visibleEvents
    .filter((event) => event.date === selectedDate)
    .sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
  const dayAllDayEvents = dayEvents.filter((event) => !event.start_time);
  const hours = Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, '0')}:00`);
  const quarterSlots = Array.from({ length: 96 }, (_, index) => {
    const hour = Math.floor(index / 4);
    const minute = (index % 4) * 15;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  });
  const overlapColumns = getOverlapColumns(dayEvents);
  const nowPosition = isToday(cursor) ? ((dayjs().hour() * 60 + dayjs().minute()) / 15) * SLOT_HEIGHT : null;
  const moveCursor = (amount: number) => setCursor(cursor.add(amount, calendarView === 'year' ? 'year' : calendarView === 'month' ? 'month' : calendarView === 'week' ? 'week' : 'day'));
  const calendarLabel = calendarView === 'year'
    ? cursor.format('YYYY')
    : calendarView === 'month'
      ? cursor.format('MMMM [de] YYYY')
      : calendarView === 'week'
        ? `${weekDays[0].format('D [de] MMM')} – ${weekDays[6].format('D [de] MMM [de] YYYY')}`
      : cursor.format('dddd, D [de] MMMM [de] YYYY');
  // No celular a coluna da data mede 165px (o "+ Compromisso" define a coluna vizinha), e o
  // rotulo inteiro nao cabe — cortaria justamente o ano, no fim da frase. A versao curta larga o
  // dia da semana e preserva a data completa. Sao dois <span> alternados por CSS, e nao um
  // `isMobile` em JS: o hook do projeto so acerta na carga e nao reage a mudanca de largura.
  const calendarLabelCompact = calendarView === 'day'
    ? cursor.format('D [de] MMMM [de] YYYY')
    : calendarLabel;

  return (
    <div className="calendar-page agenda-reference-page">
      <header className="calendar-tools">
        {/* Havia aqui um segundo campo de busca, também sem `value` e sem `onChange` — decorativo
            como o do topo. Dois campos na mesma tela, nenhum funcionando; quem busca agora usa o
            do cabeçalho, que filtra de verdade. */}
        <div>
          <button type="button" className="calendar-today" onClick={() => setCursor(dayjs())}>Hoje</button>
          {/* `calendar-nav-step` existe para escapar da regra base de `.calendar-tools > div
              button`, que dá font-size 11px e padding 0. Como o ícone do react-icons mede 1em, o
              ícone ERA o botão inteiro: 11×11. */}
          <button type="button" className="calendar-nav-step calendar-nav-prev" aria-label="Período anterior" onClick={() => moveCursor(-1)}><FiChevronLeft /></button>
          <button type="button" className="calendar-nav-step calendar-nav-next" aria-label="Próximo período" onClick={() => moveCursor(1)}><FiChevronRight /></button>
          <strong>
            <span className="calendar-label-full">{calendarLabel}</span>
            <span className="calendar-label-compact">{calendarLabelCompact}</span>
          </strong>
          <label className="calendar-assignee-filter">
            <FiUser aria-hidden="true" />
            <span className="sr-only">Filtrar por responsável</span>
            <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} aria-label="Filtrar por responsável">
              <option value="all">Todos os responsáveis</option>
              {assigneeOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <nav aria-label="Visualização da agenda">
            <button className={calendarView === 'day' ? 'calendar-active' : ''} type="button" onClick={() => setCalendarView('day')}>Dia</button>
            <button className={calendarView === 'week' ? 'calendar-active' : ''} type="button" onClick={() => setCalendarView('week')}>Semana</button>
            <button className={calendarView === 'month' ? 'calendar-active' : ''} type="button" onClick={() => setCalendarView('month')}>Mês</button>
            <button className={calendarView === 'year' ? 'calendar-active' : ''} type="button" onClick={() => setCalendarView('year')}>Ano</button>
          </nav>
        </div>
      </header>
      {calendarView === 'day' && (
        <div className="calendar-all-day">
          <span>Dia todo</span>
          <div className="calendar-all-day-list">
            {dayAllDayEvents.length > 0 ? dayAllDayEvents.map((event) => (
              <button type="button" className="calendar-all-day-event" key={event.id} onClick={() => openEdit(event)}>
                {isTaskEvent(event) && <i className={event.status === 'completed' ? 'is-completed' : ''} aria-hidden="true">{event.status === 'completed' ? <FiCheck size={11} /> : null}</i>}
                <strong>{calendarTitle(event.title, 72)}</strong>
              </button>
            )) : <strong className="calendar-all-day-empty">Planeje sua semana</strong>}
          </div>
        </div>
      )}
      <Spinner loading={loading && !events.length}>
        {calendarView === 'day' ? <div className="calendar-layout">
          <section className="calendar-timeline">
            <div className="calendar-hours">{hours.map((hour) => <span key={hour}>{hour}</span>)}</div>
            <div className="calendar-events" onDragOver={(event) => { if (canEdit) event.preventDefault(); }} onDrop={(event) => {
              if (!canEdit) return;
              event.preventDefault();
              const moving = dayEvents.find((item) => item.id === event.dataTransfer.getData('text/event-id'));
              if (!moving) return;
              const target = dateForPointer(event.clientY, event.currentTarget.getBoundingClientRect(), cursor);
              const endMinutes = Number(target.start_time.slice(0, 2)) * 60 + Number(target.start_time.slice(3, 5)) + eventDurationMinutes(moving);
              void moveEvent(moving, target.date, target.start_time, `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}:00`);
            }}>
              {/* Faixas vazias clicáveis: uma por hora, atrás dos eventos (vêm antes no DOM).
                  Clicar abre o modal já com o dia em foco e a hora da faixa — sobra só o título.
                  Onde há evento, é o botão dele que recebe o clique, porque pinta por cima. */}
              {canEdit && quarterSlots.map((time, index) => (
                <button
                  type="button"
                  key={`slot-${time}`}
                  className="calendar-slot"
                  aria-label={`Novo compromisso às ${time}`}
                  onClick={() => openCreate(selectedDate, `${time}:00`)}
                  style={{ top: index * SLOT_HEIGHT, height: SLOT_HEIGHT } as React.CSSProperties}
                />
              ))}
              {dayEvents.filter((event) => event.start_time).map((event) => {
                const layout = overlapColumns.get(event.id) || { column: 0, columns: 1 };
                const eventStyle = getEventStyle(event);
                return (
                <button
                  type="button"
                  key={event.id}
                  className="calendar-event"
                  draggable={canEdit && event.source !== 'action_plan'}
                  onDragStart={(dragEvent) => dragEvent.dataTransfer.setData('text/event-id', event.id)}
                  onClick={() => openEdit(event)}
                  style={{ '--event-color': typeColor(event.type), top: eventStyle.top, height: eventStyle.height, left: `${layout.column * (100 / layout.columns)}%`, width: `calc(${100 / layout.columns}% - 8px)` } as React.CSSProperties}
                >
                  <strong>{calendarTitle(event.title, 44)}</strong>
                  <small><FiClock /> {event.start_time?.slice(0, 5)}{event.end_time ? ` – ${event.end_time.slice(0, 5)}` : ''}</small>
                  <i className="calendar-event-resize" aria-label="Redimensionar compromisso" onPointerDown={(pointerEvent) => { pointerEvent.stopPropagation(); if (canEdit && event.source !== 'action_plan') { const end = (Number(event.end_time?.slice(0, 2) || event.start_time?.slice(0, 2) || 0) * 60) + Number(event.end_time?.slice(3, 5) || event.start_time?.slice(3, 5) || 0); setResizeState({ event, startY: pointerEvent.clientY, originalEnd: end }); } }} />
                </button>
                );
              })}
              {nowPosition !== null && <span className="calendar-now-line" style={{ top: nowPosition }} aria-hidden="true" />}
            </div>
          </section>
        </div> : calendarView === 'week' ? <section className="agenda-week-board" aria-label="Calendário semanal">
          <div className="agenda-week-head">
            <span className="agenda-week-gutter" />
            {weekDays.map((day) => <button type="button" key={day.format('YYYY-MM-DD')} className={day.isSame(dayjs(), 'day') ? 'is-today' : ''} onClick={() => { setCursor(day); setCalendarView('day'); }}>
              <small>{WEEKDAYS[day.day()]}</small><strong>{day.format('D')}</strong>
            </button>)}
          </div>
          <div className="agenda-week-all-day">
            <span>Dia todo</span>
            {weekDays.map((day) => {
              const eventsForDay = (byDate[day.format('YYYY-MM-DD')] || []).filter((event) => !event.start_time);
              return <div key={day.format('YYYY-MM-DD')}>{eventsForDay.map((event) => <button type="button" key={event.id} onClick={() => openEdit(event)} style={{ '--event-color': typeColor(event.type) } as React.CSSProperties}>{calendarTitle(event.title, 24)}</button>)}</div>;
            })}
          </div>
          <div className="agenda-week-grid">
            <div className="agenda-week-hours">{hours.map((hour) => <span key={hour}>{hour}</span>)}</div>
            {weekDays.map((day) => {
              const key = day.format('YYYY-MM-DD');
              const eventsForDay = (byDate[key] || []).filter((event) => event.start_time);
              const columns = getOverlapColumns(eventsForDay);
              return <div className="agenda-week-column" key={key} onClick={(clickEvent) => {
                if (!canEdit || (clickEvent.target as HTMLElement).closest('.calendar-event')) return;
                const target = dateForPointer(clickEvent.clientY, clickEvent.currentTarget.getBoundingClientRect(), day);
                openCreate(target.date, target.start_time);
              }}>
                {quarterSlots.map((time, index) => <span className="agenda-week-slot" key={time} style={{ top: index * SLOT_HEIGHT }} />)}
                {eventsForDay.map((event) => {
                  const layout = columns.get(event.id) || { column: 0, columns: 1 };
                  const style = getEventStyle(event);
                  return <button type="button" className="calendar-event agenda-week-event" key={event.id} onClick={(clickEvent) => { clickEvent.stopPropagation(); openEdit(event); }} style={{ '--event-color': typeColor(event.type), top: style.top, height: style.height, left: `${layout.column * (100 / layout.columns)}%`, width: `calc(${100 / layout.columns}% - 4px)` } as React.CSSProperties}>
                    <strong>{calendarTitle(event.title, 24)}</strong><small>{event.start_time?.slice(0, 5)}</small>
                  </button>;
                })}
              </div>;
            })}
          </div>
        </section> : calendarView === 'month' ? <section className="agenda-month-board" aria-label="Calendário mensal">
          <div className="agenda-month-weekdays">{WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
          <div className="agenda-month-grid">
            {monthDays.map((day) => {
              const key = day.format('YYYY-MM-DD');
              const eventsForDay = byDate[key] || [];
              const outsideMonth = day.month() !== cursor.month();
              const isReleaseDay = key === releaseDate;
              return <button type="button" key={key} className={`agenda-month-day${outsideMonth ? ' is-outside' : ''}${isReleaseDay ? ' is-release-day' : ''}`} onClick={() => { setCursor(day); setCalendarView('day'); }}>
                <b>{day.date()}</b>
                {isReleaseDay && <em>Dia D</em>}
                {eventsForDay.slice(0, 2).map((event) => <span key={event.id} style={{ '--event-color': typeColor(event.type) } as React.CSSProperties}>{calendarTitle(event.title, 20)}{event.recurrence_rule === 'weekly' ? ' · semanal' : ''}</span>)}
                {eventsForDay.length > 2 && <small>+{eventsForDay.length - 2}</small>}
              </button>;
            })}
          </div>
        </section> : <section className="agenda-year-board" aria-label="Calendário anual">
          {Array.from({ length: 12 }, (_, month) => {
            const monthCursor = cursor.month(month);
            const count = visibleEvents.filter((event) => dayjs(event.date).isSame(monthCursor, 'month')).length;
            return <button type="button" key={month} onClick={() => { setCursor(monthCursor); setCalendarView('month'); }}><strong>{monthCursor.format('MMMM')}</strong><span>{count} {count === 1 ? 'compromisso' : 'compromissos'}</span></button>;
          })}
        </section>}
      </Spinner>

      {artistId && (
        <EventModal
          open={modalOpen}
          artistId={artistId}
          event={editing}
          defaultDate={defaultDate}
          defaultTime={defaultTime}
          onClose={() => setModalOpen(false)}
          onSaved={onEventSaved}
          onDeleted={onDeleted}
          onDeleteEvent={deleteAgendaEvent}
          assigneeOptions={assigneeOptions}
          deleteLabel={editing && isTaskEvent(editing) ? 'Remover prazo' : 'Excluir'}
          deleteConfirmTitle={editing && isTaskEvent(editing) ? 'Remover o prazo da tarefa e excluir o evento?' : 'Excluir evento?'}
        />
      )}

      {/* O mesmo flutuante das Músicas e da Equipe: criar é o que se decide depois de olhar a
          semana, e é no fim da tela que a mão está. */}
      {canEdit && <BotaoFlutuante rotulo='Novo compromisso' aoClicar={() => openCreate()} />}
    </div>
  );
};

export default Agenda;
