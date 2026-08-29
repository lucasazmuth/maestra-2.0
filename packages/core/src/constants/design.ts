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

/**
 * O cromo da navegação mobile — a ilha inferior e o painel "Mais".
 *
 * A barra NÃO é uma faixa colada no rodapé: é uma ilha branca flutuante (22px de folga nos lados,
 * 18px embaixo), com fios finos separando as células e a célula ATIVA erguida como um cartão,
 * com um ponto azul no canto. Os valores saem do bloco `@media (max-width: 960px)` de
 * `src/styles/gsap-reference.css` — `src/__tests__/cromoDaBarra.test.ts` falha se lá mudarem
 * sem mudar aqui.
 *
 * O `App.scss` ainda tem uma versão anterior desta barra, escura e colada no rodapé. Ela está
 * morta: o bloco do `gsap-reference.css` vem depois e vence. Copiar a de lá foi o primeiro
 * caminho que eu tomei, e ele daria um app preto onde a web é branca.
 */
export const COR_BARRA = {
  ilha: 'rgba(255, 255, 255, .97)',
  contornoDaIlha: '#dfe7f3',
  /** O fio entre uma célula e a seguinte. */
  fio: '#edf1f7',
  item: '#98a7be',
  icone: '#b2bed0',
  vidro: 'rgba(38, 54, 82, .24)',
  contornoDoPainel: '#e1e7f0',
} as const;

/** As sombras da navegação, na notação do React Native. */
export const SOMBRA = {
  ilha: {
    shadowColor: 'rgb(68, 88, 126)', shadowOpacity: 0.2, shadowRadius: 42,
    shadowOffset: { width: 0, height: 18 }, elevation: 12,
  },
  celulaAtiva: {
    shadowColor: 'rgb(90, 111, 151)', shadowOpacity: 0.14, shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
  fotoDaIlha: {
    shadowColor: 'rgb(83, 103, 141)', shadowOpacity: 0.16, shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 }, elevation: 4,
  },
  painel: {
    shadowColor: 'rgb(72, 91, 130)', shadowOpacity: 0.16, shadowRadius: 34,
    shadowOffset: { width: 0, height: 16 }, elevation: 10,
  },
} as const;

/**
 * O cabeçalho: os botões redondos, o emblema da Nyta e o ponto de não lidas.
 *
 * Diferente da barra inferior, aqui é tudo claro — o cabeçalho usa o mesmo `--canvas` do fundo
 * (`COR.fundo`). Os valores saem de `src/styles/gsap-reference.css`, e
 * `src/__tests__/cromoDoCabecalho.test.ts` falha se lá mudarem sem mudar aqui.
 */
export const COR_CABECALHO = {
  botao: '#fff',
  iconeDoBotao: '#b2bed1',
  /** O emblema da Nyta é roxo sobre botão branco: o círculo roxo cheio pesava mais que a marca. */
  nyta: '#7625ee',
  naoLidas: '#e62e7b',
} as const;

/** A sombra dos botões redondos do cabeçalho, na notação que o React Native entende. */
export const SOMBRA_DO_BOTAO = {
  shadowColor: 'rgb(98, 112, 143)',
  shadowOpacity: 0.07,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

/**
 * O painel do artista (a home) — a única tela do produto com cartões escuros.
 *
 * O hero da próxima tarefa e os quatro cartões de números são azul-noite sobre o fundo claro;
 * é o contraste que separa "o que fazer agora" e "onde eu estou" do resto da página, que é
 * branca. Os valores saem de `.music-hero`/`.music-stat-grid`/`.release-board` e companhia, em
 * `src/styles/gsap-reference.css`, e das cores inline de `src/pages/Dashboard/index.tsx`.
 * `src/__tests__/cromoDoPainel.test.ts` falha se lá mudarem sem mudar aqui.
 */
export const COR_PAINEL = {
  heroBrilho: '#315de8',
  heroDe: '#121c38',
  heroAte: '#18254d',
  heroRotulo: '#bcd0ff',
  heroTexto: '#c4d0ed',
  pilulaContorno: 'rgba(255, 255, 255, .13)',
  pilulaFundo: 'rgba(255, 255, 255, .08)',
  pilulaTexto: '#eaf0ff',
  pilulaNumero: 'rgba(51, 97, 255, .32)',
  pilulaPrazo: '#ffe083',
  cartaoDeNumero: '#202c46',
  rotuloDeNumero: '#d7e0f4',
  linha: '#edf1f5',
  tituloDoCartao: '#5b6f94',
  acaoDoCartao: '#7286aa',
  promoDe: '#151f37',
  promoAte: '#44324e',
  promoRotulo: '#9aaac7',
  promoTexto: '#65789d',
  /** O contador de estratégias do cartão claro — o roxo, não o azul de ação. */
  promoNumeroRoxo: '#8833ff',
  faixaTitulo: '#60739a',
  faixaLegenda: '#9aa9c0',
  botaoSuave: '#eef2ff',
  rodapeIcone: '#aab8d0',
  rodapeTitulo: '#607399',
  rodapeTexto: '#9aa8bf',
  /** Sobre os cartões escuros, o branco é texto — não superfície. */
  sobreEscuro: '#fff',
  velado: 'rgba(255, 255, 255, .72)',
  seta: 'rgba(255, 255, 255, .78)',
  disco: 'rgba(255, 255, 255, .2)',
} as const;

/** A bolinha de cada número, na ordem em que os cartões aparecem. */
export const CORES_DOS_NUMEROS = ['#29cc39', '#3361ff', '#8833ff', '#ffcb33'] as const;

/**
 * O fundo de cada faixa em "Músicas lançadas".
 *
 * Os dois primeiros vêm do array do Dashboard; o terceiro e o quarto o CSS sobrescreve por
 * `nth-child`, e é por isso que esta lista não é igual à de lá.
 */
export const CORES_DOS_LANCAMENTOS = ['#8833ff', '#33bfff', '#3b4ee4', '#171d2b'] as const;

/**
 * Os cinzas do "em breve" do Marketing.
 *
 * Um módulo que ainda não existe é a única tela feita só de tipografia e fios, e ela usa uma
 * escala mais fria que a do resto — de `.marketing-empty*` em `src/styles/gsap-reference.css`.
 * `src/__tests__/cromoDoEmBreve.test.ts` os amarra ao CSS.
 */
export const COR_EM_BREVE = {
  aro: '#dbe3ef',
  titulo: '#52668d',
  texto: '#8b9ab3',
  fio: '#e1e7f0',
  numero: '#a0aec3',
  item: '#64779a',
  assinatura: '#a1aec1',
} as const;

/**
 * O Plano estratégico.
 *
 * A tela tem uma assinatura própria: os cartões não são brancos, são do MESMO cinza do fundo,
 * com um contorno fino e sem sombra — o que separa um bloco do outro é o fio, não a elevação.
 * Só dois cartões fogem disso, e de propósito: o foco do ciclo (azul) e a introdução da
 * identidade (azul-noite). Os valores saem de `.planning-*` em `src/styles/gsap-reference.css`,
 * e `src/__tests__/cromoDoPlanejamento.test.ts` os amarra lá.
 */
export const COR_PLANEJAMENTO = {
  contorno: '#e1e7f0',
  rotulo: '#93a3bc',
  titulo: '#52668d',
  legenda: '#90a0ba',
  focoDe: '#3361ff',
  focoAte: '#7398ff',
  focoTexto: '#e6edff',
  identidadeDe: '#172548',
  identidadeAte: '#2856b8',
  passoRotulo: '#8d9cb6',
  numeroApoio: '#7f91af',
  campoRotulo: '#8b9ab4',
  objetivoNumero: '#9daabe',
  objetivoTexto: '#5d7095',
  fio: '#edf1f5',
  nota: '#8c9bb2',
  swotTitulo: '#65789b',
  swotItem: '#63769a',
} as const;

/** Forças, Fraquezas, Oportunidades, Ameaças — nesta ordem. */
export const CORES_SWOT = ['#3361ff', '#ff6633', '#29cc39', '#e62e7b'] as const;

/**
 * O mapa de referências: o miolo, os quatro nós e as bolhas de cada categoria.
 *
 * A cor da borda de cada bolha é o que a amarra ao nó do grupo dela — sem isso, o mapa promete
 * "conectar" no subtítulo e não conecta nada.
 */
export const COR_MAPA = {
  centro: '#15794a',
  posicionamento: '#2a54e0',
  artistica: '#8f6207',
  comunicacao: '#b4490a',
  gestao: '#c62330',
  bolha: {
    artistica: { contorno: '#b8860b', texto: '#8a6508' },
    communication: { contorno: '#d2691e', texto: '#a4501a' },
    career: { contorno: '#d64550', texto: '#b5323d' },
  },
} as const;
