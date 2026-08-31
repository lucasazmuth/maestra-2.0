import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import { Marcacao } from '@/casca/wizard/Marcacao';
import { WZ, WZ_MEDIDA } from '@/casca/wizard/cores';

// As bolhas do fio da conversa.
//
// A da Nyta entra pela esquerda, com o emblema ao lado e o canto de baixo à esquerda quadrado; a
// de quem responde entra pela direita, azul-clara, com o canto de baixo à direita quadrado — é o
// rabinho que diz quem falou, sem precisar de rótulo.

export const BolhaDaNyta = ({ children }: { children: ReactNode }) => (
  <View style={estilos.linha}>
    <EmblemaNyta size={WZ_MEDIDA.avatar} />
    <View style={estilos.bolha}>{children}</View>
  </View>
);

export const FalaDaNyta = ({ texto }: { texto: string }) => (
  <BolhaDaNyta><Marcacao texto={texto} estilo={estilos.textoDaNyta} /></BolhaDaNyta>
);

export const FalaDeQuemResponde = ({ texto }: { texto: string }) => (
  <View style={[estilos.linha, estilos.linhaDoUsuario]}>
    <View style={[estilos.bolha, estilos.bolhaDoUsuario]}>
      <Text style={estilos.textoDoUsuario}>{texto}</Text>
    </View>
  </View>
);

/** Os três pontinhos enquanto a Nyta "pensa". */
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
    <View style={estilos.linha}>
      <EmblemaNyta size={WZ_MEDIDA.avatar} pensando />
      <View style={[estilos.bolha, estilos.pensando]} accessibilityLabel="Nyta está digitando">
        {pontos.map((valor, i) => (
          <Animated.View key={i} style={[estilos.ponto, { opacity: valor }]} />
        ))}
      </View>
    </View>
  );
};

/**
 * Um cartão que a Nyta "envia": mesma linha e mesmo emblema de uma fala dela, sem a casca da
 * bolha — o conteúdo traz a própria moldura. Sem o emblema, o cartão parecia aparecer sozinho na
 * conversa, sem autor.
 */
export const CartaoDaNyta = ({ children }: { children: ReactNode }) => (
  <View style={[estilos.linha, estilos.linhaDeCartao]}>
    <EmblemaNyta size={WZ_MEDIDA.avatar} />
    <View style={estilos.cartao}>{children}</View>
  </View>
);

/**
 * Onde o widget do beat atual é desenhado. Recuado para alinhar com as bolhas: o emblema mais o
 * vão da linha, que é a mesma conta da folha (`--wiz-avatar` + o gap de 10px).
 */
export const LugarDoWidget = ({ children }: { children: ReactNode }) => (
  <View style={estilos.widget}>{children}</View>
);

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  linhaDoUsuario: { justifyContent: 'flex-end' },
  linhaDeCartao: { alignItems: 'flex-start' },
  bolha: {
    maxWidth: '78%',
    paddingVertical: 13, paddingHorizontal: 16,
    borderRadius: 14, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: WZ.bolhaContorno, backgroundColor: WZ.surface,
    shadowColor: 'rgb(105, 122, 159)', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  textoDaNyta: { fontSize: 14, lineHeight: 21.7, color: WZ.text },
  bolhaDoUsuario: {
    borderBottomLeftRadius: 14, borderBottomRightRadius: 4,
    borderColor: 'transparent', backgroundColor: WZ.blueSoft,
    shadowOpacity: 0, elevation: 0,
  },
  textoDoUsuario: { fontSize: 14, lineHeight: 21.7, fontWeight: '600', color: WZ.blueInk },
  pensando: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ponto: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: WZ.faint },
  cartao: { flex: 1, minWidth: 0 },
  widget: { paddingLeft: WZ_MEDIDA.avatar + 10 },
});
