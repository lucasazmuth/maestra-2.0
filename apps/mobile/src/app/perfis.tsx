import { Link, Redirect } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND, BRAND_ONYX } from '@maestra/core/constants/brand';
import type { Artist } from '@maestra/core/interfaces/maestra';
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
  const { items, loading, loaded } = useAppSelector((s) => s.artists);

  const usuario = sessao?.user.id;
  useEffect(() => {
    if (usuario) dispatch(artistsActions.fetchArtists(usuario));
  }, [usuario, dispatch]);

  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;

  return (
    <SafeAreaView style={estilos.tela}>
      <View style={estilos.cabecalho}>
        <View style={estilos.flex}>
          <Text style={estilos.marca}>Seus perfis</Text>
          <Text style={estilos.legenda}>{sessao?.user.email}</Text>
        </View>
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
            refreshing={loading && loaded}
            onRefresh={() => usuario && dispatch(artistsActions.fetchArtists(usuario))}
            tintColor={BRAND}
          />
        }
        ListEmptyComponent={
          loading && !loaded
            ? <ActivityIndicator color={BRAND} style={estilos.espera} />
            : <Text style={estilos.vazio}>Nenhum perfil ainda.</Text>
        }
        renderItem={({ item }) => (
          <Link href={{ pathname: '/perfil/[id]', params: { id: item.id } }} asChild>
            <Pressable style={({ pressed }) => [estilos.cartao, pressed && estilos.pressionado]}>
              <Avatar artista={item} />
              <View style={estilos.flex}>
                <Text style={estilos.nome} numberOfLines={1}>{item.name}</Text>
                <Selo artista={item} />
              </View>
              <Text style={estilos.seta}>›</Text>
            </Pressable>
          </Link>
        )}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  marca: { fontSize: 28, fontWeight: '800', color: BRAND_ONYX, letterSpacing: -0.5 },
  legenda: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  sair: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
  lista: { paddingHorizontal: 24, paddingBottom: 32, gap: 10 },
  espera: { marginTop: 40 },
  vazio: { textAlign: 'center', color: '#9ca3af', marginTop: 40, fontSize: 15 },
  cartao: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 16, padding: 14,
  },
  pressionado: { opacity: 0.6 },
  foto: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#f3f4f6' },
  fotoVazia: { alignItems: 'center', justifyContent: 'center' },
  inicial: { fontSize: 20, fontWeight: '800', color: '#9ca3af' },
  nome: { fontSize: 17, fontWeight: '700', color: BRAND_ONYX },
  selo: { marginTop: 4, gap: 3 },
  perfilNome: { fontSize: 13, color: BRAND, fontWeight: '600' },
  letras: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  letra: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  acesa: { color: BRAND },
  apagada: { color: '#d1d5db' },
  contagem: { fontSize: 11, color: '#9ca3af', marginLeft: 2 },
  semDiagnostico: { fontSize: 13, color: '#9ca3af', marginTop: 4 },
  seta: { fontSize: 26, color: '#d1d5db', marginTop: -2 },
});
