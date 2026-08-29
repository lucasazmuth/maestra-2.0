declare module '*.svg' {
  import type { FC } from 'react';
  import type { SvgProps } from 'react-native-svg';

  const conteudo: FC<SvgProps>;
  export default conteudo;
}
