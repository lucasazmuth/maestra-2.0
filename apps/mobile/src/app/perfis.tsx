import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Linking, Pressable, RefreshControl,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import { COR, RAIO, COR_PERFIS } from '@maestra/core/constants/design';
import { artistEntryRoute, isOnboardingComplete } from '@maestra/core/constants/maestra';
import type { Artist } from '@maestra/core/interfaces/maestra';
import { countUnread } from '@maestra/core/services/db/notifications';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';

import { BotaoDoMenuDoSistema, BotaoRedondo } from '@/casca/marca/MenuDoSistema';
import { SeloDoPlano } from '@/casca/marca/SeloDoPlano';
import { MaestraMarca, NotificationIcon } from '@/icones';
import { useSessao } from '@/nucleo/sessao';

/** Assinatura, desbloqueio e suporte continuam na web: pagamento no app exige StoreKit. */
const SITE = 'https://www.maestramanager.com';

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
/**
 * O que a web mostra embaixo do nome: o ESTADO do perfil e os seguidores.
 *
 * Na ordem em que importa: cobrança em aberto trava tudo; sem plano, o próximo passo é o
 * planejamento. O selo R·E·A·L não entra — a web não o mostra aqui, e ele já é a primeira coisa
 * dentro do perfil.
 */
const Selo = ({ artista }: { artista: Artist }) => {
  const conteudo = artista.content;
  // Chartmetric primeiro: a Web API do Spotify não devolve mais `followers`, então o campo do
  // `spotifyProfile` é nulo em quase todo artista.
  const seguidores = conteudo?.chartmetricProfile?.sp_followers ?? conteudo?.spotifyProfile?.followers;
  const dono = artista.role !== 'member';

  const estado = dono && artista.is_locked
    ? { cor: COR_PERFIS.pagamentoPendente, texto: 'Pagamento pendente' }
    : !isOnboardingComplete(artista)
      ? { cor: COR_PERFIS.semPlano, texto: 'Planejamento não iniciado' }
      : null;

  return (
    <>
      {!!estado && (
        <View style={estilos.estado}>
          <View style={[estilos.ponto, { backgroundColor: estado.cor }]} />
          <Text style={[estilos.estadoTexto, { color: estado.cor }]}>{estado.texto}</Text>
        </View>
      )}
      {seguidores != null && (
        <Text style={estilos.seguidores}>
          {seguidores.toLocaleString('pt-BR')} seguidores
        </Text>
      )}
    </>
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

  /**
   * Para onde um perfil abre.
   *
   * A regra e do nucleo (`artistEntryRoute`), a MESMA da web: cobranca em aberto vai pro
   * desbloqueio, sem planejamento vai pro wizard, e so o resto abre a home. O app mandava tudo
   * pra home — quem tinha um perfil recem-criado caia numa tela vazia sem saber o que fazer.
   *
   * Desbloqueio e planejamento agora sao do app: `/desbloquear/[id]` e `/wizard/[id]`. Nada mais
   * desta lista sai para o navegador.
   */
  const abrir = (artista: Artist) => {
    const destino = artistEntryRoute(artista);
    if (destino.endsWith(`/${artista.id}`)) {
      router.push({ pathname: '/artista/[id]', params: { id: artista.id } });
      return;
    }
    if (destino.endsWith('/desbloquear')) {
      router.push({ pathname: '/desbloquear/[id]', params: { id: artista.id } });
      return;
    }
    if (destino.endsWith('/wizard')) {
      router.push({ pathname: '/wizard/[id]', params: { id: artista.id } });
      return;
    }
    Linking.openURL(`${SITE}${destino}`);
  };

  if (!carregandoSessao && !sessao) return <Redirect href="/entrar" />;

  return (
    <SafeAreaView style={estilos.tela}>
      {/* A barra do sistema: a MARCA à esquerda, com a pílula do plano ao lado, e à direita o
          sino e o menu de grade. É o mesmo desenho do cabeçalho de dentro do artista, que só
          acrescenta a Nyta.

          Tocar na marca leva aos perfis, como no cabeçalho do artista. Aqui já se está neles;
          o alvo existe porque o desenho é o mesmo, e um logotipo que responde numa tela e não
          na outra é o tipo de diferença que só se sente sem saber nomear.

          A pílula diz PRO ou Pendente, e só para quem paga: uma pílula "FREE" que leva ao
          checkout é direcionar para fora da loja (3.1.3). Quem não assina encontra o convite
          em "Seja PRO", dentro do menu. */}
      <View style={estilos.barra}>
        <Pressable
          style={estilos.marca}
          onPress={() => router.push('/perfis')}
          accessibilityRole="button"
          accessibilityLabel="Maestra. Ir para os perfis"
        >
          <MaestraMarca size={24} color={COR_PERFIS.titulo} />
        </Pressable>

        {/* Fora do toque da marca: o selo não leva a lugar nenhum. */}
        <SeloDoPlano />

        <View style={estilos.espaco} />

        <BotaoRedondo
          rotulo={naoLidas > 0 ? `Notificações (${naoLidas} não lidas)` : 'Notificações'}
          aoTocar={() => router.push('/notificacoes')}
          marca={naoLidas > 0}
        >
          <NotificationIcon size={28} color={COR_PERFIS.sino} />
        </BotaoRedondo>

        <BotaoDoMenuDoSistema aqui="perfis" />
      </View>

      {/* O titulo com a acao ao lado, como na web. */}
      <View style={estilos.tituloLinha}>
        <Text style={estilos.titulao}>Seus perfis</Text>
        <Pressable
          style={estilos.criar}
          onPress={() => router.push('/criar-artista')}
          accessibilityRole="button"
          accessibilityLabel="Criar perfil"
        >
          <Feather name="plus" size={15} color={COR.sobrePrimaria} />
          <Text style={estilos.criarTexto}>Criar perfil</Text>
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
            onPress={() => abrir(item)}
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
  // A barra da web: marca + selo a esquerda, sino e conta a direita.
  barra: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 20,
  },
  marca: { flexDirection: 'row', alignItems: 'center' },
  /** O que empurra os botões para a direita — o `margin-left: auto` da web. */
  espaco: { flex: 1 },
  tituloLinha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingHorizontal: 18, paddingBottom: 34,
  },
  titulao: { fontSize: 30, fontWeight: '800', color: COR_PERFIS.titulo, letterSpacing: -1.2 },
  criar: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 13, paddingHorizontal: 17,
    borderRadius: RAIO.pilula, backgroundColor: COR.primaria,
  },
  criarTexto: { fontSize: 13, fontWeight: '800', color: COR.sobrePrimaria },
  legenda: { fontSize: 15, color: COR_PERFIS.papel, marginTop: 14 },
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
  estado: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10 },
  ponto: { width: 6, height: 6, borderRadius: 3 },
  estadoTexto: { fontSize: 12.5, fontWeight: '700' },
  seguidores: { fontSize: 13, color: COR_PERFIS.papel, textAlign: 'center', marginTop: 6 },
  contagem: { fontSize: 11, color: COR.apagado, marginLeft: 2 },
  semDiagnostico: { fontSize: 12.5, color: COR_PERFIS.semPlano, marginTop: 10, textAlign: 'center', fontWeight: '700' },
});
