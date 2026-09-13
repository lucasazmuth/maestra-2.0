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
/**
 * O arco de luz que percorre a borda da pílula da marca, nas boas-vindas.
 *
 * São os azuis e o roxo da marca, na ordem em que o arco os atravessa. A paleta anterior
 * (magenta + branco) sumia contra o branco da pílula sobre o fundo claro.
 *
 * Vive aqui porque o efeito existe nas DUAS superfícies: na web é um `conic-gradient` girando
 * atrás da pílula; no app, um degradê que gira dentro de um anel recortado. A técnica muda
 * porque não há gradiente cônico no React Native — as cores, não.
 */
export const AURORA_DA_MARCA = ['#9a4fd1', '#3361ff', '#33bfff'] as const;

/**
 * O véu escuro por trás de um aviso modal.
 *
 * Só do APP: na web o overlay é do Ant Design e não passa por aqui. Fica FORA do
 * `COR_DIAGNOSTICO` por isso — aquele grupo é espelhado na folha da web, e um valor que a web
 * não pinta quebraria o cromo dela sem que nada estivesse errado.
 */
export const COR_AVISO = { veu: 'rgba(23, 33, 56, 0.45)' };

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

/**
 * A Nyta — o chat.
 *
 * A conversa tinha um balão por turno, com contorno e avatar dos dois lados. Ela passou a ter
 * UM recipiente só, e é a assimetria toda do desenho:
 *
 *  • A resposta da Nyta é texto na própria página, sem moldura. Um balão espremia uma resposta
 *    longa em 80% da largura e a fazia ler como mensagem de robô; solta, ela lê como documento,
 *    que é o que uma resposta longa é.
 *  • A pergunta de quem escreve é o único recipiente, e em CINZA — não no azul de ação, que a
 *    fazia parecer um botão.
 *
 * Por isso não há mais `bolha`, `bolhaContorno` nem `textoDoArtista` aqui: as duas pontas da
 * conversa deixaram de ser a mesma peça em cores diferentes. Os valores saem de `.nyta-surface`
 * em `src/styles/gsap-reference.css`, e `src/__tests__/cromoDaNyta.test.ts` os amarra lá.
 */
export const COR_NYTA = {
  fundo: '#f7f9fc',
  /**
   * A superfície branca dos CARTÕES do chat — o de confirmar uma ação e o campo de escrever.
   * Era `bolha`, quando a resposta ainda vinha dentro de uma; o nome mudou porque a coisa que
   * ele pinta mudou. Cartão continua existindo; balão de conversa, não.
   */
  cartao: '#ffffff',
  /** O texto da resposta, e o corpo de leitura da tela. */
  resposta: '#4a5b78',
  /** Negrito e títulos dentro da resposta. */
  respostaForte: '#2f4064',
  /** Marcadores das listas que a Nyta escreve. */
  marcador: '#9aabc4',
  /** A pergunta de quem escreve: o único recipiente da conversa. */
  pergunta: '#eceff5',
  perguntaTexto: '#40506e',
  campoContorno: '#dfe6f1',
  campoTexto: '#40506e',
  espacoReservado: '#a4b1c8',
  /** O botão de enviar: escuro e redondo, como na referência. */
  enviar: '#22314f',
  enviarApagado: '#e4e9f2',
  aviso: '#a4b1c8',
  /** Os três pontos da espera. */
  espera: '#b6c2d6',
  limiteFundo: '#f4f7fc',
  limiteContorno: '#d9e2f0',
  limiteTitulo: '#52688f',
  limiteTexto: '#8b9bb5',
  erroFundo: '#fff5f5',
  erroContorno: '#f5d7d7',
} as const;

/**
 * O cabeçalho do chat e a lista de conversas da Nyta.
 *
 * No celular a lista não cabe ao lado e vira o NÍVEL DE TRÁS da conversa: o "voltar" do
 * cabeçalho leva até ela, e é de lá que se sai para o perfil — a navegação em dois níveis de
 * qualquer aplicativo de mensagem.
 *
 * Saíram daqui `contexto`, `uso`, `usoCheioFundo`, `usoCheioTexto` e `titulo`: os quatro
 * primeiros eram a pílula "sobre <artista>" com foto e o contador de mensagens do dia, que o
 * cabeçalho deixou de ter. O `titulo` era o "CONVERSAS" em caixa alta e peso 800 da lista —
 * hoje ela usa o mesmo tom e peso do nome do artista na faixa do chat, porque as duas telas
 * são a MESMA faixa com conteúdos diferentes, e um rótulo gritado fazia parecerem de épocas
 * diferentes do produto. Ele
 * carregava seis coisas numa tela cuja função é ler e escrever, e ficou com três — sair, ver as
 * conversas, começar outra. O nome do artista continua, agora em texto solto.
 *
 * Os valores saem de `ChatHeader.scss` e `ConversationSidebar.scss`, e
 * `src/__tests__/cromoDasConversas.test.ts` os amarra lá.
 */
export const COR_CONVERSAS = {
  fio: '#e8edf4',
  contorno: '#e3eaf3',
  botao: '#8496b3',
  rotulo: '#9aabc4',
  destaque: '#eef2f8',
  destaqueTexto: '#4267b9',
  rascunhoContorno: '#cfdcf0',
  itemTocado: '#f4f7fc',
  nome: '#60749a',
  hora: '#a8b6cd',
  renomearContorno: '#9bb5ec',
} as const;

/**
 * O Plano de Ação.
 *
 * Cada estratégia é uma linha de acordeão com contorno próprio, e aberta ela ganha um azul
 * levíssimo no cabeçalho — o suficiente para dizer qual está aberta sem virar um bloco colorido.
 * A tarefa é um círculo (aberto/fechado) mais o texto e os chips de categoria, dono e prazo.
 *
 * Os valores saem de `src/pages/ActionPlan/actionPlan.scss`, e
 * `src/__tests__/cromoDoPlano.test.ts` os amarra lá.
 */
/**
 * O cabeçalho de página dos módulos — sobretítulo, título e a linha de apoio, com um fio embaixo.
 *
 * Ele APARECE no celular. A folha tem um `.board-content > .module-page-heading { display: none }`
 * que parece esconder em todo lugar, mas o seletor é de filho DIRETO, e o heading dos módulos é
 * filho da página (`.action-plan-page`, `.planning-page`), não do `.board-content`. Cheguei a
 * concluir o contrário lendo só a regra — o `>` decide.
 */
export const COR_CABECALHO_DE_MODULO = {
  rotulo: '#9aa9c2',
  titulo: '#52668d',
  apoio: '#91a0b9',
  fio: '#e5eaf2',
} as const;

export const COR_PLANO = {
  contorno: '#e1e7f0',
  contornoAberta: '#b9c8ff',
  cabecalhoAberta: 'rgba(51, 97, 255, .045)',
  chevron: '#93a3bc',
  rotulo: '#93a3bc',
  titulo: '#52668d',
  progresso: '#8798b4',
  fio: '#edf1f7',
  legenda: '#8d9db7',
  chipContorno: '#dde5f1',
  /** O contorno em volta da lista de estratégias. */
  molduraContorno: '#e1e7f0',
  contagemFundo: '#edf2fb',
  contagemTexto: '#7183a3',
  /** Um cinza mais frio que o da página, para as seções da ficha da tarefa. */
  secaoFundo: '#f7f8fb',
  /** O círculo de concluir, e o "⋮" que abre a ficha. */
  marcar: '#8c9bb2',
  mais: '#9aabc4',
  /** Os três chips da tarefa: categoria, responsável e prazo. */
  chipFundo: '#edf1f6',
  chipTexto: '#7183a1',
  prazoFundo: '#edf2fb',
  prazoTexto: '#60749a',
  responsavelContorno: '#c4cddd',
  responsavelIcone: '#8091ac',
  /** "Adicionar tarefa": contorno tracejado, sem fundo — é um convite, não um botão cheio. */
  adicionarContorno: '#c9d8f0',
} as const;

/**
 * O Catálogo (o módulo "Músicas").
 *
 * No celular a lista deixa de ser cartões soltos e vira uma lista contínua: cada faixa é uma
 * faixa branca de 78px separada por um fio, sem contorno e sem canto arredondado. O botão de
 * tocar é discreto — azul-claro com o ícone em cinza-azulado, e não o azul de ação cheio.
 *
 * Os valores saem de `.catalog-reference-page` e `.catalog-page-heading` em
 * `src/styles/gsap-reference.css`. `src/__tests__/cromoDoCatalogo.test.ts` os amarra lá.
 */
export const COR_CATALOGO = {
  fio: '#edf1f5',
  titulo: '#52668d',
  legenda: '#8b9bb5',
  rotulo: '#93a3bc',
  apoio: '#91a0b9',
  tocarFundo: '#eef3fb',
  tocarIcone: '#60749a',
  contornoDoTopo: '#e1e7f0',
} as const;

/**
 * A Agenda.
 *
 * É CLARA, como o resto do app, e é uma grade do DIA: as horas numa coluna estreita à esquerda e
 * as faixas de 50px à direita, com a barra de ferramentas em cima (hoje, a data, Dia/Mês/Ano e
 * "+ Compromisso").
 *
 * ⚠️ A folha tem um `.agenda-reference-page { background: #0d2146 !important }` que descreve uma
 * agenda azul-noite. Ela NÃO vale: a página real leva as duas classes
 * (`calendar-page agenda-reference-page`) e a de `.calendar-page` vence. Cheguei a portar a
 * versão escura confiando no `!important` — dois `!important` não se resolvem pela leitura, só
 * pelo que o navegador computa. Os valores abaixo saíram do DOM em execução.
 */
export const COR_AGENDA = {
  fundo: '#f7f8fb',
  texto: '#52668d',
  hora: '#65789c',
  rotulo: '#61749a',
  navegar: '#7f91b0',
  abaAtivaFundo: '#ffffff',
  abaAtivaTexto: '#3361ff',
  fio: '#e5e7eb',
  /** O trilho onde as abas Dia/Mês/Ano vivem. */
  abasFundo: '#eef2f8',
  faixa: '#eef1f7',
  diaDeFora: '#aab7cc',
  hoje: '#3361ff',
} as const;

/**
 * O Diagnóstico REAL — a tela de entrega.
 *
 * Tem uma paleta própria, mais fria que a do resto: cartões brancos com contorno `#dbe4f1` e
 * sombra baixa, o cartão do perfil com um degradê claro, e a frase de cada dimensão puxada por
 * uma barra à esquerda na cor da própria dimensão.
 *
 * Os valores saem de `src/pages/ArtistCreate/ArtistCreate.module.scss` (o `DiagnosticReport`,
 * que é o que a rota `/artists/:id/diagnostico` renderiza — não a pasta `DiagnosticoReal`, que
 * é a página pública). `src/__tests__/cromoDoDiagnostico.test.ts` os amarra lá.
 */
export const COR_DIAGNOSTICO = {
  contorno: '#dbe4f1',
  contornoDoHero: '#e1e8f3',
  titulo: '#52668d',
  texto: '#61749a',
  /** O cartão do perfil tem degradê próprio — é o "momento uau" da entrega. */
  cartaoDe: '#ffffff',
  cartaoAte: '#f4f7fd',
  /**
   * O herói da entrega NÃO tem paleta própria: ele usa a do herói do painel (`COR_PAINEL`).
   *
   * Chegou a ter uma, navy caminhando para o roxo — e era justamente o erro: o roxo `COR.marca`
   * é institucional e entra como linha, nunca como campo. Um segundo escuro no produto seria um
   * segundo sistema.
   */
  rotulo: '#8495b3',
  /** Rótulo de seção dentro de um cartão (Composição da receita, Saúde financeira…). */
  secao: '#7184a5',
  /**
   * A letra apagada do Índice REAL sobre o herói escuro, e a palavra abaixo dela.
   *
   * Chegaram a usar o `pilulaContorno` do painel, que é branco a 13% — e 13% é medida de FIO,
   * não de texto: no navy do herói a letra sumia. Na web ainda se multiplicava por um
   * `opacity: .42` do item, o que dava 5% de branco: ilegível de perto, quanto mais impresso.
   *
   * O contraste com a acesa (branco puro) continua evidente, e agora as duas se leem.
   */
  letraApagada: 'rgba(255, 255, 255, .55)',
  palavraApagada: 'rgba(255, 255, 255, .5)',
  /** O disco da letra no cartão da dimensão. */
  discoFundo: '#eef3ff',
  /**
   * O fundo da moldura do vídeo do convite — o azul quase preto por trás do player.
   *
   * Ele aparece enquanto o YouTube carrega, e é o que impede um retângulo branco piscando no
   * meio do cartão. O valor é o mesmo do `.ctaVideo` da web.
   */
  fundoDoVideo: '#0b1020',
  /** A régua e o preenchimento; o TOP ICON troca o azul pelo dourado. */
  regua: '#e8eef7',
  topoDe: '#f5c451',
  topoAte: '#e0a13c',
  /** O "/100" ao lado da nota, e a nota da fonte declarada. */
  maximo: '#6f6f78',
  fonte: '#7c8da8',
  /** O selo âmbar de "Sem CNPJ"/"Sem empresário". */
  selo: '#e0a13c',
  seloFundo: 'rgba(224, 161, 60, 0.12)',
  seloContorno: 'rgba(224, 161, 60, 0.32)',
  /** O mapa dos 16 perfis: a etiqueta comum e a do perfil da pessoa. */
  etiquetaFundo: '#f7f9fd',
  etiquetaContorno: '#d8e1ee',
  etiquetaAtivaFundo: '#eaf0ff',
  etiquetaAtivaContorno: '#9db7ff',
  /**
   * A bolinha apagada do mapa dos 16: é o cinza do TIER_ACCENT.base (o nível 0), e não uma cor
   * própria — a folha o escreve como `rgb(140,140,150)` em vez de hex.
   */
  bolinhaApagada: 'rgb(140, 140, 150)',
  /**
   * A CRIAÇÃO DE PERFIL — o fluxo que leva ao diagnóstico.
   *
   * Ela é neutra no primeiro passo (escolher o artista) e vira o ambiente do REAL a partir da
   * segunda tela; as duas são claras, e no celular a diferença some. Os valores saem do bloco
   * `:not(.pageReal)` de `ArtistCreate.module.scss` e do DOM a 375px.
   */
  criarContorno: '#dfe6f1',
  criarCampoContorno: '#d8e1ee',
  criarPontoApagado: '#d8e1ee',
  criarTrilho: '#e7ecf5',
  criarSeguidores: '#8495b3',
  criarAvisoContorno: '#f0d9a7',
  criarAvisoIcone: '#c98712',
  /** O aviso tem uma barra de 3px na esquerda, mais escura que o contorno, e fundo creme. */
  criarAvisoBarra: '#d89a20',
  criarAvisoFundo: '#fffdf8',
  /** O espaço reservado dos campos deste fluxo é mais claro que o `COR.espaçoReservado`. */
  criarEspacoReservado: '#91a1bd',
  /** A linha de ajuda da pergunta de imprensa. */
  criarAjuda: '#788bad',
  /** As pílulas de porte da pergunta de imprensa, apagadas. */
  criarChipFundo: '#f8faff',
  /** A foto do artista na transição: aro azul-claro e um anel de 5px em volta. */
  criarIntroContorno: '#7f9fff',
  criarIntroAnel: '#e8efff',

  /** O verde de "acima do corte" e o cinza de "abaixo". */
  acima: '#1db954',
  abaixo: '#7184a5',
  /** A tinta escura sobre o selo dourado de TOP ICON. */
  tintaDoTopo: '#1a1206',
  /** O contorno do botão de compartilhar. */
  compartilharContorno: '#cbd9ff',
  /**
   * O fio que separa a barra fixa do rodapé do conteúdo que rola atrás dela.
   *
   * A web usa um degradê para essa transição; no app é uma faixa sólida com este fio, porque o
   * degradê exigiria mais uma camada só pelo efeito. O tom é o mesmo `rgba(219, 228, 241, .9)`
   * do `border-top` do `.stickyCta`, achatado sobre o fundo.
   */
  barraFio: '#dbe4f1',
  /**
   * As cores da composição da receita, na ordem em que a web as usa. São sete porque há sete
   * fontes possíveis; a oitava dá a volta.
   */
  fatiasDaReceita: ['#1db954', '#4c7dff', '#e0a13c', '#9A4FD1', '#21b26e', '#9b8cff', '#d65a5a'],
} as const;

/**
 * O CHECKOUT — a tela que cobra.
 *
 * O kit nasceu escuro e foi repintado no design claro: cartão branco com contorno frio, azul de
 * ação e cinza-azulado no apoio. No celular as duas colunas viram uma só (o `grid` colapsa em
 * 900px), e é essa a leitura que o app replica: formulário primeiro, resumo depois.
 *
 * Os valores saem do bloco `.light` de `src/components/checkout/checkout.module.scss` — que é o
 * tom que o desbloqueio usa — e de `.unlock*` em `ArtistCreate.module.scss`.
 * `src/__tests__/cromoDoCheckout.test.ts` os amarra lá.
 */
export const COR_CHECKOUT = {
  /** Cartão (conta, painel, carrinho): branco com contorno e sombra baixa. */
  contorno: '#d9e3f1',
  titulo: '#52668d',
  texto: '#61749a',
  apoio: '#7185aa',
  /** O disco do e-mail confirmado, o ícone do painel e a bolinha de cada item incluído. */
  disco: '#edf2ff',
  /** O campo: contorno mais forte que o do resto do app — aqui se digita cartão. */
  campoContorno: '#aebfda',
  campoFundo: '#ffffff',
  espacoReservado: '#91a1bb',
  rotulo: '#7185aa',
  erro: '#c32645',
  erroFundo: '#fff1f2',
  erroContorno: '#fecdd3',
  erroIcone: '#dc3152',
  /** O método de pagamento: linha com rádio, e a escolhida ganha fundo azul-claro. */
  metodoContorno: '#d8e2f1',
  metodoRadio: '#9aafce',
  metodoEscolhidoFundo: '#f5f8ff',
  /** O cupom: botão "Aplicar" e a pílula do cupom aplicado. */
  cupomFundo: '#f5f8ff',
  cupomBotaoContorno: '#d5e0f0',
  cupomAplicadoContorno: '#b9cdf9',
  cupomApagado: '#f7f9fc',
  /** As divisórias do carrinho. */
  fio: '#e2e9f4',
  /** O texto de "compra segura" e o recebedor. */
  seguro: '#7185aa',
  /** A opção escolhida na lista de parcelas. */
  escolhidoTexto: '#2b56d8',
  /** O verde do desconto do cupom na tela do PIX (vive numa cor inline do `ProfileUnlock`). */
  descontoPix: '#1fa971',
} as const;

/**
 * A tela de pagamento confirmado.
 *
 * É a única tela ESCURA fora do Espaço da versão, e de propósito: é celebração, não trabalho.
 * Os valores vivem em estilos inline do `src/components/PaymentSuccessScreen.tsx`.
 *
 * O confete e o degradê da web (`SuccessConfetti`, `AuroraBackdrop`) não vieram: são duas peças
 * de animação a mais para um instante que dura três segundos, e o app já tem o Lottie do selo
 * para manter. Se um dia vierem, é aqui que a cor de fundo continua morando.
 */
export const COR_SUCESSO = {
  fundo: '#0a0a0a',
  /** O preto por trás do SVG das auroras (o `backgroundColor` do `AuroraBackdrop`). */
  pagina: '#000',
  apoio: '#dce3f5',
  texto: '#8f9bb8',
} as const;

/**
 * A caixa de notificações.
 *
 * Cada aviso é um cartão de 88px com um disco azul-claro à esquerda, o título, a linha de apoio
 * e a hora à direita. Os valores saem de `.notifications-list` em `src/styles/gsap-reference.css`.
 * `src/__tests__/cromoDasNotificacoes.test.ts` os amarra lá.
 */
export const COR_NOTIFICACOES = {
  contorno: '#e5eaf2',
  disco: '#edf2ff',
  titulo: '#5b6f94',
  texto: '#98a6bd',
  hora: '#9aa9c2',
  /** "NOVO" é roxo e sem fundo — uma palavra, não um selo. */
  novo: '#8833ff',
  limpar: '#d24b61',
} as const;

/**
 * Configurações.
 *
 * Cartões do MESMO cinza do fundo com contorno fino e sem sombra, cada um aberto por um quadrado
 * azul-claro de 38px com o ícone dentro. Os valores saem de `.settings-*` em
 * `src/styles/gsap-reference.css`; `src/__tests__/cromoDaConta.test.ts` os amarra lá.
 */
export const COR_CONTA = {
  contorno: '#e5eaf2',
  disco: '#edf2ff',
  rotulo: '#9aa9c2',
  titulo: '#52668d',
  tituloDoCartao: '#5b6f94',
  texto: '#98a6bd',
  apoio: '#8e9eb8',
  /** A estrela da avaliação: o MESMO dourado da estrela do Espaço Jam. */
  estrela: '#e0ad3c',
  /** O interruptor de notificações, e o aviso de quando ele não existe. */
  interruptorFundo: '#dde3ee',
  aviso: '#b0720f',
  avisoFundo: '#fff7e8',
  /**
   * Os quatro tons do status de um pagamento, com o par fundo/texto de cada um.
   *
   * `STATUS_META` (no núcleo) diz o TOM de cada status — `ok`, `warn`, `danger`, `mute` — e a
   * folha da web (`Payments.module.scss`) pinta cada tom. Aqui é a mesma tradução, para "Pago",
   * "Pendente" e "Vencido" não caírem todos no mesmo cinza.
   */
  pagoFundo: '#e6f5ef',
  pagoTom: '#1d8a68',
  atencaoFundo: '#fdf6e6',
  atencaoTom: '#a17a1c',
  perigoFundo: '#fdeeee',
  perigoTom: '#c33a3f',
  neutroFundo: '#eef1f7',
  neutroTom: '#7c8da8',
} as const;

/**
 * A Equipe.
 *
 * Cada membro é uma faixa de 78px com o avatar, o nome, o e-mail, UMA pílula dizendo o nível de
 * acesso e o estado — ponto verde mais a palavra. Os valores vieram do DOM em execução.
 */
export const COR_EQUIPE = {
  nome: '#52668d',
  email: '#8b9bb5',
  acessoFundo: '#eef3fb',
  acessoTexto: '#6a7c9e',
  ativoPonto: '#29cc39',
  ativoTexto: '#2a9a59',
  pendentePonto: '#f0ad2f',
  pendenteTexto: '#e5b95e',
  recusadoPonto: '#d95263',
  recusadoTexto: '#d87783',
  pendente: '#aeb9ca',
  /** O contorno da lista e o fio entre uma pessoa e a seguinte. */
  contorno: '#e1e7f0',
  fio: '#edf1f5',
  /** O avatar sem foto, e o "···" da linha. */
  avatarFundo: '#eaf0fb',
  mais: '#aeb9ca',
  /** O cartão de permissão: contorno e fundo quando apagado, azul quando marcado. */
  permissaoContorno: '#e3eaf5',
  permissaoFundo: '#fbfcfe',
  permissaoTexto: '#5f76a3',
  permissaoMarcadaContorno: '#b9cbed',
  permissaoMarcadaTexto: '#2f4f8f',
  permissaoCaixa: '#ccd8ea',
  permissaoApoio: '#91a0b9',
} as const;

/**
 * A lista de perfis.
 *
 * O cartão é CENTRADO, e não uma linha: foto redonda de 140px no meio, nome embaixo em 20px, e o
 * papel em 15px — a mesma leitura de um seletor de perfil de streaming. O selo de estado é um
 * ponto colorido com o texto ao lado, na cor do próprio estado.
 *
 * Os valores saem de `src/pages/Artists/Artists.module.scss`;
 * `src/__tests__/cromoDosPerfis.test.ts` os amarra lá.
 */
export const COR_PERFIS = {
  titulo: '#53668d',
  papel: '#97a6be',
  pagamentoPendente: '#3361ff',
  semPlano: '#b0720f',
  /**
   * O selo do plano (`PlanTag`), nos três estados. O degradê do PRO e do Pendente vira a cor da
   * PRIMEIRA parada: são duas paradas com 4 pontos de diferença de opacidade dentro de uma
   * pílula de 20px de altura, e um `LinearGradient` a mais ali não muda o que se vê.
   */
  seloFundo: '#f7f9fd',
  seloContorno: '#e1e8f3',
  selo: '#8ca0c5',
  proFundo: 'rgba(51, 97, 255, .12)',
  proContorno: 'rgba(51, 97, 255, .24)',
  pendenteFundo: 'rgba(240, 180, 41, .16)',
  pendenteContorno: 'rgba(221, 154, 18, .28)',
  pendente: '#9a7217',
  /** Os dois botões redondos do topo: círculo branco com sombra baixa. */
  controle: '#ffffff',
  sino: '#b2bed1',
  menu: '#8e9eb8',
  /**
   * O painel do menu do sistema: grade de duas colunas com fios finos, ícone em cima e rótulo
   * embaixo — a mesma célula do "Mais" da barra de abas.
   */
  painelContorno: '#e8edf5',
  painelFio: '#edf1f7',
  painelRotulo: '#98a7be',
  painelIcone: '#b2bed0',
  /**
   * O ponto de não-lidas do sino: ROSA, e sem número. A contagem vive no rótulo de
   * acessibilidade — o app mostrava um balão vermelho com "2" que a web não tem.
   */
  naoLidas: '#e62e7b',
} as const;

/**
 * O selo do plano, ao lado da marca.
 *
 * Três estados, e o padrão é o mais discreto: FREE é só contorno, porque não há nada de errado
 * em não ser Pro. Os valores saem de `src/components/PlanTag/PlanTag.module.scss`.
 */
export const COR_PLANO_DA_CONTA = {
  proContorno: 'rgba(51, 97, 255, .24)',
  proTexto: '#2a54e0',
  pendenteContorno: 'rgba(221, 154, 18, .28)',
  pendenteTexto: '#9a7217',
  livreContorno: '#e1e8f3',
  livreFundo: '#f7f9fd',
  livreTexto: '#8ca0c5',
} as const;

/**
 * As telas de autenticação (entrar, cadastrar, esqueci e redefinir senha).
 *
 * O formulário vive num cartão branco no meio de um fundo com degradê — as duas manchas
 * radiais, azul e roxa, são a assinatura da entrada. Google e Apple ficam LADO A LADO, em duas
 * colunas iguais: a diretriz 4.8 da App Store pede que o Sign in with Apple tenha a mesma
 * proeminência dos outros, e empilhado o de cima vira o "principal" aos olhos de quem lê.
 *
 * Os valores saem de `src/pages/Login/AuthShell.module.scss`;
 * `src/__tests__/cromoDaEntrada.test.ts` os amarra lá.
 */
export const COR_ENTRADA = {
  fundoDe: '#f9fbff',
  fundoAte: '#eef4ff',
  manchaAzul: 'rgba(47, 96, 246, .1)',
  manchaRoxa: 'rgba(154, 79, 209, .07)',
  contornoDoCartao: '#e3eaf3',
  marca: '#52668d',
  rotulo: '#93a4c0',
  /**
   * O contorno dos botoes sociais.
   *
   * E PRETO porque o botao do Sign in with Apple e o do SISTEMA, e ele so aceita tres estilos
   * (branco, branco com contorno, preto) — nao da para pintar a borda dele. Entao quem se
   * ajusta e o botao do Google, que copia o contorno do vizinho para os dois parecerem o mesmo
   * par. E tambem o que as diretrizes de marca do Google pedem para o tema claro: fundo branco
   * com traco neutro.
   */
  socialContorno: '#000000',
  socialFundo: '#ffffff',
  socialTexto: '#52668d',
  divisoria: '#e6ecf6',
  divisoriaTexto: '#9aabc4',
  campoContorno: '#e1e7f0',
  campoFundo: '#fbfcfe',
  campoIcone: '#9aabc4',
  texto: '#405985',
  espacoReservado: '#a3b2ca',
  apoio: '#7c8da8',
  linkSecundario: '#4267b9',
  erro: '#d2474b',
} as const;

/**
 * O Espaço JAM — a tela da MÚSICA vista pela gravação.
 *
 * Na web ela é `position: fixed; inset: 0`: cobre o app inteiro, some o topo, o rail e a barra.
 * No app, portanto, ela mora FORA das abas do artista, e não dentro do catálogo.
 *
 * O layout em 375px é de cima para baixo: etiqueta "ESPAÇO JAM", linha
 * [voltar] título [status] [editar], a ficha técnica em 2×2 (BPM, Tom, Gênero, Lançamento), o
 * botão Upload e a lista de versões; embaixo, o chat do projeto. Os dois blocos sangram até as
 * bordas (a folha cancela o recuo da página com margem negativa de 18px), sem cantos e sem
 * bordas laterais — o que os separa é o fio de cima e o de baixo.
 *
 * Os valores saem de `src/pages/Catalog/ProjectSpace.module.scss` (bloco `max-width: 760px`) e
 * do DOM computado a 375px; `src/__tests__/cromoDoEspacoJam.test.ts` os amarra lá.
 */
// Três tokens saíram daqui em 09/09/2026 junto com o chat do projeto: `painelDoChat`,
// `legenda` (o texto das mensagens) e `entradaFundo` (o campo de escrever). Eram cores que só a
// casca do chat usava na web, e este objeto é a cópia da folha da web — o teste do cromo
// reprova um token que a folha não tem. O que no app usava `legenda` passou para `apoio`, e o
// que usava `entradaFundo` para `cabecaDaVersao`, que são os tons vizinhos que ficaram.
/**
 * A cor de cada pista da mesa, pela posição dela.
 *
 * Cor como SISTEMA, e não como enfeite: a mesma cor identifica a faixa na borda da linha, o
 * ponto ao lado do nome e a onda. É o que faz uma mesa de seis pistas ler-se de relance.
 *
 * Sai da POSIÇÃO e não do instrumento, porque o nome da pista é texto livre — adivinhar
 * "bateria" de "808" ou "Kick in" daria errado mais vezes do que certo, e uma cor errada é pior
 * do que uma cor arbitrária.
 *
 * ⚠️ Estas NÃO entram no `COR_JAM`: aquele objeto é a cópia da folha da web, e o teste do cromo
 * compara-o linha a linha com o SCSS. Estas são usadas em linha nas duas superfícies, a partir
 * daqui — uma fonte só, sem cópia para divergir.
 */
/**
 * As cores das faixas do editor.
 *
 * ⚠️ SÃO AS DA WEB, À LETRA — `src/pages/Catalog/daw/tokens.ts`, e o `peleDoEditor` prende as
 * duas listas. Aqui viveu durante um tempo uma paleta PRÓPRIA, de oito cores mais apagadas, e o
 * resultado era a mesma faixa roxa no computador e amarela no telemóvel: quem punha os dois
 * lado a lado via duas montagens diferentes da mesma música.
 *
 * Seis, e não oito: é o que a folha do editor define, e o `proximaCorDaPista` conta até esse
 * número para escolher a próxima livre.
 */
export const CORES_DAS_PISTAS = [
  '#3b82f6', // azul
  '#a855f7', // roxo
  '#22c55e', // verde
  '#f59e0b', // âmbar
  '#ec4899', // rosa
  '#14b8a6', // turquesa
] as const;

/**
 * O nome de cada cor, na ordem da paleta.
 *
 * ⚠️ QUEM NÃO VÊ A COR PRECISA DE A OUVIR. Seis bolinhas coloridas são seis alvos idênticos
 * para um leitor de tela; sem nome, escolher a cor de uma faixa passa a ser impossível — e a
 * cor é justamente o que distingue uma faixa da outra de relance.
 *
 * Moram no núcleo porque as duas telas anunciam as mesmas seis.
 */
export const NOMES_DAS_CORES = [
  'Azul', 'Roxo', 'Verde', 'Âmbar', 'Rosa', 'Turquesa',
] as const;

/** A cor da pista na posição N. Dá a volta: a sétima pista repete a primeira. */
export const corDaPista = (indice: number): string =>
  CORES_DAS_PISTAS[((indice % CORES_DAS_PISTAS.length) + CORES_DAS_PISTAS.length)
    % CORES_DAS_PISTAS.length];

/**
 * A PELE DO EDITOR — o Espaço JAM, nas duas superfícies.
 *
 * ⚠️ ESTA TELA NÃO USA O DESIGN SYSTEM DO RESTO DO PRODUTO, e é de propósito. O Maestra é claro,
 * azul-marca e arredondado; um editor de música é escuro, denso e de contraste alto — é o que
 * Ableton, Logic e Pro Tools são, e é o que o olho de quem trabalha com áudio espera. Misturar
 * os dois daria uma tela que não é nem uma coisa nem outra. Os valores são os da referência que
 * o dono do produto mandou, e são os mesmos do `DS` da web (`src/pages/Catalog/daw/tokens.ts`).
 *
 * ⚠️ AS CHAVES SÃO AS DO `COR_JAM`, uma a uma, e não é coincidência: o app foi desenhado claro
 * primeiro, e o que muda quando ele veste o editor é a TINTA, não o papel de cada cor. Com o
 * mesmo conjunto de chaves, a troca é de import — e uma cor que exista num e não no outro passa
 * a ser um erro de compilação em vez de um buraco na tela.
 */
/**
 * O AZUL DA AÇÃO no editor: o play, os controlos deslizantes, o botão de enviar.
 *
 * Não entra no `COR_EDITOR` porque não tem par no `COR_JAM` — o app claro usa a primária da
 * marca para isto, e o editor usa a do `DS` da web. São dois azuis parecidos e diferentes, e a
 * diferença é de propósito: o azul da marca ao lado de um cinza quase preto puxa para o roxo.
 */
export const AZUL_DO_EDITOR = '#3b82f6';

/** A agulha e o botão de gravar, no editor. */
export const VERMELHO_DO_EDITOR = '#ef4444';

export const COR_EDITOR: Record<keyof typeof COR_JAM, string> = {
  // O fundo é chapado, como na web: um gradiente num fundo quase preto é banda, não profundidade.
  fundoDe: '#1a1a1e',
  fundoAte: '#1a1a1e',
  mancha: 'rgba(59, 130, 246, .10)',
  painel: '#212127',
  fio: '#33333d',
  texto: '#e8e8ee',
  titulo: '#e8e8ee',
  rotulo: '#71717f',
  apoio: '#a6a6b3',
  botaoRedondo: '#2f2f38',
  cabecaDaVersao: '#2a2a32',
  contornoDaVersao: '#33333d',
  cracha: '#a6a6b3',
  /** Apagada é a mais fraca que ainda se lê; acesa é o âmbar, o mesmo dos dois lados. */
  estrela: '#4a4a56',
  estrelaAcesa: '#f59e0b',
  acaoFundo: '#2f2f38',
  acaoIcone: '#e8e8ee',
  vazioContorno: '#44444f',
  avatarDe: '#a855f7',
  avatarAte: '#3b82f6',
  statusPadrao: '#edc663',
  tintaEscura: '#181818',
  apoioDoVazio: '#71717f',
  /** No escuro, "papel" é a tinta que se escreve POR CIMA de uma cor cheia — continua branca. */
  papel: '#ffffff',
};

export const COR_JAM = {
  fundoDe: '#f9fbff',
  fundoAte: '#eef4ff',
  mancha: 'rgba(47, 96, 246, .08)',
  painel: 'rgba(255, 255, 255, .86)',
  fio: '#dce6f7',
  texto: '#405985',
  titulo: '#2f4164',
  rotulo: '#8ca0c5',
  apoio: '#7f92b6',
  botaoRedondo: 'rgba(255, 255, 255, .92)',
  /** O fundo dos blocos dentro das folhas e dos modais — vem do `StandardModal` da web. */
  cabecaDaVersao: '#f6f9ff',
  contornoDaVersao: '#dce6f7',
  cracha: '#5f76a3',
  estrela: '#b7c4da',
  estrelaAcesa: '#e0ad3c',
  acaoFundo: '#eef4ff',
  acaoIcone: '#405985',
  vazioContorno: '#c8d7f0',
  avatarDe: '#9a4fd1',
  avatarAte: '#2f60f6',
  /** O status sem cor própria cai neste amarelo, e a pílula escolhe a tinta pela luminância. */
  statusPadrao: '#edc663',
  tintaEscura: '#181818',
  apoioDoVazio: '#6f83aa',
  papel: '#ffffff',
} as const;

/**
 * O ESPAÇO DA VERSÃO — a tela cheia de UMA gravação.
 *
 * É a única tela ESCURA do produto, e de propósito: aqui não se administra nada, se escuta. O
 * cabeçalho continua claro (é a saída), o corpo é quase preto com a capa da música ao fundo sob
 * um degradê, o traço orgânico gira em volta do play enquanto toca, e a conversa da equipe vem
 * embaixo, também escura.
 *
 * A régua de progresso carrega os comentários MARCADOS num ponto do áudio: cada alfinete é um
 * comentário num segundo, e tocar nele leva a reprodução até lá.
 *
 * Os valores saem de `src/styles/gsap-reference.css` (blocos `.track-detail-*`, `.track-player`,
 * `.track-comment-*`) e do DOM computado a 375px;
 * `src/__tests__/cromoDoEspacoDaVersao.test.ts` os amarra lá.
 */
export const COR_VERSAO = {
  fundo: '#18213b',
  cabecalho: '#ffffff',
  cabecalhoTexto: '#52668d',
  cabecalhoIcone: '#8ca0bd',
  cabecalhoApoio: '#a2b0c7',
  estrelaFundo: '#fdf4de',
  estrela: '#e0ad3c',
  palco: '#090c18',
  veuDe: 'rgba(48, 40, 82, .88)',
  veuMeio: 'rgba(21, 28, 62, .92)',
  veuAte: 'rgba(8, 10, 20, .95)',
  brilho: '#8e3cff',
  traco: 'rgba(255,255,255,.92)',
  rotulo: 'rgba(255,255,255,.52)',
  valor: 'rgba(255,255,255,.86)',
  relogio: 'rgba(255,255,255,.74)',
  trilho: 'rgba(255,255,255,.22)',
  divisoria: 'rgba(255,255,255,.16)',
  alfinete: '#1479ff',
  conversaDe: '#080808',
  conversaAte: '#090b10',
  contagem: 'rgba(255,255,255,.13)',
  autor: '#ffffff',
  data: 'rgba(255,255,255,.45)',
  fala: 'rgba(255,255,255,.68)',
  marcado: '#2f8cff',
  campoFundo: '#171717',
  campoContorno: 'rgba(255,255,255,.12)',
  campoTexto: 'rgba(255,255,255,.42)',
  rotuloDaConversa: '#9aa9c2',
  sombra: '#000000',
} as const;

/**
 * As opções da ONDA da versão — as mesmas nas duas superfícies.
 *
 * A web desenha com o wavesurfer.js (`src/pages/Catalog/WaveSurferWaveform.tsx`); o app roda a
 * MESMA biblioteca dentro de um WebView. Enquanto os dois lerem estas opções daqui, a onda de um
 * arquivo é o mesmo desenho nos dois — e uma barra a mais no celular deixa de ser possível.
 *
 * `height: 60` num contêiner de 62 é o que a folha da web mede; barras de 3px com 4 de vão são o
 * que dá àquela onda a densidade que ela tem.
 */
export const ONDA_DA_VERSAO = {
  height: 60,
  waveColor: '#405985',
  progressColor: '#2f60f6',
  cursorWidth: 0,
  barWidth: 3,
  barGap: 4,
  barRadius: 3,
  barMinHeight: 3,
  normalize: true,
  interact: true,
  dragToSeek: true,
  hideScrollbar: true,
} as const;

/**
 * A ESPERA: a marca da Maestra a respirar.
 *
 * ⚠️ NÃO É UMA RODA. Uma roda a girar é o sinal de espera de toda a gente, e por isso não é de
 * ninguém — a tela podia ser de qualquer aplicativo. A marca a respirar diz de quem é a espera,
 * e a web já o fazia (`src/components/spinner/spinner.scss`); o aplicativo é que tinha ficado
 * com o círculo do sistema.
 *
 * ⚠️ OS NÚMEROS MORAM AQUI porque as duas superfícies os escrevem em linguagens diferentes — a
 * web em `@keyframes`, o aplicativo em `reanimated` — e duas cópias de uma curva divergem sem
 * que ninguém repare: uma respiração meio segundo mais lenta num dos lados não quebra nada, só
 * faz os dois parecerem dois produtos.
 *
 * A roda pequena CONTINUA onde sempre esteve: dentro de um botão a gravar, ao pé de um campo, no
 * rodapé de uma lista que busca mais. Ali ela não é a espera da tela — é o estado de um controlo,
 * e a marca a respirar dentro de um botão de 44 seria um logotipo a piscar numa caixa.
 */
export const ESPERA_DA_MARCA = {
  /** O cinza-azulado da marca em repouso. */
  cor: '#526B96',
  /** O desenho, em pontos. A caixa é maior: a respiração cresce até 1.0 e precisa de folga. */
  marca: 48,
  caixa: 72,
  /** Uma respiração inteira, em milissegundos. */
  ciclo: 1550,
  /**
   * Os quadros da respiração, em fração do ciclo. São os mesmos `@keyframes` da web, lidos como
   * dados: `em` é onde o quadro cai (0..1), e os dois valores são o que se vê nele.
   */
  quadros: [
    { em: 0, opacidade: 0.55, escala: 0.88 },
    { em: 0.45, opacidade: 1, escala: 1 },
    { em: 0.65, opacidade: 0.78, escala: 0.95 },
    { em: 1, opacidade: 0.55, escala: 0.88 },
  ],
} as const;

/**
 * A TELA DE SUPORTE: os dois canais, em cartão.
 *
 * Os valores saem de `src/pages/Support/Support.module.scss`, e o app desenha os mesmos dois
 * cartões empilhados — que é o que a web já faz abaixo de 700px.
 *
 * ⚠️ O VERDE DO WHATSAPP NÃO É DECORAÇÃO: o canal reconhece-se pela cor antes de se ler o
 * título, e é o que separa os dois cartões à primeira vista. Por isso ele é um token, e não o
 * azul do sistema com outro nome.
 */
export const COR_SUPORTE = {
  contorno: '#edf1f7',
  titulo: '#52668d',
  apoio: '#98a6bd',
  valor: '#5b6f94',
  /** O quadrado do ícone: azul pálido no e-mail, verde no WhatsApp. */
  disco: '#edf2ff',
  discoWhatsapp: '#e7f8ee',
} as const;

/**
 * AS PÁGINAS LEGAIS (termos e privacidade).
 *
 * Os valores saem de `src/pages/Legal/legal.scss`. O texto é o MESMO markdown de
 * `constants/legal.ts`, desenhado nas duas superfícies: `react-markdown` na web, e no app o
 * parser do núcleo (`nucleo/markdownDaNyta`) — o mesmo que a Nyta usa.
 *
 * ⚠️ CORPO DE LEITURA LONGA, e daí a entrelinha de 1.75 que a web usa: são documentos de
 * milhares de palavras que alguém percorre à procura de uma cláusula, e não um aviso de duas
 * linhas.
 */
export const COR_LEGAL = {
  titulo: '#2c3f63',
  texto: '#52668d',
  apoio: '#52668d',
} as const;

/**
 * O CABEÇALHO DAS PÁGINAS DE APOIO — Notificações, Histórico, Suporte, Termos, Política.
 *
 * São as telas FOLHA do usuário: entra-se nelas por um caminho, lê-se, e volta-se. O desenho é
 * o mesmo em todas — botão redondo de voltar, um sobretítulo que diz de onde a página é, o
 * título grande, e às vezes uma linha de apoio.
 *
 * ⚠️ ELE ESTEVE ESCRITO À MÃO EM CADA TELA, e foi assim que o `CabecalhoDoModulo` nasceu do lado
 * dos módulos do artista: "título 27 num, 30 noutro; espaçamento de letra só num deles... todas
 * juntas dão a impressão de telas escritas por gente diferente — que é exatamente o que eram".
 * Aqui o mesmo estava a começar: o Histórico tinha o sobretítulo a 9 e as Notificações a 10.
 *
 * Os valores são os das Notificações, que é a tela que o dono apontou como o padrão.
 */
export const COR_CABECALHO_DE_APOIO = {
  sobretitulo: '#9aa9c2',
  titulo: '#5b6f94',
  apoio: '#98a6bd',
} as const;
