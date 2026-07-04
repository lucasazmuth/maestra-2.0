import { CSSProperties, FC } from 'react';

import bg from '../assets/dark-gradient-bg.svg';

// Fundo decorativo premium (gradiente escuro com auroras borradas) — camada fixa atrás do
// conteúdo. Usado nas telas de celebração/onboarding (boas-vindas e sucesso de pagamento) pra
// dar um toque especial sem interferir na leitura. Aceita `style` pra ajustes pontuais.
export const AuroraBackdrop: FC<{ style?: CSSProperties }> = ({ style }) => (
  <div
    aria-hidden
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 0,
      backgroundColor: '#000',
      backgroundImage: `url(${bg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      pointerEvents: 'none',
      ...style,
    }}
  />
);

export default AuroraBackdrop;
