import { FC, useEffect, useState } from 'react';
import { Modal, Input, Select, DatePicker, TimePicker, Popconfirm, message } from 'antd';
import dayjs from 'dayjs';

import type { AgendaEvent } from '../interfaces/maestra';
import { EVENT_TYPE_OPTIONS, EVENT_STATUS } from '../constants/maestra';
import * as eventsDb from '../services/db/events';

interface Props {
  open: boolean;
  artistId: string;
  event?: AgendaEvent | null;
  defaultDate?: string;
  onClose: () => void;
  onSaved: (e: AgendaEvent) => void;
  onDeleted?: (id: string) => void;
}

const empty = (date?: string): Partial<AgendaEvent> => ({
  title: '',
  type: 'other',
  date: date || dayjs().format('YYYY-MM-DD'),
  status: 'scheduled',
});

export const EventModal: FC<Props> = ({
  open,
  artistId,
  event,
  defaultDate,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const [draft, setDraft] = useState<Partial<AgendaEvent>>(empty(defaultDate));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraft(event ? { ...event } : empty(defaultDate));
  }, [open, event, defaultDate]);

  const set = (patch: Partial<AgendaEvent>) => setDraft((d) => ({ ...d, ...patch }));

  const handleSave = async () => {
    if (!draft.title?.trim()) {
      message.warning('Informe o título');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        artist_id: artistId,
        title: draft.title,
        type: draft.type || 'other',
        date: draft.date,
        start_time: draft.start_time || null,
        end_time: draft.end_time || null,
        location: draft.location || null,
        description: draft.description || null,
        status: draft.status || 'scheduled',
      };
      const saved = event
        ? await eventsDb.updateEvent(event.id, payload)
        : await eventsDb.createEvent(payload);
      onSaved(saved);
      onClose();
    } catch (e: any) {
      message.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    try {
      await eventsDb.deleteEvent(event.id);
      onDeleted?.(event.id);
      onClose();
    } catch {
      message.error('Erro ao excluir');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered
      width={520}
      destroyOnClose
      title={<span style={{ color: '#fff', fontWeight: 700 }}>{event ? 'Editar compromisso' : 'Novo compromisso'}</span>}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {event && (
              <Popconfirm title='Excluir evento?' onConfirm={handleDelete} okText='Sim' cancelText='Não'>
                <button style={{ background: 'transparent', border: 'none', color: '#e91429', cursor: 'pointer', fontWeight: 700 }}>
                  Excluir
                </button>
              </Popconfirm>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#b3b3b3', cursor: 'pointer', fontWeight: 700, padding: '6px 14px' }}>
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ background: '#af2896', border: 'none', color: '#fff', borderRadius: 9999, padding: '6px 20px', cursor: 'pointer', fontWeight: 700 }}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input placeholder='Título *' value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        <div style={{ display: 'flex', gap: 12 }}>
          <Select
            style={{ flex: 1 }}
            placeholder='Tipo'
            value={draft.type}
            options={EVENT_TYPE_OPTIONS.map((t) => ({ value: t.id, label: t.label }))}
            onChange={(v) => set({ type: v })}
          />
          <Select
            style={{ flex: 1 }}
            placeholder='Status'
            value={draft.status}
            options={Object.entries(EVENT_STATUS).map(([id, v]) => ({ value: id, label: v.label }))}
            onChange={(v) => set({ status: v })}
          />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <DatePicker
            style={{ flex: 1 }}
            value={draft.date ? dayjs(draft.date) : null}
            onChange={(d) => set({ date: d ? d.format('YYYY-MM-DD') : undefined })}
          />
          <TimePicker
            style={{ flex: 1 }}
            format='HH:mm'
            placeholder='Início'
            value={draft.start_time ? dayjs(draft.start_time, 'HH:mm:ss') : null}
            onChange={(t) => set({ start_time: t ? t.format('HH:mm:ss') : null })}
          />
          <TimePicker
            style={{ flex: 1 }}
            format='HH:mm'
            placeholder='Fim'
            value={draft.end_time ? dayjs(draft.end_time, 'HH:mm:ss') : null}
            onChange={(t) => set({ end_time: t ? t.format('HH:mm:ss') : null })}
          />
        </div>
        <Input placeholder='Local' value={draft.location || ''} onChange={(e) => set({ location: e.target.value })} />
        <Input.TextArea rows={3} placeholder='Descrição' value={draft.description || ''} onChange={(e) => set({ description: e.target.value })} />
      </div>
    </Modal>
  );
};

export default EventModal;
