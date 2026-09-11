import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { AZUL_DO_EDITOR, COR_EDITOR } from '@maestra/core/constants/design';

// O volume de uma pista.
//
// Feito à mão porque o React Native não traz um controlo deslizante, e a única biblioteca da
// comunidade que o faz não está instalada. São trinta linhas — instalar um pacote para isto
// seria mais peso do que código.
//
// O gesto é de ARRASTAR e também de TOCAR: tocar a meio leva o botão para lá. Só arrastar
// obrigaria a agarrar um alvo de 22 pt para baixar o volume, que é preciso demais para um dedo.

const ALTURA_DO_TRILHO = 6;
const BOTAO = 22;

export const Fader = ({ valor, aoMudar, apagado }: {
  /** 0..1 */
  valor: number;
  aoMudar: (v: number) => void;
  apagado?: boolean;
}) => {
  const [largura, setLargura] = useState(0);

  const paraValor = (x: number) => {
    if (largura <= 0) return valor;
    return Math.max(0, Math.min(x / largura, 1));
  };

  const medir = (e: LayoutChangeEvent) => setLargura(e.nativeEvent.layout.width);

  // `runOnJS` porque o gesto corre na thread da interface e `aoMudar` mexe em estado do React.
  //
  // ⚠️ O `activeOffsetX` é o que separa "quero mexer no volume" de "quero rolar a tela". Sem
  // ele, o Pan ganhava no toque e um dedo que começasse sobre o fader para rolar a página
  // arrastava o volume junto. Seis pixels horizontais é o gesto declarado; menos que isso é um
  // toque, e o toque abaixo trata dele.
  const arrastar = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onUpdate((e) => { runOnJS(aoMudar)(paraValor(e.x)); });

  const toque = Gesture.Tap().onEnd((e) => { runOnJS(aoMudar)(paraValor(e.x)); });

  const cheio = Math.max(0, Math.min(valor, 1));

  return (
    <GestureDetector gesture={Gesture.Race(arrastar, toque)}>
      {/* O alvo é mais alto que o trilho: 6 pt de trilho seria impossível de acertar. */}
      <View style={estilos.alvo} onLayout={medir} accessibilityRole="adjustable"
        accessibilityLabel="Volume da faixa"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(cheio * 100) }}>
        <View style={estilos.trilho}>
          <View style={[
            estilos.cheio,
            { width: `${cheio * 100}%` },
            apagado && estilos.cheioApagado,
          ]} />
        </View>
        <View style={[estilos.botao, { left: `${cheio * 100}%` }]} />
      </View>
    </GestureDetector>
  );
};

const estilos = StyleSheet.create({
  alvo: { height: 34, justifyContent: 'center' },
  trilho: {
    height: ALTURA_DO_TRILHO, borderRadius: ALTURA_DO_TRILHO / 2,
    backgroundColor: COR_EDITOR.acaoFundo, overflow: 'hidden',
  },
  cheio: { height: '100%', backgroundColor: AZUL_DO_EDITOR },
  cheioApagado: { backgroundColor: COR_EDITOR.estrela },
  botao: {
    position: 'absolute', width: BOTAO, height: BOTAO, borderRadius: BOTAO / 2,
    // Metade da largura para a esquerda: o `left` posiciona a borda, e o que tem de ficar sobre
    // o valor é o CENTRO do botão.
    marginLeft: -BOTAO / 2,
    backgroundColor: COR_EDITOR.papel,
    borderWidth: 1, borderColor: COR_EDITOR.contornoDaVersao,
    shadowColor: 'rgba(74, 99, 145, .25)', shadowOpacity: 1,
    shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 3,
  },
});
