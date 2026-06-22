import { FC, ReactNode, useEffect, useState } from 'react';
import { FiPlus, FiLock } from 'react-icons/fi';
import type { Strategy } from '../../interfaces/maestra';
import { AiGlow } from '../../components/AiGlow';
import { TaskCategory, TaskDate } from './TaskControls';

// Composer de tarefa compartilhado pelos modos básico e avançado. Dois fluxos distintos:
//  • "Nova tarefa" (manual): descrição + categoria + prazo (padrão hoje + 7 dias).
//  • "Pedir ideias pra Nyta": apenas as sugestões da IA (sem campo manual).
// `accent` controla o visual (true = básico, Nyta em gradiente; false = avançado, sóbrio).

export interface SuggTask { description: string; type?: string; deadline?: string }

// TASK_TYPES vive em TaskControls (junto do chip TaskCategory); reexportado aqui pra não
// quebrar quem já importa de TaskComposer.
export { TASK_TYPES } from './TaskControls';

const plus7 = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
};

const fmtDate = (d?: string): string =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : '';

interface Props {
  strategy: Strategy;
  open: boolean;
  loading: boolean;
  suggestions?: SuggTask[];
  accent?: boolean;
  // "Pedir ideias pra Nyta" (IA) é recurso PRO. Sem PRO, o botão vira cadeado e o onAskNyta do
  // pai leva pra assinatura (não dispara a IA).
  canUseNyta?: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAdd: (task: SuggTask) => void;
  onAskNyta: () => void;
  onUseSugg: (i: number) => void;
}

export const TaskComposer: FC<Props> = ({
  strategy,
  open,
  loading,
  suggestions,
  accent = true,
  canUseNyta = true,
  onOpen,
  onClose,
  onAdd,
  onAskNyta,
  onUseSugg,
}) => {
  const [text, setText] = useState('');
  const [type, setType] = useState('acoes');
  const [date, setDate] = useState(plus7);
  const [mode, setMode] = useState<'manual' | 'nyta'>('manual');

  // Reseta os campos do formulário manual sempre que o composer abre.
  useEffect(() => {
    if (open) { setText(''); setType('acoes'); setDate(plus7()); }
  }, [open]);

  const submit = () => {
    if (!text.trim()) return;
    onAdd({ description: text.trim(), type, deadline: date || undefined });
    setText('');
  };

  const sm = accent ? '' : ' ap-btn--sm';
  // Botão da Nyta SEMPRE com o estilo de IA + brilho aurora (também no modo avançado/sm).
  const nytaBtn = `ap-btn ap-btn--ai${accent ? '' : ' ap-btn--sm'}`;
  const wrapAi = (btn: ReactNode) => <AiGlow>{btn}</AiGlow>;

  // ---- Fechado: só "Nova tarefa". O "Pedir ideias pra Nyta" aparece DENTRO do compositor,
  // evitando que o usuário gere com IA sem querer (custo). ----
  if (!open) {
    return (
      <div className={accent ? 'ap-add' : 'ap-adv-add-row'}>
        <button className={`ap-btn ap-btn--ghost${sm}`} onClick={() => { setMode('manual'); onOpen(); }}>
          <FiPlus size={accent ? 15 : 14} /> Nova tarefa
        </button>
      </div>
    );
  }

  // ---- Modo Nyta: só sugestões, sem campo manual ----
  if (mode === 'nyta') {
    const hint = loading
      ? 'A Nyta está pensando nos melhores próximos passos…'
      : suggestions?.length
      ? 'Ideias da Nyta — toque pra adicionar:'
      : 'A Nyta não trouxe ideias agora. Tente de novo num instante.';
    return (
      <div className="ap-composer">
        {accent ? (
          <div className="ap-ai-hint"><span className="ap-ai-avatar">N</span> {hint}</div>
        ) : (
          <div className="ap-adv-thinking">{hint}</div>
        )}

        {!!suggestions?.length && (
          accent ? (
            <div style={{ marginTop: 10 }}>
              {suggestions.map((sg, i) => (
                <div className="ap-sugg" key={i} onClick={() => onUseSugg(i)}>
                  <span className="ap-sugg-plus"><FiPlus size={14} /></span>
                  <div>
                    <div className="ap-sugg-desc">{sg.description}</div>
                    <div className="ap-sugg-meta">{sg.type ? String(sg.type).replace(/_/g, ' ') : 'ação'}{sg.deadline ? ` · sugestão de prazo: ${fmtDate(sg.deadline)}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ap-adv-sugg-list">
              {suggestions.map((sg, i) => (
                <button className="ap-adv-sugg" key={i} onClick={() => onUseSugg(i)}>
                  <FiPlus size={13} />
                  <span>
                    <span className="ap-adv-sugg-desc">{sg.description}</span>
                    {sg.deadline && <span className="ap-adv-sugg-meta">sugestão de prazo: {fmtDate(sg.deadline)}</span>}
                  </span>
                </button>
              ))}
            </div>
          )
        )}

        <div className="ap-composer-row">
          {wrapAi(
            <button className={nytaBtn} disabled={loading} onClick={onAskNyta}>
              {loading ? <span className="ap-spin" /> : null} Gerar outras
            </button>
          )}
          <button className={`ap-btn ap-btn--ghost${sm}`} onClick={onClose}>Fechar</button>
        </div>
      </div>
    );
  }

  // ---- Modo manual: descrição + categoria + prazo ----
  return (
    <div className="ap-composer">
      <input
        className="ap-composer-input"
        placeholder={`Escreva uma tarefa para "${strategy.title}"`}
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
      <div className="ap-composer-meta">
        <div className="ap-composer-field">
          <span>Categoria</span>
          <TaskCategory className="ap-type" value={type} onChange={setType} />
        </div>
        <div className="ap-composer-field">
          <span>Prazo</span>
          <TaskDate className="ap-date" value={date} onChange={(d) => setDate(d || '')} />
        </div>
      </div>
      <div className="ap-composer-row">
        <button className={`ap-btn ap-btn--primary${sm}`} disabled={!text.trim()} onClick={submit}>Adicionar</button>
        {canUseNyta ? (
          wrapAi(
            <button className={nytaBtn} disabled={loading} onClick={() => { setMode('nyta'); onAskNyta(); }}>
              Pedir ideias {accent ? 'pra' : 'à'} Nyta
            </button>
          )
        ) : (
          // Sem PRO: não dispara a IA — o onAskNyta do pai leva pra assinatura.
          <button className={nytaBtn} onClick={onAskNyta} title="Recurso do Maestra PRO">
            <FiLock size={13} style={{ marginRight: 6 }} /> Pedir ideias {accent ? 'pra' : 'à'} Nyta
          </button>
        )}
        <button className={`ap-btn ap-btn--ghost${sm}`} onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
};

export default TaskComposer;
