import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Redirect, useLocalSearchParams } from 'expo-router';

import { COR, COR_LEGAL } from '@maestra/core/constants/design';
import { LEGAL_DOCS, type LegalSlug } from '@maestra/core/constants/legal';
import { markdownDaNyta } from '@maestra/core/nucleo/markdownDaNyta';

import { CabecalhoDaPagina } from '@/casca/CabecalhoDaPagina';

// OS TERMOS E A POLÍTICA DE PRIVACIDADE, dentro do app.
//
// Eles abriam o navegador. Num app que se submete à loja isso é o contrário do que se quer: são
// os documentos que a pessoa precisa de ler ANTES de aceitar, e mandá-la para fora — para uma
// aba que pode nem abrir, num aparelho sem navegador padrão configurado — é pedir o aceite de
// algo que ela não conseguiu ver.
//
// ⚠️ O TEXTO É O MESMO, e não uma cópia: `constants/legal.ts` guarda o markdown, e as duas
// superfícies desenham-no. Um segundo texto legal seria dois contratos diferentes com o mesmo
// nome — e o que vale em juízo é o que a pessoa leu.
//
// O parse também é partilhado: `nucleo/markdownDaNyta` é o mesmo que a Nyta usa, com o
// subconjunto declarado lá (títulos, listas e ênfase — que é exatamente o que estes documentos
// usam). O DESENHO é que é daqui: um contrato de milhares de palavras lê-se com outra
// entrelinha e outra hierarquia do que a resposta de um assistente.

const ehSlug = (v: unknown): v is LegalSlug => v === 'termos' || v === 'privacidade';

export default function Legal() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  if (!ehSlug(slug)) return <Redirect href="/conta" />;

  const doc = LEGAL_DOCS[slug];
  // `T00:00:00` sem fuso: sem ele, a data ISO é lida como UTC e um documento de 21/08 aparece
  // como 20/08 para quem está a oeste de Greenwich. É a mesma leitura que a web faz.
  const atualizado = new Date(`${doc.updatedAt}T00:00:00`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <SafeAreaView style={estilos.tela} edges={['top', 'left', 'right']}>
      <CabecalhoDaPagina
        sobretitulo="DOCUMENTOS"
        titulo={doc.title}
        apoio={`Última atualização: ${atualizado}`}
        para="/conta"
      />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        {markdownDaNyta(doc.content).map((bloco, i) => {
          const conteudo = bloco.trechos.map((trecho, j) => (
            <Text
              key={j}
              style={[trecho.negrito && estilos.negrito, trecho.italico && estilos.italico]}
            >
              {trecho.texto}
            </Text>
          ));

          if (bloco.tipo === 'item') {
            return (
              <View key={i} style={estilos.item}>
                <Text style={estilos.marcador}>{bloco.marcador}</Text>
                <Text style={[estilos.texto, estilos.flex]}>{conteudo}</Text>
              </View>
            );
          }

          return (
            <Text
              key={i}
              style={[estilos.texto, bloco.tipo === 'titulo' && estilos.subtitulo]}
            >
              {conteudo}
            </Text>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  // ⚠️ A FOLGA ENTRE BLOCOS VIVE NO `gap`, e não numa margem por bloco: com margem, o primeiro
  // parágrafo depois de um título ganhava o dobro do espaço, e a leitura ficava aos soluços.
  conteudo: { padding: 20, paddingBottom: 48, gap: 12 },
  flex: { flex: 1 },


  // Entrelinha de 1.75, a da web: são milhares de palavras percorridas à procura de uma cláusula.
  texto: { fontSize: 15, lineHeight: 26, color: COR_LEGAL.texto },
  subtitulo: {
    fontSize: 18, fontWeight: '800', lineHeight: 26, color: COR_LEGAL.titulo, marginTop: 10,
  },
  negrito: { fontWeight: '700', color: COR_LEGAL.titulo },
  italico: { fontStyle: 'italic' },
  item: { flexDirection: 'row', gap: 10 },
  marcador: { fontSize: 15, lineHeight: 26, fontWeight: '700', color: COR_LEGAL.apoio },
});
