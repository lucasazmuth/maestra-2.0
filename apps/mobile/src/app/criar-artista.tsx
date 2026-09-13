import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { COR, COR_DIAGNOSTICO, RAIO } from '@maestra/core/constants/design';
import {
  FALAS, IMPRENSA_PORTES, IMPRENSA_TIPOS, IMPRENSA_NUNCA, QUIZ, REVENUE_SOURCES,
  TIPOS_DE_CONTRATANTE_QUIZ, NAO_SEI, CTX_API, ORIENTACAO_SPOTIFY, CHAVES_DO_BLOCO_R, totalDaTrilha,
  perguntaAnterior, proximaPergunta, transicaoDoBloco, enunciado,
} from '@maestra/core/constants/quizDoDiagnostico';
import { useCanCreateArtist } from '@maestra/core/hooks/useCanCreateArtist';
import type { RealIndex } from '@maestra/core/interfaces/maestra';
import { supabase } from '@maestra/core/lib/supabase';
import {
  searchSpotifyArtists, type SpotifyArtistSearchResult,
} from '@maestra/core/services/spotifyArtist';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import { formatRemainingTime } from '@maestra/core/utils/rateLimitCalc';

import { Fala } from '@/casca/criar/Fala';
import { LogoDoSpotify } from '@/casca/criar/LogoDoSpotify';
import { PassosDaAnalise } from '@/casca/criar/PassosDaAnalise';
import { FOLGA_APOS_O_CABECALHO } from '@/casca/CabecalhoDoModulo';
import { Relatorio } from '@/casca/diagnostico/Relatorio';
import { MaestraMarca } from '@/icones';
import { useSessao } from '@/nucleo/sessao';
import { Carregando } from '@/casca/Carregando';

// CRIAR PERFIL — o fluxo que termina no Diagnóstico REAL.
//
// Era um `Linking.openURL` para a web. É a porta de entrada do produto: quem instala o app e
// ainda não tem perfil nenhum não tinha o que fazer dentro dele.
//
// Cinco passos, os mesmos da web: escolher o artista (busca no Spotify, ou o caminho "ainda
// estou iniciando"), a transição, o quiz de 13 perguntas com os desvios, a análise e o
// diagnóstico. O roteiro inteiro mora no núcleo — as chaves das respostas são as que a edge
// `artist-diagnostic` lê, e ela é a MESMA para as duas superfícies.
//
// O relatório do fim é o `Relatorio`, o mesmo componente da página do diagnóstico: na web o
// `DiagnosticReport` também aparece nos dois lugares.
//
// O que fica de fora, e está dito na tela: o DESBLOQUEIO. Ele é pagamento, e pagamento dentro do
// app exige StoreKit, que ainda não está configurado. O perfil é criado e o diagnóstico aparece;
// liberar os módulos continua sendo na web — a mesma escolha do "Criar perfil" de antes.

type Passo = 'perfil' | 'intro' | 'quiz' | 'analisando' | 'diagnostico';

const SITE = 'https://www.maestramanager.com';

/** Só dígitos, e com os pontos de milhar da web ("1.500"). */
const soDigitos = (texto: string) => texto.replace(/\D/g, '');
const comMilhar = (texto: string) => texto.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export default function CriarArtista() {
  const { sessao, carregando: carregandoSessao } = useSessao();
  const dispatch = useAppDispatch();
  const artistas = useAppSelector((s) => s.artists.items);
  const usuario = sessao?.user;

  // REFAZER: a mesma tela, mas sobre um perfil que já existe.
  //
  // A edge recalcula o Índice REAL com as novas respostas (`redoArtistId`), sem criar perfil,
  // sem tocar em plano nem em identidade. Aqui isso significa pular a busca do artista — ele já
  // está escolhido — e pré-carregar o quiz com o que foi respondido da última vez, para quem
  // refaz corrigir o que mudou em vez de digitar tudo de novo. É o modo `redo` da web.
  const { refazer: refazerId } = useLocalSearchParams<{ refazer?: string }>();
  const refazendo = !!refazerId;
  const artistaDoRefazer = refazerId ? artistas.find((a) => a.id === refazerId) : undefined;

  const {
    canCreate: pode, reason: motivo, pendingCount: pendentes,
    cooldownRemainingSeconds: espera, loading: verificando, error: erroDoLimite, retry: verificarDeNovo,
  } = useCanCreateArtist();

  const [passo, setPasso] = useState<Passo>('perfil');
  const [fala, setFala] = useState('');
  // A interação só entra depois que a Maestra termina de falar — como na web.
  const [falou, setFalou] = useState(false);
  const dizer = useCallback((texto: string) => { setFalou(false); setFala(texto); }, []);

  // Busca no Spotify
  const [busca, setBusca] = useState('');
  const [buscado, setBuscado] = useState('');
  const [resultados, setResultados] = useState<SpotifyArtistSearchResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [falhaNaBusca, setFalhaNaBusca] = useState<null | 'instavel' | 'bloqueado'>(null);
  const [duplicado, setDuplicado] = useState<string | null>(null);
  const [semSpotify, setSemSpotify] = useState(false);
  const [nomeManual, setNomeManual] = useState('');
  const escolhido = useRef<{
    name: string; spotifyArtistId: string | null; followers: number | null; image: string | null;
  }>({ name: '', spotifyArtistId: null, followers: null, image: null });

  // Quiz
  const [indice, setIndice] = useState(0);
  const respostas = useRef<Record<string, unknown>>({});
  const [valor, setValor] = useState('');
  // Receita: R$ por fonte, ou a string "não sei" (§4 — conta zero e sinaliza no relatório).
  const [receita, setReceita] = useState<Record<string, number | typeof NAO_SEI>>({});
  // Cachê médio por tipo de contratante (§3.2) — seis linhas de R$, zero é resposta válida.
  const [cachePorTipo, setCachePorTipo] = useState<Record<string, number>>({});
  // Imprensa: UM porte por tipo, o maior (§9.3). Chave vazia = "nunca apareceu nesse veículo".
  const [matriz, setMatriz] = useState<Record<string, string>>({});

  // Diagnóstico
  const [real, setReal] = useState<RealIndex | null>(null);
  const [chartmetric, setChartmetric] = useState<Record<string, any> | null>(null);
  const [erroNoDiagnostico, setErroNoDiagnostico] = useState(false);
  // A falha crua, para o log e para a tela de desenvolvimento. O `catch` engolia tudo, e um
  // "não consegui gerar" sem causa não se investiga: não dá para saber se foi rede, sessão,
  // limite ou defeito da edge.
  const [detalheDoErro, setDetalheDoErro] = useState<string | null>(null);
  const criado = useRef<{ artistId: string; locked: boolean } | null>(null);

  const pergunta = passo === 'quiz' ? QUIZ[indice] : null;

  // A saudação muda conforme já existe um perfil — a mesma regra da web.
  const falaDeAbertura = useRef('');
  const abriu = useRef(false);
  useEffect(() => {
    if (abriu.current) return;
    abriu.current = true;
    falaDeAbertura.current = artistas.some((a) => a.role !== 'member')
      ? FALAS.outroPerfil
      : FALAS.primeiroPerfil;
    dizer(falaDeAbertura.current);
  }, [artistas, dizer]);

  // Ao trocar de pergunta, o campo do tipo certo volta ao que já tinha sido respondido.
  useEffect(() => {
    if (!pergunta) return;
    const anterior = respostas.current[pergunta.key];
    if (pergunta.type === 'int' || pergunta.type === 'currency') {
      setValor(typeof anterior === 'number' ? String(anterior) : '');
    } else if (pergunta.type === 'revenue') {
      setReceita((anterior as Record<string, number | typeof NAO_SEI>) ?? {});
    } else if (pergunta.type === 'cache') {
      setCachePorTipo((anterior as Record<string, number>) ?? {});
    } else if (pergunta.type === 'matrix') {
      const guardado = (anterior as { tipo: string; porte: string }[]) ?? [];
      setMatriz(Object.fromEntries(guardado.map((c) => [c.tipo, c.porte])));
    }
  }, [pergunta]);

  // A busca espera 600ms e exige 3 letras: a cota do Spotify é do APP inteiro, e é compartilhada
  // por todo mundo que estiver digitando ao mesmo tempo.
  useEffect(() => {
    const termo = busca.trim();
    setBuscado(termo);
    if (termo.length < 3) { setResultados([]); setFalhaNaBusca(null); return undefined; }
    let vivo = true;
    const conta = setTimeout(() => {
      setBuscando(true);
      setFalhaNaBusca(null);
      searchSpotifyArtists(termo)
        .then((r) => { if (vivo) { setResultados(r); setFalhaNaBusca(null); } })
        .catch((e) => {
          if (!vivo) return;
          setResultados([]);
          // 403 não é instabilidade: é bloqueio do lado do Spotify, e insistir não resolve.
          const status = (e as { response?: { status?: number } })?.response?.status;
          setFalhaNaBusca(status === 403 ? 'bloqueado' : 'instavel');
        })
        .finally(() => { if (vivo) setBuscando(false); });
    }, 600);
    return () => { vivo = false; clearTimeout(conta); };
  }, [busca]);

  // No refazer, o perfil já está escolhido: a tela pula a busca e cai no quiz com as respostas
  // da última vez pré-carregadas. Se a lista ainda não chegou (abriu por link direto), busca e
  // tenta de novo quando ela chegar.
  useEffect(() => {
    if (!refazendo || passo !== 'perfil') return;
    if (!artistaDoRefazer) { if (usuario?.id) dispatch(artistsActions.fetchArtists(usuario.id)); return; }
    // Refazer é do DONO: a edge filtra por user_id e devolveria 404 no fim do quiz inteiro.
    if (artistaDoRefazer.user_id !== usuario?.id) {
      router.replace({ pathname: '/artista/[id]/diagnostico', params: { id: String(refazerId) } });
      return;
    }
    const conteudo = artistaDoRefazer.content as Record<string, any> | undefined;
    escolhido.current = {
      name: artistaDoRefazer.name,
      spotifyArtistId: conteudo?.spotifyProfile?.spotify_artist_id ?? null,
      followers: conteudo?.spotifyProfile?.followers ?? null,
      image: conteudo?.spotifyProfile?.image ?? null,
    };
    respostas.current = { ...(conteudo?.quizDiagnostic?.answers || {}) };
    setIndice(0);
    setPasso('quiz');
    dizer(enunciado(QUIZ[0], respostas.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refazendo, artistaDoRefazer, passo]);

  // O diagnóstico roda ao entrar em "analisando".
  useEffect(() => {
    if (passo !== 'analisando') return undefined;
    let vivo = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('artist-diagnostic', {
          body: refazendo
            ? { redoArtistId: refazerId, quizV4: respostas.current }
            : {
              name: escolhido.current.name,
              spotifyArtistId: escolhido.current.spotifyArtistId,
              spotify: { followers: escolhido.current.followers, image: escolhido.current.image },
              quizV4: respostas.current,
            },
        });
        if (error) throw error;
        const d = data as {
          artistId: string; locked?: boolean; reused?: boolean;
          realIndex: RealIndex | null; chartmetric: Record<string, any> | null;
        };
        if (!vivo) return;
        criado.current = { artistId: d.artistId, locked: d.locked !== false };
        // A lista precisa refletir o perfil novo (que nasce pendente).
        if (usuario?.id) dispatch(artistsActions.fetchArtists(usuario.id));
        // Perfil reaproveitado e já PAGO segue direto pro app, sem repetir o diagnóstico. No
        // refazer isso não se aplica: o perfil é o mesmo, e o que a pessoa veio ver é o índice
        // recalculado.
        if (!refazendo && d.reused && d.locked === false) {
          router.replace({ pathname: '/artista/[id]', params: { id: d.artistId } });
          return;
        }
        setReal(d?.realIndex ?? null);
        setChartmetric(d?.chartmetric ?? null);
        setErroNoDiagnostico(!d?.realIndex);
        if (!d?.realIndex) setDetalheDoErro('a resposta veio sem o índice REAL');
      } catch (falha) {
        if (!vivo) return;
        const mensagem = falha instanceof Error ? falha.message : String(falha);
        // eslint-disable-next-line no-console
        console.error('[criar-artista] o diagnóstico falhou:', mensagem, falha);
        setDetalheDoErro(mensagem);
        setErroNoDiagnostico(true);
      }
      if (vivo) setPasso('diagnostico');
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo]);

  // ── Fluxo ───────────────────────────────────────────────────────────────────
  // Consulta prévia à Chartmetric (§3.1, passo 2): é ela que decide quais perguntas de
  // autodeclaração de R o quiz mostra. Dispara ao escolher o perfil e roda enquanto o artista lê a
  // tela de orientação, então na prática ninguém espera por ela.
  //
  // Rede de segurança (§3.1, passo 6): qualquer falha deixa o contexto vazio e o quiz pergunta os
  // três campos. Perguntar demais é recuperável; calcular o alcance sobre nada não é.
  const preview = useRef<Promise<unknown> | null>(null);
  const [preparando, setPreparando] = useState(false);
  const buscarPreview = (spotifyId: string | null) => {
    delete respostas.current[CTX_API];
    if (!spotifyId) { preview.current = null; return; }
    preview.current = supabase.functions
      .invoke('artist-diagnostic', { body: { preview: true, spotifyArtistId: spotifyId } })
      .then(({ data }) => { if (data?.api) respostas.current[CTX_API] = data.api; })
      .catch(() => { /* sem preview, o quiz pergunta tudo */ });
  };

  const escolher = (
    nome: string, spotifyId: string | null, seguidores: number | null, foto: string | null,
  ) => {
    escolhido.current = {
      name: nome, spotifyArtistId: spotifyId, followers: seguidores, image: foto,
    };
    buscarPreview(spotifyId);
    setPasso('intro');
    dizer(FALAS.escolhido(nome));
  };

  const escolherDoSpotify = async (r: SpotifyArtistSearchResult) => {
    try {
      // O mesmo aviso da web: o perfil já existe nesta conta. O banco revalida.
      const { data: jaExiste } = await supabase.rpc('check_self_duplicate', {
        p_user_id: usuario?.id, p_spotify_id: r.id,
      });
      if (jaExiste) { setDuplicado(r.name); setResultados([]); return; }
    } catch { /* o banco revalida */ }
    setDuplicado(null);
    setBusca('');
    setResultados([]);
    escolher(r.name, r.id, r.followers ?? null, r.image ?? null);
  };

  const irSemSpotify = () => {
    setSemSpotify(true);
    setBusca('');
    setResultados([]);
    setDuplicado(null);
    setFalhaNaBusca(null);
    dizer(FALAS.semSpotify);
  };

  const responder = useCallback((resposta: unknown) => {
    respostas.current[QUIZ[indice].key] = resposta;
    const proxima = proximaPergunta(indice + 1, respostas.current);
    if (proxima < QUIZ.length) {
      setIndice(proxima);
      dizer(enunciado(QUIZ[proxima], respostas.current));
    } else {
      setPasso('analisando');
      dizer(FALAS.analisando);
    }
  }, [indice, dizer]);

  const voltarUmaPergunta = () => {
    const anterior = perguntaAnterior(indice - 1, respostas.current);
    if (anterior < 0) return;
    setIndice(anterior);
    dizer(enunciado(QUIZ[anterior], respostas.current));
  };

  const desbloquear = () => {
    const perfil = criado.current;
    if (!perfil) { router.replace('/perfis'); return; }
    router.replace({ pathname: '/desbloquear/[id]', params: { id: perfil.artistId } });
  };

  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;

  const podeVoltar = passo === 'quiz' && falou
    && perguntaAnterior(indice - 1, respostas.current) >= 0;
  // O progresso vem da posição ABSOLUTA na trilha, e não da contagem de perguntas visíveis: essa
  // muda conforme as respostas abrem e fecham desvios, e a barra chegava a recuar. A única exceção
  // é o bloco R, que a consulta prévia resolve ANTES do quiz começar e por isso é estável.
  const naTrilha = (p: typeof QUIZ[number]) =>
    !(CHAVES_DO_BLOCO_R.includes(p.key) && p.skipIf?.(respostas.current));
  const progresso = passo === 'quiz'
    ? (QUIZ.filter((p, i) => i <= indice && naTrilha(p)).length / totalDaTrilha(respostas.current)) * 100
    : 0;
  const mostrarInteracao = falou || passo === 'diagnostico';
  // A transição do bloco (v4.2, §2): a frase que explica por que o próximo assunto está sendo
  // puxado. Sai na primeira pergunta VISÍVEL de cada bloco e some quando a pessoa responde —
  // quem volta pelo "Voltar" a vê de novo, que é o certo: ela é o contexto daquela pergunta.
  const transicao = passo === 'quiz' ? transicaoDoBloco(indice, respostas.current) : undefined;
  const aviso = (texto: string, acao?: { rotulo: string; aoTocar: () => void }) => (
    <View style={estilos.aviso}>
      <Feather name="alert-circle" size={18} color={COR_DIAGNOSTICO.criarAvisoIcone} />
      <View style={estilos.flex}>
        <Text style={estilos.avisoTexto}>{texto}</Text>
        {!!acao && (
          <Pressable
            onPress={acao.aoTocar}
            accessibilityRole="button"
            accessibilityLabel={acao.rotulo}
          >
            <Text style={estilos.avisoAcao}>{acao.rotulo}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={estilos.tela} edges={['top', 'left', 'right']}>
      {/* A barra de progresso do quiz mora no topo absoluto da página. */}
      {passo === 'quiz' && (
        <View style={estilos.trilho}>
          <View style={[estilos.progresso, { width: `${progresso}%` }]} />
        </View>
      )}

      <View style={estilos.topo}>
        {/* 24, o mesmo do cabeçalho normal do app — e o mesmo da etapa seguinte, no
            desbloqueio: a marca não pode mudar de tamanho no meio da jornada. */}
        <MaestraMarca size={24} color={COR_DIAGNOSTICO.titulo} />

        {/* O progresso do macro-fluxo: três pontos e o nome de SÓ a etapa atual. */}
        <View style={estilos.fase}>
          <View style={estilos.pontos}>
            {[0, 1, 2].map((i) => {
              const atual = passo === 'perfil' ? 0 : 1;
              return (
                <View
                  key={i}
                  style={[
                    estilos.ponto,
                    i <= atual && estilos.pontoAceso,
                    i === atual && estilos.pontoAtual,
                  ]}
                />
              );
            })}
          </View>
          <Text style={estilos.faseTexto}>
            {passo === 'perfil' ? 'Perfil' : 'Diagnóstico'}
          </Text>
        </View>

        <Pressable
          style={estilos.sair}
          onPress={() => (refazendo
            ? router.replace({ pathname: '/artista/[id]/diagnostico', params: { id: String(refazerId) } })
            : router.replace('/perfis'))}
          accessibilityRole="button"
          accessibilityLabel={refazendo ? 'Voltar ao diagnóstico' : 'Sair'}
        >
          <Feather name="x" size={20} color={COR_DIAGNOSTICO.texto} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={estilos.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          {passo !== 'diagnostico' && (
            <View style={estilos.folgaDaFala}>
              {/*
                A transição vem PRONTA, sem a máquina de escrever. São até quatro linhas, e a
                18ms por caractere o bloco dos números levaria quase cinco segundos até a
                pergunta começar — a interação só entra quando a fala termina.
              */}
              {!!transicao && <Text style={estilos.transicao}>{transicao}</Text>}
              <Fala texto={fala} aoTerminar={() => setFalou(true)} />
            </View>
          )}

          {mostrarInteracao && (
            <View style={estilos.interacao}>
              {/* ── 1. O artista ───────────────────────────────────────────── */}
              {passo === 'perfil' && (
                <>
                  {verificando && <Carregando estilo={estilos.espera} />}

                  {!verificando && !pode && motivo === 'pending_limit' && aviso(
                    `Você tem ${pendentes} perfis pendentes. Pague ou exclua antes de criar outro.`,
                    { rotulo: 'Ver meus perfis', aoTocar: () => router.replace('/perfis') },
                  )}

                  {!verificando && !pode && motivo === 'cooldown' && aviso(
                    `Aguarde ${formatRemainingTime(espera)} para criar outro perfil.`,
                  )}

                  {!!erroDoLimite && aviso(
                    'Erro ao verificar limites. Verifique sua conexão e tente novamente.',
                    { rotulo: 'Tentar novamente', aoTocar: verificarDeNovo },
                  )}

                  {!verificando && pode && !semSpotify && (
                    <>
                      <View style={estilos.campo}>
                        <LogoDoSpotify tamanho={24} />
                        <TextInput
                          style={estilos.entrada}
                          value={busca}
                          onChangeText={(t) => { setBusca(t); if (duplicado) setDuplicado(null); }}
                          placeholder="Nome do artista ou link do Spotify…"
                          placeholderTextColor={COR_DIAGNOSTICO.criarEspacoReservado}
                          autoCorrect={false}
                          autoCapitalize="words"
                          accessibilityLabel="Nome do artista ou link do Spotify"
                        />
                      </View>

                      {(buscando || resultados.length > 0) && (
                        <View style={estilos.resultados}>
                          {buscando && (
                            <ActivityIndicator color={COR.primaria} style={estilos.esperaCurta} />
                          )}
                          {!buscando && resultados.map((r) => (
                            <Pressable
                              key={r.id}
                              style={estilos.resultado}
                              onPress={() => escolherDoSpotify(r)}
                              accessibilityRole="button"
                              accessibilityLabel={r.name}
                            >
                              {/* A imagem padrão da web é um arquivo servido pelo site
                                  (`PUBLIC_URL/images/artist.png`), que aqui não existe: a
                                  linha ficava com um buraco. Sem foto, a inicial — o mesmo
                                  recurso da lista de perfis. */}
                              {r.image ? (
                                <Image source={{ uri: r.image }} style={estilos.fotoDoResultado} />
                              ) : (
                                <View style={[estilos.fotoDoResultado, estilos.fotoVazia]}>
                                  <Text style={estilos.inicial}>
                                    {(r.name.trim()[0] ?? '?').toUpperCase()}
                                  </Text>
                                </View>
                              )}
                              <View style={estilos.flex}>
                                <Text style={estilos.nomeDoResultado} numberOfLines={1}>
                                  {r.name}
                                </Text>
                                {r.followers != null && (
                                  <Text style={estilos.seguidores}>
                                    {r.followers.toLocaleString('pt-BR')} seguidores
                                  </Text>
                                )}
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      )}

                      {/* Buscou e não achou. Acontece muito com nome curto ou comum, que afunda
                          na ordenação do Spotify: é a hora de contar que o link acha exato.

                          `!duplicado` porque escolher um perfil que já existe LIMPA os
                          resultados e mantém o termo digitado: sem isto, os dois avisos
                          apareciam juntos, e o "não achei esse artista" contradizia o "você já
                          tem esse artista" logo abaixo. */}
                      {!buscando && !falhaNaBusca && !duplicado && buscado.length >= 3
                        && resultados.length === 0
                        && aviso(
                          'Não achei esse artista pelo nome. Abra o perfil dele no Spotify, copie o link e cole aqui.',
                        )}

                      {!!falhaNaBusca && !buscando && aviso(
                        falhaNaBusca === 'bloqueado'
                          ? 'A busca do Spotify está indisponível no momento. Já estamos resolvendo. Você pode seguir criando o perfil sem ele e conectar depois.'
                          : 'Não consegui falar com o Spotify agora. Isso costuma ser passageiro: espere alguns instantes e escreva o nome de novo.',
                        { rotulo: 'Criar sem o Spotify', aoTocar: irSemSpotify },
                      )}

                      {!!duplicado && aviso(
                        `Você já tem ${duplicado} nos seus perfis. Não dá pra criar de novo, mas você pode abrir o que já existe.`,
                        { rotulo: 'Ver meus perfis', aoTocar: () => router.replace('/perfis') },
                      )}

                      <Pressable
                        onPress={irSemSpotify}
                        accessibilityRole="button"
                        accessibilityLabel="Ainda estou iniciando, não tenho perfil no Spotify"
                      >
                        <Text style={estilos.link}>
                          Ainda estou iniciando, não tenho perfil no Spotify
                        </Text>
                      </Pressable>
                    </>
                  )}

                  {!verificando && pode && semSpotify && (
                    <>
                      <View style={estilos.campo}>
                        <TextInput
                          style={estilos.entrada}
                          value={nomeManual}
                          onChangeText={setNomeManual}
                          placeholder="Seu nome artístico"
                          placeholderTextColor={COR_DIAGNOSTICO.criarEspacoReservado}
                          autoCapitalize="words"
                          onSubmitEditing={() => {
                            if (nomeManual.trim()) escolher(nomeManual.trim(), null, null, null);
                          }}
                          accessibilityLabel="Seu nome artístico"
                        />
                      </View>
                      {/* Sem campo preenchido o botão não faz nada, como o `disabled` da web.
                          A recusa mora no `onPress` porque o `disabled` do Pressable, ligado e
                          desligado por estado, deixa de responder ao toque depois de reabilitado
                          — some da tela e do teste, e o botão vira um botão morto. */}
                      <Pressable
                        style={[estilos.principal, !nomeManual.trim() && estilos.apagado]}
                        onPress={() => {
                          if (nomeManual.trim()) escolher(nomeManual.trim(), null, null, null);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !nomeManual.trim() }}
                        accessibilityLabel="Continuar"
                      >
                        <Text style={estilos.principalTexto}>Continuar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setSemSpotify(false);
                          setNomeManual('');
                          dizer(falaDeAbertura.current);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Tenho Spotify, quero buscar"
                      >
                        <Text style={estilos.link}>Tenho Spotify, quero buscar</Text>
                      </Pressable>
                    </>
                  )}
                </>
              )}

              {/* ── 2. A transição ─────────────────────────────────────────── */}
              {passo === 'intro' && (
                <View style={estilos.intro}>
                  {!!escolhido.current.image && (
                    <View style={estilos.anelDaFoto}>
                      <Image
                        source={{ uri: escolhido.current.image }}
                        style={estilos.fotoDaIntro}
                      />
                    </View>
                  )}
                  <Text style={estilos.nomeDaIntro}>{escolhido.current.name}</Text>
                  {/*
                    §3.1, passo 3 — é o que faz o dado automático existir da próxima vez, e o único
                    momento do fluxo em que o artista tem motivo para ir configurar isso.
                  */}
                  {!!escolhido.current.spotifyArtistId && (
                    <Text style={estilos.orientacao}>{ORIENTACAO_SPOTIFY}</Text>
                  )}
                  <Pressable
                    style={[estilos.principal, preparando && estilos.apagado]}
                    disabled={preparando}
                    onPress={async () => {
                      // Espera o preview para não abrir o quiz com perguntas que já sabemos que
                      // vão sumir. Quase sempre já terminou enquanto esta tela era lida.
                      if (preview.current) { setPreparando(true); await preview.current; setPreparando(false); }
                      setIndice(0); setPasso('quiz'); dizer(enunciado(QUIZ[0], respostas.current));
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: preparando }}
                    accessibilityLabel="Começar diagnóstico"
                  >
                    <Text style={estilos.principalTexto}>
                      {preparando ? 'Preparando as perguntas…' : 'Começar diagnóstico'}
                    </Text>
                  </Pressable>
                </View>
              )}

              {/* ── 3. O quiz ──────────────────────────────────────────────── */}
              {passo === 'quiz' && !!pergunta && (
                <>
                  {/*
                    Várias perguntas da v4 trazem instrução própria ("deixe em zero o que não se
                    aplica", "esse número aparece no YouTube Studio"). Sem ela o artista responde
                    outra coisa, e o que entra no índice deixa de ser o que a metodologia pediu.
                  */}
                  {!!pergunta.ajuda && <Text style={estilos.ajuda}>{pergunta.ajuda}</Text>}

                  {pergunta.type === 'select' && (
                    <View style={estilos.opcoes}>
                      {pergunta.options?.map((opcao) => (
                        <Pressable
                          key={String(opcao.value)}
                          style={estilos.opcao}
                          onPress={() => responder(opcao.value)}
                          accessibilityRole="button"
                          accessibilityLabel={opcao.label}
                        >
                          <Text style={estilos.opcaoTexto}>{opcao.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {(pergunta.type === 'int' || pergunta.type === 'currency') && (
                    <>
                      <View style={estilos.campoNumerico}>
                        {pergunta.type === 'currency' && (
                          <Text style={estilos.prefixo}>R$</Text>
                        )}
                        <TextInput
                          style={estilos.entrada}
                          value={pergunta.type === 'currency' ? comMilhar(valor) : valor}
                          onChangeText={(t) => setValor(soDigitos(t))}
                          placeholder={pergunta.placeholder ?? '0'}
                          placeholderTextColor={COR_DIAGNOSTICO.criarEspacoReservado}
                          keyboardType="number-pad"
                          accessibilityLabel={enunciado(pergunta, respostas.current)}
                        />
                      </View>
                      <Pressable
                        style={[estilos.principal, !valor && estilos.apagado]}
                        onPress={() => { if (valor) responder(Number(valor)); }}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !valor }}
                        accessibilityLabel="Continuar"
                      >
                        <Text style={estilos.principalTexto}>Continuar</Text>
                      </Pressable>
                    </>
                  )}

                  {/*
                    Receita fora dos shows: nove fontes, cada uma em R$ ou "não sei" (§3.2).

                    O "não sei" é resposta de verdade, não campo vazio: conta zero no saldo e vira
                    sinalização no relatório (§4, §11.3.4). Quem não sabe quanto a própria
                    distribuidora paga está dizendo algo sobre a gestão da carreira, e é isso que o
                    diagnóstico devolve. Por isso a linha marcada trava o campo em vez de escondê-lo.
                  */}
                  {pergunta.type === 'revenue' && (
                    <View style={estilos.receita}>
                      <Text style={estilos.prefixoDaReceita}>
                        Quanto você recebeu nos últimos 12 meses...
                      </Text>
                      {REVENUE_SOURCES.map((fonte) => {
                        const naoSei = receita[fonte.key] === NAO_SEI;
                        return (
                          <View key={fonte.key} style={estilos.linhaDeReceita}>
                            <Text style={estilos.rotuloDaReceita}>{fonte.label}</Text>
                            <View style={estilos.controlesDaReceita}>
                              <View style={[estilos.campoNumerico, estilos.campoDaReceita, naoSei && estilos.campoApagado]}>
                                <Text style={estilos.prefixo}>R$</Text>
                                <TextInput
                                  style={estilos.entrada}
                                  editable={!naoSei}
                                  value={!naoSei && receita[fonte.key] ? comMilhar(String(receita[fonte.key])) : ''}
                                  onChangeText={(t) => setReceita((atual) => ({
                                    ...atual, [fonte.key]: Number(soDigitos(t)) || 0,
                                  }))}
                                  placeholder={naoSei ? 'Não sei' : '0'}
                                  placeholderTextColor={COR_DIAGNOSTICO.criarEspacoReservado}
                                  keyboardType="number-pad"
                                  accessibilityLabel={fonte.label}
                                />
                              </View>
                              <Pressable
                                style={[estilos.naoSei, naoSei && estilos.naoSeiMarcado]}
                                onPress={() => setReceita((atual) => ({
                                  ...atual, [fonte.key]: naoSei ? 0 : NAO_SEI,
                                }))}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: naoSei }}
                                accessibilityLabel={`Não sei: ${fonte.label}`}
                              >
                                <Text style={[estilos.naoSeiTexto, naoSei && estilos.naoSeiTextoMarcado]}>
                                  Não sei
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
                      <Pressable
                        style={[estilos.principal, estilos.principalDaReceita]}
                        onPress={() => responder({ ...receita })}
                        accessibilityRole="button"
                        accessibilityLabel="Continuar"
                      >
                        <Text style={estilos.principalTexto}>Continuar</Text>
                      </Pressable>
                    </View>
                  )}

                  {/*
                    Cachê médio por tipo de contratante (§3.2). Zero é resposta válida e significa
                    "não atendi esse tipo": o motor tira os zeros antes de tirar a média.
                  */}
                  {pergunta.type === 'cache' && (
                    <View style={estilos.receita}>
                      {TIPOS_DE_CONTRATANTE_QUIZ.map((tipo) => (
                        <View key={tipo.key} style={estilos.linhaDeReceita}>
                          <Text style={estilos.rotuloDaReceita}>{tipo.label}</Text>
                          <View style={estilos.campoNumerico}>
                            <Text style={estilos.prefixo}>R$</Text>
                            <TextInput
                              style={estilos.entrada}
                              value={cachePorTipo[tipo.key] ? comMilhar(String(cachePorTipo[tipo.key])) : ''}
                              onChangeText={(t) => setCachePorTipo((atual) => ({
                                ...atual, [tipo.key]: Number(soDigitos(t)) || 0,
                              }))}
                              placeholder="0"
                              placeholderTextColor={COR_DIAGNOSTICO.criarEspacoReservado}
                              keyboardType="number-pad"
                              accessibilityLabel={tipo.label}
                            />
                          </View>
                        </View>
                      ))}
                      <Pressable
                        style={[estilos.principal, estilos.principalDaReceita]}
                        onPress={() => responder({ ...cachePorTipo })}
                        accessibilityRole="button"
                        accessibilityLabel="Continuar"
                      >
                        <Text style={estilos.principalTexto}>Continuar</Text>
                      </Pressable>
                    </View>
                  )}

                  {/*
                    Imprensa: uma escolha por tipo de veículo, o MAIOR porte (§9.3).

                    A v3 deixava marcar vários portes no mesmo tipo, o que não significava nada: o
                    motor agrega pelo máximo, porque a matriz mede o TETO de legitimação alcançado.
                    Marcar "pequeno" além de "grande" nunca mudou a nota e só confundia. Agora a
                    pergunta é a que a metodologia faz, com "Nunca" explícito em vez de deixar em branco.
                  */}
                  {pergunta.type === 'matrix' && (
                    <>
                      <View style={estilos.matriz}>
                        {IMPRENSA_TIPOS.map((tipo) => (
                          <View key={tipo.key} style={estilos.linhaDaMatriz}>
                            <Text style={estilos.nomeDoTipo}>{tipo.label}</Text>
                            <View style={estilos.portes}>
                              {[{ key: IMPRENSA_NUNCA, label: 'Nunca' }, ...IMPRENSA_PORTES].map((porte) => {
                                const ehNunca = porte.key === IMPRENSA_NUNCA;
                                const marcada = ehNunca ? !matriz[tipo.key] : matriz[tipo.key] === porte.key;
                                return (
                                  <Pressable
                                    key={porte.key}
                                    style={[estilos.porte, marcada && estilos.porteMarcado]}
                                    onPress={() => setMatriz((atual) => ({
                                      ...atual,
                                      [tipo.key]: ehNunca || atual[tipo.key] === porte.key ? '' : porte.key,
                                    }))}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: marcada }}
                                    accessibilityLabel={`${tipo.label}, ${porte.label}`}
                                  >
                                    <Text
                                      style={[
                                        estilos.porteTexto, marcada && estilos.porteTextoMarcado,
                                      ]}
                                    >
                                      {porte.label}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        ))}
                      </View>
                      <Pressable
                        style={[estilos.principal, estilos.principalDaMatriz]}
                        onPress={() => responder(
                          Object.entries(matriz)
                            .filter(([, porte]) => !!porte)
                            .map(([tipo, porte]) => ({ tipo, porte })),
                        )}
                        accessibilityRole="button"
                        accessibilityLabel="Continuar"
                      >
                        <Text style={estilos.principalTexto}>Continuar</Text>
                      </Pressable>
                    </>
                  )}
                </>
              )}

              {/* ── 4. A análise ───────────────────────────────────────────── */}
              {passo === 'analisando' && <PassosDaAnalise />}

              {/* ── 5. O diagnóstico ───────────────────────────────────────── */}
              {passo === 'diagnostico' && (
                real ? (
                  <>
                    <Relatorio
                      real={real as unknown as Record<string, any>}
                      chartmetric={chartmetric}
                      // Idem: o PDF baixado aqui é o mesmo documento da tela de desbloquear e do
                      // módulo do perfil, e precisa carregar a mesma identificação.
                      artista={{
                        id: refazendo ? String(refazerId) : criado.current?.artistId,
                        nome: escolhido.current?.name || nomeManual,
                        foto: escolhido.current?.image,
                        // O vínculo declarado sai na capa do PDF: sem ele, esta tela gerava um
                        // documento diferente do das outras duas.
                        vinculo: typeof respostas.current?.vinculo === 'string' ? respostas.current.vinculo : null,
                      }}
                      // No refazer a pessoa já conhece o produto: o cabeçalho é o da REVISITA,
                      // como na web, que desliga o herói de entrega no modo redo.
                      momento={refazendo ? 'revisita' : 'entrega'}
                      semSpotify={!escolhido.current?.spotifyArtistId}
                    />
                    {/* No refazer não há o que liberar: o perfil já é pago, e a saída é voltar
                        para o módulo de onde a pessoa veio. */}
                    {refazendo ? (
                      <View style={estilos.desbloqueio}>
                        <Pressable
                          style={estilos.principal}
                          onPress={() => router.replace({
                            pathname: '/artista/[id]/diagnostico', params: { id: String(refazerId) },
                          })}
                          accessibilityRole="button"
                          accessibilityLabel="Voltar ao diagnóstico"
                        >
                          <Text style={estilos.principalTexto}>Voltar ao diagnóstico</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={estilos.desbloqueio}>
                        <Text style={estilos.notaDoDesbloqueio}>
                          Este perfil ainda está pendente. O próximo passo é liberar o
                          planejamento estratégico.
                        </Text>
                        <Pressable
                          style={estilos.principal}
                          onPress={desbloquear}
                          accessibilityRole="button"
                          accessibilityLabel="Liberar este perfil"
                        >
                          <Text style={estilos.principalTexto}>Liberar este perfil</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => router.replace('/perfis')}
                          accessibilityRole="button"
                          accessibilityLabel="Ver meus perfis"
                        >
                          <Text style={estilos.link}>Ver meus perfis</Text>
                        </Pressable>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={estilos.semDiagnostico}>
                    <Text style={estilos.semDiagnosticoTexto}>
                      {erroNoDiagnostico
                        ? 'Não consegui gerar seu diagnóstico agora. Tente novamente em instantes.'
                        : 'Carregando…'}
                    </Text>
                    {/* A causa aparece só em desenvolvimento: para quem usa, ela não muda o que
                        fazer, e o log já a guarda. */}
                    {__DEV__ && !!detalheDoErro && (
                      <Text style={estilos.detalheDoErro}>{detalheDoErro}</Text>
                    )}
                    {erroNoDiagnostico && (
                      <Pressable
                        style={estilos.principal}
                        onPress={() => {
                          setErroNoDiagnostico(false);
                          setDetalheDoErro(null);
                          setPasso('analisando');
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Tentar de novo"
                      >
                        <Text style={estilos.principalTexto}>Tentar de novo</Text>
                      </Pressable>
                    )}
                  </View>
                )
              )}
            </View>
          )}

          {/* Voltar pra pergunta anterior — discreto, no rodapé. */}
          {podeVoltar && (
            <Pressable
              style={estilos.voltar}
              onPress={voltarUmaPergunta}
              accessibilityRole="button"
              accessibilityLabel="Voltar para a pergunta anterior"
            >
              <Feather name="arrow-left" size={15} color={COR_DIAGNOSTICO.texto} />
              <Text style={estilos.voltarTexto}>Voltar</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** A sombra baixa que quase todo bloco claro desta tela usa. */
const sombra = (deslocamento: number, raio: number, opacidade: number) => ({
  shadowColor: 'rgb(46, 72, 117)',
  shadowOpacity: opacidade,
  shadowOffset: { width: 0, height: deslocamento },
  shadowRadius: raio,
  elevation: 2,
});

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 16, paddingBottom: 40 },

  trilho: { height: 3, backgroundColor: COR_DIAGNOSTICO.criarTrilho },
  progresso: { height: 3, backgroundColor: COR.primaria },

  // 76px de altura e um fio embaixo. A folga até o conteúdo NAO mora aqui: ela depende do que
  // vem depois. A fala da Nyta precisa dos 52; o relatório do diagnóstico ja traz o recuo do
  // próprio cabeçalho de módulo, e somar os dois abria um vao de 74px embaixo do fio.
  topo: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 76, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: COR_DIAGNOSTICO.criarTrilho,
  },
  folgaDaFala: { marginTop: 52 },
  // Menor que a pergunta de propósito. As duas são a mesma voz, e no mesmo corpo a tela ficaria
  // com dois títulos brigando — quem chega precisa saber de relance qual das linhas se responde.
  transicao: {
    fontSize: 15, lineHeight: 23, fontWeight: '500',
    color: COR_DIAGNOSTICO.criarAjuda, textAlign: 'center', marginBottom: 18,
  },
  fase: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  pontos: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ponto: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: COR_DIAGNOSTICO.criarPontoApagado,
  },
  pontoAceso: { backgroundColor: COR.primaria },
  /** O ponto da etapa ATUAL vira uma barrinha; os já vencidos continuam redondos. */
  pontoAtual: { width: 18 },
  faseTexto: {
    fontSize: 13, fontWeight: '700', letterSpacing: 0.13, color: COR_DIAGNOSTICO.titulo,
  },
  sair: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.criarContorno, backgroundColor: COR.superficie,
    ...sombra(8, 20, 0.08),
  },

  interacao: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  espera: { marginVertical: 24 },
  esperaCurta: { marginVertical: 16 },

  campo: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    height: 60, paddingHorizontal: 18, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.criarCampoContorno,
    backgroundColor: COR.superficie, ...sombra(10, 24, 0.06),
  },
  // O campo numérico do quiz é mais baixo e tem o canto maior — é o `InputNumber` da web.
  campoNumerico: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 56, paddingHorizontal: 18, borderRadius: RAIO.cartao,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.criarCampoContorno,
    backgroundColor: COR.superficie, ...sombra(8, 18, 0.05),
  },
  entrada: { flex: 1, fontSize: 16, color: COR_DIAGNOSTICO.titulo },
  prefixo: { fontSize: 15, fontWeight: '800', color: COR_DIAGNOSTICO.titulo },

  resultados: {
    // A web limita a lista a 300px com rolagem própria; aqui quem rola é a página, porque uma
    // área de rolagem dentro de outra no celular rouba o gesto de quem quer descer a tela.
    marginTop: 12, padding: 6, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.criarContorno,
    backgroundColor: COR.superficie, ...sombra(14, 30, 0.1),
  },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8 },
  fotoDoResultado: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COR.divisoria,
  },
  fotoVazia: { alignItems: 'center', justifyContent: 'center' },
  inicial: { fontSize: 17, fontWeight: '800', color: COR.apagado },
  nomeDoResultado: { fontSize: 14, fontWeight: '700', color: COR_DIAGNOSTICO.titulo },
  seguidores: { fontSize: 12, color: COR_DIAGNOSTICO.criarSeguidores, marginTop: 2 },

  link: {
    fontSize: 14, fontWeight: '600', color: COR.primaria, textAlign: 'center', marginTop: 14,
  },

  intro: { alignItems: 'center', gap: 18 },
  // O aro de 2px mais o anel de 5px em volta — dois Views, porque não é sombra.
  anelDaFoto: {
    padding: 5, borderRadius: 58, backgroundColor: COR_DIAGNOSTICO.criarIntroAnel,
  },
  fotoDaIntro: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2, borderColor: COR_DIAGNOSTICO.criarIntroContorno,
  },
  nomeDaIntro: {
    fontSize: 26, fontWeight: '800', lineHeight: 29.9, color: COR_DIAGNOSTICO.titulo,
    textAlign: 'center',
  },

  opcoes: { gap: 10 },
  opcao: {
    paddingVertical: 17, paddingHorizontal: 22, borderRadius: RAIO.cartao,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.criarContorno, backgroundColor: COR.superficie,
    ...sombra(8, 18, 0.05),
  },
  opcaoTexto: { fontSize: 16, fontWeight: '600', color: COR_DIAGNOSTICO.titulo },

  receita: { gap: 14 },
  linhaDeReceita: { gap: 8 },
  rotuloDaReceita: { fontSize: 13.5, fontWeight: '700', color: COR_DIAGNOSTICO.texto },
  // O prefixo comum das nove fontes ("Quanto você recebeu nos últimos 12 meses...") é dito uma vez
  // no topo, e cada linha completa a frase. Repeti-lo nove vezes empurraria a lista para fora da tela.
  prefixoDaReceita: {
    fontSize: 13.5, lineHeight: 19, fontWeight: '700', color: COR_DIAGNOSTICO.titulo,
  },
  controlesDaReceita: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  campoDaReceita: { flex: 1, minWidth: 0 },
  campoApagado: { opacity: 0.55 },
  naoSei: {
    height: 56, paddingHorizontal: 14, borderRadius: RAIO.cartao,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    borderColor: COR_DIAGNOSTICO.criarCampoContorno,
    backgroundColor: COR_DIAGNOSTICO.criarChipFundo,
  },
  naoSeiMarcado: { borderColor: COR.primaria, backgroundColor: COR.primaria },
  naoSeiTexto: { fontSize: 12, fontWeight: '700', color: COR_DIAGNOSTICO.texto },
  naoSeiTextoMarcado: { color: COR.sobrePrimaria },
  orientacao: {
    fontSize: 13, lineHeight: 19.5, color: COR_DIAGNOSTICO.criarAjuda,
    textAlign: 'center', marginTop: -4,
  },

  ajuda: {
    fontSize: 13, lineHeight: 18.85, color: COR_DIAGNOSTICO.criarAjuda,
    marginBottom: 16, textAlign: 'center',
  },
  matriz: { gap: 10 },
  linhaDaMatriz: {
    alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1,
    borderColor: COR_DIAGNOSTICO.criarContorno, backgroundColor: COR.superficie,
    ...sombra(6, 14, 0.04),
  },
  nomeDoTipo: {
    fontSize: 13, fontWeight: '600', color: COR_DIAGNOSTICO.titulo, textAlign: 'center',
  },
  portes: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  porte: {
    minWidth: 62, paddingVertical: 8, paddingHorizontal: 12, borderRadius: RAIO.campo,
    alignItems: 'center', borderWidth: 1, borderColor: COR_DIAGNOSTICO.criarCampoContorno,
    backgroundColor: COR_DIAGNOSTICO.criarChipFundo,
  },
  porteMarcado: { borderColor: COR.primaria, backgroundColor: COR.primaria },
  porteTexto: { fontSize: 12, fontWeight: '700', color: COR_DIAGNOSTICO.texto },
  porteTextoMarcado: { color: COR.sobrePrimaria },

  principal: {
    marginTop: 12, paddingVertical: 13, paddingHorizontal: 22,
    borderRadius: RAIO.campoDeEntrada, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR.primaria,
    shadowColor: 'rgb(51, 97, 255)', shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 10 }, shadowRadius: 20, elevation: 4,
  },
  principalDaReceita: { marginTop: 14 },
  principalDaMatriz: { marginTop: 16 },
  apagado: { opacity: 0.5 },
  principalTexto: {
    fontSize: 14, fontWeight: '800', letterSpacing: 0.14, color: COR.sobrePrimaria,
  },

  aviso: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12,
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: RAIO.campo,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.criarAvisoContorno,
    borderLeftWidth: 3, borderLeftColor: COR_DIAGNOSTICO.criarAvisoBarra,
    backgroundColor: COR_DIAGNOSTICO.criarAvisoFundo,
  },
  avisoTexto: { fontSize: 13, lineHeight: 19, color: COR_DIAGNOSTICO.texto },
  avisoAcao: { fontSize: 12, fontWeight: '600', color: COR.primaria, paddingVertical: 7 },

  desbloqueio: { marginTop: FOLGA_APOS_O_CABECALHO, gap: 4 },
  notaDoDesbloqueio: {
    fontSize: 13, lineHeight: 19, textAlign: 'center', color: COR_DIAGNOSTICO.texto,
  },

  semDiagnostico: { alignItems: 'center', marginVertical: 64 },
  detalheDoErro: {
    fontSize: 12, lineHeight: 17, textAlign: 'center', color: COR_DIAGNOSTICO.rotulo,
    marginBottom: 14,
  },
  semDiagnosticoTexto: {
    fontSize: 15, lineHeight: 22, textAlign: 'center', color: COR_DIAGNOSTICO.texto,
    marginBottom: 18,
  },

  voltar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    alignSelf: 'center', marginTop: 28, paddingVertical: 8, paddingHorizontal: 14,
  },
  voltarTexto: { fontSize: 13.5, fontWeight: '600', color: COR_DIAGNOSTICO.texto },
});
