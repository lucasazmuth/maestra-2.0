import { FC, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, message } from 'antd';
import { FiArrowUp } from 'react-icons/fi';

import * as wizardAi from '../../../services/wizardAi';
import { supabase } from '../../../lib/supabase';
import { ARTISTS_DEFAULT_IMAGE } from '../../../constants/spotify';
import { WIZARD_TOTAL_STEPS } from '../../../constants/maestra';
import { NytaBubble, TypingIndicator, UserBubble, WidgetSlot } from './ChatMessage';
import { GUIDED_OPENTEXT, SAY, type OpenTextField } from './nytaPersona';
import { buildOpening, nextBeat, type PrepareAction, type WidgetSpec } from './script';
import {
  GENDER_OPTIONS,
  MISSION_FINANCIAL_OPTIONS,
  STAGE_OPTIONS,
  VISION_ONDE_OPTIONS,
  deriveRecognitionTags,
  missionFinancialSuffix,
  seedValues,
} from './wizardData';
import * as engine from '../method/engines';
import { SWOT_INTERNAL, SWOT_OPPORTUNITIES, SWOT_THREATS } from '../method/swotItems';
import {
  FinalSummaryCard,
  GenderChoice,
  GenreChips,
  MissionFinancialChoice,
  MissionReviewCard,
  ObjectiveChips,
  PriorityScale,
  CityInputCard,
  ProposalPick,
  ReferenceHorizons,
  ReferenceMapCard,
  RetryPill,
  StageChoice,
  StrategyCards,
  SwotBoardCard,
  SwotChecklist,
  SwotInternalCard,
  TextPromptHelper,
  ValueChips,
  VisionAdjetivoChoice,
  VisionOndeChoice,
  VisionPorQuemChoice,
  VisionReviewCard,
  VisionSubstantivoChoice,
} from './widgets';
import type {
  Artist,
  ArtistContent,
  ArtistIdentity,
  MissionFinancialTier,
  MissionParts,
  ReferenceHorizons as ReferenceHorizonsData,
  SpotifyProfile,
  VisionParts,
} from '../../../interfaces/maestra';

// Orquestrador do wizard conversacional (metodologia Nyta): mantém o thread, resolve o próximo
// beat a partir do draft (script.ts), roda as ações de IA (prepare) e roteia o texto digitado.

const uid = () => Math.random().toString(36).slice(2, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ChatItem {
  id: string;
  role: 'nyta' | 'user';
  text?: string;
  hero?: boolean;
  // Card do mapa de referências exibido inline (Metodologia v2, Q6).
  refMap?: ArtistIdentity['references'];
}

interface NytaChatProps {
  artist: Artist;
  draft: ArtistContent;
  setDraft: React.Dispatch<React.SetStateAction<ArtistContent>>;
  identity: ArtistIdentity;
  sp?: SpotifyProfile;
  persist: (patch: Partial<ArtistContent>, nextStep?: number) => Promise<void>;
}

export const NytaChat: FC<NytaChatProps> = ({ artist, draft, setDraft, identity, sp, persist }) => {
  const navigate = useNavigate();
  const [thread, setThread] = useState<ChatItem[]>([]);
  const [typing, setTyping] = useState(false);
  const [widget, setWidget] = useState<WidgetSpec | null>(null);
  const [input, setInput] = useState('');
  // O campo de texto só aparece quando o beat pede digitação (acceptsText).
  const [inputOn, setInputOn] = useState(false);
  const [nonce, setNonce] = useState(0);
  // "Me ajuda a responder": a Nyta pergunta, o artista responde, e ela formula a resposta.
  const [guided, setGuided] = useState<{
    field: OpenTextField;
    answers: Record<string, string>;
    current: string;
    count: number;
    proposal?: string;
    failed?: boolean;
  } | null>(null);

  const stageRef = useRef<string>('');
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const preparingRef = useRef<string | null>(null);
  const openedRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const inputRef = useRef<any>(null);
  // Sempre o draft mais recente — evita merges com closure velha quando respostas chegam rápido.
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const pushUser = (text: string) => setThread((t) => [...t, { id: uid(), role: 'user', text }]);

  // Fila de falas da Nyta: digitando → mensagem, em ordem, com cadência proporcional ao texto.
  const say = (texts: string[]) => {
    const run = queueRef.current.then(async () => {
      for (const text of texts) {
        setTyping(true);
        await sleep(Math.min(400 + text.length * 5, 1200));
        setTyping(false);
        setThread((t) => [...t, { id: uid(), role: 'nyta', text }]);
        await sleep(120);
      }
    });
    queueRef.current = run;
    return run;
  };

  // Injeta o card do mapa de referências inline (na fila, para respeitar a ordem das falas).
  const sayMap = (refs: ArtistIdentity['references']) => {
    const run = queueRef.current.then(async () => {
      setTyping(true);
      await sleep(500);
      setTyping(false);
      setThread((t) => [...t, { id: uid(), role: 'nyta', refMap: refs || {} }]);
      await sleep(120);
    });
    queueRef.current = run;
    return run;
  };

  // Abertura: hero compacto + saudação/recap (uma única vez por montagem).
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setThread([{ id: uid(), role: 'nyta', hero: true }]);
    say(buildOpening(draft, artist.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resolução do beat a cada mudança do draft.
  useEffect(() => {
    if (!openedRef.current) return;
    const beat = nextBeat(draft);

    if (beat.autoPersistStep != null) {
      persist({}, beat.autoPersistStep);
      return;
    }

    if (beat.stage !== stageRef.current) {
      stageRef.current = beat.stage;
      setWidget(null);
      setGuided(null);
      setInputOn(beat.acceptsText === true);
      if (beat.stage === 'vision.city') {
        // Metodologia v2, Q6: o mapa de referências aparece inline ("Aqui está o que produzimos
        // até agora:") ANTES do card de cidade, separados — para não confundir o usuário.
        const refs = draftRef.current.identity?.references;
        say(SAY.visionCityIntro());
        sayMap(refs);
        say(SAY.visionCityAsk()).then(() => setWidget({ kind: 'cityInput' }));
      } else {
        say(beat.say).then(() => {
          if (beat.widget) setWidget(beat.widget);
        });
      }
    }

    if (beat.prepare && preparingRef.current !== beat.stage) {
      preparingRef.current = beat.stage;
      runPrepare(beat.prepare);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, nonce]);

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= 160;
  };
  const scrollToBottom = (smooth: boolean) => {
    endRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
  };

  useEffect(() => {
    if (userScrolledUpRef.current) return;
    const id = requestAnimationFrame(() => scrollToBottom(true));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread, typing, widget, inputOn]);

  useEffect(() => {
    const content = threadRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!userScrolledUpRef.current) scrollToBottom(false);
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const handleScroll = () => {
    userScrolledUpRef.current = !isNearBottom();
  };

  useEffect(() => {
    if (inputOn) inputRef.current?.focus?.();
  }, [inputOn]);

  // ---- Atualização de campos da identidade (persistidas a cada passo, sem avançar step) --------

  const patchIdentity = (patch: Partial<ArtistIdentity>) => {
    const base = draftRef.current.identity || { name: artist.name };
    return persist({ identity: { ...base, ...patch } });
  };
  const patchVisionParts = (patch: Partial<VisionParts>) => {
    const base = draftRef.current.identity || { name: artist.name };
    return persist({ identity: { ...base, visionParts: { ...(base.visionParts || {}), ...patch } } });
  };
  const patchMissionParts = (patch: Partial<MissionParts>) => {
    const base = draftRef.current.identity || { name: artist.name };
    return persist({ identity: { ...base, missionParts: { ...(base.missionParts || {}), ...patch } } });
  };
  const patchReferences = (patch: Partial<NonNullable<ArtistIdentity['references']>>) => {
    const base = draftRef.current.identity || { name: artist.name };
    return persist({ identity: { ...base, references: { ...(base.references || {}), ...patch } } });
  };

  // ---- "Me ajuda a responder": entrevista guiada que formula a resposta de texto aberto --------

  const storeOpenText = (field: OpenTextField, text: string) => {
    if (field === 'oQueFalam') patchVisionParts({ oQueFalam: text });
    else if (field === 'paraQuem') patchMissionParts({ paraQuem: text });
    else patchMissionParts({ entrega: text });
  };

  const startGuided = (field: OpenTextField) => {
    const opener = GUIDED_OPENTEXT[field].opener;
    setGuided({ field, answers: {}, current: opener, count: 1 });
    setWidget(null);
    setInputOn(true);
    say([...SAY.guidedIntro(), opener]);
  };

  const composeProposal = async (field: OpenTextField, answers: Record<string, string>) => {
    setGuided({ field, answers, current: '', count: 0 });
    setInputOn(false);
    await queueRef.current;
    setTyping(true);
    try {
      const text = await wizardAi.composeOpenText(field, draftRef.current.identity || { name: artist.name }, answers);
      setTyping(false);
      setGuided({ field, answers, current: '', count: 0, proposal: text });
      say(SAY.proposalReady());
    } catch (e: any) {
      setTyping(false);
      message.error(e?.message || 'Erro ao compor o texto');
      setGuided({ field, answers, current: '', count: 0, failed: true });
    }
  };

  const handleGuidedAnswer = (text: string) => {
    if (!guided || guided.proposal !== undefined || guided.failed) return;
    const g = guided;
    const answers = { ...g.answers, [g.current]: text };
    const followups = GUIDED_OPENTEXT[g.field].followups;
    const askedFollowups = g.count - 1; // a abertura é a pergunta 1
    if (askedFollowups < followups.length) {
      const q = followups[askedFollowups];
      setGuided({ ...g, answers, current: q, count: g.count + 1 });
      setInputOn(true);
      say([q]);
    } else {
      composeProposal(g.field, answers);
    }
  };

  // Dossiê: contexto consolidado p/ as gerações pesadas não "esquecerem" o que já foi dito.
  const buildDossier = (): string => {
    const id = draftRef.current.identity || {};
    const lines: string[] = [];
    if (id.genre) lines.push(`Generos: ${id.genre}`);
    if (id.stage) lines.push(`Estagio: ${id.stage}`);
    if (id.city) lines.push(`Local: ${id.city}${id.state ? `, ${id.state}` : ''}`);
    if (id.references) {
      const r = id.references;
      const pos = r.posicionamento || {};
      const refParts = [r.artisticas, r.comunicacao, r.gestao, pos.curto, pos.medio, pos.longo].filter(Boolean);
      if (refParts.length) lines.push(`Referencias: ${refParts.join(' | ')}`);
    }
    if (id.vision) lines.push(`Visao: ${id.vision}`);
    if (id.mission) lines.push(`Missao: ${id.mission}`);
    if (id.values?.length) lines.push(`Valores: ${id.values.join(', ')}`);
    if (id.recognitionTags?.length) lines.push(`Reconhecimento: ${id.recognitionTags.join(', ')}`);
    if (draftRef.current.objectives?.length) lines.push(`Objetivos: ${draftRef.current.objectives.join('; ')}`);
    return lines.join('\n');
  };

  // ---- Ações de IA entre beats ----------------------------------------------------------------

  const runPrepare = async (action: PrepareAction) => {
    await queueRef.current;
    setTyping(true);
    try {
      let patch: Partial<ArtistContent> = {};
      const d = draftRef.current;
      const id = d.identity || {};
      if (action === 'assembleVision') {
        // `onde` = ALCANCE que o artista escolheu na pergunta "até onde quer chegar" (cidade/
        // capitais/nacional/nicho_intl/internacional). O edge resolve 'cidade' → cidade de ORIGEM
        // (id.city); os demais → alcance maior. NUNCA sobrescrever com id.city: a cidade é a origem
        // (de onde parte), não o alcance. (Bug antigo: forçava a cidade mesmo com alcance nacional.)
        const vpVision = id.visionParts || {};
        const text = await wizardAi.assembleVision(id, vpVision, id.recognitionTags || []);
        patch = { identity: { ...id, vision: text } };
      } else if (action === 'assembleMission') {
        // Metodologia v2: a parte financeira é determinística (tier → sufixo). Passamos o sufixo em
        // `negocio` para o frasear da IA combinar entrega + para quem + sustentabilidade.
        const mp = { ...(id.missionParts || {}), negocio: missionFinancialSuffix(id.missionParts?.financialTier) };
        const text = await wizardAi.assembleMission(id, mp);
        patch = { identity: { ...id, mission: text } };
      } else if (action === 'generateStrategies') {
        // Determinístico (Matrizes A/B/C + banco de 53). Sem LLM.
        patch = { strategies: engine.generateStrategies(d.swotInputs || {}, id) };
      } else if (action === 'summary') {
        patch = {
          executiveSummary: await wizardAi.createFinalResult(
            id,
            d.swotAnalysis,
            d.objectives || [],
            d.strategies || [],
            sp,
            buildDossier()
          ),
        };
      }
      await persist(patch);
    } catch (e: any) {
      message.error(e?.message || 'Erro na IA');
      setWidget({ kind: 'retry' });
    } finally {
      setTyping(false);
    }
  };

  // ---- Texto livre do input -------------------------------------------------------------------

  // Gate de qualidade (fail-open): valida a resposta digitada antes de guardar. Se a IA reprovar
  // (lixo / não-resposta / fora do tema), a Nyta pede pra reescrever e o input fica aberto pra
  // tentar de novo — sem travar (erro de rede/IA libera a resposta). Aprova respostas curtas válidas.
  const validateThenStore = async (
    question: string,
    kind: string,
    answer: string,
    store: (text: string) => void
  ) => {
    pushUser(answer);
    setTyping(true);
    const { ok, reask } = await wizardAi.validateAnswer(question, answer, kind);
    setTyping(false);
    if (!ok) {
      say([reask || 'Hmm, não consegui aproveitar bem essa resposta. Pode tentar de novo, com um pouco mais de detalhe?']);
      return;
    }
    store(answer);
  };

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    const stage = stageRef.current;

    // Entrevista guiada ("Me ajuda a responder") tem precedência sobre o roteamento por etapa.
    if (guided) {
      pushUser(text);
      handleGuidedAnswer(text);
      return;
    }

    // Referências artísticas/comunicação/gestão são texto livre (posicionamento usa widget).
    const refStage = (
      { 'ref.artisticas': 'artisticas', 'ref.comunicacao': 'comunicacao', 'ref.gestao': 'gestao' } as const
    )[stage as 'ref.artisticas' | 'ref.comunicacao' | 'ref.gestao'];
    if (refStage) {
      const skip = /^(pular|skip|nao|não|-|n)$/i.test(text);
      pushUser(skip ? 'Pular' : text);
      patchReferences({ [refStage]: skip ? '' : text });
      return;
    }
    if (stage === 'vision.oQueFalam') {
      await validateThenStore('O que você quer que falem de você / como quer ser percebido (complete o "que…")', 'oQueFalam', text, (t) => patchVisionParts({ oQueFalam: t }));
      return;
    }
    if (stage === 'mission.entrega') {
      await validateThenStore('O que a sua música entrega, oferece ou proporciona?', 'entrega', text, (t) => patchMissionParts({ entrega: t }));
      return;
    }
    if (stage === 'mission.paraQuem') {
      await validateThenStore('Para quem é essa entrega? Quem recebe isso?', 'paraQuem', text, (t) => patchMissionParts({ paraQuem: t }));
      return;
    }

    pushUser(text);
    say(SAY.nudgeWidget());
  };

  // ---- Render ---------------------------------------------------------------------------------

  const labelOf = (opts: { value: string; label: string }[], v: string) =>
    opts.find((o) => o.value === v)?.label || v;

  const renderWidget = () => {
    if (!widget) return null;
    switch (widget.kind) {
      case 'textHelp':
        return <TextPromptHelper onStart={() => startGuided(widget.field)} />;
      case 'gender':
        return (
          <GenderChoice
            onConfirm={(g) => {
              pushUser(labelOf(GENDER_OPTIONS, g));
              patchIdentity({ gender: g });
            }}
          />
        );
      case 'genre':
        return (
          <GenreChips
            sp={sp}
            cmGenres={
              draft.chartmetricProfile?.genres?.length
                ? draft.chartmetricProfile.genres
                : draft.chartmetricProfile?.genre
                ? [draft.chartmetricProfile.genre]
                : undefined
            }
            onConfirm={(genres) => {
              pushUser(genres.join(', '));
              patchIdentity({ genre: genres.join(', ') });
            }}
          />
        );
      case 'referenceHorizons':
        return (
          <ReferenceHorizons
            similar={draft.chartmetricProfile?.similar}
            onConfirm={(h: ReferenceHorizonsData) => {
              const filled = [h.curto, h.medio, h.longo].filter(Boolean).join('; ');
              pushUser(filled || 'Pular');
              patchReferences({ posicionamento: h });
            }}
          />
        );
      case 'stage':
        return (
          <StageChoice
            onConfirm={(s) => {
              pushUser(labelOf(STAGE_OPTIONS, s));
              patchIdentity({ stage: s });
            }}
          />
        );
      case 'cityInput':
        return (
          <CityInputCard
            onConfirm={(city, state) => {
              pushUser([city, state].filter(Boolean).join(', '));
              patchIdentity({ city, state });
            }}
          />
        );
      case 'visionOnde':
        return (
          <VisionOndeChoice
            onConfirm={(value) => {
              pushUser(labelOf(VISION_ONDE_OPTIONS, value));
              patchVisionParts({ onde: value });
            }}
          />
        );
      case 'visionPorQuem':
        return (
          <VisionPorQuemChoice
            onConfirm={(labels) => {
              pushUser(labels.join('; '));
              const base = draftRef.current.identity || { name: artist.name };
              const tags = deriveRecognitionTags(labels, base.visionParts?.onde);
              persist({
                identity: {
                  ...base,
                  visionParts: { ...(base.visionParts || {}), porQuem: labels },
                  recognitionTags: tags,
                },
              });
            }}
          />
        );
      case 'visionSubstantivo':
        return (
          <VisionSubstantivoChoice
            gender={draft.identity?.gender}
            onConfirm={(value) => {
              pushUser(value);
              patchVisionParts({ substantivo: value });
            }}
          />
        );
      case 'visionAdjetivo':
        return (
          <VisionAdjetivoChoice
            onConfirm={(value) => {
              pushUser(value);
              patchVisionParts({ adjetivo: value });
            }}
          />
        );
      case 'visionReview':
        return (
          <VisionReviewCard
            text={draft.identity?.vision || ''}
            onConfirm={(text) => {
              pushUser('Visão confirmada');
              const base = draftRef.current.identity || { name: artist.name };
              persist({ identity: { ...base, vision: text } }, 2);
            }}
          />
        );
      case 'missionFinancial':
        return (
          <MissionFinancialChoice
            onConfirm={(tier: MissionFinancialTier) => {
              const label = MISSION_FINANCIAL_OPTIONS.find((o) => o.value === tier)?.label || '';
              pushUser(label);
              patchMissionParts({ financialTier: tier });
            }}
          />
        );
      case 'missionReview':
        return (
          <MissionReviewCard
            text={draft.identity?.mission || ''}
            onConfirm={(text) => {
              pushUser('Missão confirmada');
              const base = draftRef.current.identity || { name: artist.name };
              persist({ identity: { ...base, mission: text } }, 3);
            }}
          />
        );
      case 'values':
        return (
          <ValueChips
            seed={seedValues(draft.identity?.missionParts?.entrega)}
            onConfirm={(values) => {
              pushUser(values.join(', '));
              patchIdentity({ values });
            }}
          />
        );
      case 'objectives':
        return (
          <ObjectiveChips
            identity={identity}
            missionParts={draft.identity?.missionParts || {}}
            onConfirm={(objectives) => {
              pushUser(objectives.map((o, i) => `${i + 1}. ${o}`).join('\n'));
              persist({ objectives }, 5);
            }}
          />
        );
      case 'swotInternal':
        return (
          <SwotInternalCard
            onConfirm={(internal) => {
              pushUser('Diagnóstico interno concluído');
              const base = draftRef.current.swotInputs || {};
              persist({ swotInputs: { ...base, internal } });
            }}
          />
        );
      case 'swotOpportunities':
        return (
          <SwotChecklist
            items={SWOT_OPPORTUNITIES}
            confirmLabel='Continuar'
            onConfirm={(ids) => {
              pushUser(`${ids.length} oportunidade${ids.length === 1 ? '' : 's'} marcada${ids.length === 1 ? '' : 's'}`);
              const base = draftRef.current.swotInputs || {};
              persist({ swotInputs: { ...base, opportunities: ids } });
            }}
          />
        );
      case 'swotThreats':
        return (
          <SwotChecklist
            items={SWOT_THREATS}
            confirmLabel='Concluir diagnóstico'
            onConfirm={(ids) => {
              pushUser(`${ids.length} ameaça${ids.length === 1 ? '' : 's'} marcada${ids.length === 1 ? '' : 's'}`);
              const base = draftRef.current.swotInputs || {};
              const internal = base.internal || {};
              const oppIds = base.opportunities || [];
              const swot = {
                strengths: SWOT_INTERNAL.filter((it) => internal[it.id] === 'forte').map((it) => it.label),
                weaknesses: SWOT_INTERNAL.filter((it) => internal[it.id] === 'melhorar').map((it) => it.label),
                opportunities: SWOT_OPPORTUNITIES.filter((o) => oppIds.includes(o.id)).map((o) => o.label),
                threats: SWOT_THREATS.filter((t) => ids.includes(t.id)).map((t) => t.label),
              };
              persist({ swotInputs: { ...base, threats: ids }, swotAnalysis: swot });
            }}
          />
        );
      case 'swotBoard':
        return (
          <SwotBoardCard
            swot={draft.swotAnalysis!}
            onConfirm={(board, userEdits) => {
              pushUser('Inventário confirmado');
              persist({ swotAnalysis: board, swotUserEdits: userEdits }, 6);
            }}
          />
        );
      case 'strategies':
        return (
          <StrategyCards
            strategies={draft.strategies || []}
            onConfirm={(strategies) => {
              pushUser('Estratégias aprovadas');
              say(SAY.strategiesThreatNote());
              persist({ strategies }, 7);
            }}
          />
        );
      case 'priority':
        return (
          <PriorityScale
            strategies={draft.strategies || []}
            objectives={draft.objectives || []}
            onSuggest={async () => engine.suggestScores(draft.strategies || [], draft.objectives || [])}
            onAnnounce={(texts) => say(texts)}
            onConfirm={(scored, selectedIds) => {
              pushUser('Prioridades definidas');
              // Só as estratégias selecionadas ganham tarefas (plano de ação, sem datas). As demais
              // ficam salvas sem tarefas. Avança direto pro Resumo (passo 8) — não há mais cronograma.
              const sel = new Set(selectedIds);
              const withTasks = scored.map((s) =>
                sel.has(s.id) ? { ...s, tasks: engine.buildActionPlan(s) } : { ...s, tasks: [] }
              );
              persist({ strategies: withTasks }, 8);
            }}
          />
        );
      case 'final': {
        const concluded = (draft.step ?? 0) >= WIZARD_TOTAL_STEPS;
        return (
          <FinalSummaryCard
            summary={draft.executiveSummary || ''}
            concluded={concluded}
            onFinish={async () => {
              if (!concluded) {
                await persist({}, WIZARD_TOTAL_STEPS);
                try {
                  const { data } = await supabase
                    .from('artists')
                    .select('content')
                    .eq('id', artist.id)
                    .single();
                  const savedStep = (data?.content as ArtistContent | null)?.step ?? 0;
                  if (savedStep < WIZARD_TOTAL_STEPS) await persist({}, WIZARD_TOTAL_STEPS);
                } catch {
                  /* verificação é best-effort; o persist acima já passou pela fila */
                }
                message.success('Planejamento concluído! Painel liberado.');
              }
              navigate(`/artists/${artist.id}`);
            }}
          />
        );
      }
      case 'retry':
        return (
          <RetryPill
            onRetry={() => {
              preparingRef.current = null;
              setWidget(null);
              setNonce((n) => n + 1);
            }}
          />
        );
      default:
        return null;
    }
  };

  // Slot da entrevista guiada: proposta composta (usar / refazer) ou retry em falha.
  const renderGuidedSlot = () => {
    if (!guided) return null;
    if (guided.failed) return <RetryPill onRetry={() => composeProposal(guided.field, guided.answers)} />;
    if (guided.proposal !== undefined)
      return (
        <ProposalPick
          text={guided.proposal}
          onUse={(text) => {
            pushUser(text);
            storeOpenText(guided.field, text);
            setGuided(null);
            setInputOn(false);
          }}
          onRedo={() => {
            pushUser('Quero refazer as perguntas');
            startGuided(guided.field);
          }}
        />
      );
    return null;
  };

  return (
    <div className='nyta-chat'>
      <div className='nyta-scroll' ref={scrollRef} onScroll={handleScroll}>
        <div className='nyta-thread' ref={threadRef}>
          {thread.map((item) =>
            item.role === 'user' ? (
              <UserBubble key={item.id}>{item.text}</UserBubble>
            ) : item.hero ? (
              <NytaBubble key={item.id}>
                <div className='nyta-hero-mini'>
                  <img src={sp?.image || ARTISTS_DEFAULT_IMAGE} alt={artist.name} />
                  <div>
                    <h3>{artist.name}</h3>
                    {!!sp?.spotify_artist_id && (
                      <p>
                        Dados reais do Spotify
                        {sp?.track_count ? ` · ${sp.track_count} faixas` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </NytaBubble>
            ) : item.refMap !== undefined ? (
              <WidgetSlot key={item.id}>
                <div className='nyta-card'>
                  <ReferenceMapCard references={item.refMap} />
                </div>
              </WidgetSlot>
            ) : (
              <NytaBubble key={item.id}>{item.text}</NytaBubble>
            )
          )}
          {typing && <TypingIndicator />}
          {/* O widget fica sempre MONTADO (pra uma fala disparada no meio da interação — ex.:
              priorização — não resetar seu estado), mas é ESCONDIDO enquanto a Nyta "digita":
              assim ele não aparece sob o indicador de pensando, só quando a fala termina. */}
          <div style={{ display: typing ? 'none' : 'contents' }}>
            {guided
              ? (guided.proposal !== undefined || guided.failed) && <WidgetSlot>{renderGuidedSlot()}</WidgetSlot>
              : widget && <WidgetSlot>{renderWidget()}</WidgetSlot>}
          </div>
          <div ref={endRef} />
        </div>
      </div>

      {inputOn && (
        <div className='nyta-input-bar'>
          <Input.TextArea
            ref={inputRef}
            autoSize={{ minRows: 1, maxRows: 4 }}
            placeholder='Escreva sua resposta…'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <button className='nyta-send' onClick={onSend} disabled={!input.trim()} aria-label='Enviar'>
            <FiArrowUp size={18} />
          </button>
        </div>
      )}
    </div>
  );
};
