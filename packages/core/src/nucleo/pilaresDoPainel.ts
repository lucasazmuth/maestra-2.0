import type { Artist } from '../interfaces/maestra';
import type { JourneyState } from '../hooks/useJourneyState';
import type { ArtistCapabilities } from '../hooks/useArtistCapabilities';
import { altasForPattern } from '../constants/realBadge';

// Os três pilares da home do artista: onde estou, execução, para onde ir.
//
// A home deixou de ser uma vitrine de widgets e passou a ser a PORTA dos três produtos do método.
// Diagnóstico, Plano e Planejamento saíram da navegação: só se chega neles por estes cartões, e é
// por isso que o estado de cada um precisa estar certo — um cartão que diz "criar" onde devia dizer
// "continuar" manda a pessoa refazer o que já fez, e ela não tem outro caminho para conferir.
//
// A decisão mora aqui, e não nas telas, porque são DUAS telas (web e app) desenhando a mesma
// máquina de estados. Duas cópias divergem no primeiro ajuste e falham caladas: o app diria
// "bloqueado" onde a web diz "continuar", e ninguém veria até alguém abrir os dois lado a lado.
//
// O que NÃO mora aqui é a rota. O destino é semântico (`'plano'`), e cada superfície tem a própria
// tabela: a web usa `/artists/:id/action-plan`, o app usa `/artista/[id]/plano`. Uma rota da web no
// núcleo é como o app herdaria caminhos que não existem nele.

export type ChaveDoPilar = 'diagnostico' | 'execucao' | 'planejamento';

export type EstadoDoPilar = 'vazio' | 'andamento' | 'concluido' | 'travado';

export type DestinoDoPilar =
  | 'diagnostico'
  | 'refazerDiagnostico'
  | 'planejamento'
  | 'wizard'
  | 'plano'
  | 'assinatura';

export interface Pilar {
  chave: ChaveDoPilar;
  /** O kicker em caixa alta: onde estou, execução, para onde ir. */
  rotulo: string;
  titulo: string;
  estado: EstadoDoPilar;
  /** A linha de status, sempre com dado real de quem está olhando. */
  linha: string;
  /** Segunda linha, quando há o que acrescentar (a leitura do diagnóstico, a próxima tarefa). */
  detalhe?: string;
  /** Régua de progresso. Nula quando não há o que medir. */
  progresso: { feito: number; total: number; pct: number } | null;
  /** Os quatro pontos R·E·A·L acesos, só no pilar do diagnóstico. */
  marcas?: boolean[];
  cta: string;
  destino: DestinoDoPilar;
}

type Capacidades = Pick<ArtistCapabilities, 'viewPlanning' | 'manageTasks'>;

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/**
 * "10 fev 2026": a data da leitura do diagnóstico, curta o bastante para caber no rodapé.
 *
 * Montada à mão, e não pelo `toLocaleDateString`, porque em pt-BR ele devolve "10 de fev. de 2026":
 * três palavras a mais numa linha que já disputa espaço com a ação do cartão.
 */
const dataCurta = (iso?: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
};

/** A primeira tarefa que ainda não foi feita. O mesmo cálculo que as duas telas faziam cada uma por si. */
const proximaTarefa = (artista?: Artist | null) =>
  (artista?.content?.strategies || [])
    .flatMap((e) => e.tasks || [])
    .find((t) => t.status !== 'done' && t.status !== 'archived');

/** Corta a visão numa frase que caiba na linha, sem partir palavra no meio. */
const emUmaLinha = (texto: string, teto = 96): string => {
  const limpo = texto.trim().replace(/\s+/g, ' ');
  if (limpo.length <= teto) return limpo;
  return `${limpo.slice(0, limpo.lastIndexOf(' ', teto))}...`;
};

const pilarDoDiagnostico = (artista: Artist | null | undefined, jornada: JourneyState, capacidades: Capacidades): Pilar => {
  const real = artista?.content?.realIndex;

  // Sem diagnóstico é caso de borda (a criação do perfil já o calcula), mas o cartão precisa dizer
  // o que fazer, e não ficar mudo: é o primeiro degrau do método.
  if (!jornada.hasDiagnostic || !real) {
    return {
      chave: 'diagnostico', rotulo: 'Onde estou', titulo: 'Diagnóstico REAL',
      estado: 'vazio',
      linha: 'Sua carreira ainda não foi medida.',
      detalhe: 'São 4 dimensões: Receita, Engajamento, Audiência e Lançamentos.',
      progresso: null,
      // Refazer é PRO. Sem isso, o cartão levaria a pessoa a uma tela que ela não pode usar.
      cta: capacidades.manageTasks ? 'Fazer diagnóstico' : 'Conhecer o PRO',
      destino: capacidades.manageTasks ? 'refazerDiagnostico' : 'assinatura',
    };
  }

  const altas = altasForPattern(real.pattern);
  const data = dataCurta(real.computedAt);

  return {
    chave: 'diagnostico', rotulo: 'Onde estou', titulo: 'Diagnóstico REAL',
    estado: 'concluido',
    linha: `Você está em ${real.profile.name}, com ${altas} de 4 dimensões acesas.`,
    detalhe: data ? `Leitura de ${data}` : undefined,
    progresso: null,
    marcas: [real.pattern.r, real.pattern.e, real.pattern.a, real.pattern.l],
    cta: capacidades.manageTasks ? 'Refazer diagnóstico REAL' : 'Conhecer o PRO',
    destino: capacidades.manageTasks ? 'refazerDiagnostico' : 'assinatura',
  };
};

const pilarDaExecucao = (artista: Artist | null | undefined, jornada: JourneyState, capacidades: Capacidades): Pilar => {
  const base = { chave: 'execucao', rotulo: 'Execução', titulo: 'Plano de Ação' } as const;

  if (!capacidades.viewPlanning) {
    return {
      ...base, estado: 'travado',
      linha: 'O plano abre quando o perfil é desbloqueado.',
      progresso: null, cta: 'Desbloquear perfil', destino: 'assinatura',
    };
  }

  // Sem planejamento não há o que executar: as tarefas nascem das estratégias.
  if (!jornada.hasPlan) {
    return {
      ...base, estado: 'travado',
      linha: 'Suas tarefas nascem do planejamento.',
      detalhe: jornada.resumingPlan ? 'Você parou no meio do caminho.' : undefined,
      progresso: null,
      cta: jornada.resumingPlan ? 'Continuar planejamento' : 'Criar planejamento',
      destino: 'wizard',
    };
  }

  if (jornada.tasksTotal === 0) {
    return {
      ...base, estado: 'vazio',
      linha: 'Seu plano está pronto e ainda sem tarefas.',
      progresso: null, cta: 'Montar tarefas', destino: 'plano',
    };
  }

  const progresso = { feito: jornada.tasksDone, total: jornada.tasksTotal, pct: jornada.pct };

  // Tudo feito: o ciclo fecha medindo de novo, que é o que o método manda.
  if (jornada.tasksPending === 0) {
    return {
      ...base, estado: 'concluido',
      linha: `Tudo em dia, com ${jornada.tasksDone} tarefas concluídas.`,
      detalhe: 'Hora de medir sua evolução.',
      progresso,
      cta: capacidades.manageTasks ? 'Refazer diagnóstico' : 'Ver minhas tarefas',
      destino: capacidades.manageTasks ? 'refazerDiagnostico' : 'plano',
    };
  }

  const proxima = proximaTarefa(artista);
  return {
    ...base, estado: 'andamento',
    linha: `${jornada.tasksDone} de ${jornada.tasksTotal} tarefas concluídas.`,
    detalhe: proxima ? `Próxima: ${proxima.description}` : undefined,
    progresso, cta: 'Ver minhas tarefas', destino: 'plano',
  };
};

const pilarDoPlanejamento = (artista: Artist | null | undefined, jornada: JourneyState, capacidades: Capacidades): Pilar => {
  const base = { chave: 'planejamento', rotulo: 'Para onde ir', titulo: 'Planejamento Estratégico' } as const;

  if (!capacidades.viewPlanning) {
    return {
      ...base, estado: 'travado',
      linha: 'O planejamento abre quando o perfil é desbloqueado.',
      progresso: null, cta: 'Desbloquear perfil', destino: 'assinatura',
    };
  }

  const conteudo = artista?.content;
  const estrategias = conteudo?.strategies?.length || 0;
  const objetivos = conteudo?.objectives?.length || 0;

  if (jornada.hasPlan) {
    const visao = conteudo?.identity?.vision?.trim();
    return {
      ...base, estado: 'concluido',
      // A visão é o que a pessoa escreveu sobre onde quer chegar. Nenhum número diz isso melhor.
      linha: visao ? emUmaLinha(visao) : `${objetivos} objetivos e ${estrategias} estratégias ativas.`,
      detalhe: visao ? `${objetivos} objetivos e ${estrategias} estratégias ativas` : undefined,
      progresso: null, cta: 'Ver planejamento', destino: 'planejamento',
    };
  }

  if (jornada.resumingPlan) {
    return {
      ...base, estado: 'andamento',
      linha: 'Você parou no meio do seu planejamento.',
      detalhe: 'Volte para escolher as estratégias e finalizar.',
      progresso: null, cta: 'Continuar planejamento', destino: 'wizard',
    };
  }

  return {
    ...base, estado: 'vazio',
    linha: 'Defina visão, missão, objetivos e estratégias.',
    detalhe: 'A Nyta conduz a conversa, você responde.',
    progresso: null, cta: 'Criar planejamento', destino: 'wizard',
  };
};

/**
 * Os três cartões da home, na ordem em que ela os mostra.
 *
 * A ordem é onde estou, execução, para onde ir: começa pelo espelho, passa pelo que se faz hoje e
 * termina no destino. O ciclo do produto é outro (diagnóstico gera planejamento, que gera plano),
 * mas quem abre o app todo dia volta pela execução, não pela estratégia.
 */
export const pilaresDoPainel = (
  artista: Artist | null | undefined,
  jornada: JourneyState,
  capacidades: Capacidades,
): [Pilar, Pilar, Pilar] => [
  pilarDoDiagnostico(artista, jornada, capacidades),
  pilarDaExecucao(artista, jornada, capacidades),
  pilarDoPlanejamento(artista, jornada, capacidades),
];

export default pilaresDoPainel;
