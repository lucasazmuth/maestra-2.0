import { useMemo } from 'react';
import { View } from 'react-native';

import { SvgXml } from 'react-native-svg';

import { svgDaPlaca, type RealTier } from '@maestra/core/constants/realBadge';

// A placa da fase REAL — o MESMO SVG da web.
//
// Não é um desenho refeito: é a string que o núcleo guarda, entregue ao `react-native-svg`. A
// web faz o mesmo com `dangerouslySetInnerHTML`; aqui o `SvgXml` cumpre o papel.
//
// O `uid` por instância não é zelo: o SVG traz gradientes e filtros com id fixo, e a grade dos
// 16 perfis desenha cinco placas na mesma tela — sem o sufixo, a segunda herdaria o gradiente
// da primeira e todas ficariam da mesma cor.

export const Placa = ({ tier, rotulo, tamanho = 64 }: {
  tier: RealTier;
  rotulo: string;
  tamanho?: number;
}) => {
  const uid = useMemo(() => `pl${Math.random().toString(36).slice(2, 8)}`, []);
  const xml = useMemo(() => svgDaPlaca(tier, rotulo, uid), [tier, rotulo, uid]);

  return (
    <View
      style={{
        width: tamanho,
        height: tamanho,
        // Nível 0 (base) é a placa Standard em cinza — a web resolve com `filter: grayscale(1)`,
        // que o React Native não tem. A opacidade reduzida é o que mais perto chega de dizer
        // "esta ainda não acendeu" sem inventar uma quinta placa.
        opacity: tier === 'base' ? 0.55 : 1,
      }}
      accessibilityLabel={`Placa ${tier} · ${rotulo}`}
    >
      <SvgXml xml={xml} width="100%" height="100%" />
    </View>
  );
};
