import { CSSProperties, FC, ReactNode } from 'react';
import { FiChevronRight } from 'react-icons/fi';

import { AiGlow } from '../../components/AiGlow';
import { STEP_LABELS, currentStepIndex } from './chat/script';
import type { ArtistContent } from '../../interfaces/maestra';

// Componentes compartilhados do wizard conversacional (botões e navegação de progresso).

// ---- Botões padrão ---------------------------------------------------------------------------

// Cores vêm dos tokens `--wz-*` declarados em `.wizard` (pages/Wizard/styles.scss).
export const primaryBtn: CSSProperties = {
  background: 'var(--wz-blue)',
  border: '1px solid var(--wz-blue)',
  color: '#FFFFFF',
  padding: '10px 22px',
  borderRadius: 9999,
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 13,
  boxShadow: '0 7px 16px rgba(51, 97, 255, 0.18)',
};

// Estado desabilitado do primaryBtn. Precisa apagar TAMBÉM a borda e a sombra: sobrescrever
// só `background`/`color` deixava o botão cinza com contorno e halo azuis — parecia um botão
// ativo mal pintado. Espalhe depois do primaryBtn: `{ ...primaryBtn, ...disabledBtn }`.
export const disabledBtn: CSSProperties = {
  background: 'var(--wz-line-2)',
  border: '1px solid var(--wz-line-2)',
  color: 'var(--wz-faint)',
  boxShadow: 'none',
  cursor: 'not-allowed',
};

export const ghostBtn: CSSProperties = {
  background: 'var(--wz-surface)',
  border: '1px solid var(--wz-line-2)',
  color: 'var(--wz-text)',
  padding: '10px 22px',
  borderRadius: 9999,
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 13,
};

// Pill gradiente das ações de IA (sem ícone, sem emoji).
export const AiButton: FC<{
  children: ReactNode;
  onClick?: () => void;
  small?: boolean;
  disabled?: boolean;
}> = ({ children, onClick, small, disabled }) => (
  <AiGlow>
    <button
      className='wiz-ai-btn'
      onClick={onClick}
      disabled={disabled}
      style={small ? { padding: '5px 14px', fontSize: 12 } : undefined}
    >
      {children}
    </button>
  </AiGlow>
);


// ---- Barra da etapa --------------------------------------------------------------------------

// "Etapa 3 de 9 · Missão" — a mesma string que titula a folha do plano no celular
// (ArtifactsPanel), agora vinda do mesmo `currentStepIndex` para as duas não divergirem.
//
// Com `onOpenPlan` vira botão e ganha o chevron: é a porta para o plano acumulado no celular,
// onde não há coluna fixa. Sem ele é um <div> — e não um <button> desabilitado por CSS, que
// continuaria no caminho do teclado e do leitor de tela anunciando algo que não faz nada.
export const StepBar: FC<{
  draft: ArtistContent;
  onOpenPlan?: () => void;
  className?: string;
}> = ({ draft, onOpenPlan, className }) => {
  const cur = currentStepIndex(draft);
  const texto = `Etapa ${cur + 1} de ${STEP_LABELS.length} · ${STEP_LABELS[cur]}`;
  const classe = `wiz-stepbar${className ? ` ${className}` : ''}`;

  if (!onOpenPlan) return <div className={classe}>{texto}</div>;

  return (
    <button type='button' className={`${classe} wiz-stepbar--tap`} onClick={onOpenPlan} aria-label={`${texto}. Ver seu plano`}>
      <span>{texto}</span>
      <FiChevronRight size={16} aria-hidden />
    </button>
  );
};
