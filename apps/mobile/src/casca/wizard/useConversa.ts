import { useCallback, useEffect, useRef, useState } from 'react';

import { WIZARD_TOTAL_STEPS } from '@maestra/core/constants/maestra';
import { GUIDED_OPENTEXT, SAY, type OpenTextField } from '@maestra/core/constants/nytaPersona';
import * as wizardAi from '@maestra/core/services/wizardAi';
import * as motores from '@maestra/core/wizard/motores';
import { fecharNegritoAberto } from '@maestra/core/wizard/pergunta';
import {
  buildOpening, currentStepIndex, nextBeat,
  type PrepareAction, type WidgetSpec,
} from '@maestra/core/wizard/script';
import { BEAT_VIDEOS, VIDEO_ABERTURA } from '@maestra/core/wizard/videos';
import { missionFinancialSuffix } from '@maestra/core/wizard/dados';
import type {
  Artist, ArtistContent, ArtistIdentity, MissionParts, SpotifyProfile, VisionParts,
  WizardBackTrailEntry,
} from '@maestra/core/interfaces/maestra';

// O CONDUTOR da conversa do planejamento.
//
// É a porta do `NytaChat` da web (src/pages/Wizard/chat/NytaChat.tsx) sem uma linha de desenho:
// mantém o fio, resolve o próximo beat a partir do rascunho (o roteiro está no núcleo), roda as
// ações de IA entre beats, guarda a trilha do "voltar" e roteia o texto digitado.
//
// O que NÃO está aqui, de propósito: a tela. Quem desenha os balões e os widgets é a tela, que é
// a única parte que muda entre a web e o app.
//
// ⚠️ Este arquivo e o `NytaChat` são DOIS condutores para a mesma conversa. O roteiro, as falas e
// os motores são os mesmos (núcleo), então o que se pergunta e o que se grava não pode divergir;
// o risco é um beat novo aparecer no roteiro e só um dos dois tratar. `cromoDaConversa.test.ts`
// existe para isso: ele falha se um `WidgetSpec` ou um `PrepareAction` do núcleo não for tratado
// aqui.

const uid = () => Math.random().toString(36).slice(2, 10);
const espera = (ms: number) => new Promise((r) => { setTimeout(r, ms); });

/** Efeito máquina de escrever, o mesmo da web: rápido, e mais rápido ainda em falas longas. */
const TECLA_MS = 14;
const porTique = (tamanho: number) => (tamanho > 220 ? 3 : tamanho > 110 ? 2 : 1);

export interface ItemDaConversa {
  id: string;
  quem: 'nyta' | 'artista';
  texto?: string;
  /** O cartão de abertura, com a foto e o nome do artista. */
  hero?: boolean;
  /** O mapa de referências, mostrado no fio da conversa (Metodologia v2, Q6). */
  mapa?: ArtistIdentity['references'];
  /** Vídeo de apoio, enviado como se a Nyta o tivesse mandado. */
  video?: { src: string; titulo: string };
  /** true enquanto a fala está sendo escrita letra a letra. */
  escrevendo?: boolean;
}

/** A foto de uma pergunta respondível — o suficiente para REVIVÊ-LA no "voltar". */
interface Foto {
  draft: ArtistContent;
  conversa: ItemDaConversa[] | null;
  stage: string;
  widget: WidgetSpec | null;
  aceitaTexto: boolean;
}

// Campos PESADOS: não são respostas do wizard e ficam fora da trilha persistida, para não inchar
// o `content`. Ao restaurar, são reidratados do rascunho atual (são estáveis durante o wizard).
const PESADOS = [
  'chartmetricProfile', 'quizDiagnostic', 'diagnostic', 'realIndex', 'spotifyProfile',
  'spotifyCatalog',
] as const;

const semOsPesados = (d: ArtistContent): ArtistContent => {
  const fora: Record<string, unknown> = { ...d };
  for (const k of PESADOS) delete fora[k];
  delete fora.wizardBackTrail; // a trilha nunca aninha dentro dela mesma
  return fora as ArtistContent;
};

const soOsPesados = (d: ArtistContent): Partial<ArtistContent> => {
  const dentro: Record<string, unknown> = {};
  for (const k of PESADOS) if (d[k] !== undefined) dentro[k] = d[k];
  return dentro as Partial<ArtistContent>;
};

interface Entrada {
  artista: Artist;
  /**
   * Só conduz depois que o rascunho CARREGOU.
   *
   * Sem isto, o primeiro beat é resolvido contra um rascunho vazio: a conversa abre perguntando o
   * pronome, e quando o rascunho real chega o beat certo entra por cima — mas a fala do beat
   * errado já está na fila, e o widget dela aterrissa depois, sobre a pergunta nova. Foi o que
   * apareceu no aparelho: a pergunta era sobre referências e embaixo dela estavam ele/ela/elu.
   */
  ativo: boolean;
  draft: ArtistContent;
  sp?: SpotifyProfile;
  persist: (patch: Partial<ArtistContent>, proximoPasso?: number) => Promise<void>;
  /** Substitui o rascunho inteiro (permite REGREDIR o passo) — é o que o "voltar" usa. */
  restore: (content: ArtistContent) => Promise<void>;
}

export const useConversa = ({ artista, ativo, draft, sp, persist, restore }: Entrada) => {
  const [conversa, setConversa] = useState<ItemDaConversa[]>([]);
  const [pensando, setPensando] = useState(false);
  const [widget, setWidget] = useState<WidgetSpec | null>(null);
  const [aceitaTexto, setAceitaTexto] = useState(false);
  const [falando, setFalando] = useState(false);
  const [erro, setErro] = useState('');
  const [nonce, setNonce] = useState(0);
  const [podeVoltar, setPodeVoltar] = useState(false);
  // O portão entre etapas: cobre a conversa, confirma o que terminou e anuncia o que vem.
  const [portao, setPortao] = useState<{ concluida: number; proxima: number } | null>(null);
  const portaoRef = useRef(false);
  // "Me ajuda a responder": a Nyta pergunta, a pessoa responde, e ela formula o texto.
  const [guiado, setGuiado] = useState<{
    campo: OpenTextField;
    respostas: Record<string, string>;
    atual: string;
    contagem: number;
    proposta?: string;
    falhou?: boolean;
  } | null>(null);

  const stageRef = useRef('');
  const videoDoPassoRef = useRef<number | null>(null);
  const filaRef = useRef<Promise<void>>(Promise.resolve());
  const preparandoRef = useRef<string | null>(null);
  const abriuRef = useRef(false);
  const draftRef = useRef(draft);
  const conversaRef = useRef<ItemDaConversa[]>([]);
  const falandoRef = useRef(false);
  const historicoRef = useRef<Foto[]>([]);
  const fotoAtualRef = useRef<Foto | null>(null);
  const semeouRef = useRef(false);
  const guiadoRef = useRef<typeof guiado>(null);

  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { conversaRef.current = conversa; }, [conversa]);
  useEffect(() => { guiadoRef.current = guiado; }, [guiado]);

  const revisarVoltar = useCallback(() => {
    setPodeVoltar(historicoRef.current.length > 0 && !falandoRef.current);
  }, []);

  useEffect(() => {
    falandoRef.current = falando;
    revisarVoltar();
  }, [falando, revisarVoltar]);

  // ---- A fila de falas ------------------------------------------------------------------------

  /** Enfileira falas: "pensando" curto, depois o texto letra a letra, em ordem. */
  const dizer = useCallback((textos: string[]) => {
    setFalando(true);
    const volta = filaRef.current.then(async () => {
      for (const texto of textos) {
        setPensando(true);
        await espera(Math.min(300 + texto.length * 2, 700));
        setPensando(false);
        const id = uid();
        setConversa((c) => [...c, { id, quem: 'nyta', texto: '', escrevendo: true }]);
        const passo = porTique(texto.length);
        for (let i = passo; i < texto.length; i += passo) {
          // `fecharNegritoAberto` evita que um `**` pela metade apareça como asterisco solto.
          const parcial = fecharNegritoAberto(texto.slice(0, i));
          setConversa((c) => c.map((m) => (m.id === id ? { ...m, texto: parcial } : m)));
          await espera(TECLA_MS);
        }
        setConversa((c) => c.map((m) => (m.id === id ? { ...m, texto, escrevendo: false } : m)));
        await espera(140);
      }
    });
    filaRef.current = volta;
    // Só o ÚLTIMO `dizer` da fila libera o campo (se outro entrou na frente, ele que libera).
    void volta.then(() => { if (filaRef.current === volta) setFalando(false); });
    return volta;
  }, []);

  /** Um item que não é fala (vídeo, mapa) entra na MESMA fila, para respeitar a ordem. */
  const enfileirar = useCallback((item: Omit<ItemDaConversa, 'id' | 'quem'>) => {
    setFalando(true);
    const volta = filaRef.current.then(async () => {
      setPensando(true);
      await espera(500);
      setPensando(false);
      setConversa((c) => [...c, { id: uid(), quem: 'nyta', ...item }]);
      await espera(120);
    });
    filaRef.current = volta;
    void volta.then(() => { if (filaRef.current === volta) setFalando(false); });
    return volta;
  }, []);

  const falaDoArtista = useCallback((texto: string) => {
    setConversa((c) => [...c, { id: uid(), quem: 'artista', texto }]);
  }, []);

  // ---- A trilha do "voltar" --------------------------------------------------------------------

  const paraTrilha = (f: Foto): WizardBackTrailEntry => ({
    draft: semOsPesados(f.draft), stage: f.stage, widget: f.widget, inputOn: f.aceitaTexto,
  });
  const gravarTrilha = useCallback(() => {
    void persist({ wizardBackTrail: historicoRef.current.map(paraTrilha) });
  }, [persist]);

  // Semeia a trilha da sessão com o que foi persistido (perguntas de sessões anteriores).
  useEffect(() => {
    if (semeouRef.current) return;
    semeouRef.current = true;
    const trilha = draft.wizardBackTrail;
    if (trilha?.length) {
      const pesados = soOsPesados(draftRef.current);
      historicoRef.current = trilha.map((e) => ({
        draft: { ...pesados, ...(e.draft as ArtistContent) },
        conversa: null, // veio da persistência: a pergunta é re-apresentada do zero
        stage: e.stage,
        widget: (e.widget as WidgetSpec | null) ?? null,
        aceitaTexto: !!e.inputOn,
      }));
      revisarVoltar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Arquiva a foto da pergunta anterior e tira a foto da recém-apresentada. */
  const fotografar = useCallback((stage: string, w: WidgetSpec | null, texto: boolean) => {
    const anterior = fotoAtualRef.current;
    if (anterior && anterior.stage !== stage) {
      historicoRef.current = [...historicoRef.current, anterior];
      revisarVoltar();
      gravarTrilha();
    }
    fotoAtualRef.current = {
      draft: draftRef.current, conversa: conversaRef.current, stage, widget: w, aceitaTexto: texto,
    };
  }, [gravarTrilha, revisarVoltar]);

  const voltar = useCallback(() => {
    if (falandoRef.current) return; // não volta no meio de uma fala
    const hist = historicoRef.current;
    if (!hist.length) return;
    const foto = hist[hist.length - 1];
    historicoRef.current = hist.slice(0, -1);
    setGuiado(null);
    if (foto.conversa) {
      // Sessão atual: restauração perfeita, sem re-falar.
      stageRef.current = foto.stage;
      preparandoRef.current = foto.stage;
      fotoAtualRef.current = foto;
      setConversa(foto.conversa);
      setWidget(foto.widget);
      setAceitaTexto(foto.aceitaTexto);
    } else {
      // Trilha persistida: a pergunta é re-apresentada do zero.
      stageRef.current = '__voltou__';
      preparandoRef.current = null;
      fotoAtualRef.current = null;
      setWidget(null);
      setAceitaTexto(false);
      setConversa([{ id: uid(), quem: 'nyta', hero: true }]);
    }
    revisarVoltar();
    void restore({ ...foto.draft, wizardBackTrail: historicoRef.current.map(paraTrilha) });
  }, [restore, revisarVoltar]);

  /** "Recomeçar do zero": zera o fio, o histórico e o beat, e reabre na saudação. */
  const recomecar = useCallback((limpo: ArtistContent) => {
    filaRef.current = Promise.resolve(); // descarta qualquer fala em andamento
    historicoRef.current = [];
    fotoAtualRef.current = null;
    stageRef.current = '';
    preparandoRef.current = null;
    setGuiado(null);
    setWidget(null);
    setAceitaTexto(false);
    revisarVoltar();
    setConversa([{ id: uid(), quem: 'nyta', hero: true }]);
    dizer(buildOpening(limpo, artista.name));
    void restore(limpo);
  }, [artista.name, dizer, restore, revisarVoltar]);

  // ---- Abertura --------------------------------------------------------------------------------

  useEffect(() => {
    if (!ativo || abriuRef.current) return;
    abriuRef.current = true;
    setConversa([{ id: uid(), quem: 'nyta', hero: true }]);
    videoDoPassoRef.current = draft.step ?? 0;
    dizer(buildOpening(draft, artista.name));
    // O vídeo de abertura vem DEPOIS da saudação (ele reforça a pergunta dela), e só na primeira
    // vez. As duas chamadas enfileiram de forma síncrona, então a ordem no fio é esta aqui.
    if (!(draft.step ?? 0)) {
      enfileirar({ video: { src: VIDEO_ABERTURA, titulo: 'Vídeo: como funciona o planejamento' } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo]);

  // ---- Ações de IA entre beats -----------------------------------------------------------------

  /** Contexto consolidado, para as gerações pesadas não "esquecerem" o que já foi dito. */
  const dossie = useCallback((): string => {
    const id = draftRef.current.identity || {};
    const linhas: string[] = [];
    if (id.genre) linhas.push(`Generos: ${id.genre}`);
    if (id.stage) linhas.push(`Estagio: ${id.stage}`);
    if (id.city) linhas.push(`Local: ${id.city}${id.state ? `, ${id.state}` : ''}`);
    if (id.references) {
      const r = id.references;
      const pos = r.posicionamento || {};
      const partes = [r.artisticas, r.comunicacao, r.gestao, pos.curto, pos.medio, pos.longo]
        .filter(Boolean);
      if (partes.length) linhas.push(`Referencias: ${partes.join(' | ')}`);
    }
    if (id.vision) linhas.push(`Visao: ${id.vision}`);
    if (id.mission) linhas.push(`Missao: ${id.mission}`);
    if (id.values?.length) linhas.push(`Valores: ${id.values.join(', ')}`);
    if (id.recognitionTags?.length) linhas.push(`Reconhecimento: ${id.recognitionTags.join(', ')}`);
    if (draftRef.current.objectives?.length) {
      linhas.push(`Objetivos: ${draftRef.current.objectives.join('; ')}`);
    }
    return linhas.join('\n');
  }, []);

  const preparar = useCallback(async (acao: PrepareAction) => {
    await filaRef.current;
    setPensando(true);
    try {
      let patch: Partial<ArtistContent> = {};
      const d = draftRef.current;
      const id = d.identity || {};
      if (acao === 'assembleVision') {
        const texto = await wizardAi.assembleVision(id, id.visionParts || {}, id.recognitionTags || []);
        patch = { identity: { ...id, vision: texto } };
      } else if (acao === 'assembleMission') {
        // A parte financeira é determinística (tier → sufixo); a IA só frasea o resto.
        const mp = {
          ...(id.missionParts || {}),
          negocio: missionFinancialSuffix(id.missionParts?.financialTier),
        };
        const texto = await wizardAi.assembleMission(id, mp);
        patch = { identity: { ...id, mission: texto } };
      } else if (acao === 'generateStrategies') {
        // Determinístico (Matrizes A/B/C + o banco de estratégias). Sem LLM.
        patch = { strategies: motores.generateStrategies(d.swotInputs || {}, id) };
      } else if (acao === 'summary') {
        patch = {
          executiveSummary: await wizardAi.createFinalResult(
            id, d.swotAnalysis, d.objectives || [], d.strategies || [], sp, dossie(),
          ),
        };
      }
      await persist(patch);
    } catch (e: any) {
      setErro(e?.message || 'A Nyta está indisponível neste momento. Tente de novo em alguns instantes.');
      setWidget({ kind: 'retry' });
    } finally {
      setPensando(false);
    }
  }, [dossie, persist, sp]);

  // ---- A resolução do beat ---------------------------------------------------------------------

  useEffect(() => {
    if (!ativo || !abriuRef.current) return;
    if (portaoRef.current) return; // portão aberto: nada avança por trás dele
    const beat = nextBeat(draft);

    if (beat.autoPersistStep != null) { void persist({}, beat.autoPersistStep); return; }
    // Valor derivado (ex.: o momento de carreira vindo do diagnóstico REAL): grava sem avançar o
    // passo e o beat se re-resolve, pulando a pergunta.
    if (beat.autoPersistPatch) { void persist(beat.autoPersistPatch); return; }

    // VIRADA DE ETAPA: abre o portão e para. O resto só acontece no "Continuar" — senão a Nyta
    // ficaria falando por trás de uma tela que cobre a conversa.
    const passoAtual = draft.step ?? 0;
    if (videoDoPassoRef.current !== null && passoAtual !== videoDoPassoRef.current) {
      const anterior = videoDoPassoRef.current;
      videoDoPassoRef.current = passoAtual;
      // `>` e não `!==`: o "voltar" pode REGREDIR o passo, e aí não há etapa concluída para
      // anunciar. Regressão só atualiza a referência, em silêncio.
      if (passoAtual > anterior) {
        portaoRef.current = true;
        setWidget(null);
        setGuiado(null);
        setAceitaTexto(false);
        setPortao({ concluida: anterior, proxima: currentStepIndex(draft) });
        return;
      }
    }

    if (beat.stage !== stageRef.current) {
      stageRef.current = beat.stage;
      setWidget(null);
      setGuiado(null);
      setAceitaTexto(beat.acceptsText === true);
      // Respondível = tem widget ou aceita texto. Só essas viram foto para o "voltar".
      const respondivel = beat.widget != null || beat.acceptsText === true;

      if (beat.stage === 'vision.city') {
        // Metodologia v2, Q6: o mapa de referências aparece no fio ANTES do cartão de cidade.
        dizer(SAY.visionCityIntro());
        enfileirar({ mapa: draftRef.current.identity?.references });
        void dizer(SAY.visionCityAsk()).then(() => {
          setWidget({ kind: 'cityInput' });
          fotografar('vision.city', { kind: 'cityInput' }, false);
        });
      } else {
        // O vídeo de apoio vem DEPOIS da pergunta (ele reforça o que acabou de ser perguntado), e
        // o widget só aparece depois dele.
        const apoio = BEAT_VIDEOS[beat.stage];
        const falas = dizer(beat.say);
        const comApoio = apoio
          ? falas.then(() => enfileirar({ video: { src: apoio, titulo: 'Vídeo de apoio da Nyta' } }))
          : falas;
        void comApoio.then(() => {
          if (beat.widget) setWidget(beat.widget);
          if (respondivel) fotografar(beat.stage, beat.widget ?? null, beat.acceptsText === true);
        });
      }
    }

    if (beat.prepare && preparandoRef.current !== beat.stage) {
      preparandoRef.current = beat.stage;
      void preparar(beat.prepare);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, draft, nonce]);

  /** "Continuar" do portão: limpa a conversa e libera a etapa nova. */
  const continuarEtapa = useCallback(() => {
    setPortao(null);
    portaoRef.current = false;
    setConversa([]);
    stageRef.current = '';
    setWidget(null);
    setGuiado(null);
    setNonce((n) => n + 1);
  }, []);

  const tentarDeNovo = useCallback(() => {
    preparandoRef.current = null;
    setErro('');
    setWidget(null);
    setNonce((n) => n + 1);
  }, []);

  // ---- Gravação de respostas -------------------------------------------------------------------

  const base = useCallback(() => draftRef.current.identity || { name: artista.name }, [artista.name]);

  const gravarIdentidade = useCallback((patch: Partial<ArtistIdentity>) =>
    persist({ identity: { ...base(), ...patch } }), [base, persist]);

  const gravarVisao = useCallback((patch: Partial<VisionParts>) => {
    const b = base();
    return persist({ identity: { ...b, visionParts: { ...(b.visionParts || {}), ...patch } } });
  }, [base, persist]);

  const gravarMissao = useCallback((patch: Partial<MissionParts>) => {
    const b = base();
    return persist({ identity: { ...b, missionParts: { ...(b.missionParts || {}), ...patch } } });
  }, [base, persist]);

  const gravarReferencias = useCallback(
    (patch: Partial<NonNullable<ArtistIdentity['references']>>) => {
      const b = base();
      return persist({ identity: { ...b, references: { ...(b.references || {}), ...patch } } });
    }, [base, persist],
  );

  // ---- "Me ajuda a responder" ------------------------------------------------------------------

  const guardarTextoAberto = useCallback((campo: OpenTextField, texto: string) => {
    if (campo === 'oQueFalam') void gravarVisao({ oQueFalam: texto });
    else if (campo === 'paraQuem') void gravarMissao({ paraQuem: texto });
    else void gravarMissao({ entrega: texto });
  }, [gravarMissao, gravarVisao]);

  const comporProposta = useCallback(async (
    campo: OpenTextField, respostas: Record<string, string>,
  ) => {
    setGuiado({ campo, respostas, atual: '', contagem: 0 });
    setAceitaTexto(false);
    await filaRef.current;
    setPensando(true);
    try {
      const texto = await wizardAi.composeOpenText(campo, base(), respostas);
      setPensando(false);
      setGuiado({ campo, respostas, atual: '', contagem: 0, proposta: texto });
      dizer(SAY.proposalReady());
    } catch (e: any) {
      setPensando(false);
      setErro(e?.message || 'Não consegui montar o texto agora. Tente de novo.');
      setGuiado({ campo, respostas, atual: '', contagem: 0, falhou: true });
    }
  }, [base, dizer]);

  const iniciarGuiado = useCallback((campo: OpenTextField) => {
    const abertura = GUIDED_OPENTEXT[campo].opener;
    setGuiado({ campo, respostas: {}, atual: abertura, contagem: 1 });
    setWidget(null);
    setAceitaTexto(true);
    dizer([...SAY.guidedIntro(), abertura]);
  }, [dizer]);

  const responderGuiado = useCallback((texto: string) => {
    const g = guiadoRef.current;
    if (!g || g.proposta !== undefined || g.falhou) return;
    const respostas = { ...g.respostas, [g.atual]: texto };
    const seguintes = GUIDED_OPENTEXT[g.campo].followups;
    const jaFeitas = g.contagem - 1; // a abertura é a pergunta 1
    if (jaFeitas < seguintes.length) {
      const proxima = seguintes[jaFeitas];
      setGuiado({ ...g, respostas, atual: proxima, contagem: g.contagem + 1 });
      setAceitaTexto(true);
      dizer([proxima]);
    } else {
      void comporProposta(g.campo, respostas);
    }
  }, [comporProposta, dizer]);

  const usarProposta = useCallback((texto: string) => {
    const g = guiadoRef.current;
    if (!g) return;
    falaDoArtista(texto);
    guardarTextoAberto(g.campo, texto);
    setGuiado(null);
  }, [falaDoArtista, guardarTextoAberto]);

  const refazerProposta = useCallback(() => {
    const g = guiadoRef.current;
    if (g) void comporProposta(g.campo, g.respostas);
  }, [comporProposta]);

  // ---- O texto digitado ------------------------------------------------------------------------

  const enviar = useCallback((bruto: string) => {
    const texto = bruto.trim();
    if (!texto) return;
    const stage = stageRef.current;

    // A entrevista guiada tem precedência sobre o roteamento por etapa.
    if (guiadoRef.current) {
      falaDoArtista(texto);
      responderGuiado(texto);
      return;
    }

    // Referências artísticas/comunicação/gestão são texto livre (posicionamento usa widget).
    const campoDeReferencia = ({
      'ref.artisticas': 'artisticas', 'ref.comunicacao': 'comunicacao', 'ref.gestao': 'gestao',
    } as const)[stage as 'ref.artisticas' | 'ref.comunicacao' | 'ref.gestao'];
    if (campoDeReferencia) {
      const pular = /^(pular|skip|nao|não|-|n)$/i.test(texto);
      falaDoArtista(pular ? 'Pular' : texto);
      void gravarReferencias({ [campoDeReferencia]: pular ? '' : texto });
      return;
    }
    if (stage === 'vision.oQueFalam') {
      falaDoArtista(texto);
      void gravarVisao({ oQueFalam: texto });
      return;
    }
    if (stage === 'mission.entrega') {
      falaDoArtista(texto);
      void gravarMissao({ entrega: texto });
      return;
    }
    if (stage === 'mission.paraQuem') {
      falaDoArtista(texto);
      void gravarMissao({ paraQuem: texto });
      return;
    }

    falaDoArtista(texto);
    dizer(SAY.nudgeWidget());
  }, [dizer, falaDoArtista, gravarMissao, gravarReferencias, gravarVisao, responderGuiado]);

  /** O passo final: marca o planejamento como concluído (o `persist` já passa pela fila). */
  const concluir = useCallback(async () => {
    if ((draftRef.current.step ?? 0) >= WIZARD_TOTAL_STEPS) return;
    await persist({}, WIZARD_TOTAL_STEPS);
  }, [persist]);

  return {
    conversa,
    /** O estágio do beat atual — é por ele que a tela sabe qual pergunta está no ar. */
    estagio: stageRef.current,
    pensando,
    falando,
    widget,
    aceitaTexto,
    guiado,
    portao,
    podeVoltar,
    erro,
    limparErro: () => setErro(''),
    // ações
    enviar,
    voltar,
    recomecar,
    continuarEtapa,
    tentarDeNovo,
    concluir,
    falaDoArtista,
    dizer,
    iniciarGuiado,
    usarProposta,
    refazerProposta,
    gravarIdentidade,
    gravarVisao,
    gravarMissao,
    gravarReferencias,
  };
};
