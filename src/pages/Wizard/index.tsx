import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { App } from 'antd';
import { FiArrowLeft, FiCornerUpLeft, FiRotateCcw, FiSidebar } from 'react-icons/fi';

import './styles.scss';
import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import { useWizardPanelStore } from '../../stores/wizardPanelStore';
import { migrateWizardContent } from './migration';
import { NytaChat } from './chat/NytaChat';
import EnhancedEmptyState from '../../components/action-plan/EnhancedEmptyState';
import { supabase } from '../../lib/supabase';
import { shouldEnrichChartmetric } from '../../lib/chartmetricFreshness';
import { setWizardPlatformContext, clearWizardPlatformContext } from '../../services/wizardAi';
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

  // Marca a tela para o CSS reservar altura da tab bar no mobile (ver gsap-reference.css).
  //
  // A barra CONTINUA visível aqui, e isso é deliberado: o "voltar" do cabeçalho volta uma
  // pergunta, não sai da tela — sem a tab bar a pessoa fica presa no wizard sem caminho de saída.
  // O que incomodava não era a barra existir, era ela ficar por cima da conversa.
  useEffect(() => {
    document.body.classList.add('wizard-fullscreen');
    return () => document.body.classList.remove('wizard-fullscreen');
  }, []);

  // Convite antes da conversa. Quem entra direto (pelo rail, pelo menu) caía no meio de um
  // chat já em andamento, sem contexto do que é aquilo nem do próximo passo. A mesma mensagem
  // que o Plano de Ação usa serve aqui — e, vindo de lá, ela não se repete.
  const location = useLocation();
  const [entrou, setEntrou] = useState<boolean>(() => !!(location.state as { convidado?: boolean } | null)?.convidado);

  const [draft, setDraft] = useState<ArtistContent>({});
  const [draftReady, setDraftReady] = useState(false);

  // Fonte única da decisão "estou mostrando o convite?": o render e o efeito da coluna de
  // resultados leem daqui, senão um poderia dizer sim e o outro não.
  const mostrandoConvite = draftReady && !entrou && !(draft.step ?? 0);
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

  // Liga/desliga a coluna de resultados no AppLayout enquanto a CONVERSA está aberta.
  // Ela nasce ABERTA no desktop (é o acompanhamento do plano, não um extra a descobrir). No
  // mobile não: lá a coluna vira folha de tela cheia e abriria por cima da própria conversa —
  // o breakpoint é o mesmo do CSS (.wiz-artifacts). Fechar segue sendo escolha do usuário.
  //
  // Depende de `mostrandoConvite` porque hooks rodam mesmo quando o render sai antes pelo
  // convite: sem isso a coluna "Etapa 1 de 9" aparecia ao lado de uma tela que ainda nem
  // começou, anunciando um progresso que não existe.
  useEffect(() => {
    if (mostrandoConvite) return;
    wizardPanel.activate(window.matchMedia('(min-width: 769px)').matches);
    return () => wizardPanel.deactivate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mostrandoConvite]);

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
  // Avatar do perfil no cabeçalho (identifica de quem é o plano, já que o nome saiu da linha de baixo).
  const artistImage = sp?.image || ARTISTS_DEFAULT_IMAGE;
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

  // Convite antes da conversa — só para quem ainda não começou o planejamento e não veio pela
  // CTA do Plano de Ação (que já convidou).
  if (mostrandoConvite) {
    return (
      <EnhancedEmptyState
        artistId={artist?.id || ''}
        artistName={identity.name || artist?.name || ''}
        onStartWizard={() => setEntrou(true)}
      />
    );
  }

  return (
    <div className='wizard wizard--chat'>
      {/* Brilho aurora na borda ao avançar de etapa (re-monta via key pra re-tocar a animação) */}
      {stepGlow > 0 && <span key={stepGlow} className='wiz-step-glow wiz-step-glow--on' aria-hidden />}

      {/* Cabeçalho fixo: não rola junto com a conversa */}
      <div className='wiz-chat-head'>
        <div className='wiz-col'>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            {/* Identificação enxuta: avatar do perfil + título. A etapa saiu daqui e passou a
                ser o título do painel de resultados — só um lugar diz em que etapa se está. */}
            <div className='wiz-head-id'>
              {/* SAIR do planejamento. Sem isto o wizard nao teria saida nenhuma no celular: os
                  outros tres botoes agem DENTRO da conversa (desfazer, recomecar, ver o plano) e a
                  unica porta era a tab bar, que agora nao existe aqui. Vai para "Seus perfis", o
                  mesmo destino do "Tela inicial" do rail — e nao para o dashboard do artista, que
                  com o plano incompleto reencaminha de volta para ca. */}
              <button
                className='wiz-exit-btn'
                title='Sair do planejamento'
                aria-label='Sair do planejamento'
                onClick={() => navigate('/artists')}
              >
                <FiArrowLeft size={18} />
              </button>
              <img className='wiz-head-avatar' src={artistImage} alt='' aria-hidden />
              {/* Cor/tamanho vêm de `.wiz-title` (styles.scss) — a tipografia acompanha a viewport. */}
              <h1 className='wiz-title' style={{ fontFamily: 'var(--font-display)', fontWeight: 800, margin: 0 }}>
                Crie seu planejamento
              </h1>
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
                  {/* Deixou de ser FiArrowLeft: com a seta de SAIR agora no canto esquerdo, duas
                      setas iguais na mesma barra significariam coisas diferentes. Esta desfaz um
                      passo da conversa, e o icone de canto diz isso. */}
                  <FiCornerUpLeft size={17} />
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
              {/* Abrir a coluna de resultados. Só aparece com ela FECHADA: aberta, quem fecha
                  é o X do próprio painel, e manter os dois seria oferecer a mesma ação duas
                  vezes na mesma tela. */}
              {!wizardPanel.open && (
                <button
                  className='wiz-back-btn'
                  title='Ver seu plano'
                  aria-label='Ver seu plano'
                  onClick={() => wizardPanel.setOpen(true)}
                >
                  <FiSidebar size={17} />
                </button>
              )}
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
