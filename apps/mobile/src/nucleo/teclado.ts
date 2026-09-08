import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * O teclado do aparelho está aberto?
 *
 * Serve para uma coisa só, e é uma que engana: a margem de baixo do aparelho (`bottom` do
 * `useSafeAreaInsets`) existe para o conteúdo não ficar embaixo da barra de gestos do iPhone.
 * Com o teclado ABERTO essa barra some — o teclado ocupa o lugar dela —, e manter a margem
 * empurra o conteúdo mais 34px para cima, deixando uma faixa vazia entre ele e as teclas.
 *
 * `Will` no iOS e `Did` no Android: o iOS avisa antes de animar, e é o que faz a margem
 * desaparecer junto com a subida do teclado em vez de dar um pulo no fim. O Android não tem os
 * eventos `Will`.
 */
export const useTecladoAberto = (): boolean => {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const abriu = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const fechou = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const assinaturas = [
      Keyboard.addListener(abriu, () => setAberto(true)),
      Keyboard.addListener(fechou, () => setAberto(false)),
    ];
    return () => assinaturas.forEach((a) => a.remove());
  }, []);

  return aberto;
};

/**
 * A ALTURA do teclado, em pontos. Zero quando ele está fechado.
 *
 * Existe porque o `KeyboardAvoidingView` não serve dentro de um `Modal` com
 * `presentationStyle="pageSheet"`: ele calcula o quanto empurrar a partir da posição do próprio
 * quadro dentro da JANELA, e numa folha esse quadro começa abaixo do topo da tela. O resultado é
 * um empurrão curto demais, e o rodapé fica atrás das teclas.
 *
 * Medir o teclado e reservar a altura embaixo do container é determinístico: não depende de onde
 * o quadro começa nem de deslocamento algum para compensar.
 */
export const useAlturaDoTeclado = (): number => {
  const [altura, setAltura] = useState(0);

  useEffect(() => {
    const abriu = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const fechou = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const assinaturas = [
      Keyboard.addListener(abriu, (e) => setAltura(e?.endCoordinates?.height ?? 0)),
      Keyboard.addListener(fechou, () => setAltura(0)),
    ];
    return () => assinaturas.forEach((a) => a.remove());
  }, []);

  return altura;
};
