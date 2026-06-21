import { WIZARD_VERSION } from '../../constants/maestra';
import type { ArtistContent, PhaseHistoryEntry } from '../../interfaces/maestra';

// Migração para a Metodologia v2 (wizardVersion 5). Diferente das migrações anteriores (que só
// reescalavam o `step`), esta é uma REFUNDAÇÃO do método: objetivos, estratégias, priorização e
// plano de ação passam a ser DETERMINÍSTICOS (matrizes/banco canônico), a SWOT vira itens
// canônicos, a missão ganha tier financeiro e a história é removida. Por isso todos os artistas
// — inclusive os que já concluíram — são reconduzidos pelo fluxo novo.
//
// Nada se perde: o conteúdo estratégico anterior (visão/missão/valores/objetivos/SWOT/
// estratégias) é arquivado como um snapshot em `phaseHistory`, e o wizard reinicia em step 0.
// Aplicada ao carregar o draft; a escrita no banco acontece no próximo persist().
export function migrateWizardContent(content: ArtistContent): ArtistContent {
  if ((content.wizardVersion ?? 1) >= WIZARD_VERSION) return content;

  const hadPlan =
    !!content.identity?.vision ||
    !!content.objectives?.length ||
    !!content.strategies?.length ||
    !!content.swotAnalysis;

  // Arquiva o plano antigo (snapshot) para não perder nada do trabalho anterior.
  const archive: PhaseHistoryEntry[] = [...(content.phaseHistory || [])];
  if (hadPlan) {
    archive.push({
      phase: content.phase ?? 1,
      phaseLabel: content.phaseLabel || 'Plano anterior (método v2)',
      objectives: content.objectives,
      strategies: content.strategies,
      swotAnalysis: content.swotAnalysis,
      snapshotAt: new Date().toISOString(),
    });
  }

  // Mantém o reutilizável de cara: nome, gênero musical, idioma e os DADOS DE PLATAFORMA
  // (Spotify, Chartmetric, quiz, diagnóstico, Índice REAL) — eles não fazem parte do plano que
  // está sendo refeito e alimentam a Nyta (ex.: gênero/similares da Chartmetric na nova Q2/refs).
  // Visão/missão/valores/objetivos/SWOT/estratégias/cronograma são refeitos no método novo.
  return {
    language: content.language,
    spotifyProfile: content.spotifyProfile,
    spotifyCatalog: content.spotifyCatalog,
    chartmetricProfile: content.chartmetricProfile,
    quizDiagnostic: content.quizDiagnostic,
    diagnostic: content.diagnostic,
    realIndex: content.realIndex,
    phase: content.phase,
    phaseLabel: content.phaseLabel,
    phaseHistory: archive,
    identity: {
      name: content.identity?.name,
      genre: content.identity?.genre,
    },
    step: 0,
    wizardVersion: WIZARD_VERSION,
  };
}
