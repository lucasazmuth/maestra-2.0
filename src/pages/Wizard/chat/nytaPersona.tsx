import { FC } from 'react';

import { NytaEmblem, type NytaEmblemTone } from '../../../components/nyta/NytaEmblem';

// O ROSTO da Nyta. A VOZ dela (as falas) mudou-se para o núcleo, em `constants/nytaPersona`:
// o app nativo conduz a mesma conversa, e duas cópias das falas seriam duas Nytas.
//
// Nada é reexportado daqui: `export … from` cruzando a fronteira do pacote passa no `tsc` e
// some no bundle do webpack. Quem precisa das falas as importa do núcleo.

// Avatar da Nyta: a estrela de quatro pontas (ver components/nyta/NytaEmblem), solta — sem
// plate, sem clip circular e sem fundo, porque a forma já é a identidade. Ao "pensar"
// (`state='thinking'`) a estrela gira e se reveza com o rastro de giro e o flare do set.
export type NytaAvatarState = 'idle' | 'thinking';

export const NytaAvatar: FC<{ size?: number; state?: NytaAvatarState; tone?: NytaEmblemTone }> = ({
  size = 32, state = 'idle', tone = 'brand',
}) => (
  <span
    className={`nyta-avatar${state === 'thinking' ? ' nyta-avatar--thinking' : ''}`}
    // `background: none` inline anula o gradiente que a classe global `.nyta-avatar` pinta pro
    // avatar antigo, que era um orb: aqui ele viraria uma bolha atrás do emblema.
    style={{ width: size, height: size, minWidth: size, display: 'inline-flex', background: 'none', overflow: 'visible' }}
    aria-hidden
  >
    <NytaEmblem state={state} tone={tone} />
  </span>
);

// Sorteia uma variação para a fala não soar robótica.
