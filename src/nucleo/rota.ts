/**
 * De onde o núcleo lê a rota atual.
 *
 * Três hooks do núcleo precisam saber em que tela o usuário está: `useArtist` e `useNytaChat`
 * querem o `:id` do artista, `useActiveModuleContext` quer o caminho. Todos liam isso do
 * `react-router-dom`, que não existe no app nativo — lá quem responde é o Expo Router.
 *
 * A superfície registra o hook dela uma vez, e o núcleo passa a perguntar aqui. As assinaturas
 * de `useArtist()` e companhia não mudam, então nenhum dos ~15 pontos de uso foi tocado.
 */

export interface Rota {
  /** Caminho atual, sem origem: `/artists/abc/catalogo`. */
  caminho: string;
  /** Parâmetros nomeados do trecho de rota: `{ id: 'abc' }`. */
  parametros: Record<string, string | undefined>;
}

type UsarRota = () => Rota;

const ROTA_VAZIA: Rota = { caminho: '', parametros: {} };

/**
 * O hook registrado. Ele é trocado UMA vez, no carregamento do módulo da superfície, e nunca
 * mais — é isso que mantém a ordem dos hooks estável entre renderizações, apesar da chamada
 * indireta abaixo.
 */
let usarRota: UsarRota | null = null;

export const configurarRota = (hook: UsarRota): void => {
  usarRota = hook;
};

/** Volta ao estado não registrado. Existe para teste. */
export const reiniciarRota = (): void => {
  usarRota = null;
};

/**
 * A rota atual, na implementação de quem registrou.
 *
 * Sem registro devolve rota vazia em vez de estourar: um hook do núcleo não deve derrubar a
 * árvore por causa de configuração ausente, e o caminho vazio já leva os consumidores ao
 * comportamento de "fora de qualquer artista".
 */
export const useRota = (): Rota => (usarRota ? usarRota() : ROTA_VAZIA);
