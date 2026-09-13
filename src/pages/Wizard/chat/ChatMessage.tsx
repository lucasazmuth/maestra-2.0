import { FC, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';

import { stripEmDash } from '@maestra/core/wizard/limpar';

// Falas do chat da Nyta no wizard — mesmo desenho do chat livre da Nyta (NytaChat/components/
// Mensagem.tsx): a resposta da Nyta não tem recipiente (nem balão, nem contorno, nem avatar), é
// texto na própria coluna, largura cheia. Um balão por turno espreme a resposta e a faz ler como
// mensagem de robô; sem ele, ela lê como o texto de um formulário conduzido — que é o que é.
// A fala de quem responde é o único recipiente da tela, porque é o que precisa se destacar do
// texto corrido para se achar, rolando, onde se respondeu o quê.

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
  <div className={`nyta-fala nyta-fala--nyta${streaming ? ' nyta-fala--streaming' : ''}`}>
    <ChatMarkdown>{children}</ChatMarkdown>
  </div>
);

// `avatar` é opcional de propósito: no chat da Nyta ele identifica QUEM da equipe escreveu — um
// perfil pode ter várias pessoas conversando sobre o mesmo artista. No wizard não entra: lá a
// conversa é sempre entre a Nyta e quem está preenchendo, e um retrato repetido a cada resposta
// só faria barulho — a mesma razão pela qual a fala da Nyta também não leva avatar.
export const UserBubble: FC<{ children: ReactNode; avatar?: { src: string; name: string } }> = ({ children, avatar }) => (
  <div className='nyta-row--user'>
    <div className='nyta-fala nyta-fala--voce'>{children}</div>
    {avatar && (
      <img className='nyta-user-avatar' src={avatar.src} alt={avatar.name} title={avatar.name} />
    )}
  </div>
);

export const TypingIndicator: FC = () => (
  <div className='nyta-fala nyta-fala--pensando' aria-label='Nyta está digitando'>
    <span />
    <span />
    <span />
  </div>
);

// Área onde o widget interativo do beat atual é renderizado (alinhada à coluna da conversa).
export const WidgetSlot: FC<{ children: ReactNode }> = ({ children }) => (
  <div className='nyta-widget-slot'>{children}</div>
);

// Card que a Nyta "envia" (hoje: o hero do artista e o vídeo da etapa) — mesma coluna de uma fala
// dela, mas o conteúdo traz a própria moldura (`.nyta-card`), então este wrapper só posiciona.
export const NytaCardRow: FC<{ children: ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`nyta-row-card${className ? ` ${className}` : ''}`}>{children}</div>
);
