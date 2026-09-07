import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';

import { COR, COR_DIAGNOSTICO } from '@maestra/core/constants/design';
import { useEntitlements } from '@maestra/core/hooks/useEntitlements';

import { Relatorio } from '@/casca/diagnostico/Relatorio';
import { useArtistaDaRota } from '@/nucleo/artista';
import { irParaOCheckout } from '@/nucleo/loja';
import { useSessao } from '@/nucleo/sessao';

// A página do diagnóstico de um perfil: só a moldura. O relatório inteiro é o `Relatorio`, que
// o fluxo de criação também usa — é o mesmo documento nos dois lugares, como na web.

export default function Diagnostico() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const artista = useArtistaDaRota(id);
  const conteudo = artista?.content as Record<string, any> | undefined;
  const { sessao } = useSessao();
  const { isPro } = useEntitlements();

  // Refazer é do DONO do perfil. A edge `artist-diagnostic` filtra por
  // `.eq("id", redoArtistId).eq("user_id", user.id)` e devolve 404 quando não bate — então um
  // colaborador atravessaria o quiz inteiro para receber "não consegui gerar seu diagnóstico",
  // que soa como falha temporária e não como falta de permissão. A condição aqui é a MESMA do
  // servidor, para os dois não divergirem. É o mesmo corte da web.
  const souDono = !!artista?.user_id && !!sessao?.user.id && artista.user_id === sessao.user.id;

  // Loop de crescimento: executou o plano e cresceu? Refaz o REAL pra fase subir. É recurso PRO —
  // quem não é vai para o checkout, que vive na web (ver `nucleo/loja`).
  const refazer = () => {
    if (isPro) router.push({ pathname: '/criar-artista', params: { refazer: String(id) } });
    else void irParaOCheckout({ destino: 'assinatura' });
  };

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Relatorio
          real={conteudo?.realIndex as Record<string, any> | undefined}
          chartmetric={conteudo?.chartmetricProfile ?? null}
          artista={{
            id: artista?.id,
            nome: artista?.name,
            foto: conteudo?.spotifyProfile?.image,
            vinculo: conteudo?.titularidade?.vinculo,
          }}
          acaoDoCabecalho={souDono ? (
            <Pressable
              style={estilos.refazer}
              onPress={refazer}
              accessibilityRole="button"
              accessibilityLabel={isPro
                ? 'Refazer o diagnóstico'
                : 'Refazer o diagnóstico é um recurso PRO'}
            >
              <Feather
                name={isPro ? 'refresh-cw' : 'lock'}
                size={14}
                color={COR_DIAGNOSTICO.titulo}
              />
              <Text style={estilos.refazerTexto}>Refazer</Text>
            </Pressable>
          ) : undefined}
        />
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: {
    // Sem recuo de cima: ele é todo do `CabecalhoDoModulo`, para o título nascer à mesma
    // altura em todos os módulos.
    // O ritmo da pilha NÃO é decidido aqui: mora dentro do próprio `Relatorio`, que aparece
    // nesta tela, no fim da criação e no desbloqueio. Era essa decisão espalhada por três
    // molduras que fazia o mesmo documento sair com espaçamentos diferentes em cada uma.
    // O recuo de baixo é da barra de abas, que flutua sobre o conteúdo.
    paddingHorizontal: 16, paddingBottom: 122,
  },
  // Discreto de propósito: refazer é uma ação de manutenção, não a próxima coisa a fazer.
  refazer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 9999,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.contorno, backgroundColor: COR.superficie,
  },
  refazerTexto: { fontSize: 12.5, fontWeight: '800', color: COR_DIAGNOSTICO.titulo },
});
