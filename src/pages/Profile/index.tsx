import { FC, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { FiArrowRight } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useAppDispatch } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { PageHeader } from '../../components/PageHeader';
import { RedoRealBanner } from '../../components/RedoRealBanner';
import { PRODUCT_THEME, pageBg } from '../../components/productTheme';
import { RealCareerCard } from '../../components/RealCareerCard';
import { PhaseSummary } from '../../components/PhaseSummary';
import AdvancedPlan from '../ActionPlan/AdvancedPlan';
import { isOnboardingComplete } from '../../constants/maestra';
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
  const { isPro } = useEntitlements();

  const content = artist?.content;
  const strategies = useMemo<Strategy[]>(() => content?.strategies || [], [content]);
  // O dossiê só é exibido quando o wizard foi CONCLUÍDO (Finalizar clicado). Ter só as estratégias
  // geradas (step 6) não basta — faltam a seleção que vira tarefa (step 7) e o resumo (step 8);
  // nesse meio-do-caminho mostramos o CTA de "continuar" pra não travar o usuário num plano parcial.
  const hasPlan = isOnboardingComplete(artist);
  // Começou o wizard mas não concluiu → o CTA vira "continuar de onde parou".
  const resumingPlan = !hasPlan && ((content?.step ?? 0) > 0 || strategies.length > 0);
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

  const onRedo = () => navigate(isPro ? `/artists/${artist.id}/diagnostico/refazer` : '/assinatura');

  return (
    <div style={{ padding: 24, minHeight: '100%', ...pageBg(PRODUCT_THEME.planning.accent) }}>
      <PageHeader
        title="Planejamento estratégico"
        subtitle={`Visão, missão, valores, objetivos e estratégias de ${artist.name}.`}
      />

      {/* Sem planejamento concluído, a tela fica SÓ com o card de gatilho (criar/continuar) —
          FASE de carreira e "Refazer diagnóstico" só fazem sentido quando já existe um plano. */}
      {hasPlan && (
        <>
          {/* FASE de carreira REAL (sem barra de progresso — progresso é do Plano de Ação). */}
          <RealCareerCard artist={artist} taskCounts={taskCounts} showProgress={false} compact />

          {/* Loop do ciclo: executou o plano → refaz o REAL → sobe de fase. */}
          {artist.content?.realIndex?.profile && (
            <RedoRealBanner onRedo={onRedo} locked={!isPro} marginTop={0} marginBottom={24} />
          )}
        </>
      )}

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
        // Sem planejamento CONCLUÍDO: o dossiê não existe — direciona pra criar/continuar com a Nyta.
        <div style={{ position: 'relative', overflow: 'hidden', background: '#181818', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <span className="aurora-glow aurora-glow--on" aria-hidden />
          <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
            {resumingPlan ? 'Termine seu planejamento estratégico' : 'Monte seu planejamento estratégico'}
          </h2>
          <p style={{ color: '#b3b3b3', margin: '0 auto 18px', lineHeight: 1.5, maxWidth: 520 }}>
            {resumingPlan
              ? 'Você parou no meio do planejamento. Volte pra escolher as estratégias que viram tarefas e finalizar. Só então o dossiê e o plano de ação ficam prontos.'
              : 'É no planejamento com a Nyta que nascem os fundamentos do seu perfil: visão, missão, valores, objetivos, referências e a análise SWOT. Crie o seu para preencher esta página.'}
          </p>
          <button
            onClick={() => navigate(`/artists/${artist.id}/wizard`)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#BE81EC', color: '#1A1A1A', border: 'none', padding: '12px 28px', borderRadius: 9999, cursor: 'pointer', fontWeight: 800, fontSize: 15 }}
          >
            {resumingPlan ? 'Continuar planejamento' : 'Criar planejamento estratégico'} <FiArrowRight />
          </button>
        </div>
      )}
    </div>
  );
};

export default Profile;
