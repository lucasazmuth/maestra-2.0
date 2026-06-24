import { FC, useMemo } from 'react';
import { message } from 'antd';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useAppDispatch } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { ArtistHero } from '../../components/ArtistHero';
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
  const { editPlanning } = useArtistCapabilities(artist);

  const content = artist?.content;
  const strategies = useMemo<Strategy[]>(() => content?.strategies || [], [content]);
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
      <ArtistHero artist={artist} />

      {/* FASE de carreira REAL (sem barra de progresso — progresso é do Plano de Ação). */}
      <RealCareerCard artist={artist} taskCounts={taskCounts} showProgress={false} />

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
    </div>
  );
};

export default Profile;
