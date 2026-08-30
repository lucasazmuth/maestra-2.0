import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { COR } from '@maestra/core/constants/design';

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
        />
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 122, gap: 16 },
});
