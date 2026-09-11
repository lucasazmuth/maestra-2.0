import { FC } from 'react';

// Os dois ícones das abas, desenhados pelo dono do produto (`timeline.svg` e `mixer.svg`).
//
// ⚠️ O traço foi trocado de `#898989` para `currentColor`: assim o ícone acompanha o estado da
// aba (aceso quando escolhida, apagado quando não) em vez de ficar cinza para sempre. Os
// caminhos são os originais, à vírgula — o desenho é dele.
//
// ─── Por que o `viewBox` não é o do ficheiro ─────────────────────────────────
//
// Os originais vêm num quadro de 41×41 com o desenho no miolo, ocupando 41 % e 46 % dele. Os
// ícones vizinhos das outras abas (react-icons) enchem 75–83 % do seu quadro. Resultado, com
// `size` quase igual: 6,2 px de tinta na Timeline e 7,0 px no Mixer, contra 11,7 px na Ficha —
// quase o dobro. O `size` dizia 15 nos quatro e a tela mostrava dois tamanhos.
//
// O quadro aqui é recortado no DESENHO (mais a metade do traço, que o `getBBox` não conta) e
// depois folgado para os mesmos ~80 % de ocupação dos vizinhos. Assim `tamanho` passa a querer
// dizer a mesma coisa nas quatro abas, que é o que faz uma fila de ícones parecer uma fila.

export const IconeDaTimeline: FC<{ tamanho?: number }> = ({ tamanho = 15 }) => (
  <svg width={tamanho} height={tamanho} viewBox="8.2 8.2 24 24" fill="none" aria-hidden>
    <path
      d="M19.3636 11.7866H14.5929C13.043 11.7866 11.7866 13.043 11.7866 14.5929C11.7866 16.1428 13.043 17.3992 14.5929 17.3992H19.3636"
      stroke="currentColor" strokeWidth="2.3573" strokeLinecap="round"
    />
    <path
      d="M11.7866 23.0117L28.6245 23.0117"
      stroke="currentColor" strokeWidth="2.3573" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="M11.7866 28.624L28.6245 28.624"
      stroke="currentColor" strokeWidth="2.3573" strokeLinecap="round" strokeLinejoin="round"
    />
    <path
      d="M23.573 14.3123H26.0987M28.6244 14.3123H26.0987M26.0987 14.3123V11.7866M26.0987 14.3123V16.838"
      stroke="currentColor" strokeWidth="2.02054" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

export const IconeDoMixer: FC<{ tamanho?: number }> = ({ tamanho = 15 }) => (
  <svg width={tamanho} height={tamanho} viewBox="7.2 7.1 26.3 26.3" fill="none" aria-hidden>
    <path
      d="M19.8269 13.0864H12.8269C11.7223 13.0864 10.8269 13.9819 10.8269 15.0864C10.8269 16.191 11.7223 17.0864 12.8269 17.0864H19.8269"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    />
    <rect
      x="23.5961" y="12.0864" width="6.23077" height="6.23077" rx="3.11538"
      stroke="currentColor" strokeWidth="2"
    />
    <path
      d="M20.8269 27.3174L27.8269 27.3174C28.9315 27.3174 29.8269 26.422 29.8269 25.3174C29.8269 24.2128 28.9315 23.3174 27.8269 23.3174L20.8269 23.3174"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    />
    <rect
      x="17.0577" y="28.3174" width="6.23077" height="6.23077" rx="3.11538"
      transform="rotate(-180 17.0577 28.3174)"
      stroke="currentColor" strokeWidth="2"
    />
  </svg>
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
 */
export const IconeDeEnviar: FC<{ tamanho?: number }> = ({ tamanho = 15 }) => (
  <svg width={tamanho} height={tamanho} viewBox="-1.5 0 25 25" fill="none" aria-hidden>
    <rect
      x="1" y="3.75" width="20" height="20" rx="3"
      stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
    />
    <path
      d="M3 3.75H19C19 2.09315 17.6569 0.75 16 0.75H6C4.34315 0.75 3 2.09315 3 3.75Z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
    />
    <path
      d="M11.5125 14.7059V9.375C11.5125 9.02982 11.7923 8.75 12.1375 8.75H14.2539M11.5125 14.7059V17.7229C11.5125 18.2777 11.1186 18.7612 10.5639 18.7489C9.60192 18.7275 8.25391 18.3937 8.25391 16.6912C8.25391 14.0441 11.5125 14.7059 11.5125 14.7059Z"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);
