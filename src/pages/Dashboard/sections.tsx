import { FC, ReactNode, useState } from 'react';
import { Input, Popconfirm, Spin, message } from 'antd';
import { FaSpotify } from 'react-icons/fa6';
import { FiArrowRight } from 'react-icons/fi';

import { useAppDispatch } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { getPhaseInfo } from '../../constants/maestra';
import { searchSpotifyArtists, buildSpotifyProfileAndCatalog } from '../../services/spotifyArtist';
import { supabase } from '../../lib/supabase';
import type { Artist, ArtistContent, SwotAnalysis } from '../../interfaces/maestra';

// Seções da home do artista (Dashboard). Antes viviam na tela Perfil — foram fundidas aqui.

interface TaskCounts {
  todo: number;
  inProgress: number;
  done: number;
  total: number;
}

// ---- Card de Fase de Carreira ------------------------------------------------------------------

export const PhaseCard: FC<{
  artist: Artist;
  taskCounts: TaskCounts;
  advancing: boolean;
  onAdvance: () => void;
  footer?: ReactNode; // conteúdo extra renderizado dentro do card (ex.: resumo executivo no Plano de Ação)
  hideFocus?: boolean; // oculta Foco/Evite (Plano de Ação libera espaço pras estratégias)
}> = ({ artist, taskCounts, advancing, onAdvance, footer, hideFocus }) => {
  const phase = artist.content?.phase || 1;
  const info = getPhaseInfo(phase);
  const label = artist.content?.phaseLabel || info.label;
  const pct = taskCounts.total ? Math.round((taskCounts.done / taskCounts.total) * 100) : 0;
  const complete = taskCounts.total > 0 && taskCounts.done === taskCounts.total;

  return (
    <div style={{ background: 'linear-gradient(180deg, #1f1f1f, #121212)', borderRadius: 12, padding: 24, marginBottom: 24 }}>
      <div style={{ color: '#b3b3b3', fontSize: 12, fontWeight: 700 }}>FASE {phase}</div>
      <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '4px 0 16px', fontFamily: 'SpotifyMixUITitle' }}>
        {label}
      </h2>

      {/* Progresso = % de tarefas concluídas da fase */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: '#af2896', transition: 'width .4s cubic-bezier(0.4,0,0.2,1)' }} />
        </div>
        <span style={{ color: '#af2896', fontWeight: 800, fontSize: 14, minWidth: 42, textAlign: 'right' }}>{pct}%</span>
      </div>

      {!hideFocus && (
        <>
          <p style={{ color: '#fff', margin: '0 0 4px' }}>
            <strong>Foco:</strong> {info.focus}
          </p>
          <p style={{ color: '#b3b3b3', margin: 0 }}>
            <strong>Evite:</strong> {info.antiFocus}
          </p>
        </>
      )}

      {complete ? (
        <Popconfirm
          title='Avançar de fase?'
          description={`O plano atual será arquivado no histórico e um novo ciclo começa para a fase ${phase + 1}.`}
          okText='Avançar'
          cancelText='Cancelar'
          onConfirm={onAdvance}
        >
          <button
            disabled={advancing}
            style={{
              marginTop: 16,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: '#af2896',
              border: 'none',
              color: '#fff',
              padding: '10px 24px',
              borderRadius: 9999,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {advancing ? 'Avançando…' : 'Avançar de fase'} <FiArrowRight />
          </button>
        </Popconfirm>
      ) : (
        <p style={{ color: '#6b7280', fontSize: 13, margin: '16px 0 0' }}>
          Conclua todas as tarefas do plano de ação para avançar de fase.
        </p>
      )}

      {footer}
    </div>
  );
};

// ---- Resumo SWOT -------------------------------------------------------------------------------

const StatBox: FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#181818', borderRadius: 8, padding: 16, flex: 1, minWidth: 120 }}>
    <div style={{ color, fontSize: 28, fontWeight: 800 }}>{value}</div>
    <div style={{ color: '#b3b3b3', fontSize: 13 }}>{label}</div>
  </div>
);

export const SwotSummary: FC<{ swot?: SwotAnalysis }> = ({ swot }) => (
  <>
    <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '24px 0 12px' }}>Análise SWOT</h2>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <StatBox label='Forças' value={swot?.strengths?.length || 0} color='#af2896' />
      <StatBox label='Fraquezas' value={swot?.weaknesses?.length || 0} color='#e91429' />
      <StatBox label='Oportunidades' value={swot?.opportunities?.length || 0} color='#3b82f6' />
      <StatBox label='Ameaças' value={swot?.threats?.length || 0} color='#f59e0b' />
    </div>
  </>
);

// ---- Resumo executivo + histórico de fases -----------------------------------------------------

export const ExecutiveSummary: FC<{ text: string }> = ({ text }) => (
  <>
    <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '24px 0 12px' }}>Resumo executivo</h2>
    <div style={{ background: '#181818', borderRadius: 8, padding: 16, color: '#d0d0d0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
      {text}
    </div>
  </>
);

export const PhaseHistory: FC<{ history: NonNullable<ArtistContent['phaseHistory']> }> = ({ history }) => (
  <>
    <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '24px 0 12px' }}>Histórico de fases</h2>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {history.map((h, i) => (
        <div key={i} style={{ background: '#181818', borderRadius: 8, padding: 12, color: '#b3b3b3', fontSize: 13 }}>
          Fase {h.phase} — {h.phaseLabel} ({new Date(h.snapshotAt).toLocaleDateString('pt-BR')})
        </div>
      ))}
    </div>
  </>
);

// ---- Conectar ao Spotify (quando o artista não está vinculado) ----------------------------------

export const ConnectSpotify: FC<{ artist: Artist }> = ({ artist }) => {
  const dispatch = useAppDispatch();
  const [linking, setLinking] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  return (
    <div style={{ background: '#181818', borderRadius: 12, padding: 20, marginBottom: 24, border: '1px solid #282828' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <FaSpotify color='#af2896' size={22} />
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Conectar ao Spotify</h2>
      </div>
      <p style={{ color: '#b3b3b3', fontSize: 13, margin: '0 0 12px' }}>
        Vincule ao perfil do Spotify para carregar métricas, seguidores e catálogo automaticamente.
      </p>

      {!linking ? (
        <button
          onClick={() => setLinking(true)}
          style={{ background: '#af2896', border: 'none', color: '#fff', padding: '8px 20px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
        >
          Buscar no Spotify
        </button>
      ) : (
        <div>
          <Input
            autoFocus
            placeholder='Nome do artista no Spotify'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            prefix={<FaSpotify color='#af2896' />}
            onPressEnter={async () => {
              if (!query.trim()) return;
              setSearching(true);
              try {
                setResults(await searchSpotifyArtists(query));
              } catch {
                message.error('Falha na busca');
              }
              setSearching(false);
            }}
          />
          {searching && <div style={{ textAlign: 'center', padding: 12 }}><Spin /></div>}
          <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto' }}>
            {results.map((r: any) => (
              <button
                key={r.id}
                onClick={async () => {
                  try {
                    const { data: check } = await supabase.rpc('check_spotify_artist_exists', { p_spotify_id: r.id });
                    if (check?.[0]?.exists_flag && !check[0].is_own) {
                      message.error(`"${r.name}" já está vinculado por outro usuário.`);
                      return;
                    }
                    const { profile, catalog } = await buildSpotifyProfileAndCatalog(r.id);
                    const content: ArtistContent = { ...artist.content, spotifyProfile: profile, spotifyCatalog: catalog };
                    await dispatch(artistsActions.updateArtistContent({ id: artist.id, content })).unwrap();
                    await supabase.from('artists').update({ spotify_artist_id: r.id }).eq('id', artist.id);
                    message.success('Spotify vinculado com sucesso!');
                    setLinking(false);
                    setResults([]);
                  } catch (err: any) {
                    message.error(err.message || 'Erro ao vincular');
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 8, background: 'transparent', border: 'none', borderRadius: 6, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#282828')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <img src={r.image || ''} alt={r.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{r.name}</div>
                  {r.followers != null && <div style={{ color: '#b3b3b3', fontSize: 11 }}>{r.followers.toLocaleString('pt-BR')} seguidores</div>}
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => { setLinking(false); setResults([]); }} style={{ background: 'transparent', border: 'none', color: '#b3b3b3', marginTop: 8, cursor: 'pointer', fontSize: 12 }}>
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
};
