import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_CATALOGO, RAIO } from '@maestra/core/constants/design';
import { CATALOG_STATUS } from '@maestra/core/constants/maestra';
import type { CatalogItem } from '@maestra/core/interfaces/maestra';
import { listCatalogProjectItems } from '@maestra/core/services/db/catalog';

import { useArtistaDaRota } from '@/nucleo/artista';

// O Catálogo.
//
// A web desenha a forma de onda (wavesurfer) porque la a interacao e de mesa: arrastar dentro do
// audio para achar um trecho. No celular o gesto util e outro — tocar, pausar e saber quanto
// falta. A barra de progresso e o equivalente honesto, e a forma de onda fica de fora ate
// alguem precisar dela de verdade no aparelho.
//
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

  const [faixas, setFaixas] = useState<CatalogItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tocandoId, setTocandoId] = useState<string | null>(null);

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

  const alternar = (faixa: CatalogItem) => {
    if (!faixa.audio_file) return;
    if (tocandoId === faixa.id) {
      if (status.playing) player.pause();
      else player.play();
      return;
    }
    player.replace({ uri: faixa.audio_file });
    player.play();
    setTocandoId(faixa.id);
  };

  const emFoco = faixas.find((f) => f.id === tocandoId);
  const vazio = !carregando && faixas.length === 0;

  return (
    <View style={estilos.tela}>

      {/* O cabecalho e o da web, com as MESMAS palavras: o modulo se chama "Musicas", nao
          "Catalogo" — e a aba de baixo ja dizia "Musicas", entao a tela se contradizia. */}
      <View style={estilos.cabecalho}>
        <Text style={estilos.sobretitulo}>MÚSICAS DO ARTISTA</Text>
        <Text style={estilos.titulao}>Músicas</Text>
        <Text style={estilos.subtitulo}>
          Organize as músicas em preparação e acompanhe cada etapa antes do lançamento.
        </Text>
      </View>

      {carregando ? (
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
                style={({ pressed }) => [estilos.linha, pressed && temAudio && estilos.pressionada]}
                onPress={() => alternar(item)}
                disabled={!temAudio}
                accessibilityRole="button"
                accessibilityLabel={
                  temAudio
                    ? `${eAtual && status.playing ? 'Pausar' : 'Tocar'} ${item.title}`
                    : `${item.title}, sem áudio`
                }
              >
                <Capa faixa={item} />
                <View style={estilos.flex}>
                  <Text style={estilos.titulo} numberOfLines={1}>{item.title}</Text>
                  <View style={estilos.meta}>
                    {!!rotulo && (
                      <Text style={[estilos.status, { color: rotulo.color }]}>{rotulo.label}</Text>
                    )}
                    {!!item.duration && <Text style={estilos.duracao}>{item.duration}</Text>}
                  </View>
                </View>
                <View style={estilos.botao}>
                  <Feather
                    name={eAtual && status.playing ? 'pause' : 'play'}
                    size={18}
                    color={temAudio ? COR_CATALOGO.tocarIcone : COR.contorno}
                  />
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {!!emFoco && (
        <View style={estilos.barra}>
          <View style={estilos.trilho}>
            <View
              style={[
                estilos.progresso,
                { width: `${status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0}%` },
              ]}
            />
          </View>
          <View style={estilos.barraLinha}>
            <Text style={estilos.barraTitulo} numberOfLines={1}>{emFoco.title}</Text>
            <Text style={estilos.barraTempo}>
              {tempo(status.currentTime)} / {tempo(status.duration)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1 },
  cabecalho: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 30, marginHorizontal: 0,
    borderBottomWidth: 1, borderBottomColor: COR_CATALOGO.contornoDoTopo,
  },
  sobretitulo: {
    fontSize: 9, fontWeight: '800', color: COR_CATALOGO.rotulo, marginBottom: 8,
  },
  titulao: { fontSize: 27, fontWeight: '800', color: COR_CATALOGO.titulo },
  subtitulo: { fontSize: 12, color: COR_CATALOGO.apoio, lineHeight: 18, marginTop: 9 },
  espera: { marginTop: 48 },
  conteudo: { paddingHorizontal: 16, paddingTop: 28, paddingBottom: 122 },
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
  titulo: { fontSize: 15, fontWeight: '700', color: COR_CATALOGO.titulo },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  status: { fontSize: 12, fontWeight: '700' },
  duracao: { fontSize: 12, color: COR_CATALOGO.legenda },
  // O tocar e discreto: azul-claro com o icone cinza-azulado, e nao o azul de acao cheio.
  botao: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_CATALOGO.tocarFundo,
  },
  barra: { borderTopWidth: 1, borderTopColor: COR.divisoria, paddingHorizontal: 24, paddingTop: 10, paddingBottom: 6, gap: 8 },
  trilho: { height: 3, borderRadius: 2, backgroundColor: COR.divisoria, overflow: 'hidden' },
  progresso: { height: 3, backgroundColor: COR.primaria },
  barraLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  barraTitulo: { flex: 1, fontSize: 13, fontWeight: '600', color: COR.titulo },
  barraTempo: { fontSize: 12, color: COR.apagado, fontVariant: ['tabular-nums'] },
  aviso: { borderWidth: 1, borderColor: COR_CATALOGO.contornoDoTopo, borderRadius: 8, padding: 18, gap: 6, marginHorizontal: 16 },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR_CATALOGO.titulo },
  avisoTexto: { fontSize: 13, color: COR_CATALOGO.apoio, lineHeight: 20 },
});
