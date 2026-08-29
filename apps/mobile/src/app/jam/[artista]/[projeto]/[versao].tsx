import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import Svg, { Defs, Path, Rect, RadialGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { CATALOG_STATUS } from '@maestra/core/constants/maestra';
import { COR, COR_VERSAO } from '@maestra/core/constants/design';
import type {
  CatalogProject, CatalogVersion, CatalogVersionComment,
} from '@maestra/core/interfaces/maestra';
import * as catalogo from '@maestra/core/services/db/catalog';

import { FolhaDaVersao } from '@/casca/jam/FolhaDaVersao';
import { useSessao } from '@/nucleo/sessao';

// O ESPAÇO DA VERSÃO: uma gravação em tela cheia.
//
// É a única tela escura do produto, e de propósito — aqui não se administra nada, se escuta. O
// traço orgânico gira em volta do play enquanto toca; a régua embaixo carrega os comentários
// marcados num ponto do áudio, e tocar num alfinete leva a reprodução até lá.
//
// Na web ela é um overlay sobre a página de Músicas, alcançado por `?projectId&versionId`. Aqui
// é uma tela da pilha, filha do Espaço Jam — o caminho de volta é o mesmo, e o endereço diz
// onde se está.

const relogio = (segundos?: number | null) => {
  if (segundos == null || !Number.isFinite(segundos) || segundos < 0) return '0:00';
  const m = Math.floor(segundos / 60);
  const s = String(Math.floor(segundos % 60)).padStart(2, '0');
  return `${m}:${s}`;
};

const quando = (valor?: string | null) => valor
  ? new Date(valor).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
  : '';

const iniciais = (valor?: string | null) => (valor || '?').trim().slice(0, 1).toUpperCase();

// Os dois traços são os MESMOS caminhos do SVG da web, copiados do `ProjectSpace`... não: da
// sala da versão, em `src/pages/Catalog/index.tsx`. Um `d` decorado à mão daria outro desenho.
const TRACO_UM = 'M149.091 51.0449C158.028 48.1411 167.655 48.1411 176.593 51.0449L217.228 64.248C226.166 67.152 233.955 72.8114 239.478 80.4141L264.592 114.98C270.115 122.583 273.091 131.739 273.091 141.137V183.863C273.091 193.261 270.115 202.417 264.592 210.02L239.478 244.586C233.955 252.189 226.166 257.848 217.228 260.752L176.593 273.955C167.655 276.859 158.028 276.859 149.091 273.955L108.455 260.752C99.5175 257.848 91.7286 252.189 86.205 244.586L61.0917 210.02C55.568 202.417 52.5927 193.261 52.5927 183.863V141.137C52.5927 131.739 55.568 122.583 61.0917 114.98L86.205 80.4141C91.7286 72.8114 99.5175 67.152 108.455 64.248L149.091 51.0449Z';
const TRACO_DOIS = 'M229.205 75.9546C238.687 80.376 246.307 87.9968 250.729 97.4785L269.967 138.735C274.388 148.217 275.328 158.954 272.62 169.059L260.838 213.03C258.13 223.135 251.948 231.964 243.378 237.964L206.09 264.074C197.52 270.075 187.109 272.865 176.687 271.953L131.34 267.985C120.917 267.073 111.149 262.518 103.751 255.121L71.5628 222.932C64.165 215.534 59.6107 205.767 58.6988 195.344L54.7303 149.996C53.8185 139.574 56.6085 129.164 62.6093 120.593L88.7191 83.3053C94.7198 74.7354 103.548 68.553 113.654 65.8452L157.624 54.0633C167.73 51.3555 178.466 52.2949 187.948 56.7163L229.205 75.9546Z';

const Avatar = ({ nome, foto, tamanho }: {
  nome?: string | null; foto?: string | null; tamanho: number;
}) => {
  const forma = {
    width: tamanho, height: tamanho, borderRadius: tamanho / 2,
    borderWidth: 2, borderColor: COR_VERSAO.autor,
  } as const;
  if (foto) return <Image source={{ uri: foto }} style={[forma, estilos.avatarFoto]} />;
  return (
    <View style={[forma, estilos.avatarVazio]}>
      <Text style={estilos.avatarTexto}>{iniciais(nome)}</Text>
    </View>
  );
};

export default function EspacoDaVersao() {
  const {
    artista: artistaId, projeto: projetoId, versao: versaoId,
  } = useLocalSearchParams<{ artista: string; projeto: string; versao: string }>();
  const margem = useSafeAreaInsets();
  const { sessao } = useSessao();

  const usuario = sessao?.user;
  const dados = (usuario?.user_metadata ?? {}) as Record<string, unknown>;
  const meuNome = (dados.full_name || dados.name || usuario?.email || 'Você') as string;
  const minhaFoto = (dados.avatar_url || dados.picture || null) as string | null;

  const [projeto, setProjeto] = useState<CatalogProject | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [comentarios, setComentarios] = useState<CatalogVersionComment[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [folhaAberta, setFolhaAberta] = useState(false);

  // O ponto onde a pessoa quer comentar: nasce da posição atual, e o campo abre com ele à vista.
  const [marcando, setMarcando] = useState<number | null>(null);
  const [textoMarcado, setTextoMarcado] = useState('');

  const [reguaLargura, setReguaLargura] = useState(0);

  const player = useAudioPlayer();
  const estado = useAudioPlayerStatus(player);
  const [noAr, setNoAr] = useState(false);

  const versao = useMemo(
    () => (projeto?.versions ?? []).find((v) => v.id === versaoId) ?? null,
    [projeto, versaoId],
  );
  const principal = Boolean(projeto && versao && projeto.primary_version_id === versao.id);

  const buscar = useCallback(async () => {
    if (!projetoId) return;
    try {
      setProjeto(await catalogo.getCatalogProject(String(projetoId)));
    } catch {
      setProjeto(null);
    } finally {
      setCarregando(false);
    }
  }, [projetoId]);

  const buscarComentarios = useCallback(async () => {
    if (!versaoId) return;
    try {
      setComentarios(await catalogo.listVersionComments(String(versaoId)));
    } catch {
      setErro('Não foi possível carregar os comentários.');
    }
  }, [versaoId]);

  useEffect(() => { void buscar(); }, [buscar]);
  useEffect(() => { void buscarComentarios(); }, [buscarComentarios]);

  // A fonte entra no player uma vez; a partir daí é play/pause e posição.
  useEffect(() => {
    if (!versao?.audio_file) return;
    player.replace({ uri: versao.audio_file });
    setNoAr(true);
  }, [versao?.audio_file, player]);

  const tocando = noAr && estado.playing;

  // O traço só se mexe quando toca — parado, ele é a moldura da capa. Uma volta a cada 7s, como
  // o `track-wave-spin-breathe` da web.
  const giro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!tocando) { giro.stopAnimation(); return undefined; }
    const volta = Animated.loop(Animated.timing(giro, {
      toValue: 1, duration: 7000, easing: Easing.linear, useNativeDriver: true,
    }));
    volta.start();
    return () => volta.stop();
  }, [tocando, giro]);

  const rotacao = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const duracao = estado.duration || 0;
  const posicao = estado.currentTime || 0;
  const fracao = duracao > 0 ? Math.min(1, Math.max(0, posicao / duracao)) : 0;

  const alternar = () => {
    if (!versao?.audio_file) return;
    if (estado.playing) player.pause(); else player.play();
  };

  const irPara = (segundo: number) => {
    if (!duracao) return;
    player.seekTo(Math.min(duracao, Math.max(0, segundo)));
  };

  // Os comentários com tempo viram alfinetes na régua. Os sem tempo ficam só na conversa.
  const alfinetes = useMemo(() => comentarios
    .filter((c) => c.time_seconds != null && duracao > 0)
    .map((c, i) => ({
      id: c.id,
      numero: i + 1,
      segundo: Number(c.time_seconds),
      fracao: Math.min(1, Math.max(0, Number(c.time_seconds) / duracao)),
    })), [comentarios, duracao]);

  const enviar = async (segundoMarcado: number | null) => {
    const conteudo = (segundoMarcado == null ? texto : textoMarcado).trim();
    if (!versaoId || !conteudo || enviando) return;
    setEnviando(true);
    setErro('');
    try {
      const criado = await catalogo.createVersionComment({
        version_id: String(versaoId),
        author_id: usuario?.id ?? null,
        author_name: meuNome,
        author_avatar: minhaFoto,
        text: conteudo,
        time_seconds: segundoMarcado,
      });
      setComentarios((atual) => [...atual, criado]);
      if (segundoMarcado == null) setTexto('');
      else { setTextoMarcado(''); setMarcando(null); }
    } catch {
      setErro('Não foi possível enviar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  const alternarPrincipal = async () => {
    if (!projeto || !versao) return;
    try {
      await catalogo.setPrimaryVersion(projeto.id, principal ? null : versao.id);
      await buscar();
    } catch { /* o estado real volta no próximo refresh */ }
  };

  const voltar = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/jam/${artistaId}/${projetoId}`);
  };

  if (carregando) {
    return (
      <View style={estilos.espera}>
        <ActivityIndicator color={COR.primaria} />
      </View>
    );
  }

  if (!projeto || !versao) {
    return (
      <View style={estilos.espera}>
        <Text style={estilos.esperaTexto}>Esta versão não existe mais.</Text>
        <Pressable onPress={voltar} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={estilos.esperaLink}>Voltar para o Espaço JAM</Text>
        </Pressable>
      </View>
    );
  }

  const rotuloDoStatus =
    CATALOG_STATUS[projeto.status as keyof typeof CATALOG_STATUS]?.label || projeto.status || 'Rascunho';

  return (
    <View style={estilos.tela}>
      <View style={[estilos.cabecalho, { paddingTop: margem.top + 13, height: 68 + margem.top }]}>
        <Pressable
          style={estilos.redondo}
          onPress={voltar}
          accessibilityRole="button"
          accessibilityLabel="Voltar para o Espaço JAM"
        >
          <Feather name="arrow-left" size={20} color={COR_VERSAO.cabecalhoIcone} />
        </Pressable>

        <View style={estilos.flex}>
          <Text style={estilos.nome} numberOfLines={1}>
            {versao.title || `Versão ${versao.version_number}`}
          </Text>
          <Text style={estilos.subtitulo} numberOfLines={1}>
            {/* Sem a categoria: quem tem categoria é a MÚSICA, não a versão. Fica o status, que
                é do projeto e diz onde a obra está. */}
            ESPAÇO DA VERSÃO · {rotuloDoStatus}
          </Text>
        </View>

        <Pressable
          style={[estilos.redondo, principal && estilos.redondoAceso]}
          onPress={alternarPrincipal}
          accessibilityRole="button"
          accessibilityState={{ selected: principal }}
          accessibilityLabel={principal
            ? `Desmarcar V${versao.version_number} como versão principal`
            : `Tornar V${versao.version_number} a versão principal`}
        >
          <Feather
            name="star"
            size={19}
            color={principal ? COR_VERSAO.estrela : COR_VERSAO.cabecalhoIcone}
          />
        </Pressable>

        {/* A engrenagem edita a VERSÃO aberta — não a ficha da música. Quem está na sala de uma
            gravação e toca aqui espera mexer nela. */}
        <Pressable
          style={estilos.redondo}
          onPress={() => setFolhaAberta(true)}
          accessibilityRole="button"
          accessibilityLabel="Editar versão"
        >
          <Feather name="settings" size={19} color={COR_VERSAO.cabecalhoIcone} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={estilos.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={{ paddingBottom: margem.bottom }}>
          <View style={estilos.palco}>
            {/* A capa da música entra ATRÁS do véu — é o lugar que a web reserva para ela. */}
            {!!projeto.cover_image && (
              <Image source={{ uri: projeto.cover_image }} style={estilos.capa} />
            )}
            <LinearGradient
              colors={[COR_VERSAO.veuDe, COR_VERSAO.veuMeio, COR_VERSAO.veuAte]}
              locations={[0, 0.46, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* O brilho roxo é RADIAL e some em 33% do raio — não um disco de borda dura. Um
                `View` redondo com opacidade desenha justamente o disco, que lê como uma mancha
                colada por cima em vez de profundidade. */}
            <Svg style={estilos.brilho} pointerEvents="none">
              <Defs>
                <RadialGradient id="brilho" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={COR_VERSAO.brilho} stopOpacity={0.22} />
                  <Stop offset="0.33" stopColor={COR_VERSAO.brilho} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#brilho)" />
            </Svg>

            <View style={estilos.fichaTecnica}>
              {([['BPM', projeto.bpm], ['TOM', projeto.key], ['GÊNERO', projeto.genre]] as const)
                .map(([rotulo, valor], i) => (
                  <View key={rotulo} style={[estilos.dado, i > 0 && estilos.dadoComFio]}>
                    <Text style={estilos.dadoRotulo}>{rotulo}</Text>
                    <Text style={estilos.dadoValor} numberOfLines={1}>{valor || '—'}</Text>
                  </View>
                ))}
            </View>

            <View style={estilos.centro}>
              <Animated.View style={{ transform: [{ rotate: rotacao }] }}>
                <Svg width={250} height={250} viewBox="0 0 327 327">
                  <Path
                    d={TRACO_UM}
                    fill="none"
                    stroke={COR_VERSAO.traco}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.92}
                  />
                  <Path
                    d={TRACO_DOIS}
                    fill="none"
                    stroke={COR_VERSAO.traco}
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.66}
                  />
                </Svg>
              </Animated.View>

              <Pressable
                style={estilos.play}
                onPress={alternar}
                disabled={!versao.audio_file}
                accessibilityRole="button"
                accessibilityLabel={tocando ? 'Pausar música' : 'Tocar música'}
              >
                <Feather
                  name={tocando ? 'pause' : 'play'}
                  size={54}
                  color={versao.audio_file ? COR_VERSAO.autor : COR_VERSAO.rotulo}
                />
              </Pressable>
            </View>

            <View style={estilos.rodapeDoPalco}>
              <View style={estilos.tempos}>
                <Text style={estilos.tempo}>{relogio(posicao)}</Text>
                <Text style={estilos.tempo}>{relogio(duracao || versaoEmSegundos(versao))}</Text>
              </View>

              <View
                style={estilos.regua}
                onLayout={(e) => setReguaLargura(e.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => Boolean(duracao)}
                onMoveShouldSetResponder={() => Boolean(duracao)}
                onResponderGrant={(e) => reguaLargura > 0
                  && irPara((e.nativeEvent.locationX / reguaLargura) * duracao)}
                onResponderMove={(e) => reguaLargura > 0
                  && irPara((e.nativeEvent.locationX / reguaLargura) * duracao)}
                accessibilityRole="adjustable"
                accessibilityLabel="Progresso da música"
              >
                <View style={estilos.trilho}>
                  <View style={[estilos.percorrido, { width: `${fracao * 100}%` }]} />
                </View>

                {/* O marcador anda com a reprodução e abre o campo de comentar NAQUELE ponto —
                    é o gesto que cria os alfinetes. Mora DENTRO da régua: fora dela a
                    porcentagem mede a partir da borda da seção, e a gota fica pendurada no
                    canto da tela. */}
                <Pressable
                  style={[estilos.marcador, { left: `${fracao * 100}%` }]}
                  onPress={() => { setMarcando(Math.floor(posicao)); setTextoMarcado(''); }}
                  hitSlop={10}
                  disabled={!duracao}
                  accessibilityRole="button"
                  accessibilityLabel="Comentar neste ponto da música"
                >
                  <View style={estilos.gota}>
                    {/* O "+" dentro da gota é o que diz que ela ACRESCENTA algo; sem ele a gota
                        lê como o cursor da reprodução, e ninguém a toca.
                        Os 45° DESFAZEM a rotação da gota — a web faz a mesma conta no `::before`.
                        Sem eles o "+" gira junto e vira um "×", que diz o contrário: fechar. */}
                    <View style={estilos.mais}>
                      <Feather name="plus" size={13} color={COR_VERSAO.fundo} />
                    </View>
                  </View>
                </Pressable>

                {alfinetes.map((alfinete) => (
                  <Pressable
                    key={alfinete.id}
                    style={[estilos.alfinete, { left: `${alfinete.fracao * 100}%` }]}
                    onPress={() => irPara(alfinete.segundo)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      `Ir para o comentário marcado em ${relogio(alfinete.segundo)}`
                    }
                  >
                    {/* Gota também, como a da web: girada 135°, a ponta apontando para a régua.
                        O número fica FORA da rotação — girado ele viraria um rabisco. */}
                    <View style={estilos.corpoDoAlfinete} />
                    <Text style={estilos.alfineteTexto}>{alfinete.numero}</Text>
                  </Pressable>
                ))}
              </View>

            </View>

            {marcando != null && (
              <View style={estilos.campoMarcado}>
                <Text style={estilos.campoMarcadoTempo}>{relogio(marcando)}</Text>
                <TextInput
                  style={estilos.campoMarcadoEntrada}
                  value={textoMarcado}
                  onChangeText={setTextoMarcado}
                  placeholder="Comente neste ponto..."
                  placeholderTextColor={COR_VERSAO.campoTexto}
                  autoFocus
                  accessibilityLabel={`Comentário marcado em ${relogio(marcando)}`}
                />
                <Pressable
                  onPress={() => setMarcando(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancelar comentário"
                >
                  <Feather name="x" size={16} color={COR_VERSAO.campoTexto} />
                </Pressable>
                <Pressable
                  style={estilos.enviarPequeno}
                  onPress={() => enviar(marcando)}
                  disabled={!textoMarcado.trim() || enviando}
                  accessibilityRole="button"
                  accessibilityLabel="Enviar comentário neste ponto"
                >
                  <Feather name="send" size={14} color={COR_VERSAO.autor} />
                </Pressable>
              </View>
            )}
          </View>

          <LinearGradient
            colors={[COR_VERSAO.conversaDe, COR_VERSAO.conversaAte]}
            style={estilos.conversa}
          >
            <View style={estilos.cabecalhoDaConversa}>
              <Text style={estilos.rotuloDaConversa}>CONVERSA DA EQUIPE</Text>
              <View style={estilos.linhaDaContagem}>
                <Text style={estilos.tituloDaConversa}>Comentários</Text>
                <View style={estilos.contagem}>
                  <Text style={estilos.contagemTexto}>{comentarios.length}</Text>
                </View>
              </View>
            </View>

            <View style={estilos.listaDeComentarios}>
              {comentarios.length === 0 ? (
                <Text style={estilos.semComentarios}>
                  Ninguém comentou esta gravação ainda. Toque no marcador da régua para falar de
                  um ponto do áudio.
                </Text>
              ) : comentarios.map((c) => (
                <View key={c.id} style={estilos.comentario}>
                  <Avatar nome={c.author_name} foto={c.author_avatar} tamanho={32} />
                  <View style={estilos.flex}>
                    <Text style={estilos.autor}>{c.author_name}</Text>
                    <View style={estilos.linhaDaData}>
                      <Text style={estilos.data}>{quando(c.created_at)}</Text>
                      {c.time_seconds != null && (
                        <Text style={estilos.marcado}>
                          Marcado em {relogio(Number(c.time_seconds))}
                        </Text>
                      )}
                    </View>
                    <Text style={estilos.fala}>{c.text}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={estilos.campo}>
              <Avatar nome={meuNome} foto={minhaFoto} tamanho={30} />
              <TextInput
                style={estilos.campoEntrada}
                value={texto}
                onChangeText={setTexto}
                maxLength={5000}
                placeholder="Comente sobre essa versão…"
                placeholderTextColor={COR_VERSAO.campoTexto}
                editable={!enviando}
                accessibilityLabel="Comentário sobre esta versão"
              />
              <Pressable
                style={[estilos.enviar, (!texto.trim() || enviando) && estilos.enviarApagado]}
                onPress={() => enviar(null)}
                disabled={!texto.trim() || enviando}
                accessibilityRole="button"
                accessibilityLabel="Enviar comentário"
              >
                {enviando
                  ? <ActivityIndicator size="small" color={COR_VERSAO.autor} />
                  : <Feather name="send" size={15} color={COR_VERSAO.autor} />}
              </Pressable>
            </View>

            {!!erro && <Text style={estilos.erro}>{erro}</Text>}
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>

      <FolhaDaVersao
        aberta={folhaAberta}
        artistaId={String(artistaId)}
        projetoId={projeto.id}
        nomeDoProjeto={projeto.title}
        versao={versao}
        ehPrincipal={principal}
        autor={{ id: usuario?.id, nome: meuNome, foto: minhaFoto }}
        aoFechar={() => setFolhaAberta(false)}
        aoSalvar={buscar}
        // Excluir a versão deixa a tela sem assunto: volta para o Espaço JAM.
        aoExcluir={voltar}
      />
    </View>
  );
}

/** A duração gravada na ficha, quando o player ainda não sabe a de verdade. */
const versaoEmSegundos = (versao: CatalogVersion) => {
  const partes = (versao.duration || '').split(':').map(Number);
  if (partes.length !== 2 || partes.some((n) => !Number.isFinite(n))) return 0;
  return partes[0] * 60 + partes[1];
};

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR_VERSAO.fundo },
  flex: { flex: 1, minWidth: 0 },
  espera: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14,
    backgroundColor: COR_VERSAO.palco,
  },
  esperaTexto: { fontSize: 15, color: COR_VERSAO.rotulo },
  esperaLink: { fontSize: 14, fontWeight: '800', color: COR.primaria },

  cabecalho: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
    paddingBottom: 13, backgroundColor: COR_VERSAO.cabecalho,
  },
  redondo: {
    width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_VERSAO.cabecalho,
    shadowColor: 'rgba(82, 102, 141, .1)', shadowOpacity: 1,
    shadowOffset: { width: 0, height: 8 }, shadowRadius: 20, elevation: 3,
  },
  redondoAceso: { backgroundColor: COR_VERSAO.estrelaFundo },
  nome: { fontSize: 16, fontWeight: '900', letterSpacing: -0.32, color: COR_VERSAO.cabecalhoTexto },
  subtitulo: {
    fontSize: 8, fontWeight: '900', letterSpacing: 0.32, textTransform: 'uppercase',
    color: COR_VERSAO.cabecalhoApoio, marginTop: 3,
  },

  palco: { minHeight: 650, paddingBottom: 47, backgroundColor: COR_VERSAO.palco, overflow: 'hidden' },
  capa: {
    position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
    width: '100%', height: '100%', resizeMode: 'cover',
  },
  brilho: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },

  fichaTecnica: { flexDirection: 'row', marginTop: 34, marginLeft: 28 },
  dado: { gap: 4 },
  dadoComFio: {
    marginLeft: 24, paddingLeft: 24,
    borderLeftWidth: 1, borderLeftColor: COR_VERSAO.divisoria,
  },
  dadoRotulo: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: COR_VERSAO.rotulo },
  dadoValor: { fontSize: 10, fontWeight: '700', color: COR_VERSAO.valor },

  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 40 },
  play: { position: 'absolute', width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },

  rodapeDoPalco: { paddingHorizontal: 28, gap: 6 },
  tempos: { flexDirection: 'row', justifyContent: 'space-between' },
  tempo: { fontSize: 10, fontWeight: '800', color: COR_VERSAO.relogio },
  regua: { height: 20, justifyContent: 'center' },
  trilho: { height: 4, borderRadius: 4, backgroundColor: COR_VERSAO.trilho, overflow: 'hidden' },
  percorrido: { height: 4, borderRadius: 4, backgroundColor: COR_VERSAO.autor },
  alfinete: {
    position: 'absolute', top: 24, marginLeft: -13,
    width: 26, height: 26, alignItems: 'center', justifyContent: 'center',
  },
  corpoDoAlfinete: {
    position: 'absolute', top: 2, right: 2, bottom: 2, left: 2,
    borderWidth: 2, borderColor: COR_VERSAO.autor, backgroundColor: COR_VERSAO.alfinete,
    borderTopLeftRadius: 11, borderTopRightRadius: 11, borderBottomRightRadius: 11,
    borderBottomLeftRadius: 0, transform: [{ rotate: '135deg' }],
  },
  alfineteTexto: { fontSize: 11, fontWeight: '900', color: COR_VERSAO.autor },
  marcador: {
    position: 'absolute', top: -32, marginLeft: -13,
    width: 26, height: 26, alignItems: 'center', justifyContent: 'center',
  },
  // A gota da web é um círculo com um canto quadrado, girado 45° — a ponta desce para a régua.
  gota: {
    width: 22, height: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_VERSAO.autor,
    borderWidth: 2, borderColor: COR_VERSAO.autor,
    borderTopLeftRadius: 11, borderTopRightRadius: 11, borderBottomRightRadius: 11,
    borderBottomLeftRadius: 0, transform: [{ rotate: '-45deg' }],
    shadowColor: COR_VERSAO.sombra, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12, elevation: 4,
  },
  mais: { transform: [{ rotate: '45deg' }] },
  campoMarcado: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 28, marginTop: 22, padding: 10, borderRadius: 12,
    borderWidth: 1, borderColor: COR_VERSAO.campoContorno, backgroundColor: COR_VERSAO.campoFundo,
  },
  campoMarcadoTempo: { fontSize: 10, fontWeight: '800', color: COR_VERSAO.marcado },
  campoMarcadoEntrada: { flex: 1, minWidth: 0, fontSize: 12, color: COR_VERSAO.autor },
  enviarPequeno: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR.primaria,
  },

  conversa: { minHeight: 380, paddingBottom: 18 },
  cabecalhoDaConversa: {
    gap: 7, paddingHorizontal: 18, paddingTop: 25, paddingBottom: 19,
    borderBottomWidth: 1, borderBottomColor: COR_VERSAO.campoContorno,
  },
  rotuloDaConversa: {
    fontSize: 9, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase',
    color: COR_VERSAO.rotuloDaConversa,
  },
  linhaDaContagem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  tituloDaConversa: { fontSize: 19, color: COR_VERSAO.autor },
  contagem: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR_VERSAO.contagem,
  },
  contagemTexto: { fontSize: 10, fontWeight: '700', color: COR_VERSAO.autor },
  listaDeComentarios: { paddingHorizontal: 18, paddingVertical: 20, gap: 18 },
  semComentarios: { fontSize: 11, lineHeight: 18, color: COR_VERSAO.fala },
  comentario: { flexDirection: 'row', gap: 10 },
  avatarFoto: { resizeMode: 'cover' },
  avatarVazio: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR_VERSAO.brilho,
  },
  avatarTexto: { fontSize: 11, fontWeight: '800', color: COR_VERSAO.autor },
  autor: { fontSize: 11, fontWeight: '700', color: COR_VERSAO.autor },
  linhaDaData: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 },
  data: { fontSize: 9, color: COR_VERSAO.data },
  marcado: { fontSize: 9, fontWeight: '800', color: COR_VERSAO.marcado },
  fala: { fontSize: 11, lineHeight: 17, color: COR_VERSAO.fala, marginTop: 9 },
  campo: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 18, padding: 8, borderRadius: 9,
    borderWidth: 1, borderColor: COR_VERSAO.campoContorno, backgroundColor: COR_VERSAO.campoFundo,
  },
  campoEntrada: { flex: 1, minWidth: 0, fontSize: 10, color: COR_VERSAO.autor },
  enviar: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR.primaria,
  },
  enviarApagado: { opacity: 0.45 },
  erro: { paddingHorizontal: 18, paddingTop: 12, fontSize: 11, color: COR.erro },
});
