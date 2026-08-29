import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import { COR, RAIO, COR_PERFIS } from '@maestra/core/constants/design';
import type { Artist } from '@maestra/core/interfaces/maestra';
import { countUnread } from '@maestra/core/services/db/notifications';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
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
        <Pressable
          onPress={() => router.push('/conta')}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Conta"
        >
          <Feather name="user" size={21} color={COR.secundario} />
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
            onPress={() => router.push({ pathname: '/artista/[id]', params: { id: item.id } })}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            {/* Centrado, com a foto grande no meio: e a leitura de um seletor de perfil, e nao
                a de uma lista de itens. E o que a web faz. */}
            <Avatar artista={item} />
            <Text style={estilos.nome} numberOfLines={2}>{item.name}</Text>
            <Text style={estilos.papel}>
              {item.role === 'member' ? 'Membro' : 'Administrador'}
            </Text>
            <Selo artista={item} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 34 },
  marca: { fontSize: 30, fontWeight: '800', color: COR_PERFIS.titulo, letterSpacing: -1.2 },
  legenda: { fontSize: 15, color: COR_PERFIS.papel, marginTop: 14 },
  bolha: {
    position: 'absolute', top: -4, right: -8, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: RAIO.pilula, backgroundColor: COR.primaria,
    alignItems: 'center', justifyContent: 'center',
  },
  bolhaTexto: { fontSize: 11, fontWeight: '800', color: COR.sobrePrimaria },
  lista: { paddingHorizontal: 18, paddingBottom: 32, gap: 26 },
  espera: { marginTop: 40 },
  vazio: { textAlign: 'center', color: COR.apagado, marginTop: 40, fontSize: 15 },
  cartao: {
    minHeight: 300, padding: 22, borderRadius: 10, justifyContent: 'center',
    backgroundColor: COR.superficie,
    // A sombra baixa da web (`0 7px 17px rgba(124,145,185,.08)`), no lugar do contorno.
    shadowColor: 'rgb(124, 145, 185)', shadowOpacity: 0.08, shadowRadius: 17,
    shadowOffset: { width: 0, height: 7 }, elevation: 3,
  },
  pressionado: { opacity: 0.6 },
  foto: { width: 140, height: 140, borderRadius: 70, backgroundColor: COR.divisoria, alignSelf: 'center' },
  fotoVazia: { alignItems: 'center', justifyContent: 'center' },
  inicial: { fontSize: 56, fontWeight: '800', color: COR.apagado },
  nome: { fontSize: 20, fontWeight: '800', color: COR_PERFIS.titulo, textAlign: 'center', marginTop: 23, lineHeight: 25 },
  papel: { fontSize: 15, color: COR_PERFIS.papel, textAlign: 'center', marginTop: 6 },
  selo: { marginTop: 10, gap: 4, alignItems: 'center' },
  perfilNome: { fontSize: 12.5, color: COR.primaria, fontWeight: '700' },
  letras: { flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'center' },
  letra: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  acesa: { color: COR.primaria },
  apagada: { color: COR.contorno },
  contagem: { fontSize: 11, color: COR.apagado, marginLeft: 2 },
  semDiagnostico: { fontSize: 12.5, color: COR_PERFIS.semPlano, marginTop: 10, textAlign: 'center', fontWeight: '700' },
});
