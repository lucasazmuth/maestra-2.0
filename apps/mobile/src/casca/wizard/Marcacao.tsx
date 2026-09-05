import { Fragment, type ReactNode } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';

import { stripEmDash } from '@maestra/core/wizard/limpar';

import { WZ } from '@/casca/wizard/cores';

// O pouco de Markdown que as falas da Nyta usam.
//
// A web renderiza as bolhas com `react-markdown`. O que o roteiro de fato escreve é negrito
// (`**assim**`), quebras de linha e, de vez em quando, uma lista com `- `. Trazer um
// interpretador inteiro para o app seria dependência nova para três marcações; o que está aqui
// é exatamente o que o roteiro usa, e o teste `cromoDaConversa` percorre TODAS as falas do
// núcleo para provar que nenhuma outra marcação aparece.
//
// `stripEmDash` vem do núcleo: o travessão sai do texto nas duas superfícies (voz da marca).

const NEGRITO = /\*\*([^*]+)\*\*/g;

/** Uma linha de texto com os trechos em negrito destacados. */
const linha = (texto: string, estilo: TextStyle | undefined, chave: string): ReactNode => {
  const pedacos: ReactNode[] = [];
  let ultimo = 0;
  let achado: RegExpExecArray | null;
  NEGRITO.lastIndex = 0;
  // eslint-disable-next-line no-cond-assign
  while ((achado = NEGRITO.exec(texto)) !== null) {
    if (achado.index > ultimo) pedacos.push(texto.slice(ultimo, achado.index));
    pedacos.push(
      <Text key={`${chave}-${achado.index}`} style={estilos.forte}>{achado[1]}</Text>,
    );
    ultimo = achado.index + achado[0].length;
  }
  if (ultimo < texto.length) pedacos.push(texto.slice(ultimo));
  return <Text style={estilo}>{pedacos}</Text>;
};

export const Marcacao = ({ texto, estilo }: { texto: string; estilo?: TextStyle }) => {
  const linhas = stripEmDash(texto).split('\n');
  return (
    <View>
      {linhas.map((bruta, i) => {
        const item = bruta.match(/^\s*[-*]\s+(.*)$/);
        if (item) {
          return (
            <View key={i} style={estilos.item}>
              <Text style={[estilo, estilos.marcador]}>•</Text>
              <View style={estilos.itemTexto}>{linha(item[1], estilo, `l${i}`)}</View>
            </View>
          );
        }
        // Linha vazia entre parágrafos: um respiro, e não um <Text> sem altura.
        if (!bruta.trim()) return <View key={i} style={estilos.respiro} />;
        return <Fragment key={i}>{linha(bruta, estilo, `l${i}`)}</Fragment>;
      })}
    </View>
  );
};

const estilos = StyleSheet.create({
  forte: { fontWeight: '700', color: WZ.ink },
  item: { flexDirection: 'row', gap: 8 },
  itemTexto: { flex: 1, minWidth: 0 },
  marcador: { color: WZ.marker },
  respiro: { height: 8 },
});
