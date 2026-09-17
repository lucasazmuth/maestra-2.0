import { FC, useState } from 'react';
import { Button, DatePicker, Input, Modal, Select } from 'antd';
import dayjs from 'dayjs';

import type { ActionPlanAction, ActionPlanChecklistItem } from '@maestra/core/interfaces/maestra';
import { actionStatusFromChecklist } from '@maestra/core/services/cronogramaV13';
import type { Assignee } from './TaskControls';
import modalStyles from '../../components/StandardModal.module.scss';
import styles from './ActionDetailModal.module.scss';

interface ActionDetailModalProps {
  open: boolean;
  action?: ActionPlanAction;
  strategyTitle?: string;
  assignees: Assignee[];
  canEdit: boolean;
  onClose: () => void;
  onSave: (patch: Partial<ActionPlanAction>) => void;
}

export const ActionDetailModal: FC<ActionDetailModalProps> = ({
  open, action, strategyTitle, assignees, canEdit, onClose, onSave,
}) => {
  const [title, setTitle] = useState(action?.title || '');
  const [date, setDate] = useState<string | undefined>(action?.date);
  const [owner, setOwner] = useState<string | undefined>(action?.owner);
  const [tasks, setTasks] = useState<ActionPlanChecklistItem[]>(action?.tasks || []);

  const completed = tasks.filter((task) => task.status === 'done').length;
  const ownerOptions = assignees.map((assignee) => ({ value: assignee.value, label: assignee.label }));
  if (owner && !ownerOptions.some((option) => option.value === owner)) {
    ownerOptions.push({ value: owner, label: owner });
  }

  const save = () => {
    if (!action || !canEdit || !title.trim()) return;
    const checklistChanged = tasks.some((task, index) => task.status !== action.tasks[index]?.status);
    const wasComplete = action.tasks.length > 0 && action.tasks.every((task) => task.status === 'done');
    const manualCompletion = action.status === 'done' && !wasComplete;
    onSave({
      title: title.trim(),
      date,
      owner,
      ...(checklistChanged ? {
        tasks,
        status: actionStatusFromChecklist(tasks, manualCompletion ? 'done' : undefined),
      } : {}),
    });
    onClose();
  };

  return (
    <Modal
      open={open && !!action}
      onCancel={onClose}
      title={
        <div className={modalStyles.heading}>
          <span className={modalStyles.kicker}>Plano de Ação</span>
          <span className={modalStyles.title}>
            <i className={modalStyles.titleDot} aria-hidden />
            {action?.title || 'Editar ação'}
          </span>
          {strategyTitle && <span className={modalStyles.subtitle}>{strategyTitle}</span>}
        </div>
      }
      footer={
        <div className={modalStyles.footer}>
          <div className={modalStyles.footerActions}>
            <Button onClick={onClose}>Fechar</Button>
            {canEdit && <Button type="primary" disabled={!title.trim()} onClick={save}>Salvar alterações</Button>}
          </div>
        </div>
      }
      width={640}
      centered
      destroyOnHidden
      rootClassName={modalStyles.modal}
    >
      <div className={modalStyles.form}>
        <label className={modalStyles.field}>
          <span>Título</span>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} disabled={!canEdit} />
        </label>
        <div className={modalStyles.fieldGrid}>
          <label className={modalStyles.field}>
            <span>Prazo</span>
            <DatePicker
              popupClassName="action-plan-picker"
              value={date ? dayjs(date) : null}
              format="DD/MM/YYYY"
              placeholder="Sem prazo"
              disabled={!canEdit}
              allowClear
              onChange={(value) => setDate(value ? value.format('YYYY-MM-DD') : undefined)}
            />
          </label>
          <label className={modalStyles.field}>
            <span>Responsável</span>
            <Select
              className="action-plan-select"
              popupClassName="action-plan-select-dropdown"
              value={owner}
              options={ownerOptions}
              disabled={!canEdit}
              allowClear
              placeholder="Sem responsável"
              onChange={setOwner}
            />
          </label>
        </div>
        <div className={styles.checklist}>
          <div className={styles.checklistHeading}>
            <strong>Tarefas</strong>
            <span>{completed}/{tasks.length}</span>
          </div>
          {tasks.length ? (
            <ul>
              {tasks.map((task) => (
                <li key={task.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={task.status === 'done'}
                      disabled={!canEdit}
                      onChange={(event) => setTasks((current) => current.map((item) => item.id === task.id
                        ? { ...item, status: event.target.checked ? 'done' : 'todo' }
                        : item))}
                    />
                    <span className={task.status === 'done' ? styles.completed : ''}>{task.description}</span>
                  </label>
                </li>
              ))}
            </ul>
          ) : <p>Nenhuma tarefa nesta ação.</p>}
        </div>
      </div>
    </Modal>
  );
};
