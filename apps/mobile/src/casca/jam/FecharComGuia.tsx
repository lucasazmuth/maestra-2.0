import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import LottieView, { type AnimationObject } from 'lottie-react-native';

import { ANIMACAO_DA_GUIA } from '@maestra/core/audio/animacaoDaGuia';
import {
  CORES_DA_ANIMACAO, PERGUNTA_DA_GUIA, pintarALottie, rotuloDaGuia,
} from '@maestra/core/audio/exportar';
import { AZUL_DO_EDITOR, COR_EDITOR } from '@maestra/core/constants/design';

// FECHAR O ESPAÇO JAM: a pergunta, e a espera. A mesma das duas telas.
//
// ⚠️ A GUIA DEIXOU DE SER OBRIGATÓRIA NA SAÍDA, e aqui a diferença é de outra ordem de
// grandeza: foram medidos 101 segundos para 227 de áudio num iPhone 17 Pro. Esperar por ela é o
// certo quando se acabou de montar — é o que faz a lista de Músicas tocar o que se fez — e é um
// roubo quando se entrou só para ouvir, mexeu num fader e quer sair. Quem sabe qual dos dois é,
// é quem está lá.

/** A proporção da composição (684 × 760). Esticá-la para um quadrado entorta a mão. */
const LARGURA_DA_MAO = 168;

export const FecharComGuia = ({ gerando, perguntando, aoGerar, aoSair, aoFicar }: {
  /** `null` fora da saída; 0..1 (ou `NaN`, sem conta ainda) enquanto a guia corre. */
  gerando: number | null;
  perguntando: boolean;
  aoGerar: () => void;
  aoSair: () => void;
  aoFicar: () => void;
}) => {
  // ⚠️ REPINTADA UMA VEZ. O `pintarALottie` percorre o desenho inteiro, e refazê-lo a cada
  // render — que aqui acontece a cada ponto de percentagem — seria varrer um ficheiro de
  // cinquenta mil caracteres vinte vezes por segundo para desenhar o mesmo.
  const desenho = useMemo(
    () => pintarALottie(ANIMACAO_DA_GUIA, CORES_DA_ANIMACAO) as unknown as AnimationObject,
    [],
  );

  if (gerando != null) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
        <View style={estilos.veu} accessibilityLiveRegion="polite">
          <LottieView
            source={desenho}
            autoPlay
            loop
            style={{ width: LARGURA_DA_MAO, height: Math.round(LARGURA_DA_MAO * (760 / 684)) }}
          />
          <Text style={estilos.conta}>{rotuloDaGuia(gerando)}</Text>
          {/* ⚠️ DIZ POR QUE É QUE DEMORA. Sem esta linha, um minuto e meio de espera numa tela
              que a pessoa pediu para fechar parece o aplicativo pendurado — e quem acha que
              pendurou, fecha à força, que é exatamente o gesto que perde o trabalho. */}
          <Text style={estilos.apoioDaConta}>
            Somando as faixas numa gravação só. Pode demorar um bocado.
          </Text>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={perguntando} transparent animationType="fade" onRequestClose={aoFicar}>
      {/* Tocar fora fecha a pergunta e deixa a pessoa onde estava: é o gesto que todo mundo
          tenta primeiro numa caixa destas. */}
      <Pressable style={estilos.veu} onPress={aoFicar} accessibilityLabel="Cancelar">
        <Pressable style={estilos.caixa} onPress={() => {}}>
          <Text style={estilos.titulo}>{PERGUNTA_DA_GUIA.titulo}</Text>
          <Text style={estilos.texto}>{PERGUNTA_DA_GUIA.texto}</Text>

          <Pressable style={[estilos.botao, estilos.principal]} onPress={aoGerar} accessibilityRole="button">
            <Text style={estilos.tintaPrincipal}>{PERGUNTA_DA_GUIA.gerar}</Text>
          </Pressable>
          <Pressable style={[estilos.botao, estilos.contornado]} onPress={aoSair} accessibilityRole="button">
            <Text style={estilos.tinta}>{PERGUNTA_DA_GUIA.sair}</Text>
          </Pressable>
          <Pressable style={estilos.botao} onPress={aoFicar} accessibilityRole="button">
            <Text style={estilos.tintaApagada}>{PERGUNTA_DA_GUIA.ficar}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const estilos = StyleSheet.create({
  veu: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20,
    backgroundColor: 'rgba(10, 10, 12, .72)',
  },
  conta: { marginTop: 18, fontSize: 15, fontWeight: '700', color: COR_EDITOR.texto },
  apoioDaConta: {
    marginTop: 6, fontSize: 12, lineHeight: 17, maxWidth: 280,
    color: COR_EDITOR.apoio, textAlign: 'center',
  },

  caixa: {
    width: '100%', maxWidth: 380, padding: 22, gap: 8,
    backgroundColor: COR_EDITOR.painel,
    borderWidth: 1, borderColor: COR_EDITOR.fio, borderRadius: 8,
  },
  titulo: { fontSize: 17, fontWeight: '700', color: COR_EDITOR.texto },
  texto: { fontSize: 13, lineHeight: 19, color: COR_EDITOR.apoio, marginBottom: 12 },
  botao: { height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  principal: { backgroundColor: AZUL_DO_EDITOR },
  contornado: { borderWidth: 1, borderColor: COR_EDITOR.fio },
  tintaPrincipal: { fontSize: 14, fontWeight: '700', color: COR_EDITOR.papel },
  tinta: { fontSize: 14, fontWeight: '700', color: COR_EDITOR.texto },
  tintaApagada: { fontSize: 14, fontWeight: '700', color: COR_EDITOR.apoio },
});
