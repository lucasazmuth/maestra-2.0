import { Circle, Path, Rect, Svg } from 'react-native-svg';

// Os três ícones das abas do editor, desenhados pelo dono do produto (`time line.svg`,
// `mix.svg` e `ficha.svg`).
//
// ⚠️ SÃO OS MESMOS CAMINHOS DA WEB, à vírgula — `src/pages/Catalog/daw/icones.tsx`. O editor é
// a mesma tela nas duas superfícies, e a fila de abas é a primeira coisa que a pessoa vê: dois
// desenhos parecidos mas não iguais seriam lidos como dois produtos. O `viewBox` recortado e a
// espessura reescrita também vêm de lá, e são o que faz `tamanho` querer dizer a mesma coisa
// nos quatro ícones da fila — o quarto é do Feather, e é dele que sai a proporção de 2 para 24
// a que os outros três foram acertados.

export const IconeDaTimeline = ({ tamanho = 15, cor }: { tamanho?: number; cor: string }) => (
  <Svg width={tamanho} height={tamanho} viewBox="-3.4 -4.88 34.02 34.02" fill="none">
    <Path
      d="M13.3608 5.45512V11.3846C13.3608 13.8406 15.3519 15.8316 17.8079 15.8316C20.264 15.8316 22.255 13.8406 22.255 11.3846V10.3963V5.45513C22.255 2.99908 20.264 1.00806 17.8079 1.00806C15.3519 1.00806 13.3608 2.99907 13.3608 5.45512Z"
      stroke={cor} strokeWidth={2.835} strokeLinecap="round"
    />
    <Path
      d="M9.40771 11.8784C9.40771 11.8784 10.396 19.7843 17.8077 19.7843M17.8077 19.7843C25.2195 19.7843 26.2078 11.8784 26.2078 11.8784M17.8077 19.7843V23.2432"
      stroke={cor} strokeWidth={2.835} strokeLinecap="round"
    />
    <Path d="M1.00781 6.0481H6.88783" stroke={cor} strokeWidth={2.835} strokeLinecap="round" />
    <Path d="M1.00781 12.7681H5.20782" stroke={cor} strokeWidth={2.835} strokeLinecap="round" />
    <Path d="M1.00781 19.488H6.88783" stroke={cor} strokeWidth={2.835} strokeLinecap="round" />
  </Svg>
);

export const IconeDoMixer = ({ tamanho = 15, cor }: { tamanho?: number; cor: string }) => (
  <Svg width={tamanho} height={tamanho} viewBox="7.87 7.87 24.68 24.68" fill="none">
    <Rect
      x={17.2588} y={11.3655} width={11.7865} height={17.6797} rx={2.94662}
      stroke={cor} strokeWidth={2.06263}
    />
    <Circle cx={23.1522} cy={23.1522} r={2.94662} fill={cor} />
    <Circle cx={23.152} cy={15.7856} r={1.47331} fill={cor} />
    <Circle cx={12.839} cy={27.5722} r={1.47331} fill={cor} />
    <Path
      d="M13.5757 22.4155H12.839C12.0253 22.4155 11.3657 21.7558 11.3657 20.9422V15.7856C11.3657 14.9719 12.0253 14.3123 12.839 14.3123H13.5757"
      stroke={cor} strokeWidth={2.06263} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);

/**
 * A ficha da gravação: a roda dentada do dono do produto (`ficha.svg`).
 *
 * ⚠️ O CÍRCULO DO MEIO VINHA ESPELHADO por um `matrix(1 0 0 -1 16.9766 23.1748)`. Num círculo,
 * espelhar é o mesmo que o pousar noutro sítio — e escrito assim as duas telas dizem a mesma
 * coisa, sem nenhuma depender de como o seu motor lê uma matriz. É a mesma correção que o
 * `IconeDeEnviar` levou, pelo mesmo motivo.
 */
export const IconeDaFicha = ({ tamanho = 15, cor }: { tamanho?: number; cor: string }) => (
  <Svg width={tamanho} height={tamanho} viewBox="5.3 4.8 30.1 30.1" fill="none">
    <Path
      d="M22.4406 8.82703H18.2078C17.9257 8.82703 17.6811 8.91869 17.4742 9.10203C17.2672 9.28536 17.145 9.51453 17.1073 9.78953L16.7687 12.347C16.5242 12.4387 16.2939 12.5487 16.0779 12.677C15.8612 12.8054 15.6494 12.9429 15.4425 13.0895L12.9875 12.0995C12.7241 12.0079 12.4607 11.9987 12.1974 12.072C11.934 12.1454 11.727 12.3012 11.5766 12.5395L9.4884 16.087C9.3379 16.3254 9.29087 16.582 9.34731 16.857C9.40374 17.132 9.54483 17.352 9.77058 17.517L11.887 19.0845C11.8681 19.2129 11.8587 19.3368 11.8587 19.4563V20.1988C11.8587 20.3176 11.8681 20.4412 11.887 20.5695L9.77058 22.137C9.54483 22.302 9.40374 22.522 9.34731 22.797C9.29087 23.072 9.3379 23.3287 9.4884 23.567L11.5766 27.1145C11.7082 27.3712 11.9103 27.5318 12.1827 27.5963C12.4558 27.6601 12.7241 27.6462 12.9875 27.5545L15.4425 26.5645C15.6494 26.7112 15.8657 26.8487 16.0915 26.977C16.3172 27.1054 16.543 27.2154 16.7687 27.307L17.1073 29.8645C17.145 30.1395 17.2672 30.3687 17.4742 30.552C17.6811 30.7354 17.9257 30.827 18.2078 30.827H22.4406C22.7228 30.827 22.9673 30.7354 23.1743 30.552C23.3812 30.3687 23.5035 30.1395 23.5411 29.8645L23.8797 27.307C24.1243 27.2154 24.3549 27.1054 24.5716 26.977C24.7876 26.8487 24.999 26.7112 25.206 26.5645L27.661 27.5545C27.9243 27.6462 28.1877 27.6554 28.4511 27.582C28.7145 27.5087 28.9214 27.3529 29.0719 27.1145L31.16 23.567C31.3105 23.3287 31.3576 23.072 31.3011 22.797C31.2447 22.522 31.1036 22.302 30.8779 22.137L28.7615 20.5695C28.7803 20.4412 28.7897 20.3176 28.7897 20.1988V19.4563C28.7897 19.3368 28.7709 19.2129 28.7333 19.0845L30.8496 17.517C31.0754 17.352 31.2165 17.132 31.2729 16.857C31.3294 16.582 31.2823 16.3254 31.1318 16.087L29.0437 12.567C28.8932 12.3287 28.6817 12.1681 28.4093 12.0852C28.1362 12.0031 27.8679 12.0079 27.6045 12.0995L25.206 13.0895C24.999 12.9429 24.7827 12.8054 24.557 12.677C24.3312 12.5487 24.1055 12.4387 23.8797 12.347L23.5411 9.78953C23.5035 9.51453 23.3812 9.28536 23.1743 9.10203C22.9673 8.91869 22.7228 8.82703 22.4406 8.82703Z"
      stroke={cor} strokeWidth={2.51}
    />
    <Circle cx={20.3244} cy={19.827} r={3.34783} stroke={cor} strokeWidth={2.51} />
  </Svg>
);

/**
 * O ícone de pôr um áudio na pista — desenho do dono do produto (`Group 33.svg`).
 *
 * ⚠️ ERA UMA SETA PARA BAIXO DENTRO DE UM CÍRCULO, e ao lado do M e do S lia-se "descarregar":
 * o gesto contrário do que o botão faz. Um ficheiro de música diz o que a pista vai RECEBER.
 *
 * O quadro é alargado para quadrado (o desenho vem 22 × 25) porque o botão é quadrado: esticar
 * os 22 até 25 de largura engorda a nota e entorta o cartão.
 *
 * O retângulo do ficheiro vinha espelhado por um `matrix(1 0 0 -1 1 23.75)`, que num retângulo
 * de cantos redondos é o mesmo que o pousar em (1; 3,75). Escrito assim, as duas telas dizem a
 * mesma coisa e nenhuma depende de como o seu motor lê uma matriz.
 *
 * O mesmo da web.
 */
export const IconeDeEnviar = ({ tamanho = 15, cor }: { tamanho?: number; cor: string }) => (
  <Svg width={tamanho} height={tamanho} viewBox="-1.5 0 25 25" fill="none">
    <Rect
      x={1} y={3.75} width={20} height={20} rx={3}
      stroke={cor} strokeWidth={2} strokeLinejoin="round"
    />
    <Path
      d="M3 3.75H19C19 2.09315 17.6569 0.75 16 0.75H6C4.34315 0.75 3 2.09315 3 3.75Z"
      stroke={cor} strokeWidth={1.5} strokeLinejoin="round"
    />
    <Path
      d="M11.5125 14.7059V9.375C11.5125 9.02982 11.7923 8.75 12.1375 8.75H14.2539M11.5125 14.7059V17.7229C11.5125 18.2777 11.1186 18.7612 10.5639 18.7489C9.60192 18.7275 8.25391 18.3937 8.25391 16.6912C8.25391 14.0441 11.5125 14.7059 11.5125 14.7059Z"
      stroke={cor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);
