import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

import type { Artist } from '../interfaces/maestra';

// Resumo compacto e clean do diagnóstico REAL — usado no Dashboard e no Plano de Ação.
// Só aparece para perfis que têm o Índice REAL salvo no content.
const DIMS: { k: 'r' | 'e' | 'a' | 'l'; letter: string }[] = [
  { k: 'r', letter: 'R' }, { k: 'e', letter: 'E' }, { k: 'a', letter: 'A' }, { k: 'l', letter: 'L' },
];

const clean = (s: string) => s.replace(/\s*—\s*/g, ', ');

// `hideLabel` oculta o rótulo "Diagnóstico de carreira" interno — usado quando o card já está sob
// um cabeçalho de seção (ex.: Dashboard), pra não duplicar o título.
export const RealProfileSummary: FC<{ artist: Artist; style?: React.CSSProperties; hideLabel?: boolean }> = ({ artist, style, hideLabel }) => {
  const navigate = useNavigate();
  const ri = artist.content?.realIndex;
  if (!ri?.profile) return null;

  return (
    <section
      style={{
        position: 'relative',
        background: 'radial-gradient(120% 130% at 0% 0%, rgba(175, 40, 150,0.08), #181818 60%)',
        border: '1px solid rgba(175, 40, 150,0.2)',
        borderRadius: 14,
        padding: 20,
        marginBottom: 24,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: hideLabel ? 'flex-end' : 'space-between', gap: 12 }}>
        {!hideLabel && (
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#af2896' }}>
            Diagnóstico de carreira
          </span>
        )}
        <button
          onClick={() => navigate(`/artists/${artist.id}/diagnostico`)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9a9aa5', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}
        >
          Ver completo <FiArrowRight size={14} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '10px 0 14px', flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 34, color: '#fff', margin: 0, lineHeight: 1, letterSpacing: '-0.01em' }}>
          {ri.profile.name}
        </h3>
        <span style={{ fontSize: 13, color: '#8a8a92' }}>Seu perfil entre os 16</span>
      </div>

      <p style={{ fontSize: 14, lineHeight: 1.5, color: '#cfcfd4', margin: '0 0 16px', maxWidth: 560 }}>
        {clean(ri.profile.description)}
      </p>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {DIMS.map((d) => {
          const high = ri.pattern[d.k];
          return (
            <div key={d.k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: high ? '#af2896' : '#5a5a64', flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{d.letter}</span>
              <span style={{ fontSize: 12.5, color: high ? '#cfcfd4' : '#8a8a92' }}>{high ? 'Alto' : 'Baixo'}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default RealProfileSummary;
