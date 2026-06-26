import { FC, useState } from 'react';
import ColorThiefRaw from 'colorthief';

import { ARTISTS_DEFAULT_IMAGE } from '../constants/spotify';
import type { Artist } from '../interfaces/maestra';

// Cabeçalho do artista (foto + nome + stats do Spotify) com gradiente extraído da cor dominante
// da foto (estilo Spotify). Compartilhado entre o Dashboard e a página de Perfil.

// O typedef de colorthief resolve pra versão node (sem construtor); no browser o webpack usa
// o build construível. Cast pro tipo de browser.
const ColorThief = ColorThiefRaw as unknown as {
  new (): { getColor: (img: HTMLImageElement) => [number, number, number] };
};

export const ArtistHero: FC<{ artist: Artist }> = ({ artist }) => {
  const [heroColor, setHeroColor] = useState<string | null>(null);
  const sp = artist.content?.spotifyProfile;
  const realPhase = artist.content?.realIndex?.profile?.name;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 24,
        padding: 24,
        borderRadius: 12,
        background: heroColor
          ? `linear-gradient(180deg, rgba(${heroColor}, 0.55) 0%, #121212 92%)`
          : 'linear-gradient(180deg, #1f1f1f 0%, #121212 100%)',
        transition: 'background 0.5s ease',
        marginBottom: 24,
      }}
    >
      <img
        src={sp?.image || ARTISTS_DEFAULT_IMAGE}
        alt={artist.name}
        crossOrigin="anonymous"
        onLoad={(e) => {
          try {
            const [r, g, b] = new ColorThief().getColor(e.currentTarget);
            setHeroColor(`${r}, ${g}, ${b}`);
          } catch {
            /* imagem sem CORS / não decodificada — mantém o fundo padrão */
          }
        }}
        style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
      />
      <div>
        <div style={{ color: '#b3b3b3', fontSize: 12, fontWeight: 700 }}>ARTISTA</div>
        <h1 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 40, color: '#fff', margin: '4px 0 8px' }}>
          {artist.name}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: '#b3b3b3', fontSize: 14, flexWrap: 'wrap' }}>
          {sp ? (
            <>
              {sp.followers != null && <span>{sp.followers.toLocaleString('pt-BR')} seguidores</span>}
              {sp.popularity != null && <span>Popularidade {sp.popularity}/100</span>}
              {sp.track_count != null && <span>{sp.track_count} faixas</span>}
            </>
          ) : (
            <span>Carregando…</span>
          )}
          {/* Fase do diagnóstico REAL (um dos 16 perfis), quando o artista já tem diagnóstico. */}
          {realPhase && (
            <span
              title="Fase de carreira pelo diagnóstico REAL"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 12px',
                borderRadius: 9999,
                background: 'rgba(175, 40, 150, 0.18)',
                border: '1px solid rgba(210, 100, 187, 0.55)',
                color: '#e7a6d8',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontStyle: 'italic', color: '#d264bb' }}>REAL</span>
              {realPhase}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArtistHero;
