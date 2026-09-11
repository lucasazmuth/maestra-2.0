import { Circle, Path, Rect, Svg } from 'react-native-svg';

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

/** O ícone de enviar um ficheiro para uma pista — `export.svg`, o mesmo da web. */
export const IconeDeEnviar = ({ tamanho = 15, cor }: { tamanho?: number; cor: string }) => (
  <Svg width={tamanho} height={tamanho} viewBox="7.6 7.6 25.3 25.3" fill="none">
    <Path
      d="M20.2054 15.1538V25.016M16.8379 21.6484L20.2054 25.016L23.573 21.6484"
      stroke={cor} strokeWidth={2.02054} strokeLinecap="round" strokeLinejoin="round"
    />
    <Circle cx={20.2055} cy={20.2052} r={9.26081} stroke={cor} strokeWidth={1.68378} />
  </Svg>
);
