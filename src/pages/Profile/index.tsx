import { FC, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { FiArrowRight } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useAppDispatch } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { RealCareerCard } from '../../components/RealCareerCard';
import { PhaseSummary } from '../../components/PhaseSummary';
import AdvancedPlan from '../ActionPlan/AdvancedPlan';
import type { ArtistContent, Strategy } from '../../interfaces/maestra';
import '../ActionPlan/actionPlan.scss';

// Página de Perfil do artista (como uma "página de rede social"): tudo que descreve o artista.
// Cabeçalho + card da FASE REAL + Resumo executivo + dossiê (Fundamentos, Mapa de referências,
// Objetivos, SWOT, Prioridade das estratégias). Editável (lápis), via AdvancedPlan SEM `crud`
// (a edição de tarefas/estratégias é exclusiva do Plano de Ação). Equipe abre por um botão aqui.
const Profile: FC = () => {
  const { artist } = useArtist();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { editPlanning } = useArtistCapabilities(artist);

  const content = artist?.content;
  const strategies = useMemo<Strategy[]>(() => content?.strategies || [], [content]);
  // O dossiê (Fundamentos/Referências/Objetivos/SWOT/Prioridade) só nasce com o planejamento
  // estratégico (wizard → estratégias). Sem ele, mostramos um CTA pra criar — nada de campos vazios.
  const hasPlan = strategies.length > 0;
  // Estratégias em ordem de prioridade (finalScore desc) — alimenta "Prioridade das estratégias".
  const ranked = useMemo(
    () => [...strategies].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)),
    [strategies]
  );

  // taskCounts ainda é exigido pelo RealCareerCard, mas aqui a barra fica oculta (showProgress=false).
  const taskCounts = useMemo(() => {
    const all = strategies.flatMap((s) => (s.tasks || []).filter((t) => t.status !== 'archived'));
    return {
      todo: all.filter((t) => !t.status || t.status === 'todo').length,
      inProgress: all.filter((t) => t.status === 'in_progress').length,
      done: all.filter((t) => t.status === 'done').length,
      total: all.length,
    };
  }, [strategies]);

  // Salva edições do dossiê (visão/missão/valores/bio/objetivos/gênero/referências). Merge raso +
  // persistência otimista. Gate: editar o planejamento exige dono pago/PRO (`editPlanning`).
  const saveContent = async (patch: Partial<ArtistContent>) => {
    if (!artist || !editPlanning) return;
    const next: ArtistContent = { ...artist.content, ...patch };
    dispatch(artistsActions.setArtistContentLocal({ id: artist.id, content: next }));
    try {
      await dispatch(artistsActions.updateArtistContent({ id: artist.id, content: next })).unwrap();
    } catch {
      message.error('Não consegui salvar agora, tenta de novo.');
      dispatch(artistsActions.fetchArtists(artist.user_id));
    }
  };

  if (!artist) return <Spinner loading>{null as any}</Spinner>;

  return (
    <div style={{ padding: 24 }}>
      {/* Cabeçalho próprio (não o ArtistHero do Dashboard) — identifica a página como produto. */}
      <div style={{ marginBottom: 22 }}>
        <span style={{ color: '#af2896', fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Crescimento</span>
        <h1 style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 32, color: '#fff', margin: '2px 0 0' }}>Planejamento estratégico</h1>
        <p style={{ color: '#8a8a92', fontSize: 13.5, margin: '6px 0 0' }}>
          Visão, missão, valores, objetivos e estratégias de {artist.name}.
        </p>
      </div>

      {/* FASE de carreira REAL (sem barra de progresso — progresso é do Plano de Ação). */}
      <RealCareerCard artist={artist} taskCounts={taskCounts} showProgress={false} />

      {hasPlan ? (
        <>
          {/* Resumo executivo ("Onde X está hoje"). */}
          {content?.executiveSummary && <PhaseSummary text={content.executiveSummary} />}

          {/* Dossiê: Fundamentos, Mapa de referências, Objetivos, SWOT, Prioridade das estratégias.
              Sem `crud` → a seção editável de "Estratégias"/tarefas (do Plano de Ação) não aparece. */}
          <AdvancedPlan
            content={content!}
            ranked={ranked}
            onSaveContent={saveContent}
            canEdit={editPlanning}
          />
        </>
      ) : (
        // Sem planejamento ainda: o dossiê não existe — direciona pra criar com a Nyta.
        <div style={{ position: 'relative', overflow: 'hidden', background: '#181818', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <span className="aurora-glow aurora-glow--on" aria-hidden />
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
            Monte seu planejamento estratégico
          </h2>
          <p style={{ color: '#b3b3b3', margin: '0 auto 18px', lineHeight: 1.5, maxWidth: 520 }}>
            É no planejamento com a Nyta que nascem os fundamentos do seu perfil: visão, missão,
            valores, objetivos, referências e a análise SWOT. Crie o seu para preencher esta página.
          </p>
          <button
            onClick={() => navigate(`/artists/${artist.id}/action-plan`)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#af2896', border: 'none', color: '#fff', padding: '12px 28px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
          >
            Criar planejamento estratégico <FiArrowRight />
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;
