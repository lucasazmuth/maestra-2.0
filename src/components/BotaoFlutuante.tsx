import { FC, ReactNode } from 'react';
import { FiPlus } from 'react-icons/fi';

// O BOTÃO DE CRIAR, flutuando no canto.
//
// Ele vivia no cabeçalho de cada tela, ao lado do título — e ali competia com o próprio título
// pela primeira leitura, num canto que a pessoa só olha quando chega. O que se cria numa lista
// costuma ser decidido DEPOIS de a percorrer, e é no fim dela que a mão está.
//
// Um só componente para Músicas, Agenda e Equipe: três botões iguais escritos três vezes
// divergem no primeiro ajuste, e este tem detalhes que ninguém quer refazer de cabeça — o
// desvio por causa do tocador, o desvio por causa da barra do celular, o alvo de 56 px.
//
// ⚠️ O RÓTULO NÃO DESAPARECE, muda de lugar: um `+` sozinho não diz o que cria, e quem chega
// pela primeira vez não tem como adivinhar. Ele fica no `aria-label` (para quem usa leitor de
// tela) e no `title` (para quem passa o rato) — e é obrigatório, por isso não tem valor
// implícito.

export const BotaoFlutuante: FC<{
  /** O que este botão cria. Vira o rótulo para leitor de tela e o balão do rato. */
  rotulo: string;
  aoClicar: () => void;
  /** Em curso: o botão não aceita um segundo clique enquanto o primeiro trabalha. */
  desativado?: boolean;
  /**
   * O plano esgotou o que este botão cria.
   *
   * ⚠️ APAGADO, MAS CLICÁVEL — e isto é de propósito. Um botão `disabled` de verdade não recebe
   * clique nenhum, e então a pessoa fica a olhar para algo cinzento sem nunca saber POR QUE não
   * pode: a explicação (e a oferta de plano) está do outro lado do clique.
   */
  noLimite?: boolean;
  /** Substitui o `+`, quando a ação não é "criar". */
  children?: ReactNode;
}> = ({ rotulo, aoClicar, desativado, noLimite, children }) => (
  <button
    type='button'
    className='botao-flutuante'
    aria-label={rotulo}
    title={rotulo}
    disabled={desativado}
    style={noLimite ? { opacity: 0.5, cursor: 'not-allowed' } : { opacity: 1, cursor: 'pointer' }}
    onClick={aoClicar}
  >
    {children ?? <FiPlus size={24} />}
  </button>
);
