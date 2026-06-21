import { CSSProperties, FC, useEffect, useRef } from 'react';
import lottie from 'lottie-web';

import animationData from '../assets/spotify-logo.json';

interface Props {
  size?: number;
  style?: CSSProperties;
}

// Logo do Spotify (Lottie) que toca a montagem UMA vez e congela no logo completo.
// Usado como destaque do campo de busca na tela de boas-vindas.
export const SpotifyLottie: FC<Props> = ({ size = 28, style }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = lottie.loadAnimation({
      container: el,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData,
      // Toca a entrada (círculo + ondas se desenhando) e para no logo montado.
      initialSegment: [0, 82],
    });
    return () => anim.destroy();
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden
      style={{ width: size, height: size, display: 'inline-flex', flexShrink: 0, ...style }}
    />
  );
};

export default SpotifyLottie;
