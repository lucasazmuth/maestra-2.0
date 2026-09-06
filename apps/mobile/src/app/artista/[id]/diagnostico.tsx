import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { COR } from '@maestra/core/constants/design';

import { FOLGA_APOS_O_CABECALHO } from '@/casca/CabecalhoDoModulo';
import { Relatorio } from '@/casca/diagnostico/Relatorio';
import { useArtistaDaRota } from '@/nucleo/artista';

// A página do diagnóstico de um perfil: só a moldura. O relatório inteiro é o `Relatorio`, que
// o fluxo de criação também usa — é o mesmo documento nos dois lugares, como na web.

export default function Diagnostico() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const artista = useArtistaDaRota(id);
  const conteudo = artista?.content as Record<string, any> | undefined;

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
    // O `gap` é o que separa o cabeçalho do primeiro cartão E um cartão do seguinte: a
    // pilha inteira tem o mesmo ritmo, e é ele que faz a folga depois do fio.
    paddingHorizontal: 16, paddingBottom: 122, gap: FOLGA_APOS_O_CABECALHO,
  },
});
