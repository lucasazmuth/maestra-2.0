import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Linking, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_BARRA, COR_CATALOGO, RAIO, SOMBRA } from '@maestra/core/constants/design';
import { CATALOG_STATUS } from '@maestra/core/constants/maestra';
import type { CatalogItem } from '@maestra/core/interfaces/maestra';
import { listCatalogProjectItems } from '@maestra/core/services/db/catalog';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { BotaoFlutuante } from '@/casca/BotaoFlutuante';
import { CabecalhoDoModulo, FOLGA_APOS_O_CABECALHO } from '@/casca/CabecalhoDoModulo';
import { FichaDaFaixa } from '@/casca/musicas/FichaDaFaixa';
import { EspacoJamIcon } from '@/icones';
import { useArtistaDaRota } from '@/nucleo/artista';
import { useSessao } from '@/nucleo/sessao';

type Aba = 'musicas' | 'lancamentos';

/** `189000` → `3:09`. A duração do Spotify vem em milissegundos. */
const duracaoDoSpotify = (ms?: number) => {
  if (!ms) return '';
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// O Catálogo.
//
// A web desenha a forma de onda (wavesurfer) porque la a interacao e de mesa: arrastar dentro do
// audio para achar um trecho. No celular o gesto util e outro — tocar, pausar e saber quanto
// falta. A barra de progresso e o equivalente honesto, e a forma de onda fica de fora ate
// alguem precisar dela de verdade no aparelho.
//
/**
 * A caixa do player, em números, porque DUAS coisas dependem dela.
 *
 * Ela desenha a barra e também diz ao botão flutuante até onde subir: os dois moram no mesmo
 * canto de baixo à direita, e enquanto isto era um `106` solto dentro do estilo o botão ficava
 * por cima da barra, cobrindo o "próxima faixa".
 *
 * 106 é a conta da web, que não tem margem segura — por isso a margem do aparelho é somada na
 * hora de posicionar. 64 é o `minHeight` da barra, e as duas medidas precisam continuar
 * andando juntas.
 */
const PLAYER_DEBAIXO = 106;
const ALTURA_DO_PLAYER = 64;

// Um player so para a tela inteira, e nao um por linha: dois audios tocando juntos e o defeito
// classico de lista com som, e um player unico o torna impossivel por construcao.

const tempo = (segundos: number) => {
  if (!Number.isFinite(segundos) || segundos < 0) return '0:00';
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const Capa = ({ faixa }: { faixa: CatalogItem }) =>
  faixa.cover_image ? (
    <Image source={{ uri: faixa.cover_image }} style={estilos.capa} />
  ) : (
    <View style={[estilos.capa, estilos.capaVazia]}>
      <Feather name="music" size={18} color={COR.apagado} />
    </View>
  );

export default function Catalogo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const artista = useArtistaDaRota(id);
  const direitos = useArtistCapabilities(artista);

  const [faixas, setFaixas] = useState<CatalogItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tocandoId, setTocandoId] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>('musicas');
  const [fichaAberta, setFichaAberta] = useState(false);
  const [editando, setEditando] = useState<CatalogItem | null>(null);

  const margem = useSafeAreaInsets();
  const { sessao } = useSessao();
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const buscar = useCallback(async () => {
    if (!id) return;
    setErro(null);
    try {
      setFaixas(await listCatalogProjectItems(String(id)));
    } catch {
      setErro('Não foi possível carregar o catálogo.');
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  // Ao terminar, a faixa deixa de estar "tocando" — senao o botao fica em pause para sempre.
  useEffect(() => {
    if (status.didJustFinish) setTocandoId(null);
  }, [status.didJustFinish]);

  /** Só as faixas com áudio entram na fila: pular para uma sem arquivo pararia o player. */
  const naFila = faixas.filter((f) => f.audio_file);

  const tocar = (faixa: CatalogItem) => {
    player.replace({ uri: faixa.audio_file! });
    player.play();
    setTocandoId(faixa.id);
  };

  /** Anterior e próximo dão a volta na lista, como o player da web. */
  const pular = (passo: number) => {
    if (!naFila.length) return;
    const atual = naFila.findIndex((f) => f.id === tocandoId);
    const proxima = naFila[(atual + passo + naFila.length) % naFila.length];
    if (proxima) tocar(proxima);
  };

  const fechar = () => {
    player.pause();
    setTocandoId(null);
  };

  const alternar = (faixa: CatalogItem) => {
    if (!faixa.audio_file) return;
    if (tocandoId === faixa.id) {
      if (status.playing) player.pause();
      else player.play();
      return;
    }
    tocar(faixa);
  };

  const emFoco = faixas.find((f) => f.id === tocandoId);
  const vazio = !carregando && faixas.length === 0;
  // A aba Lançamentos lista o que veio do Spotify: outra lista, mas ainda músicas. Ela sai do
  // `content` do artista, e não do banco do catálogo — são coisas diferentes, e a web mantém as
  // duas na mesma tela justamente porque quem procura uma música não sabe de qual lista ela é.
  const lancamentos = artista?.content?.spotifyCatalog?.tracks ?? [];
  // Os gêneros que o artista já usou, como atalho na ficha.
  const generos = [...new Set(faixas.map((f) => f.genre).filter(Boolean) as string[])];

  const guardar = (salva: CatalogItem) =>
    setFaixas((antes) => {
      const i = antes.findIndex((f) => f.id === salva.id || f.project_id === salva.project_id);
      if (i === -1) return [salva, ...antes];
      const proximo = antes.slice();
      proximo[i] = salva;
      return proximo;
    });

  const remover = (removidaId: string) =>
    setFaixas((antes) => antes.filter((f) => f.id !== removidaId));

  const abrirFicha = (faixa: CatalogItem | null) => {
    setEditando(faixa);
    setFichaAberta(true);
  };

  return (
    <View style={estilos.tela}>

      {/* O cabecalho e o da web, com as MESMAS palavras: o modulo se chama "Musicas", nao
          "Catalogo" — e a aba de baixo ja dizia "Musicas", entao a tela se contradizia. */}
      <View style={estilos.cabecalho}>
        <CabecalhoDoModulo
          titulo="Músicas"
          descricao="Organize as músicas em preparação e acompanhe cada etapa antes do lançamento."
        />
      </View>

      {/* As duas abas: o catálogo cadastrado aqui e o que já saiu no Spotify.
          O limite do plano vive NO RÓTULO da aba de músicas, e não numa linha própria no
          cabeçalho: ele é sobre a lista que a aba abre, e ali fica ao lado do que conta. Some
          para quem tem o PRO — sem teto não há o que contar, e um "5/∞" só ocuparia espaço
          dizendo que não há limite. */}
      <View style={estilos.abas}>
        {([['musicas', 'Músicas'], ['lancamentos', 'Lançamentos']] as const).map(([chave, texto]) => {
          const acesa = aba === chave;
          const comLimite = chave === 'musicas' && direitos.maxCatalogTracks !== Infinity;
          return (
            <Pressable
              key={chave}
              style={[estilos.aba, acesa && estilos.abaAcesa]}
              onPress={() => setAba(chave)}
              accessibilityRole="tab"
              accessibilityState={{ selected: acesa }}
              accessibilityLabel={comLimite
                ? `${texto}: ${faixas.length} de ${direitos.maxCatalogTracks} do seu plano`
                : texto}
            >
              <Text style={[estilos.abaTexto, acesa && estilos.abaTextoAceso]}>
                {texto}
                {comLimite && (
                  <Text style={[estilos.abaLimite, acesa && estilos.abaLimiteAceso]}>
                    {` ${faixas.length}/${direitos.maxCatalogTracks}`}
                  </Text>
                )}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {aba === 'lancamentos' ? (
        <FlatList
          data={lancamentos}
          keyExtractor={(t) => t.id ?? t.name}
          contentContainerStyle={estilos.conteudo}
          ListHeaderComponent={lancamentos.length ? <View style={estilos.topoDaLista} /> : null}
          ListFooterComponent={lancamentos.length ? <View style={estilos.baseDaLista} /> : null}
          ListEmptyComponent={
            <View style={estilos.aviso}>
              <Text style={estilos.avisoTitulo}>Nenhum lançamento</Text>
              <Text style={estilos.avisoTexto}>
                Nenhum lançamento publicado no Spotify vinculado a este artista.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              style={estilos.linha}
              onPress={() => item.spotify_url && Linking.openURL(item.spotify_url)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}. Abrir no Spotify`}
            >
              <View style={estilos.botao}>
                <Feather name="play" size={16} color={COR_CATALOGO.tocarIcone} />
              </View>
              {item.album_image
                ? <Image source={{ uri: item.album_image }} style={estilos.capa} />
                : <View style={[estilos.capa, estilos.capaVazia]}>
                    <Feather name="music" size={18} color={COR.apagado} />
                  </View>}
              <View style={estilos.flex}>
                <Text style={estilos.titulo} numberOfLines={1}>{item.name}</Text>
                <Text style={estilos.versao} numberOfLines={1}>{item.album || 'Spotify'}</Text>
              </View>
              {!!item.duration_ms && (
                <Text style={estilos.duracao}>{duracaoDoSpotify(item.duration_ms)}</Text>
              )}
            </Pressable>
          )}
        />
      ) : carregando ? (
        <ActivityIndicator color={COR.primaria} style={estilos.espera} size="large" />
      ) : vazio || erro ? (
        <View style={estilos.conteudo}>
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>{erro ? 'Catálogo indisponível' : 'Nenhuma música ainda'}</Text>
            <Text style={estilos.avisoTexto}>
              {erro ?? 'Músicas cadastradas na web aparecem aqui, com o áudio da versão principal.'}
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={faixas}
          keyExtractor={(f) => f.id}
          contentContainerStyle={estilos.conteudo}
          // O contorno e da LISTA, e nao de cada faixa: no celular a web troca os cartoes soltos
          // por uma lista continua dentro de uma moldura so.
          ListHeaderComponent={<View style={estilos.topoDaLista} />}
          ListFooterComponent={<View style={estilos.baseDaLista} />}
          refreshControl={<RefreshControl refreshing={false} onRefresh={buscar} tintColor={COR.primaria} />}
          renderItem={({ item }) => {
            const rotulo = CATALOG_STATUS[item.status as keyof typeof CATALOG_STATUS];
            const eAtual = tocandoId === item.id;
            const temAudio = !!item.audio_file;
            return (
              <Pressable
                style={({ pressed }) => [estilos.linha, pressed && estilos.pressionada]}
                // A linha abre o ESPAÇO JAM, como na web: a lista é o índice das músicas, e a
                // música em si mora lá. Tocar é o botão da esquerda, e editar é o "⋮" — três
                // intenções, três alvos. Antes a linha inteira tocava, e não havia como chegar
                // ao Espaço Jam pelo app.
                onPress={() => router.push(`/jam/${id}/${item.project_id || item.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Abrir o Espaço JAM de ${item.title}`}
              >
                {/* O tocar fica a ESQUERDA e e o primeiro elemento da linha, como na web — a
                    capa quadrada que estava aqui nao existe la. */}
                <Pressable
                  style={estilos.botao}
                  onPress={() => alternar(item)}
                  disabled={!temAudio}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={
                    temAudio
                      ? `${eAtual && status.playing ? 'Pausar' : 'Tocar'} ${item.title}`
                      : `${item.title}, sem áudio`
                  }
                >
                  <Feather
                    name={eAtual && status.playing ? 'pause' : 'play'}
                    size={16}
                    color={temAudio ? COR_CATALOGO.tocarIcone : COR.contorno}
                  />
                </Pressable>
                <View style={estilos.flex}>
                  <Text style={estilos.titulo} numberOfLines={1}>{item.title}</Text>
                  {/* A legenda junta versão, gênero e lançamento numa linha só, como na web. */}
                  <Text style={estilos.versao} numberOfLines={1}>
                    {[
                      `V${item.version_number || 1}${item.audio_file ? ' · versão principal' : ' · áudio pendente'}`,
                      item.genre,
                      item.release_date
                        ? new Date(`${item.release_date}T00:00:00`)
                          .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                        : null,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                {!!rotulo && (
                  <View style={[estilos.status, { backgroundColor: `${rotulo.color}22` }]}>
                    <Text style={[estilos.statusTexto, { color: rotulo.color }]}>{rotulo.label}</Text>
                  </View>
                )}
                {/* A linha inteira já abre o Espaço Jam, mas isso não se descobre olhando —
                    o botão nomeia o destino. O rótulo "Espaço Jam" que a web mostra no desktop
                    sai no celular (custava 107px dos 319 da linha); o ícone fica, senão o
                    atalho desaparece: não há `title` que se revele no toque. */}
                <Pressable
                  style={estilos.jam}
                  onPress={() => router.push(`/jam/${id}/${item.project_id || item.id}`)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir o Espaço Jam de ${item.title}`}
                >
                  <EspacoJamIcon size={15} color={COR_CATALOGO.jam} />
                </Pressable>

                {/* O "⋮" abre a ficha para editar, como na web. Ele fica fora do toque da linha:
                    tocar na linha toca a música, e editar é outra intenção. */}
                {direitos.canEditCatalog && (
                  <Pressable
                    style={estilos.mais}
                    onPress={() => abrirFicha(item)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Editar ${item.title}`}
                  >
                    <Feather name="more-vertical" size={18} color={COR_CATALOGO.legenda} />
                  </Pressable>
                )}
              </Pressable>
            );
          }}
        />
      )}

      {!!artista && (
        <FichaDaFaixa
          aberta={fichaAberta}
          artistaId={artista.id}
          faixa={editando}
          generos={generos}
          autor={{ id: sessao?.user.id, nome: sessao?.user.user_metadata?.full_name }}
          aoFechar={() => setFichaAberta(false)}
          aoSalvar={guardar}
          aoExcluir={remover}
          // Anexar versão muda o áudio principal da faixa: a lista precisa reler para o play
          // apontar para o arquivo novo.
          aoMudarVersoes={buscar}
        />
      )}

      {/* O player e uma ILHA flutuante logo acima da barra de navegacao, com a mesma forma
          dela: 22 de folga nos lados, canto de 22 e a mesma sombra. Era uma faixa colada no
          rodape, sem capa e sem controles. */}
      {!!emFoco && (
        // A ilha de navegação sobe com a margem segura do aparelho; o player precisa subir
        // junto, senão ele fica ATRÁS dela. Ver `PLAYER_DEBAIXO`.
        <View style={[estilos.player, { bottom: PLAYER_DEBAIXO + margem.bottom }]}>
          <View style={estilos.capaDoPlayer}>
            {emFoco.cover_image
              ? <Image source={{ uri: emFoco.cover_image }} style={estilos.capaDoPlayerImagem} />
              : <Feather name="music" size={17} color={COR_CATALOGO.tocarIcone} />}
          </View>

          <View style={estilos.flex}>
            <Text style={estilos.playerTitulo} numberOfLines={1}>{emFoco.title}</Text>
            <Text style={estilos.playerTempo}>
              {tempo(status.currentTime)} / {tempo(status.duration)}
            </Text>
          </View>

          <Pressable
            onPress={() => pular(-1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Anterior"
          >
            <Feather name="skip-back" size={18} color={COR_CATALOGO.tocarIcone} />
          </Pressable>

          <Pressable
            style={estilos.playerBotao}
            onPress={() => alternar(emFoco)}
            accessibilityRole="button"
            accessibilityLabel={status.playing ? 'Pausar' : 'Tocar'}
          >
            <Feather
              name={status.playing ? 'pause' : 'play'}
              size={18}
              color={COR.sobrePrimaria}
            />
          </Pressable>

          <Pressable
            onPress={() => pular(1)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Próxima"
          >
            <Feather name="skip-forward" size={18} color={COR_CATALOGO.tocarIcone} />
          </Pressable>

          <Pressable
            onPress={fechar}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Fechar player"
          >
            <Feather name="x" size={18} color={COR_CATALOGO.legenda} />
          </Pressable>

          {/* O progresso e um fio no rodape da ilha, como na web. */}
          <View style={estilos.trilho}>
            <View
              style={[
                estilos.progresso,
                { width: `${status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0}%` },
              ]}
            />
          </View>
        </View>
      )}

      {direitos.canEditCatalog && (
        <BotaoFlutuante
          rotulo="Nova música"
          aoTocar={() => abrirFicha(null)}
          // Com o player aberto o botão sobe para cima dele. Os dois moram no mesmo canto de
          // baixo à direita, e o botão ficava por cima da barra, cobrindo o "próxima faixa".
          acimaDe={emFoco ? PLAYER_DEBAIXO + margem.bottom + ALTURA_DO_PLAYER : 0}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1 },
  /** Só o recuo lateral: o resto do cabeçalho é do `CabecalhoDoModulo`. */
  cabecalho: { paddingHorizontal: 16 },
  abas: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16,
    paddingTop: FOLGA_APOS_O_CABECALHO,
  },
  aba: {
    paddingVertical: 11, paddingHorizontal: 18,
    borderRadius: 7, backgroundColor: COR_CATALOGO.tocarFundo,
  },
  abaAcesa: { backgroundColor: COR.primaria },
  abaTexto: { fontSize: 13, fontWeight: '800', color: COR_CATALOGO.tocarIcone },
  abaTextoAceso: { color: COR.sobrePrimaria },
  // O limite é um dado, não um rótulo: peso menor e cor mais apagada que o nome da aba, para
  // ser lido depois dele e não competir com ele.
  abaLimite: { fontWeight: '700', color: COR_CATALOGO.legenda },
  abaLimiteAceso: { color: COR.sobrePrimaria, opacity: 0.75 },
  // A pílula do Espaço Jam, medida no DOM a 375px: 31px de altura, raio 20, contorno de 1px e
  // fundo branco. O rótulo sai no celular — ele custava um terço da linha.
  jam: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_CATALOGO.jamContorno,
    backgroundColor: COR_CATALOGO.jamFundo,
  },
  mais: { width: 28, alignItems: 'center', justifyContent: 'center' },
  espera: { marginTop: 48 },
  // 196 = a ilha (34 de reserva + 78) mais o botão flutuante (14 de folga + 56) e mais 14. Eram
  // 122, que só vencia a ilha: a última linha da lista ficava permanentemente debaixo do botão,
  // com os controles dela inalcançáveis por mais que se rolasse.
  conteudo: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 196 },
  // A moldura da lista, em duas metades: o topo fecha os cantos de cima, o rodape os de baixo.
  // E o jeito de dar UM contorno a uma lista que rola sem envolver o `FlatList` numa `View`,
  // que tiraria a virtualizacao.
  topoDaLista: {
    height: 1, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: COR_CATALOGO.contornoDoTopo,
    borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: COR.superficie,
  },
  baseDaLista: {
    height: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: COR_CATALOGO.contornoDoTopo,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: COR.superficie,
  },
  // Lista continua: faixa branca de 78px separada por um fio, sem contorno e sem canto. E a
  // diferenca entre uma LISTA e uma pilha de caixas — no celular a web troca uma pela outra.
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 78, paddingVertical: 12, paddingHorizontal: 10,
    // As laterais sao a moldura da lista; o fio de baixo separa uma faixa da seguinte. A cor
    // especifica vem DEPOIS da geral, senao a geral apagaria o fio.
    borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
    borderColor: COR_CATALOGO.contornoDoTopo,
    borderBottomColor: COR_CATALOGO.fio,
    backgroundColor: COR.superficie,
  },
  pressionada: { opacity: 0.6 },
  capa: { width: 48, height: 48, borderRadius: 6, backgroundColor: COR.divisoria },
  capaVazia: { alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 14, fontWeight: '600', color: COR_CATALOGO.titulo },
  versao: { fontSize: 13, color: COR_CATALOGO.legenda, marginTop: 2 },
  // O selo do status usa a cor do proprio status com o fundo numa transparencia dela — o `22`
  // e o alpha em hex, o mesmo truque da web.
  status: {
    justifyContent: 'center', paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: RAIO.pilula, flexShrink: 0,
  },
  statusTexto: { fontSize: 11, fontWeight: '700' },
  duracao: { fontSize: 12, color: COR_CATALOGO.legenda },
  // O tocar e discreto: azul-claro com o icone cinza-azulado, e nao o azul de acao cheio.
  botao: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_CATALOGO.tocarFundo,
  },
  // A ilha do player: a MESMA forma da barra de navegacao (22 de folga, canto 22, mesma
  // sombra), logo acima dela.
  player: {
    position: 'absolute', left: 22, right: 22,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    minHeight: ALTURA_DO_PLAYER, paddingVertical: 8, paddingLeft: 12, paddingRight: 10,
    borderRadius: 22, backgroundColor: COR_BARRA.ilha,
    borderWidth: 1, borderColor: COR_BARRA.contornoDaIlha,
    ...SOMBRA.ilha,
  },
  capaDoPlayer: {
    width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_CATALOGO.tocarFundo, overflow: 'hidden',
  },
  capaDoPlayerImagem: { width: 38, height: 38 },
  playerTitulo: { fontSize: 14, color: COR_CATALOGO.titulo },
  playerTempo: { fontSize: 11, color: COR_CATALOGO.legenda, marginTop: 2 },
  playerBotao: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR.primaria,
  },
  trilho: {
    position: 'absolute', left: 16, right: 16, bottom: 3,
    height: 2, borderRadius: 1, backgroundColor: COR.divisoria, overflow: 'hidden',
  },
  progresso: { height: 2, backgroundColor: COR.primaria },
  aviso: { borderWidth: 1, borderColor: COR_CATALOGO.contornoDoTopo, borderRadius: 8, padding: 18, gap: 6, marginHorizontal: 16 },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR_CATALOGO.titulo },
  avisoTexto: { fontSize: 13, color: COR_CATALOGO.apoio, lineHeight: 20 },
});
