import { FC } from 'react';
import { CloseIcon } from './Icons';

// Player oficial de embed do Spotify (iframe público — não requer login nem API key).
// Toca prévia de 30s para qualquer visitante; faixa completa se o usuário estiver logado
// no Spotify no navegador. Substitui o preview_url, que a API deixou de fornecer (nov/2024).

export const SpotifyEmbedPlayer: FC<{ trackId: string; onClose: () => void }> = ({
  trackId,
  onClose,
}) => (
  <div
    style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      background: '#000',
      padding: '8px 12px',
      boxShadow: '0 -8px 24px rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}
  >
    <iframe
      key={trackId}
      title='Spotify player'
      src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
      width='100%'
      height={80}
      frameBorder='0'
      allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'
      loading='lazy'
      style={{ borderRadius: 12, display: 'block' }}
    />
    <button
      onClick={onClose}
      title='Fechar player'
      style={{
        background: 'rgba(255,255,255,0.1)',
        border: 'none',
        color: '#fff',
        width: 32,
        height: 32,
        minWidth: 32,
        borderRadius: '50%',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CloseIcon />
    </button>
  </div>
);

export default SpotifyEmbedPlayer;
