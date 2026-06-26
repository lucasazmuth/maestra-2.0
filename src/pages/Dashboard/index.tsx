import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMusic, FiCalendar, FiUsers } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { NytaDashboardHero } from '../../components/nyta/NytaDashboardHero';
import { Spinner } from '../../components/spinner/spinner';
import { DashboardEmptyState } from '../../components/DashboardEmptyState';

import { ArtistHero } from '../../components/ArtistHero';
import { MetricsEvolution } from '../../components/MetricsEvolution';
import { JourneyMap } from '../../components/journey/JourneyMap';
import { ConnectSpotify } from './sections';
import { DashboardOverview } from './overview';

const Dashboard: FC = () => {
  const { artist, loading } = useArtist();
  const navigate = useNavigate();
  // Planejamento liberado só no perfil pago (cobrança única R$199,90).
  const { viewPlanning } = useArtistCapabilities(artist);

  if (loading && !artist) {
    return <Spinner loading>{null as any}</Spinner>;
  }
  if (!artist) {
    return <div style={{ padding: 24, color: '#b3b3b3' }}>Artista não encontrado.</div>;
  }

  const sp = artist.content?.spotifyProfile;

  // Operação do dia a dia (o ciclo de crescimento — REAL/Planejamento/Plano — vive no JourneyMap).
  const quickLinks = [
    { icon: <FiMusic />, label: 'Catálogo', to: 'catalog' },
    { icon: <FiCalendar />, label: 'Agenda', to: 'agenda' },
    { icon: <FiUsers />, label: 'Equipe', to: 'team' },
  ];


  return (
    <div style={{ padding: 24 }}>
      {/* Cabeçalho do artista (foto + nome + stats) */}
      <ArtistHero artist={artist} />

      {/* Conectar ao Spotify se o artista ainda não está vinculado */}
      {!sp?.spotify_artist_id && <ConnectSpotify artist={artist} />}

      {/* Perfil não pago → upsell. Pago → o mapa da jornada orienta tudo (inclui o estado sem plano). */}
      {!viewPlanning && (
        <DashboardEmptyState
          title='Desbloqueie este perfil'
          description='Pague uma vez (R$ 199,90) e libere o planejamento estratégico com a Nyta, o plano salvo para sempre e o compartilhamento com colaboradores.'
          ctaLabel='Desbloquear — R$ 199,90'
          ctaTo='/criar-artista'
        />
      )}

      {/* Visão geral + Ferramentas só no perfil pago (não pago → recursos travados) */}
      {viewPlanning && (
        <>
          {/* Mapa da jornada (REAL → Planejamento → Plano de Ação → ↺) — a home que orienta o ciclo */}
          <JourneyMap artist={artist} />

          {/* Visão geral — próximas tarefas/eventos/lançamentos */}
          <DashboardOverview artist={artist} />

          {/* Evolução de métricas */}
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '24px 0 12px' }}>Evolução de métricas</h2>
          <MetricsEvolution artistId={artist.id} hideLabel />

          {/* Ferramentas do dia a dia (operação) */}
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '24px 0 12px' }}>Ferramentas do dia a dia</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            {quickLinks.map((l) => (
              <button
                key={l.to}
                onClick={() => navigate(`/artists/${artist.id}/${l.to}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#181818',
                  border: 'none',
                  borderRadius: 8,
                  padding: 16,
                  cursor: 'pointer',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  transition: 'background-color .2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#282828')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#181818')}
              >
                <span style={{ fontSize: 22, color: '#b3b3b3', display: 'flex' }}>{l.icon}</span>
                {l.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 2.1 Hero da Nyta — entrada do assistente (brilho aurora + busca + sugestões) */}
      <NytaDashboardHero />

      {/* 3. Histórico de fases */}
    </div>
  );
};

export default Dashboard;
