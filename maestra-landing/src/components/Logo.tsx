import React from 'react';

// Logo da Maestra (o "M" com as barras de equalizador) + wordmark opcional.
export const Logo: React.FC<{ size?: number; withWord?: boolean; className?: string }> = ({
  size = 28,
  withWord = true,
  className = '',
}) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-label="Maestra Manager" role="img">
      <path d="M30 78 V30 L60 58 L90 30 V78" stroke="#af2896" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      <g stroke="#d264bb" strokeWidth="8" strokeLinecap="round">
        <line x1="33" x2="33" y1="95" y2="106" />
        <line x1="46.5" x2="46.5" y1="87" y2="106" />
        <line x1="60" x2="60" y1="80" y2="106" />
        <line x1="73.5" x2="73.5" y1="87" y2="106" />
        <line x1="87" x2="87" y1="95" y2="106" />
      </g>
    </svg>
    {withWord && <span className="font-bold text-lg tracking-tight">Maestra Manager</span>}
  </span>
);
