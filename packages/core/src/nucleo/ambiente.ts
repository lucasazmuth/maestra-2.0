/**
 * O que muda entre a web e o app empacotado.
 *
 * O núcleo do produto — `services`, `store`, `hooks`, `lib`, `utils` — precisa rodar nas duas
 * superfícies, e quase tudo nele já roda: de 67 fontes fora de `pages` e `components`, só um
 * punhado toca API de navegador. Em vez de espalhar `typeof window` por essas fontes, elas
 * pedem aqui o que precisam, e cada superfície liga a implementação dela uma vez.
 *
 * Não há registro obrigatório: quando ninguém configura, o padrão detecta o navegador e usa
 * `localStorage`. É o que mantém a web e os testes funcionando sem uma linha de setup, e o que
 * evita depender da ordem em que os módulos carregam — `store.ts` monta o Redux no import, e
 * uma configuração explícita no boot chegaria tarde demais para ele.
 */

/** Depósito de chave e valor, síncrono. */
export interface Armazenamento {
  ler(chave: string): string | null;
  gravar(chave: string, valor: string): void;
  apagar(chave: string): void;
}

export interface Ambiente {
  /** Sobrevive ao fechamento. Na web é o `localStorage`. */
  armazenamento: Armazenamento;
  /** Morre com a aba, na web; com o processo, no app. */
  sessao: Armazenamento;
  /**
   * Origem dos links que voltam para o produto: o `redirectTo` do OAuth e a URL que vai no
   * e-mail de convite. Na web é a origem da página; no app será o esquema do deep link.
   */
  origemDoApp: string;
  /**
   * O `fetch` que sabe fazer STREAMING.
   *
   * O `fetch` do React Native devolve uma `Response` sem `body` — ele lê a resposta inteira e
   * só então entrega o texto. Para quase tudo dá no mesmo; para a Nyta, não: a tela abriria e
   * ficaria parada até a resposta terminar, e depois cuspiria o texto de uma vez. Sem erro
   * nenhum, o que é pior — parece lentidão, não defeito.
   *
   * O `expo/fetch` tem `body` como `ReadableStream`, então o app registra ele aqui. Na web o
   * `fetch` global já basta.
   */
  buscar: typeof fetch;
}

/**
 * A forma do `Storage` do navegador, escrita à mão de propósito: declarar o tipo aqui é o que
 * permite a este arquivo compilar sem a lib `dom`, que o app nativo não tem.
 */
interface DepositoDoNavegador {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

/** Guarda em memória. Some quando o processo morre. */
const emMemoria = (): Armazenamento => {
  const mapa = new Map<string, string>();
  return {
    ler: (chave) => mapa.get(chave) ?? null,
    gravar: (chave, valor) => {
      mapa.set(chave, valor);
    },
    apagar: (chave) => {
      mapa.delete(chave);
    },
  };
};

/**
 * Um depósito do navegador atrás da porta.
 *
 * O `try` não é zelo excessivo: aba anônima, cota cheia e navegador com dados de site
 * bloqueados fazem `getItem` e `setItem` LANÇAREM, e o produto não pode cair por causa de um
 * token em cache. Quem chama recebe `null` e segue.
 */
const doNavegador = (deposito: DepositoDoNavegador): Armazenamento => ({
  ler: (chave) => {
    try {
      return deposito.getItem(chave);
    } catch {
      return null;
    }
  },
  gravar: (chave, valor) => {
    try {
      deposito.setItem(chave, valor);
    } catch {
      /* sem espaço ou sem permissão: seguir sem cache é melhor do que quebrar */
    }
  },
  apagar: (chave) => {
    try {
      deposito.removeItem(chave);
    } catch {
      /* idem */
    }
  },
});

interface GlobalDoNavegador {
  localStorage?: DepositoDoNavegador;
  sessionStorage?: DepositoDoNavegador;
  location?: { origin?: string };
}

let avisou = false;

const padrao = (): Ambiente => {
  // Testar `localStorage`, e não `window`: o React Native TAMBÉM define `window`, e o que falta
  // lá é o depósito. Checar a janela daria um falso positivo no app.
  const g = globalThis as unknown as GlobalDoNavegador;
  const local = g.localStorage;
  const sessao = g.sessionStorage;

  if (!local) {
    if (!avisou) {
      avisou = true;
      // Silêncio aqui significaria token perdido a cada abertura do app, sem sintoma visível
      // até alguém reclamar de logout constante.
      // eslint-disable-next-line no-console
      console.warn(
        '[nucleo] Nenhum ambiente configurado e não há localStorage. ' +
          'Usando memória: nada sobrevive ao fechamento. Chame configurarAmbiente() no boot.'
      );
    }
    return { armazenamento: emMemoria(), sessao: emMemoria(), origemDoApp: '', buscar: fetch };
  }

  return {
    armazenamento: doNavegador(local),
    sessao: sessao ? doNavegador(sessao) : emMemoria(),
    origemDoApp: g.location?.origin ?? '',
    buscar: fetch,
  };
};

let atual: Ambiente | null = null;

/** Liga a implementação da superfície. O app nativo chama isto no boot; a web não precisa. */
export const configurarAmbiente = (novo: Ambiente): void => {
  atual = novo;
};

/** Volta ao padrão detectado. Existe para teste — um caso não pode vazar no seguinte. */
export const reiniciarAmbiente = (): void => {
  atual = null;
};

/** O ambiente em vigor. Resolvido na primeira chamada, não no import. */
export const ambiente = (): Ambiente => {
  if (!atual) atual = padrao();
  return atual;
};
