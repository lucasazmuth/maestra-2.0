import { Path, Rect, Svg } from 'react-native-svg';

// Os dois ícones das abas do editor, desenhados pelo dono do produto (`timeline.svg` e
// `mixer.svg`).
//
// ⚠️ SÃO OS MESMOS CAMINHOS DA WEB, à vírgula — `src/pages/Catalog/daw/icones.tsx`. O editor é
// a mesma tela nas duas superfícies, e a fila de abas é a primeira coisa que a pessoa vê: dois
// desenhos parecidos mas não iguais seriam lidos como dois produtos. O `viewBox` recortado
// também vem de lá, e é o que faz `tamanho` querer dizer a mesma coisa nos quatro ícones da
// fila (os outros dois são do Feather, que enche 75–83 % do seu quadro).

export const IconeDaTimeline = ({ tamanho = 15, cor }: { tamanho?: number; cor: string }) => (
  <Svg width={tamanho} height={tamanho} viewBox="8.2 8.2 24 24" fill="none">
    <Path
      d="M19.3636 11.7866H14.5929C13.043 11.7866 11.7866 13.043 11.7866 14.5929C11.7866 16.1428 13.043 17.3992 14.5929 17.3992H19.3636"
      stroke={cor} strokeWidth={2.3573} strokeLinecap="round"
    />
    <Path
      d="M11.7866 23.0117L28.6245 23.0117"
      stroke={cor} strokeWidth={2.3573} strokeLinecap="round" strokeLinejoin="round"
    />
    <Path
      d="M11.7866 28.624L28.6245 28.624"
      stroke={cor} strokeWidth={2.3573} strokeLinecap="round" strokeLinejoin="round"
    />
    <Path
      d="M23.573 14.3123H26.0987M28.6244 14.3123H26.0987M26.0987 14.3123V11.7866M26.0987 14.3123V16.838"
      stroke={cor} strokeWidth={2.02054} strokeLinecap="round" strokeLinejoin="round"
    />
  </Svg>
);

export const IconeDoMixer = ({ tamanho = 15, cor }: { tamanho?: number; cor: string }) => (
  <Svg width={tamanho} height={tamanho} viewBox="7.2 7.1 26.3 26.3" fill="none">
    <Path
      d="M19.8269 13.0864H12.8269C11.7223 13.0864 10.8269 13.9819 10.8269 15.0864C10.8269 16.191 11.7223 17.0864 12.8269 17.0864H19.8269"
      stroke={cor} strokeWidth={2} strokeLinecap="round"
    />
    <Rect
      x={23.5961} y={12.0864} width={6.23077} height={6.23077} rx={3.11538}
      stroke={cor} strokeWidth={2}
    />
    <Path
      d="M20.8269 27.3174L27.8269 27.3174C28.9315 27.3174 29.8269 26.422 29.8269 25.3174C29.8269 24.2128 28.9315 23.3174 27.8269 23.3174L20.8269 23.3174"
      stroke={cor} strokeWidth={2} strokeLinecap="round"
    />
    <Rect
      x={17.0577} y={28.3174} width={6.23077} height={6.23077} rx={3.11538}
      transform="rotate(-180 17.0577 28.3174)"
      stroke={cor} strokeWidth={2}
    />
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
