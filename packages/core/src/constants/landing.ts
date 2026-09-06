// A COPY DA LANDING — as palavras com que a Maestra se apresenta a quem ainda não a conhece.
//
// Ela vive no núcleo porque duas superfícies dizem a MESMA coisa no mesmo momento da jornada: a
// página inicial da web e a tela de apresentação do app. Duas cópias do mesmo texto viram duas
// promessas diferentes na primeira vez que alguém ajusta uma delas — e aqui o texto é a
// promessa comercial do produto, o pior lugar possível para uma divergência.

export const LANDING_HERO = {
  sobretitulo: 'Gestão de carreira musical',
  /** As três linhas do h1. Na web elas são spans; no app, um parágrafo só. */
  titulo: ['A plataforma que diagnostica,', 'planeja e acompanha', 'a sua carreira na música'],
  acao: 'Fazer meu diagnóstico grátis',
  nota: 'Sem cartão de crédito para começar.',
} as const;

/** O título do h1 numa linha só, para onde não há quebra desenhada. */
export const tituloDaLanding = (): string => LANDING_HERO.titulo.join(' ');

export interface ModuloDaPlataforma {
  title: string;
  sub: string;
  desc: string;
  /** A rota da web que aprofunda o módulo, quando existe. */
  to?: string;
}

/**
 * As frentes da plataforma, na ordem da jornada.
 *
 * Os `sub` formam uma frase quando lidos em sequência: onde estou, para onde ir, a execução, o
 * dia a dia, a assistente. Não são rótulos soltos — mudar um sozinho quebra a progressão.
 */
export const MODULOS_DA_PLATAFORMA: ModuloDaPlataforma[] = [
  {
    title: 'Diagnóstico REAL', sub: 'onde estou', to: '/diagnostico-real',
    desc: 'Um raio-X da carreira em quatro dimensões, cruzando dados do Spotify e das redes com o que só você sabe. Em minutos você descobre qual dos 16 perfis é o seu e onde a carreira realmente está, não onde parece estar.',
  },
  {
    title: 'Planejamento estratégico', sub: 'para onde ir',
    desc: 'A metodologia de 30 anos da Anita Carvalho, destilada de 313 planejamentos reais, transforma o diagnóstico em visão, missão, objetivos e as estratégias certas pro seu momento, já priorizadas.',
  },
  {
    title: 'Plano de ação', sub: 'a execução',
    desc: 'Cada estratégia vira tarefas com progresso, prazos e responsáveis, além de cronograma e modelagem financeira. É o caminho do "o que fazer" pro "feito".',
  },
  {
    title: 'Gestão: músicas e agenda', sub: 'o dia a dia',
    desc: 'Músicas, agenda de shows e lançamentos e a equipe junto: a operação da carreira mora no mesmo lugar do plano, e cada entrega alimenta o próximo diagnóstico.',
  },
  {
    title: 'Nyta IA', sub: 'a assistente',
    desc: 'A assistente que acompanha a carreira em todos os módulos: tira dúvidas, sugere caminhos e ajuda a executar o plano, sempre no contexto dos seus dados.',
  },
  {
    title: 'E ela só cresce', sub: 'em breve',
    desc: 'Novos módulos a caminho: marketing, CRM e financeiro, no mesmo lugar do resto da carreira.',
  },
];
