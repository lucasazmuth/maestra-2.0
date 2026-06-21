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
//  • TaskDelete — lixeira com confirmação (Popconfirm).
// Recebem `className` para herdar o visual de cada modo.

// Pessoa atribuível a uma tarefa: o dono do perfil ou um membro ativo da equipe.
// `value` é o que fica gravado em `ActionTask.owner` (sentinela TASK_OWNER_SELF p/ o dono,
// e-mail p/ membros).
export interface Assignee {
  value: string;
  label: string;
}

// Iniciais p/ o avatar (1–2 letras). "Lucas Andrade" → "LA"; "joao@x.com" → "J".
const initials = (label: string): string => {
  const clean = label.split('@')[0].trim();
  const parts = clean.split(/[\s._-]+/).filter(Boolean);
  const ini = (parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
  return ini.toUpperCase() || '?';
};

const fmtDate = (d?: string): string =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : '';

export const TaskDate: FC<{
  value?: string;
  overdue?: boolean;
  className: string;
  placeholder?: string;
  onChange: (d?: string) => void;
}> = ({ value, overdue, className, placeholder = 'Sem prazo', onChange }) => {
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
      title="Definir prazo"
      onClick={() => setEditing(true)}
    >
      {value ? fmtDate(value) : placeholder}
    </button>
  );
};

export const TaskCategory: FC<{ value?: string; className: string; onChange: (v: string) => void }> = ({ value, className, onChange }) => {
  const current = value || 'acoes';
  const label = TASK_TYPES.find((o) => o.v === current)?.label || 'Ações';
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
      <button type="button" className={className} title="Mudar categoria">{label}</button>
    </Dropdown>
  );
};

export const TaskOwner: FC<{
  value?: string;
  assignees: Assignee[];
  className: string;
  onChange: (v?: string) => void;
}> = ({ value, assignees, className, onChange }) => {
  // Se o responsável gravado não está mais na lista (membro removido), mostra o valor cru.
  const current = value ? assignees.find((a) => a.value === value) || { value, label: value } : undefined;
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
      <button
        type="button"
        className={`${className}${current ? ' is-assigned' : ''}`}
        title={current ? `Responsável: ${current.label}` : 'Atribuir responsável'}
      >
        {current ? <span className="ap-owner-ini">{initials(current.label)}</span> : <FiPlus size={13} />}
      </button>
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

// Textarea que cresce com o conteúdo (sem barra de rolagem). Recalcula a altura ao montar,
// ao editar e — crucial — sempre que a LARGURA muda (ex.: ao surgir o avatar de responsável,
// que estreita a coluna e faz o texto quebrar numa linha a mais). É uncontrolled (defaultValue):
// quem usa passa `key` quando a descrição muda por fora, para remontar com o novo valor.
export const AutoTextarea: FC<{
  className: string;
  defaultValue: string;
  onCommit: (v: string) => void;
}> = ({ className, defaultValue, onCommit }) => {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Antes da pintura: garante a altura certa na montagem e quando o valor inicial muda.
  useLayoutEffect(() => { resize(); }, [defaultValue, resize]);

  // Reage a mudanças de LARGURA (só largura — comparamos para não recalcular à toa). Cobre o caso
  // de a coluna estreitar depois da renderização inicial. O recálculo é adiado para o próximo frame
  // (rAF): muda a altura FORA do ciclo de entrega do observer, evitando o aviso benigno
  // "ResizeObserver loop completed with undelivered notifications".
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastW = el.clientWidth;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w === lastW) return;
      lastW = w;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(resize);
    });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [resize]);

  return (
    <textarea
      ref={ref}
      className={className}
      defaultValue={defaultValue}
      rows={1}
      onInput={resize}
      onBlur={(e) => {
        const v = e.currentTarget.value.trim();
        if (v && v !== defaultValue) onCommit(v);
        else if (!v) e.currentTarget.value = defaultValue;
        resize();
      }}
    />
  );
};
