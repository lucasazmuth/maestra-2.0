import { FC, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';

import { NytaAvatar } from './nytaPersona';

// Bolhas do chat da Nyta. A da Nyta entra pela esquerda com avatar;
// a do usuário pela direita, em verde Spotify.

// Remove travessões (—) de TODA fala da Nyta — roteiro estático e texto gerado pela IA.
// Vira vírgula (uso apositivo/parentético); não altera o conteúdo das perguntas (metodologia),
// só a pontuação. Único ponto de render das falas da Nyta, então cobre as 10 etapas de uma vez.
const stripEmDash = (s: string): string =>
  s.replace(/\s*—\s*/g, ', ').replace(/,\s*,/g, ',');

// Renderiza markdown quando o conteúdo é texto (negrito, listas, títulos das falas
// e do resumo). Conteúdo já em JSX (ex.: o hero do artista) passa direto.
export const ChatMarkdown: FC<{ children: ReactNode }> = ({ children }) =>
  typeof children === 'string' ? (
    <div className='nyta-md'>
      <ReactMarkdown>{stripEmDash(children)}</ReactMarkdown>
    </div>
  ) : (
    <>{children}</>
  );

export const NytaBubble: FC<{ children: ReactNode }> = ({ children }) => (
  <div className='nyta-row'>
    <NytaAvatar />
    <div className='nyta-bubble'>
      <ChatMarkdown>{children}</ChatMarkdown>
    </div>
  </div>
);

export const UserBubble: FC<{ children: ReactNode }> = ({ children }) => (
  <div className='nyta-row nyta-row--user'>
    <div className='nyta-bubble nyta-bubble--user'>{children}</div>
  </div>
);

export const TypingIndicator: FC = () => (
  <div className='nyta-row'>
    <NytaAvatar state='thinking' />
    <div className='nyta-bubble nyta-typing' aria-label='Nyta está digitando'>
      <span />
      <span />
      <span />
    </div>
  </div>
);

// Área onde o widget interativo do beat atual é renderizado (alinhada à coluna da conversa).
export const WidgetSlot: FC<{ children: ReactNode }> = ({ children }) => (
  <div className='nyta-widget-slot'>{children}</div>
);
