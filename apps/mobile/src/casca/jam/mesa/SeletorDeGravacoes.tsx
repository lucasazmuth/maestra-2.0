import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_JAM } from '@maestra/core/constants/design';
import type { CatalogVersion } from '@maestra/core/interfaces/maestra';

// Qual gravação está aberta no editor.
//
// ─── O que esta fila substitui ───────────────────────────────────────────────
//
// Antes, cada versão era um CARTÃO com play e onda próprios, empilhados. Isso desenhava as
// versões como coisas que tocam ao mesmo tempo — e elas são ALTERNATIVAS: V1, V2 e V3 são a
// mesma música gravada de novo, ouve-se uma de cada vez. Quem toca junto são os stems, e é isso
// que a mesa lá em baixo mostra.
//
// Por isso a lista virou uma fila de fichas: escolher uma é ABRIR aquela gravação no editor, e
// não pô-la a tocar por cima da outra. Um play por ficha diria o contrário.

export const SeletorDeGravacoes = ({ versoes, abertaId, principalId, aoAbrir }: {
  versoes: CatalogVersion[];
  abertaId: string | null;
  principalId?: string | null;
  aoAbrir: (versao: CatalogVersion) => void;
}) => (
  <View style={estilos.bloco}>
    <Text style={estilos.rotulo}>Gravações desta música</Text>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={estilos.fila}
    >
      {versoes.map((versao) => {
        const aberta = versao.id === abertaId;
        const principal = versao.id === principalId;
        return (
          <Pressable
            key={versao.id}
            style={[estilos.ficha, aberta && estilos.fichaAberta]}
            onPress={() => aoAbrir(versao)}
            accessibilityRole="button"
            accessibilityState={{ selected: aberta }}
            accessibilityLabel={`Abrir V${versao.version_number}${
              versao.title ? `, ${versao.title}` : ''}${principal ? ', gravação principal' : ''}`}
          >
            <Text style={[estilos.numero, aberta && estilos.numeroAberto]}>
              V{versao.version_number}
            </Text>
            {principal && (
              <Feather name="star" size={12} color={aberta ? COR_JAM.papel : COR_JAM.estrelaAcesa} />
            )}
            <Text
              style={[estilos.nome, aberta && estilos.nomeAberto]}
              numberOfLines={1}
            >
              {versao.title || 'Sem título'}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  </View>
);

const estilos = StyleSheet.create({
  bloco: { gap: 8 },
  rotulo: { fontSize: 12, fontWeight: '700', color: COR_JAM.rotulo },
  // O recuo à direita é o que impede a última ficha de colar na borda quando a fila chega ao fim.
  fila: { gap: 8, paddingRight: 4 },
  ficha: {
    maxWidth: 210,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 36, paddingHorizontal: 12, borderRadius: 999,
    borderWidth: 1, borderColor: COR_JAM.contornoDaVersao, backgroundColor: COR_JAM.papel,
  },
  fichaAberta: { borderColor: COR.primaria, backgroundColor: COR.primaria },
  numero: { fontSize: 12, fontWeight: '800', color: COR_JAM.cracha },
  numeroAberto: { color: COR_JAM.papel },
  nome: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: COR_JAM.texto },
  nomeAberto: { color: COR_JAM.papel },
});
