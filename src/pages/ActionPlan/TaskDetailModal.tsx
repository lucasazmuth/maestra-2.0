import { FC, useEffect, useMemo, useState } from 'react';
import { Button, DatePicker, Input, Modal, Popconfirm, Select, Tabs } from 'antd';
import dayjs from 'dayjs';
import { FiCheck, FiEdit2, FiMessageSquare, FiSend, FiTrash2, FiX } from 'react-icons/fi';

import type { ActionTask, TaskComment } from '../../interfaces/maestra';
import { TASK_TYPES, type Assignee } from './TaskControls';
// Mesmo casco das fichas de música e de compromisso: cartão, cabeçalho (kicker + título +
// subtítulo), abas, campos e rodapé vêm todos daqui. O módulo local guarda só o que é
// exclusivo desta tela — a lista de comentários, que nenhum outro modal tem.
import modalStyles from '../../components/StandardModal.module.scss';
import styles from './TaskDetailModal.module.scss';

interface TaskDetailModalProps {
  open: boolean;
  task?: ActionTask;
  strategyTitle?: string;
  assignees: Assignee[];
  canEdit: boolean;
  canDelete: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatarUrl?: string;
  onClose: () => void;
  onSave: (patch: Partial<ActionTask>) => void;
  onAddComment: (body: string) => void;
  onEditComment: (commentId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
  onDelete: () => void;
}

const statusOptions = [
  { value: 'todo', label: 'A fazer' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'done', label: 'Concluída' },
];

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '?';

const formatCommentDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const CommentList: FC<{
  comments: TaskComment[];
  canEdit: boolean;
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatarUrl?: string;
  onEdit: (commentId: string, body: string) => void;
  onDelete: (commentId: string) => void;
}> = ({
  comments,
  canEdit,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  onEdit,
  onDelete,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');

  if (!comments.length) {
    return (
      <div className={styles.emptyComments}>
        <FiMessageSquare size={24} />
        <strong>Nenhum comentário ainda</strong>
        <span>Use este espaço para registrar contexto, decisões e atualizações da tarefa.</span>
      </div>
    );
  }

  return (
    <div className={styles.commentList}>
      {comments.map((comment) => {
        const isEditing = editingId === comment.id;
        const avatarUrl =
          comment.authorAvatarUrl ||
          (
            (comment.authorId && comment.authorId === currentUserId) ||
            (!comment.authorId && comment.authorName === currentUserName)
              ? currentUserAvatarUrl
              : undefined
          );
        const saveEdit = () => {
          const body = editingBody.trim();
          if (!body) return;
          onEdit(comment.id, body);
          setEditingId(null);
          setEditingBody('');
        };

        return (
          <article className={styles.comment} key={comment.id}>
            <span className={styles.commentAvatar}>
              {initials(comment.authorName)}
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={`Foto de ${comment.authorName}`}
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </span>
            <div className={styles.commentContent}>
              <div className={styles.commentMeta}>
                <strong>{comment.authorName}</strong>
                <div className={styles.commentMetaRight}>
                  <time dateTime={comment.createdAt}>
                    {formatCommentDate(comment.createdAt)}
                    {comment.updatedAt && <span> · editado</span>}
                  </time>
                  {canEdit && !isEditing && (
                    <div className={styles.commentActions}>
                      <Button
                        type="text"
                        size="small"
                        icon={<FiEdit2 />}
                        aria-label="Editar comentário"
                        title="Editar comentário"
                        onClick={() => {
                          setEditingId(comment.id);
                          setEditingBody(comment.body);
                        }}
                      />
                      <Popconfirm
                        title="Excluir este comentário?"
                        description="Esta ação não pode ser desfeita."
                        okText="Excluir"
                        cancelText="Cancelar"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => onDelete(comment.id)}
                      >
                        <Button
                          danger
                          type="text"
                          size="small"
                          icon={<FiTrash2 />}
                          aria-label="Excluir comentário"
                          title="Excluir comentário"
                        />
                      </Popconfirm>
                    </div>
                  )}
                </div>
              </div>
              {isEditing ? (
                <div className={styles.commentEdit}>
                  <Input.TextArea
                    className={styles.commentInput}
                    value={editingBody}
                    autoSize={{ minRows: 2, maxRows: 6 }}
                    maxLength={1000}
                    autoFocus
                    onChange={(event) => setEditingBody(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') saveEdit();
                      if (event.key === 'Escape') {
                        setEditingId(null);
                        setEditingBody('');
                      }
                    }}
                  />
                  <div className={styles.commentEditActions}>
                    <Button
                      size="small"
                      icon={<FiX />}
                      onClick={() => {
                        setEditingId(null);
                        setEditingBody('');
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="primary"
                      size="small"
                      icon={<FiCheck />}
                      disabled={!editingBody.trim()}
                      onClick={saveEdit}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <p>{comment.body}</p>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};

export const TaskDetailModal: FC<TaskDetailModalProps> = ({
  open,
  task,
  strategyTitle,
  assignees,
  canEdit,
  canDelete,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  onClose,
  onSave,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState('general');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('acoes');
  const [deadline, setDeadline] = useState<string | undefined>();
  const [owner, setOwner] = useState<string | undefined>();
  const [status, setStatus] = useState<ActionTask['status']>('todo');
  const [commentDraft, setCommentDraft] = useState('');

  useEffect(() => {
    if (!open || !task) return;
    setActiveTab('general');
    setDescription(task.description);
    setType(task.type || 'acoes');
    setDeadline(task.deadline);
    setOwner(task.owner);
    setStatus(task.status);
    setCommentDraft('');
    // O rascunho só deve ser reiniciado ao abrir/trocar de tarefa. Atualizações de comentários
    // mudam o objeto `task`, mas não podem apagar uma edição em andamento na aba Geral.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const comments = useMemo(() => task?.comments || [], [task?.comments]);
  const validDescription = description.trim();
  const validComment = commentDraft.trim();

  const save = () => {
    if (!task || !validDescription || !canEdit) return;
    onSave({
      description: validDescription,
      type,
      deadline,
      owner,
      status,
    });
    onClose();
  };

  const addComment = () => {
    if (!validComment || !canEdit) return;
    onAddComment(validComment);
    setCommentDraft('');
  };

  const footer = (
    <div className={modalStyles.footer}>
      {canDelete && (
        <Popconfirm
          title="Excluir esta tarefa?"
          description="Esta ação não pode ser desfeita."
          okText="Excluir"
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
          onConfirm={onDelete}
        >
          <Button className={modalStyles.dangerButton} danger type="text" icon={<FiTrash2 />}>
            Excluir tarefa
          </Button>
        </Popconfirm>
      )}
      <div className={modalStyles.footerActions}>
        <Button onClick={onClose}>Fechar</Button>
        {activeTab === 'general' && canEdit && (
          <Button type="primary" disabled={!validDescription} onClick={save}>Salvar alterações</Button>
        )}
      </div>
    </div>
  );

  return (
    <Modal
      open={open && !!task}
      onCancel={onClose}
      title={
        <div className={modalStyles.heading}>
          <span className={modalStyles.kicker}>Tarefa</span>
          <span className={modalStyles.title}>
            <i className={modalStyles.titleDot} aria-hidden />
            {task?.description || 'Detalhes da tarefa'}
          </span>
          {strategyTitle && <span className={modalStyles.subtitle}>{strategyTitle}</span>}
        </div>
      }
      footer={footer}
      width={640}
      centered
      destroyOnHidden
      rootClassName={modalStyles.modal}
    >
      <Tabs
        className={modalStyles.tabs}
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'general',
            label: 'Geral',
            children: (
              <div className={modalStyles.form}>
                <label className={modalStyles.field}>
                  <span>Descrição</span>
                  <Input.TextArea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    autoSize={{ minRows: 3, maxRows: 7 }}
                    maxLength={500}
                    disabled={!canEdit}
                    placeholder="Descreva a tarefa"
                  />
                </label>

                <div className={modalStyles.fieldGrid}>
                  <label className={modalStyles.field}>
                    <span>Status</span>
                    <Select
                      className="action-plan-select"
                      popupClassName="action-plan-select-dropdown"
                      value={status}
                      options={statusOptions}
                      disabled={!canEdit}
                      onChange={setStatus}
                    />
                  </label>
                  <label className={modalStyles.field}>
                    <span>Prazo</span>
                    <DatePicker
                      popupClassName="action-plan-picker"
                      value={deadline ? dayjs(deadline) : null}
                      format="DD/MM/YYYY"
                      placeholder="Sem prazo"
                      disabled={!canEdit}
                      allowClear
                      onChange={(date) => setDeadline(date ? date.format('YYYY-MM-DD') : undefined)}
                    />
                  </label>
                  <label className={modalStyles.field}>
                    <span>Categoria</span>
                    <Select
                      className="action-plan-select"
                      popupClassName="action-plan-select-dropdown"
                      value={type}
                      options={TASK_TYPES.map((option) => ({ value: option.v, label: option.label }))}
                      disabled={!canEdit}
                      onChange={setType}
                    />
                  </label>
                  <label className={modalStyles.field}>
                    <span>Responsável</span>
                    <Select
                      className="action-plan-select"
                      popupClassName="action-plan-select-dropdown"
                      value={owner}
                      options={assignees.map((assignee) => ({
                        value: assignee.value,
                        label: assignee.label,
                      }))}
                      disabled={!canEdit}
                      allowClear
                      placeholder="Sem responsável"
                      onChange={setOwner}
                    />
                  </label>
                </div>
              </div>
            ),
          },
          {
            key: 'comments',
            label: (
              <span className={styles.commentsTabLabel}>
                Comentários
                {!!comments.length && <span>{comments.length}</span>}
              </span>
            ),
            children: (
              <div className={styles.comments}>
                <CommentList
                  comments={comments}
                  canEdit={canEdit || canDelete}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  currentUserAvatarUrl={currentUserAvatarUrl}
                  onEdit={onEditComment}
                  onDelete={onDeleteComment}
                />
                <div className={styles.commentComposer}>
                  <Input.TextArea
                    className={styles.commentInput}
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    autoSize={{ minRows: 3, maxRows: 6 }}
                    maxLength={1000}
                    disabled={!canEdit}
                    placeholder={canEdit ? 'Escreva um comentário…' : 'Você não tem permissão para comentar.'}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') addComment();
                    }}
                  />
                  <div className={styles.commentComposerFooter}>
                    <span>{commentDraft.length}/1000 · ⌘/Ctrl + Enter para enviar</span>
                    <Button
                      type="primary"
                      icon={<FiSend />}
                      disabled={!validComment || !canEdit}
                      onClick={addComment}
                    >
                      Comentar
                    </Button>
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />
    </Modal>
  );
};
