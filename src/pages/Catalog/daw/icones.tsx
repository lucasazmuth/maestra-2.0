import { FC } from 'react';

// Os dois ícones das abas, desenhados pelo dono do produto (`timeline.svg` e `mixer.svg`).
//
// ⚠️ O traço foi trocado de `#898989` para `currentColor`, e é a única mudança: assim o ícone
// acompanha o estado da aba (aceso quando escolhida, apagado quando não) em vez de ficar cinza
// para sempre. O `viewBox` e os caminhos são os originais, à vírgula — o desenho é dele.

export const IconeDaTimeline: FC<{ tamanho?: number }> = ({ tamanho = 15 }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 41 41" fill="none" aria-hidden>
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
  <svg width={tamanho} height={tamanho} viewBox="0 0 41 41" fill="none" aria-hidden>
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
