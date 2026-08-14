import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { App } from 'antd';
import { FiChevronDown, FiArrowLeft, FiRotateCcw, FiX } from 'react-icons/fi';

import './styles.scss';
import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { WIZARD_TOTAL_STEPS } from '../../constants/maestra';
import { useWizardPanelStore } from '../../stores/wizardPanelStore';
import { migrateWizardContent } from './migration';
import { NytaChat } from './chat/NytaChat';
import { supabase } from '../../lib/supabase';
import { shouldEnrichChartmetric } from '../../lib/chartmetricFreshness';
import { setWizardPlatformContext, clearWizardPlatformContext } from '../../services/wizardAi';
import { STEP_LABELS } from './chat/script';
import type { ArtistContent, ArtistIdentity } from '../../interfaces/maestra';

// Shell do Planejamento Estratégico conversacional: é dono do draft, da persistência e da
// migração; a condução da conversa (beats, widgets, IA) vive em chat/NytaChat.

const Wizard: FC = () => {
  const { message, modal } = App.useApp(); // `message`/`modal` estáticos são no-op fora do <App> do antd
  const { artist } = useArtist();
  const artistsLoaded = useAppSelector((s) => s.artists.loaded);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  // Quem não pode editar o plano (colaborador sem PRO) não entra no wizard interativo:
  // vai para o Plano de Ação (somente-leitura). Dono pago e colaborador PRO seguem.
  const { editPlanning } = useArtistCapabilities(artist);

  useEffect(() => {
    if (artistsLoaded && artist && !editPlanning) {
      navigate(`/artists/${artist.id}/action-plan`, { replace: true });
    }
  }, [artistsLoaded, artist, editPlanning, navigate]);

  const [draft, setDraft] = useState<ArtistContent>({});
  const [draftReady, setDraftReady] = useState(false);
  const [exiting, setExiting] = useState(false);
  // Coluna de resultados (artefatos por etapa): vive no AppLayout como 3ª coluna; aqui só
  // publicamos os dados e controlamos o toggle via store global.
  const wizardPanel = useWizardPanelStore();
  // Brilho "aurora" disparado a cada avanço de etapa: a key incrementa pra re-tocar a animação.
  const [stepGlow, setStepGlow] = useState(0);
  const prevStepRef = useRef<number | null>(null);

  // Sempre o draft mais recente: persists disparados de closures antigas (widgets,
  // runPrepare) não podem regravar estado velho por cima do novo.
  const draftRef = useRef<ArtistContent>(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // Avanço de etapa → dispara o brilho na borda (ignora o load inicial e qualquer regressão).
  useEffect(() => {
    const s = draft.step ?? 0;
    if (prevStepRef.current != null && s > prevStepRef.current) {
      setStepGlow((k) => k + 1);
    }
    prevStepRef.current = s;
  }, [draft.step]);

  // Liga/desliga a coluna de resultados no AppLayout enquanto o Wizard está montado.
  // Ela nasce ABERTA no desktop (é o acompanhamento do plano, não um extra a descobrir). No
  // mobile não: lá a coluna vira folha de tela cheia e abriria por cima da própria conversa —
  // o breakpoint é o mesmo do CSS (.wiz-artifacts). Fechar segue sendo escolha do usuário.
  useEffect(() => {
    wizardPanel.activate(window.matchMedia('(min-width: 769px)').matches);
    return () => wizardPanel.deactivate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Publica o draft para a coluna renderizada no AppLayout.
  useEffect(() => {
    wizardPanel.setData({ content: draft });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // Fila serializada de gravações: uma por vez, em ordem. Sem isso, requests
  // concorrentes chegam fora de ordem no Supabase e a última a aterrissar vence —
  // foi assim que um step antigo sobrescreveu a conclusão do wizard.
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (artist) {
      let migrated = migrateWizardContent(artist.content || {});
      // Garante o nome do artista na identidade (usado nas falas que tratam o artista pelo nome).
      // Cria um novo objeto: `migrated` pode ser o content congelado do Redux (não-mutável).
      if (!migrated.identity?.name) {
        migrated = { ...migrated, identity: { ...(migrated.identity || {}), name: artist.name } };
      }
      draftRef.current = migrated;
      setDraft(migrated);
      setDraftReady(true);
      // Alimenta a Nyta com os dados de plataforma persistidos (Chartmetric + quiz + diagnóstico).
      const c = artist.content || {};
      setWizardPlatformContext({
        chartmetric: c.chartmetricProfile,
        quizDiagnostic: c.quizDiagnostic,
        diagnostic: c.diagnostic,
        realIndex: c.realIndex,
      });
      // Metodologia v2: gênero/similares da Chartmetric alimentam a Q2 e as referências de
      // posicionamento. Política única (30 dias): só enriquece quando faltam dados ou venceram —
      // NÃO em todo mount. O enrich principal já roda 1× no pós-pagamento (ProfileUnlock).
      if (shouldEnrichChartmetric(c.chartmetricProfile)) {
        supabase.functions
          .invoke('artist-enrich-chartmetric', { body: { artistId: artist.id } })
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist?.id]);

  useEffect(() => () => clearWizardPlatformContext(), []);

  const sp = draft.spotifyProfile;
  const identity: ArtistIdentity = useMemo(
    () => draft.identity || { name: artist?.name },
    [draft.identity, artist?.name]
  );

  const persist = (patch: Partial<ArtistContent>, nextStep?: number): Promise<void> => {
    const run = persistQueueRef.current.then(async () => {
      if (!artist) return;
      // Base sempre fresca (ref), nunca o draft do closure de quem chamou.
      const base = draftRef.current;
      const maxStep = Math.max(base.step ?? 0, nextStep ?? base.step ?? 0);
      const content: ArtistContent = { ...base, ...patch, step: maxStep };
      draftRef.current = content;
      setDraft(content);
      try {
        await dispatch(artistsActions.updateArtistContent({ id: artist.id, content })).unwrap();
      } catch {
        // 1 retry silencioso antes de incomodar o usuário (falhas transitórias de rede)
        try {
          await dispatch(artistsActions.updateArtistContent({ id: artist.id, content })).unwrap();
        } catch {
          message.error('Erro ao salvar progresso — verifique sua conexão');
        }
      }
    });
    persistQueueRef.current = run;
    return run;
  };

  // Restaura um draft ANTERIOR por inteiro (usado pelo "voltar à pergunta anterior"). Diferente do
  // persist normal, aqui o step PODE regredir e campos podem sumir — é uma substituição completa.
  // Vai pela mesma fila serializada, pra não competir com gravações em andamento.
  const restore = (content: ArtistContent): Promise<void> => {
    const run = persistQueueRef.current.then(async () => {
      if (!artist) return;
      draftRef.current = content;
      setDraft(content);
      try {
        await dispatch(artistsActions.updateArtistContent({ id: artist.id, content })).unwrap();
      } catch {
        try {
          await dispatch(artistsActions.updateArtistContent({ id: artist.id, content })).unwrap();
        } catch {
          message.error('Erro ao voltar — verifique sua conexão');
        }
      }
    });
    persistQueueRef.current = run;
    return run;
  };

  // "Voltar à pergunta anterior": o NytaChat avisa quando dá pra voltar e expõe a ação via ref.
  const [canGoBack, setCanGoBack] = useState(false);
  const goBackRef = useRef<() => void>(() => {});

  // "Recomeçar do zero": limpa TODAS as respostas do wizard (mantém os insumos pesados — diagnóstico,
  // Spotify, Chartmetric — e o nome) e volta pro step 0. O NytaChat zera thread/histórico e reabre
  // na 1ª pergunta pela ref (sem re-montar — evita corrida em que a instância antiga grava trilha).
  const HEAVY_INPUT_FIELDS = ['chartmetricProfile', 'quizDiagnostic', 'diagnostic', 'realIndex', 'spotifyProfile', 'spotifyCatalog'] as const;
  const resetRef = useRef<(cleared: ArtistContent) => void>(() => {});
  const resetPlanning = () => {
    const base = draftRef.current;
    const cleared: ArtistContent = {
      language: base.language,
      wizardVersion: base.wizardVersion,
      identity: { name: base.identity?.name || artist?.name },
      step: 0,
    };
    for (const k of HEAVY_INPUT_FIELDS) {
      if (base[k] !== undefined) (cleared as Record<string, unknown>)[k] = base[k];
    }
    resetRef.current(cleared);
  };

  // Publica um persist ESTÁVEL pra coluna de resultados (edição inline dos entregáveis).
  // A função `persist` é recriada a cada render; o wrapper via ref sempre chama a mais recente.
  const persistFnRef = useRef(persist);
  persistFnRef.current = persist;
  useEffect(() => {
    wizardPanel.setPersist((patch) => persistFnRef.current(patch));
    return () => wizardPanel.setPersist(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!artist) {
    if (artistsLoaded) return <Navigate to='/artists' replace />;
    return <Spinner loading>{null as any}</Spinner>;
  }

  const step = Math.min(draft.step ?? 0, WIZARD_TOTAL_STEPS - 1);
  // Só oferece "recomeçar" quando há alguma resposta (senão não há o que zerar).
  const hasProgress = (draft.step ?? 0) > 0 || !!draft.identity?.gender;

  const confirmReset = () => {
    modal.confirm({
      // O antd roda em darkAlgorithm no app inteiro; aqui o diálogo precisa acompanhar o
      // wizard claro. `.wiz-confirm` repinta só esta caixa (styles.scss).
      className: 'wiz-confirm',
      title: 'Recomeçar o planejamento do zero?',
      content:
        'Isso apaga TODAS as respostas do planejamento estratégico e volta para a primeira pergunta. ' +
        'Seus dados de diagnóstico e do Spotify são mantidos. Essa ação não pode ser desfeita.',
      okText: 'Sim, recomeçar',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => resetPlanning(),
    });
  };

  return (
    <div className='wizard wizard--chat'>
      {/* Brilho aurora na borda ao avançar de etapa (re-monta via key pra re-tocar a animação) */}
      {stepGlow > 0 && <span key={stepGlow} className='wiz-step-glow wiz-step-glow--on' aria-hidden />}

      {/* Cabeçalho fixo: não rola junto com a conversa */}
      <div className='wiz-chat-head'>
        <div className='wiz-col'>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            {/* Coluna à esquerda: título em cima, etapa (abre o painel de resultados) embaixo. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              {/* Cor/tamanho vêm de `.wiz-title` (styles.scss) — a tipografia acompanha a viewport. */}
              <h1 className='wiz-title' style={{ fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                Criar planejamento estratégico
              </h1>
              <button
                className='wiz-step-nav'
                onClick={() => wizardPanel.toggle()}
                title='Ver seus resultados'
                aria-expanded={wizardPanel.open}
              >
                {/* Nome do artista trunca sozinho quando é longo; a etapa nunca some.
                    O {' '} é semântico, não visual (o espaço visual vem do `gap`): sem ele o
                    nome acessível do botão sai colado — "A Banca Records- Etapa 1 de 9". */}
                <span className='wiz-step-nav-artist'>{artist.name}</span>{' '}
                <span className='wiz-step-nav-sep' aria-hidden>-</span>{' '}
                <span className='wiz-step-nav-step'>
                  Etapa {step + 1} de {STEP_LABELS.length} · {STEP_LABELS[step]}
                </span>
                <FiChevronDown size={14} style={{ transform: wizardPanel.open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {/* Voltar à pergunta anterior — só aparece depois da 1ª pergunta respondida.
                  Vem antes do "recomeçar": é a ação frequente e reversível, enquanto o
                  recomeçar é destrutivo e fica mais longe do alcance imediato. */}
              {canGoBack && (
                <button
                  className='wiz-back-btn'
                  title='Voltar à pergunta anterior'
                  aria-label='Voltar à pergunta anterior'
                  onClick={() => goBackRef.current()}
                >
                  <FiArrowLeft size={18} />
                </button>
              )}
              {/* Recomeçar do zero — só aparece quando há progresso; pede confirmação (destrutivo). */}
              {hasProgress && (
                <button
                  className='wiz-back-btn'
                  title='Recomeçar o planejamento do zero'
                  aria-label='Recomeçar o planejamento'
                  onClick={confirmReset}
                >
                  <FiRotateCcw size={17} />
                </button>
              )}
              <button
                className='wiz-back-btn'
                title='Salvar e sair — seu progresso fica salvo a cada etapa'
                aria-label='Salvar e sair'
                disabled={exiting}
                onClick={async () => {
                  // Espera qualquer gravação pendente terminar ANTES de navegar, para que
                  // sair da tela nunca cancele um save em andamento (perda de progresso).
                  setExiting(true);
                  try {
                    await persistQueueRef.current;
                  } finally {
                    navigate(`/artists/${artist.id}`);
                  }
                }}
                style={{ opacity: exiting ? 0.6 : 1 }}
              >
                <FiX size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {draftReady && (
        <NytaChat
          artist={artist}
          draft={draft}
          setDraft={setDraft}
          identity={identity}
          sp={sp}
          persist={persist}
          restore={restore}
          onBackChange={setCanGoBack}
          goBackRef={goBackRef}
          resetRef={resetRef}
        />
      )}
    </div>
  );
};

export default Wizard;
