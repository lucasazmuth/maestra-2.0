import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { FiChevronDown } from 'react-icons/fi';

import './styles.scss';
import { useArtist } from '../../hooks/useArtist';
import { useArtistCapabilities } from '../../hooks/useArtistCapabilities';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { Spinner } from '../../components/spinner/spinner';
import { WIZARD_TOTAL_STEPS } from '../../constants/maestra';
import { ghostBtn } from './components';
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
  useEffect(() => {
    wizardPanel.activate();
    return () => wizardPanel.deactivate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Publica draft + nome + progresso para a coluna renderizada no AppLayout.
  useEffect(() => {
    const prog = Math.round((Math.min(draft.step ?? 0, WIZARD_TOTAL_STEPS) / WIZARD_TOTAL_STEPS) * 100);
    wizardPanel.setData({ content: draft, artistName: artist?.name || '', progress: prog });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, artist?.name]);

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

  if (!artist) {
    if (artistsLoaded) return <Navigate to='/artists' replace />;
    return <Spinner loading>{null as any}</Spinner>;
  }

  const step = Math.min(draft.step ?? 0, WIZARD_TOTAL_STEPS - 1);
  const progress = Math.round((Math.min(draft.step ?? 0, WIZARD_TOTAL_STEPS) / WIZARD_TOTAL_STEPS) * 100);

  return (
    <div className='wizard wizard--chat'>
      {/* Brilho aurora na borda ao avançar de etapa (re-monta via key pra re-tocar a animação) */}
      {stepGlow > 0 && <span key={stepGlow} className='wiz-step-glow wiz-step-glow--on' aria-hidden />}

      {/* Cabeçalho fixo: não rola junto com a conversa */}
      <div className='wiz-chat-head'>
        <div className='wiz-col'>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <h1 className='wiz-title' style={{ fontFamily: 'SpotifyMixUITitle', fontWeight: 800, fontSize: 22, color: '#fff', margin: 0 }}>
              Planejamento Estratégico
            </h1>
            <button
              title='Seu progresso fica salvo a cada etapa'
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
              style={{ ...ghostBtn, padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap', opacity: exiting ? 0.6 : 1 }}
            >
              {exiting ? 'Salvando…' : 'Salvar e sair'}
            </button>
          </div>

          <div className='wiz-progress-track' style={{ marginTop: 12, marginBottom: 10 }}>
            <div className='wiz-progress-fill' style={{ width: `${progress}%` }} />
          </div>

          {/* Mostra/esconde a coluna de resultados (no AppLayout). Sem modal. */}
          <button
            className='wiz-step-nav'
            onClick={() => wizardPanel.toggle()}
            title='Ver seus resultados'
            aria-expanded={wizardPanel.open}
          >
            Etapa {step + 1} de {STEP_LABELS.length} · {STEP_LABELS[step]}
            <FiChevronDown size={14} style={{ transform: wizardPanel.open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
          </button>
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
        />
      )}
    </div>
  );
};

export default Wizard;
