import { FC, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import ColorThiefRaw from 'colorthief';
import { FiTarget, FiMusic, FiCalendar, FiUsers } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { NytaDashboardHero } from '../../components/nyta/NytaDashboardHero';
import { useAppDispatch } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { DashboardEmptyState } from '../../components/DashboardEmptyState';

import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import { getPhaseInfo } from '../../constants/maestra';
import * as wizardAi from '../../services/wizardAi';
import type { ArtistContent, Strategy } from '../../interfaces/maestra';
import { RealProfileSummary } from '../../components/RealProfileSummary';
import { MetricsEvolution } from '../../components/MetricsEvolution';
import { ConnectSpotify, PhaseCard, PhaseHistory } from './sections';
import { DashboardOverview } from './overview';

// O typedef de colorthief resolve pra versão node (sem construtor); no browser o webpack usa
// o build construível. Cast pro tipo de browser.
const ColorThief = ColorThiefRaw as unknown as {
  new (): { getColor: (img: HTMLImageElement) => [number, number, number] };
};

const Dashboard: FC = () => {
  const { artist, loading } = useArtist();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  // Planejamento liberado só no perfil pago (cobrança única R$199,90).
  const { viewPlanning } = useArtistCapabilities(artist);
  const [advancing, setAdvancing] = useState(false);
  // Cor dominante da foto do artista (estilo Spotify) — extraída no onLoad da imagem.
  const [heroColor, setHeroColor] = useState<string | null>(null);

  const taskCounts = useMemo(() => {
    const strategies: Strategy[] = artist?.content?.strategies || [];
    const all = strategies.flatMap((s) => s.tasks || []);
    return {
      todo: all.filter((t) => t.status === 'todo').length,
      inProgress: all.filter((t) => t.status === 'in_progress').length,
      done: all.filter((t) => t.status === 'done').length,
      total: all.length,
    };
  }, [artist]);

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

  // Avançar de fase: arquiva o ciclo atual, incrementa a fase (infinita), gera rótulo via IA,
  // reseta o planejamento e reabre o wizard em Objetivos para replanejar a nova fase.
  const advancePhase = async () => {
    if (advancing) return;
    if (!(taskCounts.total > 0 && taskCounts.done === taskCounts.total)) {
      message.warning('Conclua todas as tarefas do plano para avançar de fase.');
      return;
    }
    setAdvancing(true);
    try {
      const content = artist.content || {};
      const phase = content.phase || 1;
      const nextPhase = phase + 1;

      const snapshot = {
        phase,
        phaseLabel: content.phaseLabel || getPhaseInfo(phase).label,
        objectives: content.objectives,
        strategies: content.strategies,
        swotAnalysis: content.swotAnalysis,
        snapshotAt: new Date().toISOString(),
      };

      let nextLabel = getPhaseInfo(nextPhase).label;
      try {
        const ai = await wizardAi.generatePhaseLabel(content.identity || { name: artist.name }, nextPhase);
        if (ai?.trim()) nextLabel = ai.trim();
      } catch {
        /* mantém o fallback */
      }

      const next: ArtistContent = {
        ...content,
        phase: nextPhase,
        phaseLabel: nextLabel,
        phaseHistory: [...(content.phaseHistory || []), snapshot],
        // novo ciclo de planejamento (a identidade é transversal e permanece)
        objectives: [],
        swotQuizQuestions: [],
        swotQuizAnswers: {},
        swotAnalysis: undefined,
        strategyQuizQuestions: [],
        strategyQuizAnswers: {},
        strategies: [],
        executiveSummary: undefined,
        step: 1, // reabre o wizard em Objetivos (pula Identidade)
      };

      await dispatch(artistsActions.updateArtistContent({ id: artist.id, content: next })).unwrap();
      message.success(`Nova fase iniciada: ${nextLabel}`);
      navigate(`/artists/${artist.id}/wizard`);
    } catch {
      message.error('Erro ao avançar de fase');
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Hero com stats do Spotify */}
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
          <div style={{ display: 'flex', gap: 16, color: '#b3b3b3', fontSize: 14 }}>
            {sp ? (
              <>
                {sp.followers != null && <span>{sp.followers.toLocaleString('pt-BR')} seguidores</span>}
                {sp.popularity != null && <span>Popularidade {sp.popularity}/100</span>}
                {sp.track_count != null && <span>{sp.track_count} faixas</span>}
              </>
            ) : (
              <span>Carregando…</span>
            )}
          </div>
        </div>
      </div>

      {/* Conectar ao Spotify se o artista ainda não está vinculado */}
      {!sp?.spotify_artist_id && <ConnectSpotify artist={artist} />}

      {/* Corpo: perfil não pago → upsell; pago com plano → card de fase; pago sem plano → iniciar */}
      {!viewPlanning ? (
        <DashboardEmptyState
          title='Desbloqueie este perfil'
          description='Pague uma vez (R$ 199,90) e libere o planejamento estratégico com a Nyta, o plano salvo para sempre e o compartilhamento com colaboradores.'
          ctaLabel='Desbloquear — R$ 199,90'
          ctaTo='/criar-artista'
        />
      ) : hasPlan ? (
        <PhaseCard artist={artist} taskCounts={taskCounts} advancing={advancing} onAdvance={advancePhase} hideFocus />
      ) : (
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
          {/* Evolução de métricas — deltas entre os 2 últimos snapshots */}
          <MetricsEvolution artistId={artist.id} />

          {/* 1. Visão geral — tarefas, eventos, catálogos e equipe */}
          <DashboardOverview artist={artist} />

          {/* Diagnóstico REAL — resumo do perfil de carreira (só se houver Índice REAL salvo).
              Fica mais abaixo de propósito: o foco pós-criação do perfil é o planejamento, então o
              card de Fase manda no topo e o diagnóstico não disputa o primeiro clique. */}
          <RealProfileSummary artist={artist} />

          {/* 2. Acesso rápido */}
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
      {hasPlan && !!artist.content?.phaseHistory?.length && <PhaseHistory history={artist.content.phaseHistory} />}
    </div>
  );
};

export default Dashboard;
