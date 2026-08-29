import { StyleSheet, Text, View } from 'react-native';

import { COR_NYTA } from '@maestra/core/constants/design';
import { markdownDaNyta } from '@maestra/core/nucleo/markdownDaNyta';

// O texto da Nyta, com o markdown desenhado.
//
// A Nyta responde em markdown — negrito no nome de uma estratégia, listas para enumerar passos.
// Sem isto, os `**` apareciam crus no meio da frase, como se ela tivesse errado a digitação.
//
// O parse mora no núcleo (`nucleo/markdownDaNyta`), com o subconjunto declarado; aqui só se
// desenha. A web usa `react-markdown`, que não tem equivalente confiável no React Native.

export const TextoDaNyta = ({ texto }: { texto: string }) => {
  const blocos = markdownDaNyta(texto);

  return (
    <>
      {blocos.map((bloco, i) => {
        const conteudo = bloco.trechos.map((trecho, j) => (
          <Text
            // eslint-disable-next-line react/no-array-index-key
            key={j}
            style={[trecho.negrito && estilos.negrito, trecho.italico && estilos.italico]}
          >
            {trecho.texto}
          </Text>
        ));

        if (bloco.tipo === 'item') {
          return (
            // eslint-disable-next-line react/no-array-index-key
            <View key={i} style={estilos.item}>
              <Text style={estilos.marcador}>{bloco.marcador}</Text>
              <Text style={[estilos.texto, estilos.flex]}>{conteudo}</Text>
            </View>
          );
        }

        return (
          <Text
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            style={[estilos.texto, bloco.tipo === 'titulo' && estilos.titulo, i > 0 && estilos.espaco]}
          >
            {conteudo}
          </Text>
        );
      })}
    </>
  );
};

const estilos = StyleSheet.create({
  texto: { color: COR_NYTA.bolhaTexto, fontSize: 13, lineHeight: 20 },
  flex: { flex: 1 },
  negrito: { fontWeight: '800' },
  italico: { fontStyle: 'italic' },
  titulo: { fontSize: 15, fontWeight: '800', lineHeight: 21 },
  // A folga entre blocos vive no bloco SEGUINTE: assim o primeiro encosta no topo da bolha.
  espaco: { marginTop: 8 },
  item: { flexDirection: 'row', gap: 8, marginTop: 8 },
  marcador: { color: COR_NYTA.bolhaTexto, fontSize: 13, lineHeight: 20, fontWeight: '700' },
});
