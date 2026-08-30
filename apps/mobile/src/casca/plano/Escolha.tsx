import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_PLANO } from '@maestra/core/constants/design';

// O menu de escolha, em folha.
//
// Na web, categoria e responsável são `Dropdown` do antd: um menuzinho ancorado no chip. Isso
// não existe no React Native, e ancorar um popover num item de lista rolável é o tipo de coisa
// que funciona no simulador e falha no aparelho de alguém. A folha de baixo é a forma nativa da
// mesma decisão — e cabe o dedo, que um menu de 26px de altura não cabe.

export interface Opcao {
  valor: string;
  rotulo: string;
  /** Aparece antes do rótulo; usada pelo responsável, que na web mostra a foto. */
  foto?: string | null;
}

export const Escolha = ({ aberta, titulo, opcoes, valor, limpar, aoEscolher, aoFechar }: {
  aberta: boolean;
  titulo: string;
  opcoes: Opcao[];
  valor?: string | null;
  /** O rótulo da opção que DESMARCA (ex.: "Remover responsável"). Sem ele, não há como limpar. */
  limpar?: string;
  aoEscolher: (valor: string | undefined) => void;
  aoFechar: () => void;
}) => (
  <Modal visible={aberta} animationType="slide" transparent onRequestClose={aoFechar}>
    <Pressable style={estilos.fundo} onPress={aoFechar} accessibilityLabel="Fechar" />
    <View style={estilos.folha}>
      <View style={estilos.cabecalho}>
        <Text style={estilos.titulo}>{titulo}</Text>
        <Pressable onPress={aoFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
          <Feather name="x" size={20} color={COR_PLANO.rotulo} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={estilos.lista}>
        {opcoes.map((opcao) => {
          const escolhida = valor === opcao.valor;
          return (
            <Pressable
              key={opcao.valor}
              style={estilos.opcao}
              onPress={() => { aoEscolher(opcao.valor); aoFechar(); }}
              accessibilityRole="button"
              accessibilityState={{ selected: escolhida }}
              accessibilityLabel={opcao.rotulo}
            >
              <Text style={[estilos.opcaoTexto, escolhida && estilos.opcaoEscolhida]}>
                {opcao.rotulo}
              </Text>
              {escolhida && <Feather name="check" size={17} color={COR.primaria} />}
            </Pressable>
          );
        })}

        {!!limpar && !!valor && (
          <Pressable
            style={[estilos.opcao, estilos.opcaoDeLimpar]}
            onPress={() => { aoEscolher(undefined); aoFechar(); }}
            accessibilityRole="button"
            accessibilityLabel={limpar}
          >
            <Text style={estilos.limparTexto}>{limpar}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  </Modal>
);

const estilos = StyleSheet.create({
  fundo: { flex: 1, backgroundColor: 'rgba(20, 30, 55, .45)' },
  folha: {
    maxHeight: '70%', backgroundColor: COR.superficie,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
  },
  cabecalho: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 22, borderBottomWidth: 1, borderBottomColor: COR_PLANO.fio,
  },
  titulo: { fontSize: 17, fontWeight: '800', color: COR_PLANO.titulo },
  lista: { paddingVertical: 8, paddingBottom: 34 },
  opcao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 22, paddingVertical: 15,
  },
  opcaoTexto: { flex: 1, fontSize: 15, color: COR_PLANO.titulo },
  opcaoEscolhida: { fontWeight: '800', color: COR.primaria },
  opcaoDeLimpar: { borderTopWidth: 1, borderTopColor: COR_PLANO.fio, marginTop: 8 },
  limparTexto: { fontSize: 15, fontWeight: '700', color: COR.erro },
});

/** O chip cinza da categoria e o do prazo — os dois pílulas de 26px que a web desenha na linha. */
export const Chip = ({ texto, tom, aoTocar, rotulo }: {
  texto: string;
  tom: 'categoria' | 'prazo';
  aoTocar?: () => void;
  rotulo: string;
}) => (
  <Pressable
    style={[estilos2.chip, tom === 'prazo' ? estilos2.chipDePrazo : estilos2.chipDeCategoria]}
    onPress={aoTocar}
    disabled={!aoTocar}
    accessibilityRole="button"
    accessibilityLabel={rotulo}
  >
    <Text
      style={[estilos2.chipTexto, tom === 'prazo' ? estilos2.textoDePrazo : estilos2.textoDeCategoria]}
      numberOfLines={1}
    >
      {texto}
    </Text>
  </Pressable>
);

const estilos2 = StyleSheet.create({
  chip: {
    minHeight: 26, paddingHorizontal: 9, justifyContent: 'center',
    borderRadius: 7,
  },
  chipDeCategoria: {
    backgroundColor: COR_PLANO.chipFundo,
    borderWidth: 1, borderColor: COR_PLANO.chipContorno,
  },
  // O prazo NÃO tem contorno: é a diferença que separa "o que a tarefa é" de "quando ela vence".
  chipDePrazo: { backgroundColor: COR_PLANO.prazoFundo },
  chipTexto: { fontSize: 10.5, fontWeight: '800' },
  textoDeCategoria: { color: COR_PLANO.chipTexto },
  textoDePrazo: { color: COR_PLANO.prazoTexto },
});
