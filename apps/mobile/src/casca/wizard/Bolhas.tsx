import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { Marcacao } from '@/casca/wizard/Marcacao';
import { WZ } from '@/casca/wizard/cores';

// As falas do fio da conversa do wizard.
//
// ⚠️ NÃO SÃO MAIS BOLHAS, e a assimetria abaixo é a decisão de desenho inteira — a mesma do chat
// livre da Nyta, aqui e na web:
//
//  • A fala da Nyta NÃO tem recipiente. Nem balão, nem contorno, nem avatar: é texto na própria
//    coluna, na largura toda. Um balão por turno espremia a resposta em 78% da largura e a fazia
//    ler como mensagem de robô; sem ele, ela lê como o texto de um formulário conduzido.
//  • A resposta de quem preenche TEM recipiente, e é o único da tela. É o que deixa achar,
//    rolando, onde se respondeu o quê. Em cinza neutro, e não no azul de ação: não é um botão.
//
// Nenhuma das duas leva avatar. Quem falou já está dito pela posição e pelo recipiente, e um
// retrato repetido a cada turno é a marca registrada de interface de chatbot.

export const FalaDaNyta = ({ texto }: { texto: string }) => (
  <View style={estilos.falaDaNyta}><Marcacao texto={texto} estilo={estilos.textoDaNyta} /></View>
);

export const FalaDeQuemResponde = ({ texto }: { texto: string }) => (
  <View style={estilos.linhaDaResposta}>
    <Text style={estilos.resposta}>{texto}</Text>
  </View>
);

/** Os três pontinhos enquanto a Nyta "pensa" — sem moldura, onde o texto vai nascer. */
export const Pensando = () => {
  const pontos = [useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current];

  useEffect(() => {
    const lacos = pontos.map((valor, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 150),
      Animated.timing(valor, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(valor, { toValue: 0.3, duration: 450, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.delay(300 - i * 150),
    ])));
    lacos.forEach((l) => l.start());
    return () => lacos.forEach((l) => l.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={estilos.pensando} accessibilityLabel="Nyta está digitando">
      {pontos.map((valor, i) => (
        <Animated.View key={i} style={[estilos.ponto, { opacity: valor }]} />
      ))}
    </View>
  );
};

/** Um cartão que a Nyta "envia": a coluna inteira, e a moldura vem do próprio conteúdo. */
export const CartaoDaNyta = ({ children }: { children: ReactNode }) => (
  <View style={estilos.cartao}>{children}</View>
);

/** Onde o widget do beat atual é desenhado: sem avatar para alinhar, ocupa a coluna inteira. */
export const LugarDoWidget = ({ children }: { children: ReactNode }) => (
  <View style={estilos.widget}>{children}</View>
);

/**
 * Mantida para quem ainda envolve conteúdo numa fala da Nyta. É a coluna inteira, sem casca —
 * o mesmo que o cartão, e o nome fica porque é assim que as chamadas leem.
 */
export const BolhaDaNyta = ({ children }: { children: ReactNode }) => (
  <View style={estilos.falaDaNyta}>{children}</View>
);

const estilos = StyleSheet.create({
  falaDaNyta: { width: '100%' },
  textoDaNyta: { fontSize: 15, lineHeight: 24.3, color: WZ.text },
  linhaDaResposta: { alignItems: 'flex-end' },
  resposta: {
    maxWidth: '84%',
    paddingVertical: 11, paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: WZ.surface2,
    color: WZ.ink,
    fontWeight: '600',
    fontSize: 15, lineHeight: 22.5,
  },
  pensando: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: WZ.faint },
  cartao: { width: '100%' },
  widget: { width: '100%' },
});
