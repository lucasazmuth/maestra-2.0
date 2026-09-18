import dayjs, { Dayjs } from 'dayjs';
import type { AgendaEvent, ArtistMember } from '@maestra/core/interfaces/maestra';

export type AgendaAssigneeKind = 'owner' | 'member' | 'unassigned';
export type AgendaEventWithAssignee = AgendaEvent & { assignee_kind?: AgendaAssigneeKind | string; assignee_member_id?: string | null };

export interface AgendaAssigneeOption {
  value: string;
  label: string;
  kind: AgendaAssigneeKind;
  memberId?: string | null;
}

export const SNAP_MINUTES = 15;
export const DAY_START_HOUR = 0;
export const DAY_END_HOUR = 24;
export const SLOT_HEIGHT = 22;

export const snapMinutes = (minutes: number): number => Math.max(0, Math.min(1439, Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES));

export const minutesFromTime = (time?: string | null): number | null => {
  if (!time) return null;
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return snapMinutes(hours * 60 + minutes);
};

export const timeFromMinutes = (minutes: number): string => {
  const snapped = snapMinutes(minutes);
  return `${String(Math.floor(snapped / 60)).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}:00`;
};

export const slotEndTime = (time: string): string =>
  timeFromMinutes((minutesFromTime(time) ?? 0) + SNAP_MINUTES);

export const eventDurationMinutes = (event: AgendaEvent): number => {
  const start = minutesFromTime(event.start_time);
  const end = minutesFromTime(event.end_time);
  if (start === null) return 60;
  if (end === null || end <= start) return 60;
  return Math.max(SNAP_MINUTES, end - start);
};

export const eventMatchesAssignee = (event: AgendaEventWithAssignee, filter: string): boolean => {
  if (filter === 'all') return true;
  const kind = event.assignee_kind || (event.source === 'action_plan' ? 'unassigned' : 'owner');
  if (filter === kind) return true;
  return kind === 'member' && event.assignee_member_id === filter;
};

export const buildAssigneeOptions = (members: ArtistMember[]): AgendaAssigneeOption[] => [
  { value: 'owner', label: 'Dono do perfil', kind: 'owner' },
  ...members
    .filter((member) => member.status === 'active')
    .map((member) => ({ value: member.id, label: member.name || member.email, kind: 'member' as const, memberId: member.id })),
  { value: 'unassigned', label: 'Sem responsável', kind: 'unassigned' },
];

export const getEventStyle = (event: AgendaEvent): { top: number; height: number } => {
  const start = minutesFromTime(event.start_time) ?? 0;
  return {
    top: (start / SNAP_MINUTES) * SLOT_HEIGHT,
    height: Math.max((eventDurationMinutes(event) / SNAP_MINUTES) * SLOT_HEIGHT - 4, SLOT_HEIGHT - 4),
  };
};

export const getOverlapColumns = (events: AgendaEvent[]): Map<string, { column: number; columns: number }> => {
  const timed = events
    .filter((event) => event.start_time)
    .map((event) => ({ event, start: minutesFromTime(event.start_time) || 0, end: (minutesFromTime(event.start_time) || 0) + eventDurationMinutes(event) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const active: Array<{ end: number; column: number }> = [];
  const result = new Map<string, { column: number; columns: number }>();
  const placed: Array<{ id: string; start: number; end: number; column: number }> = [];
  timed.forEach(({ event, start, end }) => {
    for (let i = active.length - 1; i >= 0; i -= 1) if (active[i].end <= start) active.splice(i, 1);
    const used = new Set(active.map((item) => item.column));
    let column = 0;
    while (used.has(column)) column += 1;
    active.push({ end, column });
    placed.push({ id: event.id, start, end, column });
  });
  placed.forEach((item) => {
    const columns = placed.filter((other) => other.start < item.end && other.end > item.start).length;
    result.set(item.id, { column: item.column, columns: Math.max(1, columns) });
  });
  return result;
};

export const dateForPointer = (clientY: number, rect: DOMRect, cursor: Dayjs): { date: string; start_time: string } => {
  const minutes = snapMinutes(((clientY - rect.top) / SLOT_HEIGHT) * SNAP_MINUTES);
  return { date: cursor.format('YYYY-MM-DD'), start_time: timeFromMinutes(minutes) };
};

export const isToday = (cursor: Dayjs): boolean => cursor.isSame(dayjs(), 'day');
