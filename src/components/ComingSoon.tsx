import { FC } from 'react';

export const ComingSoon: FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div style={{ padding: 24 }}>
    <h1
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 'clamp(24px, 3vw, 28px)',
        color: '#fff',
        margin: '0 0 8px',
      }}
    >
      {title}
    </h1>
    <p style={{ color: '#b3b3b3' }}>{subtitle || 'Módulo em construção.'}</p>
  </div>
);

export default ComingSoon;
