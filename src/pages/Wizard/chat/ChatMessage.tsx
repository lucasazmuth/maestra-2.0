import { FC, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';

import { NytaAvatar } from './nytaPersona';
import { stripEmDash } from '../clean';

// Bolhas do chat da Nyta. A da Nyta entra pela esquerda com avatar;
// a do usuário pela direita, em verde Spotify.

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

export const NytaBubble: FC<{ children: ReactNode; streaming?: boolean }> = ({ children, streaming }) => (
  <div className='nyta-row'>
    <NytaAvatar />
    <div className={`nyta-bubble${streaming ? ' nyta-bubble--streaming' : ''}`}>
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
