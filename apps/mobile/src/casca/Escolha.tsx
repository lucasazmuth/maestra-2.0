import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR } from '@maestra/core/constants/design';

// A ESCOLHA: uma opção de uma lista, numa folha que sobe de baixo.
//
// É a terceira forma do app, e não é nem `Folha` nem `Dialogo`. Uma folha é uma tela onde se
// trabalha; um diálogo é uma pergunta no centro que interrompe. Esta é o contrário dos dois: a
// pessoa toca num valor, escolhe outro e volta ao que estava fazendo, sem sair do lugar.
//
// Ela sobe de BAIXO porque a lista pode ser longa e quem escolhe é o polegar. Na web, categoria e
// responsável são `Dropdown` do antd: um menuzinho ancorado no chip. Isso não existe no React
// Native, e ancorar um popover num item de lista rolável é o tipo de coisa que funciona no
// simulador e falha no aparelho de alguém.
//
// ⚠️ ELA NASCEU DUAS VEZES. Havia esta, no plano, e outra dentro do `Parcelas` do checkout:
// mesmo véu, mesma folha, mesma lista com o "check" na escolhida, escrita de novo com outros
// nomes. Duas cópias da mesma decisão divergem no primeiro ajuste, e a do checkout já tinha um
// título menor e outro raio.

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
          <Feather name="x" size={20} color={COR.secundario} />
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
    padding: 22, borderBottomWidth: 1, borderBottomColor: COR.divisoria,
  },
  titulo: { fontSize: 17, fontWeight: '800', color: COR.titulo },
  lista: { paddingVertical: 8, paddingBottom: 34 },
  opcao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    paddingHorizontal: 22, paddingVertical: 15,
  },
  opcaoTexto: { flex: 1, fontSize: 15, color: COR.titulo },
  opcaoEscolhida: { fontWeight: '800', color: COR.primaria },
  opcaoDeLimpar: { borderTopWidth: 1, borderTopColor: COR.divisoria, marginTop: 8 },
  limparTexto: { fontSize: 15, fontWeight: '700', color: COR.erro },
});
