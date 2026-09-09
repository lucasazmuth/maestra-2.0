import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { COR, COR_AVISO, RAIO } from '@maestra/core/constants/design';

// O DIÁLOGO: a caixa que aparece no CENTRO, sobre um véu, e interrompe o que a pessoa fazia.
//
// É irmão da `Folha`, não uma variante dela, e a diferença não é de aparência: uma folha é uma
// TELA que sobe e onde se trabalha; um diálogo é uma PERGUNTA no meio do caminho, que se responde
// e sai. Por isso ele é pequeno, fica no centro, escurece o que está atrás e não rola.
//
// Forçar os dois na mesma primitiva foi a primeira coisa que eu quis fazer, e teria dado uma
// `Folha` com meia dúzia de condicionais para virar outra coisa. São duas formas, e cada uma diz
// algo diferente sobre o que se espera de quem está lendo.
//
// ─── O que ele NÃO é ─────────────────────────────────────────────────────────
//
// Não é o menu do sistema, que é ANCORADO ao botão que o abriu, no canto do cabeçalho. Um menu
// ancorado no centro da tela perderia a relação com o que o abriu.
//
// Não é a escolha de uma opção numa lista: isso é a `Escolha`, que sobe de baixo porque a lista
// pode ser longa e o polegar precisa alcançar.

export const Dialogo = ({
  aberto, titulo, emblema, aoFechar, acao, recusa, children,
}: {
  aberto: boolean;
  titulo: string;
  /** O ícone no círculo, à esquerda do título. Opcional: nem todo diálogo tem assunto com rosto. */
  emblema?: ReactNode;
  aoFechar: () => void;
  /** A ação que responde à pergunta. */
  acao?: { rotulo: string; aoTocar: () => void; sufixo?: ReactNode };
  /** A saída em texto, embaixo. "Agora não", "Cancelar". */
  recusa?: string;
  children: ReactNode;
}) => (
  <Modal visible={aberto} transparent animationType="fade" onRequestClose={aoFechar}>
    {/* Tocar fora fecha: é o gesto que todo mundo tenta primeiro numa caixa destas. */}
    <Pressable style={estilos.veu} onPress={aoFechar} accessibilityLabel="Fechar" />

    <View style={estilos.caixa} accessibilityViewIsModal accessibilityRole="alert">
      <View style={estilos.cabecalho}>
        {!!emblema && <View style={estilos.emblema}>{emblema}</View>}
        <Text style={estilos.titulo}>{titulo}</Text>
      </View>

      {children}

      {!!acao && (
        <Pressable
          style={estilos.acao}
          onPress={acao.aoTocar}
          accessibilityRole="button"
          accessibilityLabel={acao.rotulo}
        >
          <Text style={estilos.acaoTexto}>{acao.rotulo}</Text>
          {acao.sufixo}
        </Pressable>
      )}

      {!!recusa && (
        <Pressable onPress={aoFechar} accessibilityRole="button" accessibilityLabel={recusa}>
          <Text style={estilos.recusa}>{recusa}</Text>
        </Pressable>
      )}
    </View>
  </Modal>
);

const estilos = StyleSheet.create({
  veu: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COR_AVISO.veu },

  // Centrada de verdade: `justifyContent` no lugar do `translateY` fixo que a versão anterior
  // usava. Aquele número era a metade da altura ESPERADA da caixa, e um diálogo com mais texto
  // saía do centro sem ninguém perceber.
  caixa: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    marginHorizontal: 16, marginVertical: 'auto',
    alignSelf: 'center', width: '100%',
    padding: 22, gap: 14,
    borderRadius: RAIO.cartao, backgroundColor: COR.superficie,
    shadowColor: 'rgb(46, 72, 117)', shadowOpacity: 0.18, shadowRadius: 34,
    shadowOffset: { width: 0, height: 18 }, elevation: 8,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  emblema: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR.destaque,
  },
  titulo: { flex: 1, fontSize: 18, fontWeight: '800', color: COR.titulo },

  acao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: RAIO.pilula, backgroundColor: COR.primaria,
  },
  acaoTexto: { fontSize: 15, fontWeight: '800', color: COR.sobrePrimaria },
  recusa: { textAlign: 'center', fontSize: 13.5, fontWeight: '700', color: COR.secundario },
});
