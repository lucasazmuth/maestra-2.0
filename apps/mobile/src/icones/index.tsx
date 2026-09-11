import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import type { FC } from 'react';
import Svg, { Path, type SvgProps } from 'react-native-svg';

import AgendaSvg from '@/assets/icons/agenda.svg';
import MaestraLogoSvg from '@/assets/icons/maestra-logo.svg';
import MaestraSimboloSvg from '@/assets/brand/maestra-symbol.svg';
import MaestraPalavraSvg from '@/assets/brand/maestra-wordmark.svg';
import CatalogoSvg from '@/assets/icons/catalogo.svg';
import ConfigSvg from '@/assets/icons/config.svg';
import DiagnosticoSvg from '@/assets/icons/diagnostico.svg';
import EquipeSvg from '@/assets/icons/equipe.svg';
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

/**
 * O "G" do Google, nas quatro cores oficiais.
 *
 * Desenhado aqui, e não importado: a web usa o `FcGoogle` do `react-icons`, que é uma
 * biblioteca de DOM e não roda no React Native. Os caminhos são os do arquivo de marca do
 * Google, e a cor NÃO é parametrizável de propósito — as diretrizes de marca deles proíbem
 * recolorir o logotipo, exatamente como as da Apple proíbem para o símbolo dela.
 */
export const GoogleIcon: FC<{ size?: number }> = ({ size = 20 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      fill="#4285F4"
      d="M23.9999 12.2727C23.9999 11.4218 23.9235 10.6036 23.7817 9.81818H12.2453V14.46H18.8326C18.5489 15.9891 17.6871 17.2854 16.3908 18.1554V21.1663H20.3508C22.6671 19.0345 23.9999 15.8945 23.9999 12.2727Z"
    />
    <Path
      fill="#34A853"
      d="M12.2453 24C15.5453 24 18.3126 22.9091 20.3508 21.1664L16.3908 18.1555C15.2999 18.8873 13.9053 19.3227 12.2453 19.3227C9.06168 19.3227 6.36713 17.1709 5.40532 14.28H1.31805V17.3891C3.34532 21.4145 7.4708 24 12.2453 24Z"
    />
    <Path
      fill="#FBBC05"
      d="M5.40527 14.28C5.16073 13.548 5.02164 12.7664 5.02164 11.9999C5.02164 11.2335 5.16073 10.4519 5.40527 9.71993V6.61084H1.318C0.479821 8.27993 0 10.0908 0 11.9999C0 13.9091 0.479821 15.72 1.318 17.3891L5.40527 14.28Z"
    />
    <Path
      fill="#EA4335"
      d="M12.2453 4.67727C14.0453 4.67727 15.6544 5.29636 16.9271 6.50727L20.4326 3.00182C18.3071 1.09273 15.5453 0 12.2453 0C7.4708 0 3.34532 2.58545 1.31805 6.61091L5.40532 9.72C6.36713 6.82909 9.06168 4.67727 12.2453 4.67727Z"
    />
  </Svg>
);

/** Marketing é o único que a web NÃO tira de um arquivo: lá é o `FiTrendingUp` do Feather. */
export const MarketingIcon: FC<Props> = ({ size = 22, color }) => (
  <Feather name="trending-up" size={size} color={color} />
);
