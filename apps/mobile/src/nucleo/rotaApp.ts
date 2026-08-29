import { useLocalSearchParams, usePathname } from 'expo-router';

import { configurarRota } from '@maestra/core/nucleo/rota';

// A porta de rota do núcleo, na implementação do Expo Router.
//
// Três hooks do núcleo precisam saber em que tela a pessoa está — `useArtist`, `useNytaChat` e
// `useActiveModuleContext`. Na web quem responde é o `react-router-dom`; aqui é isto.
//
// O registro acontece no escopo do módulo, e não num efeito: `useRota` é chamado durante a
// renderização dos hooks do núcleo, então um registro tardio já teria perdido a primeira volta.

export const ligarRotaDoApp = (): void => {
  configurarRota(() => {
    const caminho = usePathname();
    const parametros = useLocalSearchParams();

    return {
      caminho,
      // Os parâmetros do Expo Router podem vir como lista (`?a=1&a=2`); a porta promete string.
      parametros: Object.fromEntries(
        Object.entries(parametros).map(([chave, valor]) => [
          chave,
          Array.isArray(valor) ? valor[0] : valor,
        ]),
      ),
    };
  });
};
