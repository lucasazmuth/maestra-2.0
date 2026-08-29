import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import { COR, RAIO } from '@maestra/core/constants/design';
import type { Artist } from '@maestra/core/interfaces/maestra';
import { countUnread } from '@maestra/core/services/db/notifications';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import { sair } from '@/nucleo/entrar';
import { useSessao } from '@/nucleo/sessao';

// Os perfis do usuario.
//
// Quem busca, guarda e ordena e o mesmo thunk que a web usa — `fetchArtists`, do slice de
// artistas. Nao ha servico proprio do app aqui: se a regra mudar, muda nos dois de uma vez.

const inicial = (nome: string) => (nome.trim()[0] ?? '?').toUpperCase();

const Avatar = ({ artista }: { artista: Artist }) => {
  const foto = artista.content?.spotifyProfile?.image;
  if (foto) return <Image source={{ uri: foto }} style={estilos.foto} />;
  return (
    <View style={[estilos.foto, estilos.fotoVazia]}>
      <Text style={estilos.inicial}>{inicial(artista.name)}</Text>
    </View>
  );
};

/** O selo R·E·A·L, quando o perfil ja tem diagnostico. */
const Selo = ({ artista }: { artista: Artist }) => {
  const real = artista.content?.realIndex;
  if (!real?.profile) return <Text style={estilos.semDiagnostico}>Sem diagnóstico</Text>;

  const acesas = (['r', 'e', 'a', 'l'] as const).filter((d) => real.pattern?.[d]);
  return (
    <View style={estilos.selo}>
      <Text style={estilos.perfilNome}>{real.profile.name}</Text>
      <View style={estilos.letras}>
        {(['R', 'E', 'A', 'L'] as const).map((letra, i) => {
          const chave = (['r', 'e', 'a', 'l'] as const)[i];
          const acesa = !!real.pattern?.[chave];
          return (
            <Text key={letra} style={[estilos.letra, acesa ? estilos.acesa : estilos.apagada]}>
              {letra}
            </Text>
          );
        })}
        <Text style={estilos.contagem}>{acesas.length}/4</Text>
      </View>
    </View>
  );
};

export default function Perfis() {
  const { sessao, carregando: carregandoSessao } = useSessao();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { items, loading, loaded } = useAppSelector((s) => s.artists);

  const usuario = sessao?.user.id;
  const [naoLidas, setNaoLidas] = useState(0);
  // Separado do `loading` do store de propósito: `loading` fica true em QUALQUER busca,
  // inclusive na que roda sozinha ao voltar para esta tela. Ligado ao RefreshControl, isso
  // fazia um spinner de "puxar para atualizar" aparecer sem ninguém ter puxado nada — e ainda
  // empurrava a lista para baixo, com o conteúdo já na tela.
  const [puxando, setPuxando] = useState(false);

  const puxarParaAtualizar = async () => {
    if (!usuario) return;
    setPuxando(true);
    try {
      await dispatch(artistsActions.fetchArtists(usuario));
    } finally {
      setPuxando(false);
    }
  };

  useEffect(() => {
    if (usuario) dispatch(artistsActions.fetchArtists(usuario));
  }, [usuario, dispatch]);

  useEffect(() => {
    if (!usuario) return;
    // Falha em silêncio de propósito: a contagem é um enfeite do cabeçalho, e derrubar a lista
    // de perfis por causa dela seria trocar o essencial pelo acessório.
    countUnread(usuario).then(setNaoLidas).catch(() => undefined);
  }, [usuario]);

  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;

  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <View style={estilos.flex}>
          <Text style={estilos.marca}>Seus perfis</Text>
          <Text style={estilos.legenda}>{sessao?.user.email}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/notificacoes')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={
            naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : 'Notificações'
          }
        >
          <View>
            <Feather name="bell" size={21} color={COR.secundario} />
            {naoLidas > 0 && (
              <View style={estilos.bolha}>
                <Text style={estilos.bolhaTexto}>{naoLidas > 9 ? '9+' : naoLidas}</Text>
              </View>
            )}
          </View>
        </Pressable>
        <Pressable onPress={sair} hitSlop={12}>
          <Text style={estilos.sair}>Sair</Text>
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        contentContainerStyle={estilos.lista}
        refreshControl={
          <RefreshControl
            refreshing={puxando}
            onRefresh={puxarParaAtualizar}
            tintColor={COR.primaria}
          />
        }
        ListEmptyComponent={
          loading && !loaded
            ? <ActivityIndicator color={COR.primaria} style={estilos.espera} />
            : <Text style={estilos.vazio}>Nenhum perfil ainda.</Text>
        }
        renderItem={({ item }) => (
          // Navegacao por `router.push`, e nao por `<Link asChild>`.
          //
          // O `Link asChild` monta o filho pelo Slot do Radix, que funde `style` como OBJETO.
          // Estilo de `Pressable` e uma FUNCAO (`({ pressed }) => [...]`), e espalhar funcao em
          // objeto da `{}` — o cartao perdia borda e `flexDirection: row` sem erro nenhum, e o
          // sintoma so aparece com dado real na tela.
          <Pressable
            style={({ pressed }) => [estilos.cartao, pressed && estilos.pressionado]}
            onPress={() => router.push({ pathname: '/perfil/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            <Avatar artista={item} />
            <View style={estilos.flex}>
              <Text style={estilos.nome} numberOfLines={1}>{item.name}</Text>
              <Selo artista={item} />
            </View>
            <Feather name="chevron-right" size={22} color={COR.contorno} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.superficie },
  flex: { flex: 1 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  marca: { fontSize: 28, fontWeight: '800', color: COR.titulo, letterSpacing: -0.5 },
  legenda: { fontSize: 13, color: COR.apagado, marginTop: 2 },
  sair: { fontSize: 15, fontWeight: '600', color: COR.secundario },
  bolha: {
    position: 'absolute', top: -4, right: -8, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: RAIO.pilula, backgroundColor: COR.primaria,
    alignItems: 'center', justifyContent: 'center',
  },
  bolhaTexto: { fontSize: 11, fontWeight: '800', color: COR.sobrePrimaria },
  lista: { paddingHorizontal: 24, paddingBottom: 32, gap: 10 },
  espera: { marginTop: 40 },
  vazio: { textAlign: 'center', color: COR.apagado, marginTop: 40, fontSize: 15 },
  cartao: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: COR.contorno, borderRadius: 16, padding: 14,
  },
  pressionado: { opacity: 0.6 },
  foto: { width: 52, height: 52, borderRadius: 26, backgroundColor: COR.divisoria },
  fotoVazia: { alignItems: 'center', justifyContent: 'center' },
  inicial: { fontSize: 20, fontWeight: '800', color: COR.apagado },
  nome: { fontSize: 17, fontWeight: '700', color: COR.titulo },
  selo: { marginTop: 4, gap: 3 },
  perfilNome: { fontSize: 13, color: COR.primaria, fontWeight: '600' },
  letras: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  letra: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  acesa: { color: COR.primaria },
  apagada: { color: COR.contorno },
  contagem: { fontSize: 11, color: COR.apagado, marginLeft: 2 },
  semDiagnostico: { fontSize: 13, color: COR.apagado, marginTop: 4 },
});
