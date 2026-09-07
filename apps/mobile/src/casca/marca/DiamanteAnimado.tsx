import { useMemo } from 'react';

import LottieView, { type AnimationObject } from 'lottie-react-native';

import { TONE_STOPS, paintDiamond, type PlanTone } from '@maestra/core/constants/planTagLottie';

import diamanteCru from '@/assets/lottie/gradient-diamond.json';

// O diamante do plano, em Lottie e em loop.
//
// As cores TÊM que ser injetadas no JSON: o Lottie não herda `currentColor`. A pintura e as
// paletas moram no núcleo, para as duas superfícies terem o mesmo diamante.

export const DiamanteAnimado = ({ tom, tamanho }: { tom: PlanTone; tamanho: number }) => {
  // `as AnimationObject`: a pintura devolve o JSON genérico (ela caminha na árvore sem saber o
  // formato), e o tipo do Lottie é a forma concreta do arquivo. É a mesma peça.
  const fonte = useMemo(
    () => paintDiamond(diamanteCru, TONE_STOPS[tom]) as unknown as AnimationObject,
    [tom],
  );

  return <LottieView source={fonte} autoPlay loop style={{ width: tamanho, height: tamanho }} />;
};
