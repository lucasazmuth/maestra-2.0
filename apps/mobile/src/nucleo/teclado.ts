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
