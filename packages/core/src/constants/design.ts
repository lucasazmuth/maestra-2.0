/**
 * O sistema visual da Maestra, num lugar só.
 *
 * Existe porque o app nativo não tem CSS: ele não consegue ler o `variables.scss` nem os tokens
 * que o `ConfigProvider` do antd entrega à web. Sem uma fonte comum, as duas superfícies
 * divergem por descuido — foi o que aconteceu nas primeiras telas do app, que nasceram com o
 * roxo institucional como cor de ação e cinzas que não existem em lugar nenhum do produto.
 *
 * A cor de AÇÃO do produto é o azul `#3361ff`, não o roxo. O roxo `#9A4FD1` é institucional:
 * marca, ícone, assinatura. Confundir os dois é o erro mais fácil de cometer aqui, porque a
 * documentação em DESIGN_SYSTEM.md descreve a fase escura, anterior ao redesenho claro.
 *
 * Os valores foram tirados de onde o produto de fato os declara — o `token` do `ConfigProvider`
 * em `src/App.tsx` — e completados com os papéis que se repetem nos módulos SCSS (contagem em
 * 137 usos do primário, 97 do texto secundário). `constants/__tests__/design.test.ts` compara
 * este arquivo com o App.tsx e falha quando um dos dois muda sozinho.
 */

export const COR = {
  /** Ação: botão primário, link, foco, seleção. */
  primaria: '#3361ff',
  /** Hover e pressionado da ação. */
  primariaEscura: '#2a54e0',
  /** Conteúdo sobre superfície na cor primária. */
  sobrePrimaria: '#FFFFFF',

  /** Título e texto forte. */
  titulo: '#2c3f63',
  /** Texto corrente. */
  texto: '#405985',
  /** Texto de apoio: legenda, metadado. */
  secundario: '#52668d',
  /** Texto apagado: rótulo de seção, valor ausente. */
  apagado: '#93a4c0',
  /** Placeholder de campo. */
  espaçoReservado: '#a3b2ca',

  /** Superfície de cartão e de campo. */
  superficie: '#ffffff',
  /** Fundo da tela. */
  fundo: '#f7f8fb',
  /** Contorno de campo e de cartão. */
  contorno: '#dde5f1',
  /** Divisória fina dentro de um bloco. */
  divisoria: '#e8eef8',
  /** Superfície levemente tingida, para o bloco que precisa se destacar do branco. */
  destaque: '#eef3fb',

  /** Marca institucional. NÃO é cor de ação — ver o cabeçalho deste arquivo. */
  marca: '#9A4FD1',
  /** Erro e destrutivo. */
  erro: '#b32d45',
} as const;

export const RAIO = {
  /** Campo e botão comuns. É o `borderRadius` declarado no ConfigProvider. */
  campo: 8,
  /** Cartão e bloco de conteúdo. */
  cartao: 14,
  /** Ação primária. A entrada da web usa pílula, e é a assinatura visual dela. */
  pilula: 9999,
  /** A tela de autenticação tem raios próprios, maiores — ver `AuthShell.module.scss`. */
  campoDeEntrada: 10,
  cartaoDeEntrada: 18,
} as const;

/** Contornos que a entrada usa, um pouco mais quentes que o `COR.contorno` geral. */
export const CONTORNO_DE_ENTRADA = {
  campo: '#e1e7f0',
  botao: '#dce5f0',
  cartao: '#e3eaf3',
} as const;

/**
 * A família tipográfica da web. No app nativo ela só vale depois de a fonte ser carregada; até
 * lá o sistema usa a padrão, e é por isso que a lista termina em `sans-serif`.
 */
export const FONTE = "'Inter Variable', Inter, 'Helvetica Neue', Arial, sans-serif";
