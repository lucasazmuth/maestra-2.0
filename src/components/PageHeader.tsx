import { FC, ReactNode } from 'react';

// Cabeçalho padrão das páginas de produto (kicker do grupo + título + subtítulo + ação opcional).
// Padroniza Diagnóstico, Planejamento e Plano de Ação (e demais) pra cada tela se identificar igual.
export const PageHeader: FC<{
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}> = ({ kicker, title, subtitle, action }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
    <div style={{ minWidth: 0 }}>
      {kicker && (
        <span style={{ color: '#af2896', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{kicker}</span>
      )}
      <h1 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 32, color: '#fff', margin: kicker ? '2px 0 0' : 0, lineHeight: 1.1 }}>{title}</h1>
      {subtitle && <p style={{ color: '#8a8a92', fontSize: 13.5, margin: '6px 0 0', maxWidth: 660, lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
    {action && <div style={{ flexShrink: 0 }}>{action}</div>}
  </div>
);

export default PageHeader;
