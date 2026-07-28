import { FC, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { DatePicker, Dropdown, Popconfirm } from 'antd';
import dayjs from 'dayjs';
import { FiTrash2, FiPlus } from 'react-icons/fi';

// Categorias de tarefa (valor persistido + rótulo exibido). Fonte única reutilizada pelo
// chip TaskCategory, pelo composer e pelo Dashboard.
export const TASK_TYPES: { v: string; label: string }[] = [
  { v: 'acoes', label: 'Ações' },
  { v: 'produto_fonografico', label: 'Produto fonográfico' },
  { v: 'audio_visual', label: 'Audiovisual' },
  { v: 'design', label: 'Design' },
  { v: 'fotos', label: 'Fotos' },
  { v: 'figurino', label: 'Figurino' },
  { v: 'site', label: 'Site' },
  { v: 'textos', label: 'Textos' },
  { v: 'assessoria', label: 'Assessoria' },
  { v: 'marketing_digital', label: 'Marketing digital' },
  { v: 'media_kit', label: 'Media kit' },
  { v: 'radio', label: 'Rádio' },
  { v: 'show', label: 'Show' },
];

// Controles de tarefa reaproveitados pelos modos básico (timeline) e avançado (lista):
//  • TaskDate — pílula que abre o calendário (antd DatePicker) ao clicar.
//  • TaskCategory — chip que abre um dropdown (estilo menu) para escolher a categoria.
//  • TaskOwner — avatar/+ que abre um dropdown para atribuir o responsável.
//  • TaskDelete — lixeira com confirmação usada no modo avançado; no modo básico a exclusão
//    fica dentro do modal de detalhes da tarefa.
// Recebem `className` para herdar o visual de cada modo.

// Pessoa atribuível a uma tarefa: o dono do perfil ou um membro ativo da equipe.
// `value` é o que fica gravado em `ActionTask.owner` (sentinela TASK_OWNER_SELF p/ o dono,
// e-mail p/ membros).
export interface Assignee {
  value: string;
  label: string;
}

// Letra p/ o avatar (uma letra, mantendo o chip limpo). "Lucas Andrade" → "L"; "joao@x.com" → "J".
const initials = (label: string): string => {
  const clean = label.split('@')[0].trim();
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  return (parts[0]?.[0] || '?').toUpperCase();
};

const fmtDate = (d?: string): string =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : '';

export const TaskDate: FC<{
  value?: string;
  overdue?: boolean;
  className: string;
  placeholder?: string;
  onChange: (d?: string) => void;
  disabled?: boolean;
  onBlocked?: () => void;
}> = ({ value, overdue, className, placeholder = 'Sem prazo', onChange, disabled = false, onBlocked }) => {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <DatePicker
        size="small"
        autoFocus
        open
        value={value ? dayjs(value) : undefined}
        format="DD/MM/YYYY"
        placeholder="Escolha a data"
        style={{ width: 150 }}
        onChange={(d) => { onChange(d ? d.format('YYYY-MM-DD') : undefined); setEditing(false); }}
        onOpenChange={(o) => { if (!o) setEditing(false); }}
      />
    );
  }

  return (
    <button
      type="button"
      className={`${className}${overdue ? ' is-overdue' : ''}`}
      title={disabled ? 'Recurso exclusivo do Maestra Pro' : 'Definir prazo'}
      aria-disabled={disabled}
      onClick={() => disabled ? onBlocked?.() : setEditing(true)}
    >
      {value ? fmtDate(value) : placeholder}
    </button>
  );
};

export const TaskCategory: FC<{
  value?: string;
  className: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  onBlocked?: () => void;
}> = ({ value, className, onChange, disabled = false, onBlocked }) => {
  const current = value || 'acoes';
  const label = TASK_TYPES.find((o) => o.v === current)?.label || 'Ações';
  const button = <button
    type="button"
    className={className}
    title={disabled ? 'Recurso exclusivo do Maestra Pro' : 'Mudar categoria'}
    aria-disabled={disabled}
    onClick={disabled ? onBlocked : undefined}
  >{label}</button>;
  if (disabled) return button;
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: TASK_TYPES.map((o) => ({ key: o.v, label: o.label })),
        selectable: true,
        selectedKeys: [current],
        onClick: ({ key }) => onChange(key),
      }}
    >
      {button}
    </Dropdown>
  );
};

export const TaskOwner: FC<{
  value?: string;
  assignees: Assignee[];
  className: string;
  onChange: (v?: string) => void;
  disabled?: boolean;
  onBlocked?: () => void;
}> = ({ value, assignees, className, onChange, disabled = false, onBlocked }) => {
  // Se o responsável gravado não está mais na lista (membro removido), mostra o valor cru.
  const current = value ? assignees.find((a) => a.value === value) || { value, label: value } : undefined;
  const button = <button
    type="button"
    className={`${className}${current ? ' is-assigned' : ''}`}
    title={disabled ? 'Recurso exclusivo do Maestra Pro' : (current ? `Responsável: ${current.label}` : 'Atribuir responsável')}
    aria-disabled={disabled}
    onClick={disabled ? onBlocked : undefined}
  >
    {current ? <span className="ap-owner-ini">{initials(current.label)}</span> : <FiPlus size={13} />}
  </button>;
  if (disabled) return button;
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          ...assignees.map((a) => ({ key: a.value, label: a.label })),
          ...(value ? [{ type: 'divider' as const }, { key: '__none__', label: 'Remover responsável' }] : []),
        ],
        selectable: true,
        selectedKeys: value ? [value] : [],
        onClick: ({ key }) => onChange(key === '__none__' ? undefined : key),
      }}
    >
      {button}
    </Dropdown>
  );
};

export const TaskDelete: FC<{ className: string; size?: number; onDelete: () => void }> = ({ className, size = 15, onDelete }) => (
  <Popconfirm
    title="Excluir esta tarefa?"
    okText="Excluir"
    cancelText="Cancelar"
    okButtonProps={{ danger: true }}
    onConfirm={onDelete}
  >
    <button type="button" className={className} title="Remover tarefa"><FiTrash2 size={size} /></button>
  </Popconfirm>
);

// Mantido para superfícies legadas que ainda usam edição inline.
export const AutoTextarea: FC<{
  className: string;
  defaultValue: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
  onBlocked?: () => void;
}> = ({ className, defaultValue, onCommit, disabled = false, onBlocked }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => { resize(); }, [defaultValue, resize]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastWidth = el.clientWidth;
    let animationFrame = 0;
    const observer = new ResizeObserver(() => {
      const width = el.clientWidth;
      if (width === lastWidth) return;
      lastWidth = width;
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(resize);
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [resize]);

  return (
    <textarea
      ref={ref}
      className={className}
      defaultValue={defaultValue}
      rows={1}
      readOnly={disabled}
      aria-disabled={disabled}
      onFocus={disabled ? onBlocked : undefined}
      onInput={resize}
      onBlur={(event) => {
        const value = event.currentTarget.value.trim();
        if (value && value !== defaultValue) onCommit(value);
        else if (!value) event.currentTarget.value = defaultValue;
        resize();
      }}
    />
  );
};
