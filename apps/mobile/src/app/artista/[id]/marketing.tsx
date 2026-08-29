import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { COR, COR_EM_BREVE, RAIO } from '@maestra/core/constants/design';

import { MarketingIcon } from '@/icones';

// Marketing — a área que ainda não existe.
//
// Porte direto de `src/pages/Marketing/index.tsx`, inclusive o texto: uma tela de "em breve" que
// não diz a MESMA coisa nas duas superfícies vira promessa diferente pra mesma pessoa.
//
// No celular a web empilha os três itens em uma coluna, e o fio que os separa vira horizontal
// (`.marketing-coming-list > div + div { border-top; border-left: 0 }`).

const A_CAMINHO = [
  ['01', 'Campanhas e lançamentos'],
  ['02', 'Calendário de conteúdo'],
  ['03', 'Resultados e audiência'],
] as const;

export default function Marketing() {
  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <View style={estilos.aro}>
          <MarketingIcon size={30} color={COR.primaria} />
        </View>

        <Text style={estilos.rotulo}>MARKETING</Text>
        <Text style={estilos.titulo}>Uma nova área está chegando.</Text>
        <Text style={estilos.texto}>
          Estamos preparando um espaço para organizar campanhas, conteúdo e resultados da carreira
          em um só lugar.
        </Text>

        <View style={estilos.lista}>
          {A_CAMINHO.map(([numero, rotulo], i) => (
            <View key={numero} style={[estilos.item, i > 0 && estilos.itemSeguinte]}>
              <Text style={estilos.numero}>{numero}</Text>
              <Text style={estilos.itemTexto}>{rotulo}</Text>
            </View>
          ))}
        </View>

        <Text style={estilos.assinatura}>Em breve na Maestra</Text>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40, paddingBottom: 122 },
  aro: {
    width: 68,
    height: 68,
    marginBottom: 24,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RAIO.pilula,
    borderWidth: 1,
    borderColor: COR_EM_BREVE.aro,
  },
  rotulo: { marginBottom: 11, textAlign: 'center', color: COR.primaria, fontSize: 9, fontWeight: '900' },
  titulo: { textAlign: 'center', color: COR_EM_BREVE.titulo, fontSize: 29, fontWeight: '800' },
  texto: { marginTop: 15, textAlign: 'center', color: COR_EM_BREVE.texto, fontSize: 13, lineHeight: 22 },
  lista: {
    marginTop: 32,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COR_EM_BREVE.fio,
  },
  item: { paddingVertical: 18, paddingHorizontal: 8 },
  // No celular o fio entre os itens é horizontal: a lista vira uma coluna só.
  itemSeguinte: { borderTopWidth: 1, borderTopColor: COR_EM_BREVE.fio },
  numero: { marginBottom: 11, color: COR_EM_BREVE.numero, fontSize: 9, fontWeight: '800' },
  itemTexto: { color: COR_EM_BREVE.item, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  assinatura: { marginTop: 24, textAlign: 'center', color: COR_EM_BREVE.assinatura, fontSize: 10, fontWeight: '800' },
});
