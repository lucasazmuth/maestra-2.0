import { FC } from 'react';

export const ComingSoon: FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div style={{ padding: 24 }}>
    <h1
      style={{
        fontFamily: 'SpotifyMixUITitle',
        fontWeight: 800,
        fontSize: 32,
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
