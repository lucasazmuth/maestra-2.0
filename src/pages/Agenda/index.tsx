import { FC, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { FiCheck, FiChevronLeft, FiChevronRight, FiPlus } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useGlobalSearch, normalizar } from '../../stores/globalSearchStore';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useAppDispatch } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { EventModal } from '../../components/EventModal';
import { EVENT_TYPES } from '../../constants/maestra';
import * as eventsDb from '../../services/db/events';
import type { AgendaEvent, ArtistContent } from '../../interfaces/maestra';
import './agenda.scss';

type CalendarView = 'day' | 'month' | 'year';

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

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [calendarView, setCalendarView] = useState<CalendarView>('day');
  const [cursor, setCursor] = useState<Dayjs>(dayjs());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();
  const [defaultTime, setDefaultTime] = useState<string | undefined>();

  useEffect(() => {
    if (!artistId) return;
    setLoading(true);
    eventsDb
      .listEvents(artistId)
      .then(setEvents)
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
    if (!q) return events;
    return events.filter((e) =>
      normalizar(e.title || '').includes(q) ||
      normalizar(e.description || '').includes(q) ||
      normalizar(e.location || '').includes(q)
    );
  }, [events, termoBusca]);
  const hasTaskEvents = useMemo(() => events.some(isTaskEvent), [events]);

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

  const selectedDate = cursor.format('YYYY-MM-DD');
  const dayEvents = visibleEvents
    .filter((event) => event.date === selectedDate)
    .sort((a, b) => (a.start_time || '23:59').localeCompare(b.start_time || '23:59'));
  const unscheduledTasks = visibleEvents
    .filter((event) => isTaskEvent(event) && event.date !== selectedDate)
    .slice(0, 6);
  const hours = Array.from({ length: 16 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`);
  const hourIndex = (event: AgendaEvent) => {
    const hour = Number(event.start_time?.slice(0, 2) || 8);
    return Math.min(Math.max(hour - 7, 1), hours.length);
  };
  const moveCursor = (amount: number) => setCursor(cursor.add(amount, calendarView === 'year' ? 'year' : calendarView === 'month' ? 'month' : 'day'));
  const calendarLabel = calendarView === 'year'
    ? cursor.format('YYYY')
    : calendarView === 'month'
      ? cursor.format('MMMM [de] YYYY')
      : cursor.format('dddd, D [de] MMMM');

  return (
    <div className="calendar-page agenda-reference-page">
      <header className="calendar-tools">
        {/* Havia aqui um segundo campo de busca, também sem `value` e sem `onChange` — decorativo
            como o do topo. Dois campos na mesma tela, nenhum funcionando; quem busca agora usa o
            do cabeçalho, que filtra de verdade. */}
        <div>
          <button type="button" onClick={() => setCursor(dayjs())}>Hoje</button>
          <button type="button" aria-label="Período anterior" onClick={() => moveCursor(-1)}><FiChevronLeft /></button>
          <button type="button" aria-label="Próximo período" onClick={() => moveCursor(1)}><FiChevronRight /></button>
          <strong>{calendarLabel}</strong>
          {canEdit && <button type="button" className="calendar-add-task calendar-add-task-inline" aria-label="Adicionar compromisso" onClick={() => openCreate()}><FiPlus /> Compromisso</button>}
          <nav aria-label="Visualização da agenda">
            <button className={calendarView === 'day' ? 'calendar-active' : ''} type="button" onClick={() => setCalendarView('day')}>Dia</button>
            <button className={calendarView === 'month' ? 'calendar-active' : ''} type="button" onClick={() => setCalendarView('month')}>Mês</button>
            <button className={calendarView === 'year' ? 'calendar-active' : ''} type="button" onClick={() => setCalendarView('year')}>Ano</button>
          </nav>
        </div>
      </header>
      {calendarView === 'day' && <div className="calendar-all-day"><span>Dia todo</span><strong>{dayEvents.find((event) => !event.start_time)?.title || 'Planeje sua semana com clareza'}</strong></div>}
      <Spinner loading={loading && !events.length}>
        {calendarView === 'day' ? <div className="calendar-layout">
          <section className="calendar-timeline">
            <div className="calendar-hours">{hours.map((hour) => <span key={hour}>{hour}</span>)}</div>
            <div className="calendar-events">
              {/* Faixas vazias clicáveis: uma por hora, atrás dos eventos (vêm antes no DOM).
                  Clicar abre o modal já com o dia em foco e a hora da faixa — sobra só o título.
                  Onde há evento, é o botão dele que recebe o clique, porque pinta por cima. */}
              {canEdit && hours.map((hour, index) => (
                <button
                  type="button"
                  key={`slot-${hour}`}
                  className="calendar-slot"
                  aria-label={`Novo compromisso às ${hour}`}
                  onClick={() => openCreate(selectedDate, `${hour}:00`)}
                  style={{ gridRow: index + 1, gridColumn: '1 / -1' } as React.CSSProperties}
                />
              ))}
              {dayEvents.filter((event) => event.start_time).map((event, index) => (
                <button
                  type="button"
                  key={event.id}
                  className="calendar-event"
                  onClick={() => openEdit(event)}
                  style={{ '--event-color': typeColor(event.type), gridRowStart: hourIndex(event), gridColumn: index % 2 === 0 ? 1 : 2 } as React.CSSProperties}
                >
                  <strong>{calendarTitle(event.title, 44)}</strong>
                </button>
              ))}
            </div>
          </section>
          <aside className="calendar-tasks">
            <header><h2>Tarefas</h2>{canEdit && <button type="button" className="calendar-add-task" aria-label="Adicionar compromisso" onClick={() => openCreate()}><FiPlus /></button>}</header>
            {/* Saíram daqui duas abas e um "Ordenar por Prioridade" que não existiam de fato:
                "Não agendadas" era um botão sem ação (só o estilo de aba ativa), "Atrasadas"
                escondia as tarefas do calendário inteiro — nada a ver com atraso, e ainda
                esvaziava esta própria lista — e a ordenação era texto fixo. Voltam quando forem
                filtros de verdade. */}
            {hasTaskEvents && unscheduledTasks.map((event) => <button className="calendar-task" type="button" key={event.id} onClick={() => openEdit(event)}>{taskCheckbox(event)}<i style={{ background: typeColor(event.type) }} />{calendarTitle(event.title, 48)}</button>)}
            {!unscheduledTasks.length && <p className="agenda-empty">Nenhuma tarefa pendente.</p>}
          </aside>
        </div> : calendarView === 'month' ? <section className="agenda-month-board" aria-label="Calendário mensal">
          <div className="agenda-month-weekdays">{WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
          <div className="agenda-month-grid">
            {monthDays.map((day) => {
              const key = day.format('YYYY-MM-DD');
              const eventsForDay = byDate[key] || [];
              const outsideMonth = day.month() !== cursor.month();
              return <button type="button" key={key} className={`agenda-month-day${outsideMonth ? ' is-outside' : ''}`} onClick={() => { setCursor(day); setCalendarView('day'); }}>
                <b>{day.date()}</b>
                {eventsForDay.slice(0, 2).map((event) => <span key={event.id} style={{ '--event-color': typeColor(event.type) } as React.CSSProperties}>{calendarTitle(event.title, 20)}</span>)}
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
