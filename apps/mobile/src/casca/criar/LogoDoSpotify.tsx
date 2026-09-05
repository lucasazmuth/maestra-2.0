import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import LottieView from 'lottie-react-native';

import logo from '@/assets/lottie/spotify-logo.json';

// O logo do Spotify no prefixo do campo de busca.
//
// É a MESMA animação da web (`SpotifyLottie`), e com o mesmo recorte: toca do quadro 0 ao 82 —
// o círculo com as ondas se desenhando — e congela no logo montado. Em loop ela fica piscando
// ao lado de um campo de texto, que é onde a pessoa está lendo.

export const LogoDoSpotify = ({ tamanho = 24 }: { tamanho?: number }) => {
  const anim = useRef<LottieView>(null);

  useEffect(() => { anim.current?.play(0, 82); }, []);

  return (
    <View style={{ width: tamanho, height: tamanho }}>
      <LottieView
        ref={anim}
        source={logo}
        autoPlay={false}
        loop={false}
        style={{ width: tamanho, height: tamanho }}
      />
    </View>
  );
};
