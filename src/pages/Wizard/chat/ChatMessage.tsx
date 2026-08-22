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

// `avatar` é opcional de propósito: no chat da Nyta ele identifica QUEM da equipe escreveu — um
// perfil pode ter várias pessoas conversando sobre o mesmo artista. No wizard não entra: lá a
// conversa é sempre entre a Nyta e quem está preenchendo, e um avatar repetido a cada resposta
// só faria barulho.
export const UserBubble: FC<{ children: ReactNode; avatar?: { src: string; name: string } }> = ({ children, avatar }) => (
  <div className='nyta-row nyta-row--user'>
    <div className='nyta-bubble nyta-bubble--user'>{children}</div>
    {avatar && (
      <img className='nyta-user-avatar' src={avatar.src} alt={avatar.name} title={avatar.name} />
    )}
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

// Card que a Nyta "envia": mesma linha e mesmo avatar de um balão dela, mas sem a casca da bolha —
// o conteúdo traz a própria moldura (é o caso do vídeo da etapa). Sem o avatar, o card parecia
// aparecer sozinho na conversa, sem autor.
export const NytaCardRow: FC<{ children: ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`nyta-row nyta-row--card${className ? ` ${className}` : ''}`}>
    <NytaAvatar />
    <div className='nyta-row-card'>{children}</div>
  </div>
);

// Marco de etapa: divisória com o nome da etapa no meio. Numa conversa contínua não dava pra
// saber onde uma etapa termina e a outra começa — tudo era o mesmo fio de mensagens.
export const StepDivider: FC<{ children: ReactNode }> = ({ children }) => (
  <div className='nyta-step-divider' role='separator' aria-label={`Início da etapa ${children}`}>
    <span>{children}</span>
  </div>
);
