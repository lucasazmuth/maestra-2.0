import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { WIZARD_TOTAL_STEPS } from '@maestra/core/constants/maestra';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import type { ArtistContent, ArtistIdentity } from '@maestra/core/interfaces/maestra';
import { shouldEnrichChartmetric } from '@maestra/core/lib/chartmetricFreshness';
import { supabase } from '@maestra/core/lib/supabase';
import { clearWizardPlatformContext, setWizardPlatformContext } from '@maestra/core/services/wizardAi';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import {
  GENDER_OPTIONS, MISSION_FINANCIAL_OPTIONS, STAGE_OPTIONS, VISION_ONDE_OPTIONS,
  deriveRecognitionTags, seedValues,
} from '@maestra/core/wizard/dados';
import { migrateWizardContent } from '@maestra/core/wizard/migracao';
import { perguntaEmDestaque, placeholderDaPergunta } from '@maestra/core/wizard/pergunta';
import * as motores from '@maestra/core/wizard/motores';
import { SWOT_INTERNAL, SWOT_OPPORTUNITIES, SWOT_THREATS } from '@maestra/core/wizard/swot';

import {
  BolhaDaNyta, CartaoDaNyta, FalaDaNyta, FalaDeQuemResponde, LugarDoWidget, Pensando,
} from '@/casca/wizard/Bolhas';
import { BarraDaEtapa, Convite, Portao, Video } from '@/casca/wizard/Pecas';
import { Plano } from '@/casca/wizard/Plano';
import { WZ, WZ_MEDIDA } from '@/casca/wizard/cores';
import { useConversa } from '@/casca/wizard/useConversa';
import {
  AteOndeChegar, ComoSeDefine, GeneroGramatical, GenerosMusicais, MomentoDeCarreira,
  RetornoFinanceiro, SeuAtributo, SinaisDeReconhecimento,
} from '@/casca/wizard/widgets/Escolhas';
import { Objetivos, Valores } from '@/casca/wizard/widgets/Listas';
import { Priorizacao, RevisaoDasEstrategias } from '@/casca/wizard/widgets/Estrategias';
import { InventarioInterno, ListaDeMarcar, QuadroSwot } from '@/casca/wizard/widgets/Swot';
import {
  CidadeDeOrigem, OfertaDeAjuda, PropostaDaNyta, ReferenciasPorHorizonte, RevisaoDaMissao,
  RevisaoDaVisao, TentarDeNovo,
} from '@/casca/wizard/widgets/Textos';
import { Acoes, BotaoPrincipal, Cartao } from '@/casca/wizard/widgets/kit';
import { Marcacao } from '@/casca/wizard/Marcacao';
import { useArtistaDaRota } from '@/nucleo/artista';
import { useSessao } from '@/nucleo/sessao';

// O PLANEJAMENTO ESTRATÉGICO, no nativo.
//
// É a casca da conversa: dona do rascunho, da gravação e da migração. Quem conduz a conversa é o
// `useConversa`; o roteiro, as falas e os motores são do núcleo — os mesmos da web.
//
// A tela vive FORA das abas do artista, em tela cheia, como o Espaço Jam: aqui não se navega, se
// conversa.

const SITE = 'https://www.maestramanager.com';

/** Os campos PESADOS: insumos, não respostas. Sobrevivem ao "recomeçar do zero". */
const INSUMOS = [
  'chartmetricProfile', 'quizDiagnostic', 'diagnostic', 'realIndex', 'spotifyProfile',
  'spotifyCatalog',
] as const;

const rotuloDe = (opcoes: { value: string; label: string }[], v: string) =>
  opcoes.find((o) => o.value === v)?.label || v;

export default function Wizard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessao, carregando: carregandoSessao } = useSessao();
  const dispatch = useAppDispatch();
  const artista = useArtistaDaRota(id);
  const carregado = useAppSelector((s) => s.artists.loaded);
  const { editPlanning } = useArtistCapabilities(artista);

  const [draft, setDraft] = useState<ArtistContent>({});
  const [pronto, setPronto] = useState(false);
  const [entrou, setEntrou] = useState(false);
  const [planoAberto, setPlanoAberto] = useState(false);
  const [texto, setTexto] = useState('');

  const draftRef = useRef<ArtistContent>(draft);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  const filaDeGravacao = useRef<Promise<void>>(Promise.resolve());
  const rolagem = useRef<ScrollView>(null);

  // Quem não pode editar o plano (colaborador sem PRO) vai para o Plano de Ação, só leitura.
  useEffect(() => {
    if (carregado && artista && !editPlanning) {
      router.replace({ pathname: '/artista/[id]/plano', params: { id: String(id) } });
    }
  }, [carregado, artista, editPlanning, id]);

  // Carrega o rascunho: migra o conteúdo, garante o nome na identidade e alimenta a Nyta com os
  // dados de plataforma (Chartmetric + quiz + diagnóstico).
  useEffect(() => {
    if (!artista) return;
    let migrado = migrateWizardContent(artista.content || {});
    if (!migrado.identity?.name) {
      migrado = { ...migrado, identity: { ...(migrado.identity || {}), name: artista.name } };
    }
    draftRef.current = migrado;
    setDraft(migrado);
    setPronto(true);

    const c = artista.content || {};
    setWizardPlatformContext({
      chartmetric: c.chartmetricProfile,
      quizDiagnostic: c.quizDiagnostic,
      diagnostic: c.diagnostic,
      realIndex: c.realIndex,
    });
    // Política única (30 dias): só enriquece quando falta dado ou venceu — não a cada abertura.
    if (shouldEnrichChartmetric(c.chartmetricProfile)) {
      supabase.functions.invoke('artist-enrich-chartmetric', { body: { artistId: artista.id } })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artista?.id]);

  useEffect(() => () => clearWizardPlatformContext(), []);

  /**
   * A gravação é uma FILA: uma por vez, em ordem.
   *
   * Sem isso, duas escritas concorrentes chegam fora de ordem no Supabase e a última a aterrissar
   * vence — foi assim que um passo antigo sobrescreveu a conclusão do wizard na web.
   */
  const persist = useCallback((patch: Partial<ArtistContent>, proximoPasso?: number) => {
    const volta = filaDeGravacao.current.then(async () => {
      if (!artista) return;
      const base = draftRef.current; // sempre o mais recente, nunca o do closure de quem chamou
      const maiorPasso = Math.max(base.step ?? 0, proximoPasso ?? base.step ?? 0);
      const content: ArtistContent = { ...base, ...patch, step: maiorPasso };
      draftRef.current = content;
      setDraft(content);
      try {
        await dispatch(artistsActions.updateArtistContent({ id: artista.id, content })).unwrap();
      } catch {
        // Uma segunda tentativa silenciosa antes de incomodar: falha de rede costuma ser passageira.
        try {
          await dispatch(artistsActions.updateArtistContent({ id: artista.id, content })).unwrap();
        } catch {
          Alert.alert('Erro ao salvar progresso', 'Verifique sua conexão.');
        }
      }
    });
    filaDeGravacao.current = volta;
    return volta;
  }, [artista, dispatch]);

  /** Substitui o rascunho INTEIRO: o passo pode regredir e campos podem sumir (é o "voltar"). */
  const restore = useCallback((content: ArtistContent) => {
    const volta = filaDeGravacao.current.then(async () => {
      if (!artista) return;
      draftRef.current = content;
      setDraft(content);
      try {
        await dispatch(artistsActions.updateArtistContent({ id: artista.id, content })).unwrap();
      } catch {
        try {
          await dispatch(artistsActions.updateArtistContent({ id: artista.id, content })).unwrap();
        } catch {
          Alert.alert('Erro ao voltar', 'Verifique sua conexão.');
        }
      }
    });
    filaDeGravacao.current = volta;
    return volta;
  }, [artista, dispatch]);

  const sp = draft.spotifyProfile;
  const identidade: ArtistIdentity = useMemo(
    () => draft.identity || { name: artista?.name }, [draft.identity, artista?.name],
  );

  const conversa = useConversa({
    artista: artista!, draft, sp, persist, restore,
  });

  // Rola para o fim a cada mensagem nova — quem está lendo mais acima não é arrastado.
  useEffect(() => {
    const t = setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [conversa.conversa, conversa.pensando, conversa.widget, conversa.aceitaTexto]);

  useEffect(() => {
    if (conversa.erro) {
      Alert.alert('A Nyta tropeçou', conversa.erro, [{ text: 'OK', onPress: conversa.limparErro }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversa.erro]);

  const recomecar = () => {
    Alert.alert(
      'Recomeçar o planejamento do zero?',
      'Isso apaga TODAS as respostas do planejamento estratégico e volta para a primeira pergunta. '
      + 'Seus dados de diagnóstico e do Spotify são mantidos. Essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sim, recomeçar',
          style: 'destructive',
          onPress: () => {
            const base = draftRef.current;
            const limpo: ArtistContent = {
              language: base.language,
              wizardVersion: base.wizardVersion,
              identity: { name: base.identity?.name || artista?.name },
              step: 0,
            };
            for (const k of INSUMOS) {
              if (base[k] !== undefined) (limpo as Record<string, unknown>)[k] = base[k];
            }
            conversa.recomecar(limpo);
          },
        },
      ],
    );
  };

  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;

  if (!artista) {
    if (carregado) return <Redirect href="/perfis" />;
    return (
      <SafeAreaView style={estilos.tela}>
        <ActivityIndicator style={estilos.espera} color={WZ.blue} />
      </SafeAreaView>
    );
  }

  // "Ainda não começou" NÃO é só `step === 0`: a Identidade sozinha tem sete sub-perguntas antes
  // de o passo virar 1. Quem respondeu metade e voltou não pode cair no convite de novo.
  const mostrandoConvite = pronto && !entrou && !(draft.step ?? 0) && !draft.identity?.gender;

  const cabecalho = (comMenu: boolean) => (
    <View style={estilos.cabecalho}>
      <Pressable
        style={estilos.sair}
        onPress={() => router.replace('/perfis')}
        accessibilityRole="button"
        accessibilityLabel="Sair do planejamento"
      >
        <Feather name="x" size={18} color={WZ.quietStrong} />
      </Pressable>
      {!!sp?.image && <Image source={{ uri: sp.image }} style={estilos.fotoDoArtista} />}
      <Text style={estilos.titulo} numberOfLines={1}>Crie seu planejamento</Text>
      <View style={estilos.flex} />
      {comMenu && (conversa.podeVoltar || (draft.step ?? 0) > 0 || !!draft.identity?.gender) && (
        <Pressable
          style={estilos.sair}
          onPress={() => Alert.alert('Mais opções', undefined, [
            ...(conversa.podeVoltar
              ? [{ text: 'Voltar à pergunta anterior', onPress: conversa.voltar }]
              : []),
            { text: 'Recomeçar do zero', style: 'destructive' as const, onPress: recomecar },
            { text: 'Cancelar', style: 'cancel' as const },
          ])}
          accessibilityRole="button"
          accessibilityLabel="Mais opções"
        >
          <Feather name="more-vertical" size={18} color={WZ.quietStrong} />
        </Pressable>
      )}
    </View>
  );

  if (mostrandoConvite) {
    return (
      <SafeAreaView style={estilos.tela} edges={['top', 'left', 'right']}>
        {cabecalho(false)}
        <ScrollView>
          <Convite
            nomeDoArtista={identidade.name || artista.name || ''}
            aoComecar={() => setEntrou(true)}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---- O widget do beat atual -------------------------------------------------------------------

  const widgetDoBeat = () => {
    const w = conversa.widget;
    if (!w) return null;
    switch (w.kind) {
      case 'gender':
        return (
          <GeneroGramatical
            aoConfirmar={(g) => {
              conversa.falaDoArtista(rotuloDe(GENDER_OPTIONS, g));
              void conversa.gravarIdentidade({ gender: g });
            }}
          />
        );
      case 'genre':
        return (
          <GenerosMusicais
            sp={sp}
            generosDaChartmetric={draft.chartmetricProfile?.genres?.length
              ? draft.chartmetricProfile.genres
              : draft.chartmetricProfile?.genre ? [draft.chartmetricProfile.genre] : undefined}
            aoConfirmar={(generos) => {
              conversa.falaDoArtista(generos.join(', '));
              void conversa.gravarIdentidade({ genre: generos.join(', ') });
            }}
          />
        );
      case 'stage':
        return (
          <MomentoDeCarreira
            aoConfirmar={(s) => {
              conversa.falaDoArtista(rotuloDe(STAGE_OPTIONS, s));
              void conversa.gravarIdentidade({ stage: s });
            }}
          />
        );
      case 'referenceHorizons':
        return (
          <ReferenciasPorHorizonte
            aoConfirmar={(h) => {
              const preenchido = [h.curto, h.medio, h.longo].filter(Boolean).join('; ');
              conversa.falaDoArtista(preenchido || 'Pular');
              void conversa.gravarReferencias({ posicionamento: h });
            }}
          />
        );
      case 'cityInput':
        return (
          <CidadeDeOrigem
            aoConfirmar={(cidade, uf) => {
              conversa.falaDoArtista([cidade, uf].filter(Boolean).join(', '));
              void conversa.gravarIdentidade({ city: cidade, state: uf });
            }}
          />
        );
      case 'visionOnde':
        return (
          <AteOndeChegar
            aoConfirmar={(valor) => {
              conversa.falaDoArtista(rotuloDe(VISION_ONDE_OPTIONS, valor));
              void conversa.gravarVisao({ onde: valor });
            }}
          />
        );
      case 'visionPorQuem':
        return (
          <SinaisDeReconhecimento
            aoConfirmar={(rotulos) => {
              conversa.falaDoArtista(rotulos.join('; '));
              const base = draftRef.current.identity || { name: artista.name };
              // As tags de reconhecimento são DERIVADAS aqui, junto: elas alimentam a montagem da
              // visão, e gravar em dois passos deixaria a frase sem elas.
              void persist({
                identity: {
                  ...base,
                  visionParts: { ...(base.visionParts || {}), porQuem: rotulos },
                  recognitionTags: deriveRecognitionTags(rotulos, base.visionParts?.onde),
                },
              });
            }}
          />
        );
      case 'visionSubstantivo':
        return (
          <ComoSeDefine
            genero={draft.identity?.gender}
            aoConfirmar={(valor) => {
              conversa.falaDoArtista(valor);
              void conversa.gravarVisao({ substantivo: valor });
            }}
          />
        );
      case 'visionAdjetivo':
        return (
          <SeuAtributo
            aoConfirmar={(valor) => {
              conversa.falaDoArtista(valor);
              void conversa.gravarVisao({ adjetivo: valor });
            }}
          />
        );
      case 'visionReview':
        return (
          <RevisaoDaVisao
            texto={draft.identity?.vision || ''}
            aoConfirmar={(t) => {
              conversa.falaDoArtista('Visão confirmada');
              const base = draftRef.current.identity || { name: artista.name };
              void persist({ identity: { ...base, vision: t } }, 2);
            }}
          />
        );
      case 'missionFinancial':
        return (
          <RetornoFinanceiro
            aoConfirmar={(tier) => {
              conversa.falaDoArtista(rotuloDe(MISSION_FINANCIAL_OPTIONS, tier));
              void conversa.gravarMissao({ financialTier: tier });
            }}
          />
        );
      case 'missionReview':
        return (
          <RevisaoDaMissao
            texto={draft.identity?.mission || ''}
            aoConfirmar={(t) => {
              conversa.falaDoArtista('Missão confirmada');
              const base = draftRef.current.identity || { name: artista.name };
              void persist({ identity: { ...base, mission: t } }, 3);
            }}
          />
        );
      case 'values':
        return (
          <Valores
            semente={seedValues(draft.identity?.missionParts?.entrega)}
            aoConfirmar={(valores) => {
              conversa.falaDoArtista(valores.join(', '));
              void conversa.gravarIdentidade({ values: valores });
            }}
          />
        );
      case 'objectives':
        return (
          <Objetivos
            identidade={identidade}
            partesDaMissao={draft.identity?.missionParts || {}}
            aoConfirmar={(objetivos) => {
              conversa.falaDoArtista(objetivos.map((o, i) => `${i + 1}. ${o}`).join('\n'));
              void persist({ objectives: objetivos }, 5);
            }}
          />
        );
      case 'swotInternal':
        return (
          <InventarioInterno
            aoConfirmar={(interno) => {
              conversa.falaDoArtista('Diagnóstico interno concluído');
              const base = draftRef.current.swotInputs || {};
              void persist({ swotInputs: { ...base, internal: interno } });
            }}
          />
        );
      case 'swotOpportunities':
        return (
          <ListaDeMarcar
            itens={SWOT_OPPORTUNITIES}
            titulo="Oportunidades"
            cor={WZ.ok}
            rotuloDoBotao="Continuar"
            aoConfirmar={(ids) => {
              conversa.falaDoArtista(
                `${ids.length} oportunidade${ids.length === 1 ? '' : 's'} marcada${ids.length === 1 ? '' : 's'}`,
              );
              const base = draftRef.current.swotInputs || {};
              void persist({ swotInputs: { ...base, opportunities: ids } });
            }}
          />
        );
      case 'swotThreats':
        return (
          <ListaDeMarcar
            itens={SWOT_THREATS}
            titulo="Ameaças"
            cor={WZ.warn}
            rotuloDoBotao="Concluir diagnóstico"
            aoConfirmar={(ids) => {
              conversa.falaDoArtista(
                `${ids.length} ameaça${ids.length === 1 ? '' : 's'} marcada${ids.length === 1 ? '' : 's'}`,
              );
              const base = draftRef.current.swotInputs || {};
              const interno = base.internal || {};
              const oportunidades = base.opportunities || [];
              // A SWOT montada é o que as etapas seguintes leem — as marcações continuam guardadas.
              void persist({
                swotInputs: { ...base, threats: ids },
                swotAnalysis: {
                  strengths: SWOT_INTERNAL.filter((it) => interno[it.id] === 'forte').map((it) => it.label),
                  weaknesses: SWOT_INTERNAL.filter((it) => interno[it.id] === 'melhorar').map((it) => it.label),
                  opportunities: SWOT_OPPORTUNITIES.filter((o) => oportunidades.includes(o.id)).map((o) => o.label),
                  threats: SWOT_THREATS.filter((t) => ids.includes(t.id)).map((t) => t.label),
                },
              });
            }}
          />
        );
      case 'swotBoard':
        return (
          <QuadroSwot
            swot={draft.swotAnalysis!}
            aoConfirmar={(quadro, edicoes) => {
              conversa.falaDoArtista('SWOT fechada!');
              void persist({ swotAnalysis: quadro, swotUserEdits: edicoes }, 6);
            }}
          />
        );
      case 'strategies':
        return (
          <RevisaoDasEstrategias
            estrategias={draft.strategies || []}
            aoConfirmar={(estrategias) => {
              conversa.falaDoArtista('Estratégias aprovadas');
              void persist({ strategies: estrategias }, 7);
            }}
          />
        );
      case 'priority':
        return (
          <Priorizacao
            estrategias={draft.strategies || []}
            objetivos={draft.objectives || []}
            aoSugerir={async () => motores.suggestScores(draft.strategies || [], draft.objectives || [])}
            aoAnunciar={(falas) => conversa.dizer(falas)}
            aoProgredir={(estrategias) => { void persist({ strategies: estrategias }); }}
            aoConfirmar={(pontuadas, escolhidas) => {
              conversa.falaDoArtista('Prioridades definidas');
              // Só as escolhidas ganham tarefas; as demais ficam salvas sem nenhuma.
              const escolhida = new Set(escolhidas);
              void persist({
                strategies: pontuadas.map((s) => (escolhida.has(s.id)
                  ? { ...s, tasks: motores.buildActionPlan(s) }
                  : { ...s, tasks: [] })),
              }, 8);
            }}
          />
        );
      case 'final': {
        const concluido = (draft.step ?? 0) >= WIZARD_TOTAL_STEPS;
        return (
          <Cartao>
            <Marcacao texto={draft.executiveSummary || ''} estilo={estilos.resumo} />
            <Acoes>
              <View style={estilos.flex} />
              <BotaoPrincipal
                rotulo={concluido ? 'Ir para o plano' : 'Concluir e liberar o painel'}
                aoTocar={async () => {
                  await conversa.concluir();
                  router.replace({ pathname: '/artista/[id]/plano', params: { id: String(id) } });
                }}
              />
            </Acoes>
          </Cartao>
        );
      }
      case 'retry':
        return <TentarDeNovo aoTentar={conversa.tentarDeNovo} />;
      default:
        return null;
    }
  };

  const slotGuiado = () => {
    const g = conversa.guiado;
    if (!g) return null;
    if (g.falhou) return <TentarDeNovo aoTentar={conversa.refazerProposta} />;
    if (g.proposta !== undefined) {
      return (
        <PropostaDaNyta
          texto={g.proposta}
          aoUsar={conversa.usarProposta}
          aoRefazer={conversa.refazerProposta}
        />
      );
    }
    return null;
  };

  // O espaço reservado do campo é a PERGUNTA que está no ar, encurtada — quem rolou a conversa
  // para cima continua sabendo o que está respondendo.
  const espacoReservado = (() => {
    for (let i = conversa.conversa.length - 1; i >= 0; i -= 1) {
      const item = conversa.conversa[i];
      if (item.quem !== 'nyta' || !item.texto) continue;
      return placeholderDaPergunta(perguntaEmDestaque(item.texto));
    }
    return placeholderDaPergunta(null);
  })();

  // A oferta de ajuda aparece nas perguntas de texto ABERTO — as três que a Nyta sabe formular.
  const campoGuiavel = ({
    'vision.oQueFalam': 'oQueFalam', 'mission.entrega': 'entrega', 'mission.paraQuem': 'paraQuem',
  } as const)[conversa.estagio as 'vision.oQueFalam' | 'mission.entrega' | 'mission.paraQuem'];

  return (
    <SafeAreaView style={estilos.tela} edges={['top', 'left', 'right']}>
      {cabecalho(true)}
      <BarraDaEtapa draft={draft} aoAbrirOPlano={() => setPlanoAberto(true)} />

      <KeyboardAvoidingView
        style={estilos.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView ref={rolagem} contentContainerStyle={estilos.fio}>
          {conversa.conversa.map((item) => {
            if (item.quem === 'artista') {
              return <FalaDeQuemResponde key={item.id} texto={item.texto || ''} />;
            }
            if (item.hero) {
              return (
                <BolhaDaNyta key={item.id}>
                  <View style={estilos.hero}>
                    {!!sp?.image && <Image source={{ uri: sp.image }} style={estilos.heroFoto} />}
                    <View style={estilos.flex}>
                      <Text style={estilos.heroNome}>{artista.name}</Text>
                      {!!sp?.spotify_artist_id && (
                        <Text style={estilos.heroApoio}>
                          Dados reais do Spotify
                          {sp?.track_count ? ` · ${sp.track_count} músicas` : ''}
                        </Text>
                      )}
                    </View>
                  </View>
                </BolhaDaNyta>
              );
            }
            if (item.video) {
              return (
                <CartaoDaNyta key={item.id}>
                  <Video src={item.video.src} titulo={item.video.titulo} />
                </CartaoDaNyta>
              );
            }
            if (item.mapa !== undefined) {
              const refs = item.mapa || {};
              const linhas = [
                ['Artísticas', refs.artisticas],
                ['Comunicação', refs.comunicacao],
                ['Gestão', refs.gestao],
                ['Posicionamento', [refs.posicionamento?.curto, refs.posicionamento?.medio, refs.posicionamento?.longo].filter(Boolean).join(', ')],
              ].filter(([, v]) => !!v) as [string, string][];
              return (
                <CartaoDaNyta key={item.id}>
                  <Cartao titulo="Seu mapa de referências">
                    {linhas.map(([rotulo, valor]) => (
                      <View key={rotulo} style={estilos.linhaDoMapa}>
                        <Text style={estilos.rotuloDoMapa}>{rotulo}</Text>
                        <Text style={estilos.valorDoMapa}>{valor}</Text>
                      </View>
                    ))}
                  </Cartao>
                </CartaoDaNyta>
              );
            }
            return <FalaDaNyta key={item.id} texto={item.texto || ''} />;
          })}

          {conversa.pensando && <Pensando />}

          {/* O widget só aparece quando a Nyta TERMINA de falar: sob o "pensando" ele seria uma
              resposta oferecida antes da pergunta. */}
          {!conversa.pensando && (
            <LugarDoWidget>
              {conversa.guiado ? slotGuiado() : widgetDoBeat()}
              {!conversa.guiado && !!campoGuiavel && conversa.aceitaTexto && (
                <OfertaDeAjuda aoComecar={() => conversa.iniciarGuiado(campoGuiavel)} />
              )}
            </LugarDoWidget>
          )}
        </ScrollView>

        {/* O campo só abre quando ela terminou de falar — ninguém responde no meio da frase. */}
        {conversa.aceitaTexto && !conversa.falando && !conversa.pensando && (
          <View style={estilos.barraDoCampo}>
            <TextInput
              style={estilos.campo}
              value={texto}
              onChangeText={setTexto}
              placeholder={espacoReservado}
              placeholderTextColor={WZ.faint}
              multiline
              accessibilityLabel="Sua resposta"
            />
            <Pressable
              style={[estilos.enviar, !texto.trim() && estilos.enviarApagado]}
              onPress={() => { if (texto.trim()) { conversa.enviar(texto); setTexto(''); } }}
              accessibilityRole="button"
              accessibilityLabel="Enviar"
            >
              <Feather name="arrow-up" size={18} color={WZ.surface} />
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>

      {!!conversa.portao && (
        <Portao
          concluida={conversa.portao.concluida}
          proxima={conversa.portao.proxima}
          aoContinuar={conversa.continuarEtapa}
        />
      )}

      <Modal
        visible={planoAberto}
        animationType="slide"
        onRequestClose={() => setPlanoAberto(false)}
      >
        <SafeAreaView style={estilos.tela} edges={['top', 'left', 'right']}>
          <Plano draft={draft} aoFechar={() => setPlanoAberto(false)} aoEditar={persist} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: WZ.canvas },
  flex: { flex: 1, minWidth: 0 },
  espera: { marginTop: 40 },

  cabecalho: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: WZ.line,
  },
  sair: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
  },
  fotoDoArtista: { width: 32, height: 32, borderRadius: 16 },
  titulo: { fontSize: 17, fontWeight: '800', color: WZ.ink, flexShrink: 1 },

  fio: {
    padding: WZ_MEDIDA.recuo, paddingTop: 14, paddingBottom: 24, gap: 12,
  },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroFoto: { width: 38, height: 38, borderRadius: 19 },
  heroNome: { fontSize: 15, fontWeight: '800', color: WZ.ink },
  heroApoio: { fontSize: 12, color: WZ.muted, marginTop: 2 },
  linhaDoMapa: { gap: 2, marginBottom: 8 },
  rotuloDoMapa: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase',
    color: WZ.quiet,
  },
  valorDoMapa: { fontSize: 14, lineHeight: 21, color: WZ.text },
  resumo: { fontSize: 14, lineHeight: 23.8, color: WZ.text },

  barraDoCampo: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: WZ_MEDIDA.recuo, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: WZ.line, backgroundColor: WZ.canvas,
  },
  campo: {
    flex: 1, maxHeight: 120, minHeight: 44,
    paddingVertical: 11, paddingHorizontal: 16, borderRadius: 22,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
    fontSize: 14, color: WZ.ink,
  },
  enviar: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: WZ.blue,
  },
  enviarApagado: { backgroundColor: WZ.line2 },
});
