import { FC, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { FiChevronDown } from 'react-icons/fi';

import './PhaseSummary.scss';

// Resumo executivo colapsável ("Onde X está hoje") exibido DENTRO do card de Fase.
// Reutilizado no Dashboard e no Plano de Ação (modo "Ver dados completos"). Começa minimizado,
// com fade na base; o chevron expande/recolhe.
export const PhaseSummary: FC<{ text: string }> = ({ text }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`phase-summary${open ? ' is-open' : ''}`}>
      <div className="phase-summary-body">
        {/* normaliza quebras simples em parágrafos pro markdown renderizar espaçado */}
        <ReactMarkdown>{text.replace(/([^\n])\n(?!\n)/g, '$1\n\n')}</ReactMarkdown>
      </div>
      <button
        className="phase-summary-toggle"
        onClick={() => setOpen((o) => !o)}
        title={open ? 'Minimizar' : 'Ver resumo completo'}
        aria-label={open ? 'Minimizar resumo' : 'Ver resumo completo'}
      >
        <FiChevronDown size={18} />
      </button>
    </div>
  );
};

export default PhaseSummary;
