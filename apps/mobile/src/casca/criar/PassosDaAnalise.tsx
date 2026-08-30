import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_DIAGNOSTICO } from '@maestra/core/constants/design';
import { PASSOS_DA_ANALISE } from '@maestra/core/constants/quizDoDiagnostico';

// A lista "pensante" enquanto o motor roda.
//
// Os passos sobem um a um dentro de uma janela de cinco linhas: o do CENTRO nítido, os vizinhos
// esmaecidos, as pontas invisíveis. É a mesma peça da web, e ela existe porque a espera é de
// vários segundos — um spinner mudo não diria que há uma busca no Spotify, um cruzamento com o
// quiz e um cálculo do índice acontecendo.
//
// Os rótulos vêm do núcleo: eles descrevem o que a edge de fato consulta.

const ICONES = [
  'music', 'share-2', 'trending-up', 'git-merge',
  'dollar-sign', 'radio', 'bar-chart-2', 'award',
] as const;

const ALTURA = 56;
const DESCANSO = 1500;
const SUBIDA = 620;

/**
 * A máscara de gradiente da web, virada opacidade.
 *
 * `mask-image` não existe no React Native. O que ela produz é uma curva de opacidade em função
 * da posição na janela — e é essa curva que está aqui, lida no gradiente da folha nas cinco
 * alturas onde as linhas param: transparente nas pontas, 0.1→0.36 nas vizinhas, 1 no centro.
 * Como ela é interpolada a partir do MESMO valor que move a lista, o esmaecer acompanha o
 * deslizar em vez de piscar a cada passo.
 */
const OPACIDADES = [0.05, 0.36, 1, 0.36, 0.05];

export const PassosDaAnalise = () => {
  const [passo, setPasso] = useState(0);
  const deslocamento = useRef(new Animated.Value(0)).current;
  const total = PASSOS_DA_ANALISE.length;

  useEffect(() => {
    const conta = setInterval(() => setPasso((p) => p + 1), DESCANSO);
    return () => clearInterval(conta);
  }, []);

  // O laço não tem emenda: a lista é DUPLICADA e, ao terminar o primeiro ciclo, volta ao início
  // sem animação — o conteúdo ali é idêntico, então o salto não se vê.
  useEffect(() => {
    if (passo === total) {
      const volta = setTimeout(() => { deslocamento.setValue(0); setPasso(0); }, SUBIDA);
      return () => clearTimeout(volta);
    }
    Animated.timing(deslocamento, {
      toValue: -passo * ALTURA,
      duration: SUBIDA,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
    return undefined;
  }, [passo, total, deslocamento]);

  return (
    <View
      style={estilos.janela}
      accessibilityRole="progressbar"
      accessibilityLabel="Analisando os dados do seu diagnóstico"
    >
      <Animated.View
        style={[estilos.trilha, { transform: [{ translateY: deslocamento }] }]}
      >
        {[...PASSOS_DA_ANALISE, ...PASSOS_DA_ANALISE].map((rotulo, i) => (
          <Animated.View
            key={`${rotulo}-${i}`}
            style={[estilos.linha, {
              opacity: deslocamento.interpolate({
                inputRange: [
                  -(i + 2) * ALTURA, -(i + 1) * ALTURA, -i * ALTURA,
                  -(i - 1) * ALTURA, -(i - 2) * ALTURA,
                ],
                outputRange: OPACIDADES,
                extrapolate: 'clamp',
              }),
            }]}
          >
            <Feather name={ICONES[i % total]} size={20} color={COR.primaria} />
            <Text style={estilos.texto} numberOfLines={1}>{rotulo}</Text>
          </Animated.View>
        ))}
      </Animated.View>
    </View>
  );
};

const estilos = StyleSheet.create({
  janela: { height: ALTURA * 5, overflow: 'hidden', marginVertical: 40 },
  // A lista nasce dois lugares abaixo para que o PRIMEIRO passo já apareça no centro.
  trilha: { marginTop: ALTURA * 2 },
  linha: {
    height: ALTURA, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 14, paddingHorizontal: 16,
  },
  texto: {
    fontSize: 16.5, fontWeight: '600', letterSpacing: -0.165, color: COR_DIAGNOSTICO.titulo,
  },
});
