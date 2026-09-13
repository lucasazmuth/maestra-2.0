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
/**
 * O SÍMBOLO sozinho, sem a palavra.
 *
 * É a mesma peça que a `MaestraMarca` usa à esquerda, exportada porque a espera das telas a
 * mostra sozinha, a respirar (ver `casca/Carregando.tsx`) — ali a palavra não cabe nem serve.
 */
export const MaestraSimbolo = ({ size = 24, color }: Props) => (
  <MaestraSimboloSvg width={size} height={size} color={color} />
);

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

/**
 * O envelope do Gmail e o balão do WhatsApp, na tela de suporte.
 *
 * Desenhados aqui pela MESMA razão do "G" acima: a web importa os SVGs de
 * `src/assets/icons/`, e um `.svg` importado não atravessa para o React Native sem um
 * transformador. Os caminhos são os daqueles ficheiros, à vírgula.
 *
 * ⚠️ E A COR NÃO É PARAMETRIZÁVEL, também pela mesma razão: são logotipos de terceiros, e
 * recolori-los é o que as diretrizes de marca deles proíbem. Um WhatsApp azul não é um atalho
 * de estilo, é outro produto.
 */
export const GmailIcon: FC<{ size?: number }> = ({ size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill="#4285F4" d="M1.63641 21H5.45456V11.59L0 7.43848V19.3394C0 20.2569 0.732281 21.0001 1.63641 21.0001V21Z" />
    <Path fill="#34A853" d="M18.5454 21H22.3636C23.2677 21 24 20.2568 24 19.3394V7.43848L18.5454 11.59V21Z" />
    <Path fill="#FBBC04" d="M18.5454 4.39405V11.59L24 7.43847V5.22437C24 3.17215 21.6914 2.00005 20.0727 3.23166L18.5454 4.39405Z" />
    <Path fillRule="evenodd" clipRule="evenodd" fill="#EA4335" d="M5.45459 11.5899V4.39404L12 9.37585L18.5455 4.39404V11.5899L12 16.5717L5.45459 11.5899Z" />
    <Path fill="#C5221F" d="M0 5.22437V7.43847L5.45456 11.59V4.39406L3.92728 3.23166C2.30859 2.00005 0 3.17215 0 5.22428V5.22437Z" />
  </Svg>
);

export const WhatsappIcon: FC<{ size?: number }> = ({ size = 22 }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path fill="#00E676" d="M6.34345 20.555L6.7358 20.749C8.37079 21.7185 10.2018 22.171 12.033 22.171C17.7878 22.171 22.4963 17.517 22.4963 11.8288C22.4963 9.11406 21.3845 6.46387 19.4227 4.52469C17.4608 2.5855 14.8449 1.48669 12.033 1.48669C6.27811 1.48669 1.56951 6.14066 1.63495 11.8935C1.63495 13.8326 2.22351 15.7072 3.20442 17.3231L3.46598 17.711L2.41973 21.5247L6.34345 20.555Z" />
    <Path fill="#FFFFFF" d="M20.5343 3.49047C18.3109 1.22817 15.2373 0 12.0983 0C5.42794 0 0.0654375 5.36497 0.130781 11.8934C0.130781 13.9619 0.719344 15.9657 1.70034 17.7756L0 23.9162L6.34341 22.3003C8.10909 23.2699 10.0709 23.7224 12.0329 23.7224C18.6379 23.7224 24.0004 18.3573 24.0004 11.8289C24.0004 8.66159 22.7577 5.68819 20.5343 3.49047ZM12.0983 21.7186C10.3326 21.7186 8.56687 21.2662 7.06275 20.3613L6.67041 20.1673L2.87747 21.1369L3.85837 17.4525L3.59681 17.0646C0.719344 12.4754 2.09269 6.3992 6.80119 3.55506C11.5097 0.711012 17.5915 2.06845 20.469 6.72241C23.3464 11.3764 21.973 17.3878 17.2646 20.2319C15.7604 21.2015 13.9294 21.7185 12.0983 21.7185V21.7186ZM17.8531 14.5438L17.1337 14.2206C17.1337 14.2206 16.0875 13.7681 15.4335 13.4449C15.3681 13.4449 15.3027 13.3802 15.2373 13.3802C15.0411 13.3802 14.9103 13.4449 14.7795 13.5096C14.7795 13.5096 14.7142 13.5742 13.7986 14.6084C13.7332 14.7377 13.6024 14.8023 13.4716 14.8023H13.4062C13.3408 14.8023 13.21 14.7377 13.1446 14.6731L12.8176 14.5438C12.0982 14.2206 11.4443 13.8327 10.9211 13.3156C10.7903 13.1864 10.5941 13.0571 10.4633 12.9278C10.0056 12.4754 9.54778 11.9582 9.22087 11.3765L9.15544 11.2472C9.09009 11.1825 9.09009 11.1179 9.02466 10.9887C9.02466 10.8594 9.02466 10.7301 9.09009 10.6655C9.09009 10.6655 9.35166 10.3422 9.54778 10.1484C9.67866 10.019 9.744 9.82517 9.87478 9.69591C10.0056 9.50196 10.071 9.24343 10.0056 9.04948C9.94022 8.72627 9.15544 6.98103 8.95931 6.59324C8.82844 6.39929 8.69775 6.3347 8.50153 6.27002H7.78219C7.65131 6.27002 7.52062 6.3347 7.38975 6.3347L7.32431 6.39929C7.19353 6.46397 7.06275 6.59324 6.93197 6.65782C6.80119 6.78718 6.73575 6.91636 6.60497 7.04571C6.14719 7.62746 5.88562 8.33847 5.88562 9.04948C5.88562 9.56655 6.01641 10.0837 6.21262 10.5362L6.27806 10.7301C6.86663 11.9582 7.65131 13.0571 8.69775 14.0267L8.95931 14.2852C9.15544 14.4791 9.35166 14.6084 9.48244 14.8023C10.8558 15.9658 12.4252 16.8061 14.1909 17.2586C14.3872 17.3232 14.6487 17.3232 14.8449 17.3879H15.4988C15.8258 17.3879 16.2182 17.2586 16.4798 17.1293C16.676 17.0001 16.8068 17.0001 16.9375 16.8708L17.0684 16.7414C17.1992 16.6122 17.33 16.5476 17.4608 16.4183C17.5915 16.2891 17.7223 16.1598 17.7878 16.0304C17.9185 15.7719 17.9839 15.4487 18.0493 15.1256V14.6731C18.0493 14.6731 17.9839 14.6084 17.8531 14.5438Z" />
  </Svg>
);

/** Marketing é o único que a web NÃO tira de um arquivo: lá é o `FiTrendingUp` do Feather. */
export const MarketingIcon: FC<Props> = ({ size = 22, color }) => (
  <Feather name="trending-up" size={size} color={color} />
);
