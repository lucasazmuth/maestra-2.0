import { FC, ReactNode } from 'react';

// Cabeçalho padrão das páginas de produto (título + subtítulo + ação opcional).
// Mantém o mesmo alinhamento limpo da Agenda em Diagnóstico, Planejamento e Plano de Ação.
export const PageHeader: FC<{
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}> = ({ kicker, title, subtitle, action }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
    <div style={{ minWidth: 0 }}>
      {kicker && (
        <span style={{ color: '#9A4FD1', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{kicker}</span>
      )}
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(24px, 3vw, 28px)', color: '#fff', margin: kicker ? '2px 0 0' : 0, lineHeight: 1.15 }}>{title}</h1>
      {subtitle && <p style={{ color: '#8a8a92', fontSize: 13.5, margin: '6px 0 0', maxWidth: 660, lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
    {action && <div style={{ flexShrink: 0 }}>{action}</div>}
  </div>
);

export default PageHeader;
