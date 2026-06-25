import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTarget, FiMusic, FiCalendar, FiUsers } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { NytaDashboardHero } from '../../components/nyta/NytaDashboardHero';
import { Spinner } from '../../components/spinner/spinner';
import { DashboardEmptyState } from '../../components/DashboardEmptyState';

import { ArtistHero } from '../../components/ArtistHero';
import { MetricsEvolution } from '../../components/MetricsEvolution';
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
  const hasPlan = !!artist.content?.strategies?.length;

  const quickLinks = [
    { icon: <FiTarget />, label: 'Plano de Ação', to: 'action-plan' },
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

      {/* Corpo: perfil não pago → upsell; pago sem plano → iniciar. A FASE REAL agora vive no Perfil. */}
      {!viewPlanning ? (
        <DashboardEmptyState
          title='Desbloqueie este perfil'
          description='Pague uma vez (R$ 199,90) e libere o planejamento estratégico com a Nyta, o plano salvo para sempre e o compartilhamento com colaboradores.'
          ctaLabel='Desbloquear — R$ 199,90'
          ctaTo='/criar-artista'
        />
      ) : hasPlan ? null : (
        <div style={{ position: 'relative', background: '#181818', borderRadius: 12, padding: 24, marginBottom: 24, textAlign: 'center' }}>
          <span className='aurora-glow aurora-glow--on' aria-hidden />
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
            Construa seu plano com a Nyta IA
          </h2>
          <p style={{ color: '#b3b3b3', margin: '0 0 16px', lineHeight: 1.5 }}>
            A Nyta, sua estrategista de IA, te guia passo a passo: identidade, objetivos, diagnóstico
            e estratégias viram um plano de ação com metas e cronograma — feito pra sua carreira.
          </p>
          <button
            // Leva à tela de intro "Oi, [artista]!" (ActionPlan empty state), igual ao caminho pela
            // navbar (Plano de Ação) — de lá, "Sim, iniciar" abre o chat do wizard. Fluxo consistente.
            onClick={() => navigate(`/artists/${artist.id}/action-plan`)}
            style={{ background: '#af2896', border: 'none', color: '#fff', padding: '12px 28px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
          >
            Iniciar planejamento →
          </button>
        </div>
      )}

      {/* Visão geral + Acesso rápido só no perfil pago (não pago → recursos travados) */}
      {viewPlanning && (
        <>
          {/* 1. Visão geral — junto da Fase no topo (foco pós-criação = planejamento) */}
          <DashboardOverview artist={artist} />

          {/* O diagnóstico REAL agora é o card de fase no topo (RealCareerCard) — sem seção duplicada. */}

          {/* 3. Seção: Evolução de métricas */}
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '24px 0 12px' }}>Evolução de métricas</h2>
          <MetricsEvolution artistId={artist.id} hideLabel />

          {/* 4. Acesso rápido */}
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '24px 0 12px' }}>Acesso rápido</h2>
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
