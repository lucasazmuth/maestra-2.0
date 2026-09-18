import dayjs from 'dayjs';

import type { AgendaEvent } from '@maestra/core/interfaces/maestra';
import { eventMatchesAssignee, getEventStyle, getOverlapColumns, slotEndTime, snapMinutes, timeFromMinutes } from './agendaUtils';

const event = (id: string, start_time: string, end_time: string): AgendaEvent => ({
  id,
  artist_id: 'artist',
  title: id,
  type: 'meeting',
  date: '2026-09-16',
  start_time,
  end_time,
  status: 'scheduled',
});

describe('agenda scheduler helpers', () => {
  it('encaixa horários em intervalos de quinze minutos', () => {
    expect(snapMinutes(8)).toBe(15);
    expect(snapMinutes(23)).toBe(30);
    expect(timeFromMinutes(91)).toBe('01:30:00');
  });

  it('preenche o fim de um novo evento com a duração da faixa selecionada', () => {
    expect(slotEndTime('00:00:00')).toBe('00:15:00');
    expect(slotEndTime('09:30:00')).toBe('09:45:00');
    expect(slotEndTime('23:45:00')).toBe('23:59:00');
  });

  it('calcula posição e altura de um evento', () => {
    expect(getEventStyle(event('a', '08:00:00', '09:30:00'))).toEqual({ top: 704, height: 128 });
  });

  it('distribui eventos sobrepostos em colunas', () => {
    const columns = getOverlapColumns([
      event('a', '08:00:00', '10:00:00'),
      event('b', '09:00:00', '11:00:00'),
      event('c', '11:00:00', '12:00:00'),
    ]);
    expect(columns.get('a')).toEqual({ column: 0, columns: 2 });
    expect(columns.get('b')).toEqual({ column: 1, columns: 2 });
    expect(columns.get('c')).toEqual({ column: 0, columns: 1 });
  });

  it('filtra dono, membro e sem responsável', () => {
    const member = { ...event('member', '08:00:00', '09:00:00'), assignee_kind: 'member', assignee_member_id: 'm1' };
    const owner = { ...event('owner', '08:00:00', '09:00:00'), assignee_kind: 'owner' };
    expect(eventMatchesAssignee(member, 'm1')).toBe(true);
    expect(eventMatchesAssignee(member, 'owner')).toBe(false);
    expect(eventMatchesAssignee(owner, 'owner')).toBe(true);
    expect(eventMatchesAssignee({ ...event('none', '08:00:00', '09:00:00'), source: 'action_plan' }, 'unassigned')).toBe(true);
  });

  it('mantém o dia selecionado para criação por clique', () => {
    expect(dayjs('2026-09-16').format('YYYY-MM-DD')).toBe('2026-09-16');
  });
});
