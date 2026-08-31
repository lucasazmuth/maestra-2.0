import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

// O emblema da Nyta: a estrela de quatro pontas do set do design.
//
// Os `d` e as paradas do gradiente são copiados literalmente de
// `src/components/nyta/NytaEmblem.tsx` — `src/__tests__/emblemaNyta.test.ts` quebra se um dos
// dois mudar sozinho.
//
// Em REPOUSO só a estrela aparece, e parada: ela está em toda mensagem do chat, e dezenas dela
// se mexendo ao mesmo tempo viram ruído. PENSANDO, o conjunto gira e as três formas do set se
// revezam — a estrela vira o rastro de giro, que vira o flare, que volta a pousar como estrela.
// É a mesma volta de 2,4s da web, com as mesmas janelas de crossfade.

const ESTRELA = 'M12 0C13.4908 7.48588 16.4707 10.4947 24 12C16.469 13.5053 13.4891 16.5141 12 24C10.5092 16.5141 7.52927 13.5035 0 12C7.53102 10.4947 10.5109 7.48588 12 0Z';
const RASTRO = 'M23.9623 0.0378516C17.3728 6.66832 17.3852 17.3852 24 24C17.3852 17.3852 6.6682 17.3726 0.0377344 23.9621C6.62719 17.3318 6.61477 6.61477 0 0C6.61477 6.61477 17.3318 6.62754 23.9623 0.0378516Z';
const FLARE = 'M1.86419 22.5938C6.74265 18.9135 9.18188 17.0734 12 17.0734C14.8182 17.0734 17.2574 18.9135 22.1359 22.5938L24 24L22.5937 22.1359C18.9135 17.2575 17.0733 14.8182 17.0733 12.0001C17.0733 9.18192 18.9135 6.74269 22.5937 1.86422L24 5.60626e-05L22.1359 1.40634C17.2574 5.08659 14.8182 6.92672 12 6.92672C9.18188 6.92672 6.74266 5.08659 1.8642 1.40634L-1.52588e-05 0L1.40632 1.86421C5.08656 6.74269 6.92668 9.18192 6.92668 12.0001C6.92668 14.8182 5.08656 17.2575 1.40632 22.1359L3.19758e-05 24.0001L1.86419 22.5938Z';

/** A volta completa do revezamento, em milissegundos (`nytaEmblemSpin` na folha). */
const VOLTA = 2400;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

export const EmblemaNyta = ({ size = 22, pensando = false }: { size?: number; pensando?: boolean }) => {
  const ciclo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!pensando) { ciclo.setValue(0); return undefined; }
    const laco = Animated.loop(Animated.timing(ciclo, {
      toValue: 1, duration: VOLTA, easing: Easing.linear, useNativeDriver: true,
    }));
    laco.start();
    return () => laco.stop();
  }, [pensando, ciclo]);

  // As MESMAS janelas da folha: estrela até 8%, rastro entre 20 e 40%, flare entre 52 e 78%,
  // estrela de novo a partir de 92%. Elas se sobrepõem ~12% — com o conjunto girando, o
  // crossfade lê como uma forma virando a outra.
  const opacidade = (paradas: number[], valores: number[]) =>
    (pensando
      ? ciclo.interpolate({ inputRange: paradas, outputRange: valores })
      : undefined);

  const daEstrela = opacidade([0, 0.08, 0.2, 0.78, 0.92, 1], [1, 1, 0, 0, 1, 1]);
  const doRastro = opacidade([0, 0.08, 0.2, 0.4, 0.52, 1], [0, 0, 1, 1, 0, 0]);
  const doFlare = opacidade([0, 0.4, 0.52, 0.78, 0.92, 1], [0, 0, 1, 1, 0, 0]);
  const giroEmGraus = pensando
    ? (ciclo.interpolate({ inputRange: [0, 1], outputRange: [0, 180] }) as unknown as number)
    : 0;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Defs>
        {/* O mesmo degradê do botão "Nyta IA" do rail: #a143ff -> #7420f1. A cor da Nyta é essa —
            o azul de ação é do resto do app, não dela. */}
        <LinearGradient id="nyta" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
          <Stop stopColor="#a143ff" />
          <Stop offset="1" stopColor="#7420f1" />
        </LinearGradient>
      </Defs>
      {/* O giro é do GRUPO, em torno do centro da viewBox: as três formas são simétricas em 90°,
          então a volta de 180° fecha sem pulo. */}
      <AnimatedG origin="12, 12" rotation={giroEmGraus}>
        <AnimatedPath d={ESTRELA} fill="url(#nyta)" opacity={daEstrela} />
        {pensando && <AnimatedPath d={RASTRO} fill="url(#nyta)" opacity={doRastro} />}
        {pensando && <AnimatedPath d={FLARE} fill="url(#nyta)" opacity={doFlare} />}
      </AnimatedG>
    </Svg>
  );
};
