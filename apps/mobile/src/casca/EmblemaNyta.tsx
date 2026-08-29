import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

// O emblema da Nyta: a estrela de quatro pontas do set do design.
//
// O `d` e as paradas do gradiente são copiados literalmente de `src/components/nyta/NytaEmblem.tsx`
// — `src/__tests__/emblemaNyta.test.ts` quebra se um dos dois mudar sozinho.
//
// A web tem outras duas formas (o rastro de giro e o flare) que se revezam quando a Nyta está
// pensando. Aqui só a estrela em repouso, porque é só isso que o botão do cabeçalho mostra; o
// ciclo de "pensando" vem junto com a tela de chat, que é quem tem o estado para acioná-lo.

const ESTRELA = 'M12 0C13.4908 7.48588 16.4707 10.4947 24 12C16.469 13.5053 13.4891 16.5141 12 24C10.5092 16.5141 7.52927 13.5035 0 12C7.53102 10.4947 10.5109 7.48588 12 0Z';

export const EmblemaNyta = ({ size = 22 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Defs>
      {/* O mesmo degradê do botão "Nyta IA" do rail: #a143ff -> #7420f1. A cor da Nyta é essa —
          o azul de ação é do resto do app, não dela. */}
      <LinearGradient id="nyta" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
        <Stop stopColor="#a143ff" />
        <Stop offset="1" stopColor="#7420f1" />
      </LinearGradient>
    </Defs>
    <Path d={ESTRELA} fill="url(#nyta)" />
  </Svg>
);
