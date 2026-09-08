import { FC, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';

import { stripEmDash } from '@maestra/core/wizard/limpar';

// As falas do chat livre da Nyta.
//
// Elas existem à parte das bolhas do wizard (`Wizard/chat/ChatMessage.tsx`) porque as duas
// conversas não são a mesma coisa. O wizard é roteirizado: a Nyta conduz, entrega widgets e
// espera resposta, e ali o balão com avatar marca de quem é cada turno de um diálogo curto.
// Este chat é aberto e as respostas são longas — texto que a pessoa vai LER, não uma réplica.
//
// Daí a assimetria abaixo, que é a decisão de desenho inteira em duas regras:
//
//  • A resposta da Nyta NÃO tem recipiente. Nem balão, nem contorno, nem avatar: é texto na
//    própria página, na largura da coluna de leitura. Um balão por turno espreme a resposta em
//    80% da largura e a transforma em "mensagem de robô"; sem ele, ela lê como documento.
//  • A pergunta de quem escreve TEM recipiente, e é o único da tela. Ela é curta, e é o que
//    precisa se destacar do texto corrido para a pessoa achar onde perguntou o quê.
//
// Nenhuma das duas leva avatar. Quem falou já está dito pela posição e pelo recipiente, e um
// retrato repetido a cada turno é a marca registrada de interface de chatbot.

const Md: FC<{ children: string }> = ({ children }) => (
  <ReactMarkdown>{stripEmDash(children)}</ReactMarkdown>
);

/** A resposta da Nyta: texto solto na coluna, sem moldura. */
export const FalaDaNyta: FC<{ children: string }> = ({ children }) => (
  <div className="nyta-fala nyta-fala--nyta">
    <Md>{children}</Md>
  </div>
);

/** Um aviso da própria interface (resposta que não veio, texto que se perdeu). */
export const FalaDeAviso: FC<{ children: ReactNode; tom?: 'erro' }> = ({ children, tom }) => (
  <div className={`nyta-fala nyta-fala--aviso${tom === 'erro' ? ' nyta-fala--erro' : ''}`}>
    {children}
  </div>
);

/** A pergunta de quem escreve: o único recipiente da conversa. */
export const FalaDeQuemPergunta: FC<{ children: string }> = ({ children }) => (
  <div className="nyta-fala nyta-fala--voce">{children}</div>
);

/**
 * A espera, antes do primeiro pedaço de texto chegar.
 *
 * Três pontos onde a resposta vai nascer, e não um balão vazio: assim o texto começa no lugar
 * em que os pontos estavam, sem a moldura sumir de repente quando o streaming começa.
 */
export const Pensando: FC = () => (
  <div className="nyta-fala nyta-fala--pensando" aria-label="A Nyta está escrevendo">
    <span />
    <span />
    <span />
  </div>
);
