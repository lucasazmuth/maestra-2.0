import { FC, useEffect, useState } from 'react';
import { Modal, Input, Select, DatePicker, TimePicker, Popconfirm, message, Button } from 'antd';
import { FiTrash2 } from 'react-icons/fi';
import dayjs from 'dayjs';

import type { AgendaEvent } from '../interfaces/maestra';
import { EVENT_TYPE_OPTIONS, EVENT_STATUS } from '../constants/maestra';
import * as eventsDb from '../services/db/events';
import modalStyles from './StandardModal.module.scss';

interface Props {
  open: boolean;
  artistId: string;
  event?: AgendaEvent | null;
  defaultDate?: string;
  onClose: () => void;
  onSaved: (e: AgendaEvent) => void;
  onDeleted?: (id: string) => void;
  onDeleteEvent?: (event: AgendaEvent) => Promise<void>;
  deleteLabel?: string;
  deleteConfirmTitle?: string;
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
  onDeleteEvent,
  deleteLabel = 'Excluir',
  deleteConfirmTitle = 'Excluir evento?',
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
      if (onDeleteEvent) {
        await onDeleteEvent(event);
      } else {
        await eventsDb.deleteEvent(event.id);
        onDeleted?.(event.id);
      }
      onClose();
    } catch (error: any) {
      message.error(error?.message || 'Erro ao excluir');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered
      width={520}
      destroyOnHidden
      rootClassName={modalStyles.modal}
      title={
        <div className={modalStyles.heading}>
          <span className={modalStyles.kicker}>Agenda</span>
          <span className={modalStyles.title}>
            <i className={modalStyles.titleDot} aria-hidden />
            {draft.title?.trim() || (event ? 'Editar compromisso' : 'Novo compromisso')}
          </span>
          <span className={modalStyles.subtitle}>
            {event
              ? 'Atualize data, horário e detalhes do compromisso.'
              : 'Adicione um compromisso à agenda do artista.'}
          </span>
        </div>
      }
      footer={
        <div className={modalStyles.footer}>
          {event && (
            <Popconfirm
              title={deleteConfirmTitle}
              description='Esta ação não pode ser desfeita.'
              onConfirm={handleDelete}
              okText='Excluir'
              cancelText='Cancelar'
              okButtonProps={{ danger: true }}
            >
              <Button className={modalStyles.dangerButton} danger type='text' icon={<FiTrash2 />}>
                {deleteLabel}
              </Button>
            </Popconfirm>
          )}
          <div className={modalStyles.footerActions}>
            <Button type='primary' onClick={handleSave} loading={saving}>
              Salvar
            </Button>
          </div>
        </div>
      }
    >
      <div className={modalStyles.form}>
        <label className={modalStyles.field}>
          <span>Título</span>
          <Input placeholder='Título do compromisso' value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <div className={modalStyles.fieldGrid}>
          <label className={modalStyles.field}>
            <span>Tipo</span>
            <Select
              placeholder='Tipo'
              value={draft.type}
              options={EVENT_TYPE_OPTIONS.map((t) => ({ value: t.id, label: t.label }))}
              onChange={(v) => set({ type: v })}
            />
          </label>
          <label className={modalStyles.field}>
            <span>Status</span>
            <Select
              placeholder='Status'
              value={draft.status}
              options={Object.entries(EVENT_STATUS).map(([id, v]) => ({ value: id, label: v.label }))}
              onChange={(v) => set({ status: v })}
            />
          </label>
        </div>
        <div className={modalStyles.fieldGridThree}>
          <label className={modalStyles.field}>
            <span>Data</span>
            <DatePicker
              placeholder='Selecione a data'
              value={draft.date ? dayjs(draft.date) : null}
              onChange={(d) => set({ date: d ? d.format('YYYY-MM-DD') : undefined })}
            />
          </label>
          <label className={modalStyles.field}>
            <span>Início</span>
            <TimePicker
              format='HH:mm'
              placeholder='Início'
              value={draft.start_time ? dayjs(draft.start_time, 'HH:mm:ss') : null}
              onChange={(t) => set({ start_time: t ? t.format('HH:mm:ss') : null })}
            />
          </label>
          <label className={modalStyles.field}>
            <span>Fim</span>
            <TimePicker
              format='HH:mm'
              placeholder='Fim'
              value={draft.end_time ? dayjs(draft.end_time, 'HH:mm:ss') : null}
              onChange={(t) => set({ end_time: t ? t.format('HH:mm:ss') : null })}
            />
          </label>
        </div>
        <label className={modalStyles.field}>
          <span>Local</span>
          <Input placeholder='Local do compromisso' value={draft.location || ''} onChange={(e) => set({ location: e.target.value })} />
        </label>
        <label className={modalStyles.field}>
          <span>Descrição</span>
          <Input.TextArea rows={3} placeholder='Adicione informações importantes' value={draft.description || ''} onChange={(e) => set({ description: e.target.value })} />
        </label>
      </div>
    </Modal>
  );
};

export default EventModal;
