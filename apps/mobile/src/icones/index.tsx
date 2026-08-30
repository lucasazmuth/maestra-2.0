import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

import AgendaSvg from '@/assets/icons/agenda.svg';
import MaestraLogoSvg from '@/assets/icons/maestra-logo.svg';
import MaestraSimboloSvg from '@/assets/brand/maestra-symbol.svg';
import MaestraPalavraSvg from '@/assets/brand/maestra-wordmark.svg';
import CatalogoSvg from '@/assets/icons/catalogo.svg';
import ConfigSvg from '@/assets/icons/config.svg';
import DiagnosticoSvg from '@/assets/icons/diagnostico.svg';
import EquipeSvg from '@/assets/icons/equipe.svg';
import EspacoJamSvg from '@/assets/icons/espaco-jam.svg';
import MoreSvg from '@/assets/icons/more.svg';
import NotificationSvg from '@/assets/icons/notification.svg';
import PerfisSvg from '@/assets/icons/perfis.svg';
import PlanejamentoSvg from '@/assets/icons/planejamento.svg';
import PlanoAcaoSvg from '@/assets/icons/plano-acao.svg';

// Os ícones do sistema, os MESMOS arquivos da web.
//
// Espelha `src/components/Icons/system.tsx`, inclusive os recortes de `viewBox`: o traço ocupa
// ~6..35 num box de 41, e sem o recorte cada ícone renderiza pequeno demais dentro da própria
// caixa. Os valores não são estéticos — são os que a web já calibrou, e mudá-los aqui faria os
// ícones terem tamanhos visualmente diferentes nas duas superfícies.
//
// `stroke="currentColor"` nos arquivos: o `react-native-svg` resolve isso pela prop `color`.

type Props = { size?: number; color?: string };

const recortar = (Svg: FC<SvgProps>, viewBox = '6 6 29 29'): FC<Props> =>
  ({ size = 22, color }) => <Svg viewBox={viewBox} width={size} height={size} color={color} />;

export const PlanoAcaoIcon = recortar(PlanoAcaoSvg);
export const CatalogoIcon = recortar(CatalogoSvg, '4 4 33 33');
export const AgendaIcon = recortar(AgendaSvg);
export const MoreIcon = recortar(MoreSvg, '8 16 25 9');
export const DiagnosticoIcon = recortar(DiagnosticoSvg);
export const PlanejamentoIcon = recortar(PlanejamentoSvg);
export const EquipeIcon = recortar(EquipeSvg, '4 6 33 29');
export const PerfisIcon = recortar(PerfisSvg, '9 8 22 23');
export const NotificationIcon = recortar(NotificationSvg);
export const ConfigIcon = recortar(ConfigSvg, '6 6 30 30');
// Traço ocupa ~16..34 num box de 50 — o recorte é o mesmo que a web calibrou.
export const EspacoJamIcon = recortar(EspacoJamSvg, '13 15 24 21');

/**
 * O logotipo — a marca, e não um ícone de sistema.
 *
 * Vem da pasta da referência de design (`src/assets/gsap-reference`), e não do set de ícones;
 * por isso não leva recorte de `viewBox`: o arquivo já é o desenho inteiro.
 */
export const MaestraLogo = ({ size = 22, color }: Props) => (
  <MaestraLogoSvg width={size} height={size} color={color} />
);

/**
 * A MARCA, no travessão: símbolo mais a palavra "Maestra".
 *
 * Os dois são os vetores oficiais (`src/assets/brand/`), os MESMOS que a web usa no
 * `MaestraBrand`. Eu vinha desenhando o símbolo e escrevendo "Maestra" num `<Text>` — a palavra
 * saía na fonte do app, e não no lettering da marca. De perto é outra logo.
 *
 * As proporções são as da folha da web: a palavra tem 620/121 de razão e ocupa 0,68 da altura
 * do símbolo, com 0,28em de vão entre os dois.
 */
export const MaestraMarca = ({ size = 24, color }: Props) => {
  const alturaDaPalavra = size * 0.68;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.28 }}>
      <MaestraSimboloSvg width={size} height={size} color={color} />
      <MaestraPalavraSvg
        width={alturaDaPalavra * (620 / 121)}
        height={alturaDaPalavra}
        color={color}
      />
    </View>
  );
};

/** Marketing é o único que a web NÃO tira de um arquivo: lá é o `FiTrendingUp` do Feather. */
export const MarketingIcon: FC<Props> = ({ size = 22, color }) => (
  <Feather name="trending-up" size={size} color={color} />
);
