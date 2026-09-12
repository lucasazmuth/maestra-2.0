
// A RÉGUA DA LINHA DO TEMPO, em compassos.
//
// ⚠️ O BPM NÃO FAZIA NADA NA TELA. Escrevia-se um número no rodapé, ele ia para o banco e para
// a ficha, e a montagem continuava marcada em segundos — com o clipe a encaixar de quarto em
// quarto de segundo, que não é uma unidade musical de coisa nenhuma. Num editor, o andamento é
// o que transforma "arrastar até parecer certo" em "largar no tempo": a régua conta compassos,
// e o clipe cai onde a música tem uma batida.
//
// Sem BPM, tudo isto desliga e volta a régua de segundos. É o caso mais comum — a maior parte
// dos projetos nunca chega a ter um andamento escrito —, e uma grelha inventada por omissão
// seria pior do que grelha nenhuma: diria que a música está em 120 quando ninguém disse isso.

/**
 * O zoom de partida: 100 % são 60 pixels (ou pontos) por segundo.
 *
 * ⚠️ AS MEDIDAS DA ESCALA VIVEM AQUI, e não nos tokens da web, desde que a linha do tempo passou
 * a existir nas duas superfícies. Elas não são estilo — são a conversão entre segundo e pixel, e
 * é dela que saem a régua, o encaixe e o encaixe automático ao abrir. Duas cópias divergiriam no
 * primeiro ajuste, e o sintoma seria a mesma música com dois comprimentos.
 */
export const PIXELS_POR_SEGUNDO = 60;

/** O quanto os botões de zoom afastam, no caso normal. */
export const ZOOM_MINIMO = 0.25;
export const ZOOM_MAXIMO = 4;

/**
 * O chão de todos: nem o encaixe automático desce daqui.
 *
 * ⚠️ ELE EXISTE POR CAUSA DO ECRÃ PEQUENO. A 0,25 (15 px/s) uma música de dois minutos mede
 * 2 000 px — cinco ecrãs de 390 —, e ali a única forma de a percorrer é arrastar sem fim. Para
 * a montagem abrir inteira à vista, o zoom tem de poder descer até onde ela caiba; abaixo de
 * 0,02 (1,2 px/s) a onda deixa de ter forma e passa a ser um risco.
 */
export const ZOOM_MINIMO_ABSOLUTO = 0.02;

/**
 * O zoom com que a montagem inteira cabe na largura que sobra para as ondas.
 *
 * Nunca passa de 100 %: uma música de dez segundos não deve abrir esticada a 400 % só porque
 * cabia — a régua fica absurda e a onda vira um borrão largo. E nunca desce abaixo do
 * `ZOOM_MINIMO_ABSOLUTO`, que é o ponto em que a onda deixa de ter forma.
 *
 * Sem largura ou sem duração não há encaixe possível, e o valor de partida (100 %) fica.
 */
export const zoomQueEncaixa = (duracao: number, larguraVisivel: number): number => {
  if (duracao <= 0 || larguraVisivel <= 0) return 1;
  return Math.max(ZOOM_MINIMO_ABSOLUTO, Math.min(1, larguraVisivel / (duracao * PIXELS_POR_SEGUNDO)));
};

/**
 * Onde a rolagem tem de ficar para um dado segundo aparecer NO MEIO do que se vê.
 *
 * ⚠️ ISTO É O QUE FAZ O ZOOM SERVIR PARA ALGUMA COISA. Quem aproxima a linha do tempo está
 * quase sempre a preparar um corte: quer ver a agulha de perto para acertar no sítio exato.
 * Mas aproximar multiplica a distância de tudo ao zero — a mesma rolagem passa a apontar para
 * um segundo completamente diferente — e a agulha saltava para fora do ecrã. O gesto seguinte
 * era sempre o mesmo: rolar à procura dela. Aproximar custava dois gestos, e o segundo não
 * tinha nada a ver com o que se queria fazer.
 *
 * Centrada, ela está onde o olho já estava, e sobra metade da largura de cada lado — que é
 * exatamente o que se quer ver ao decidir onde cortar.
 *
 * ⚠️ E A CONTA É COM A LARGURA DAS ONDAS, não com a da tela. A coluna das faixas fica colada à
 * esquerda por cima da montagem: descontá-la é o que impede a agulha de ficar centrada numa
 * área que está metade tapada.
 *
 * `maximo` é o fim da rolagem possível (o conteúdo menos o que se vê). O resultado nunca sai
 * dele: perto das pontas a agulha não pode ficar no meio — não há montagem que chegue de um
 * dos lados — e forçá-la deixaria uma faixa vazia à vista.
 */
export const rolagemQueCentra = (
  segundo: number,
  escala: number,
  larguraVisivel: number,
  maximo: number,
): number => Math.max(0, Math.min(
  maximo > 0 ? maximo : 0,
  segundo * escala - larguraVisivel / 2,
));

/**
 * A folga com que se mede a agulha, em segundos.
 *
 * ⚠️ O QUE SEPARA A AGULHA A ANDAR DA AGULHA A SER LEVADA NÃO É O TAMANHO DO PASSO — é o passo
 * comparado com o TEMPO QUE PASSOU. A primeira versão disto tinha um limite fixo de meio
 * segundo, e funcionava até ao dia em que a tela engasgava: um quadro lento entregava um passo
 * de 600 ms de música, a regra lia-o como alguém a mover a agulha, e a linha largava o modo
 * travado. No aparelho isso via-se de olho — ela descolava-se do meio e ia derivando para a
 * direita até sair, travava outra vez, e recomeçava.
 *
 * A música só anda ao ritmo do relógio. Um passo maior do que o tempo de parede que passou é,
 * por construção, alguém a pôr a agulha noutro sítio. A folga cobre o arredondamento dos dois
 * relógios, e nada mais.
 */
export const FOLGA_DA_AGULHA = 0.05;

/** O que a vista faz a seguir. */
export interface PassoDaVista {
  /** A rolagem nova, ou `null` para não mexer em nada. */
  rolagem: number | null;
  /** A vista passa a andar COM a agulha? Quem chama guarda isto e devolve no passo seguinte. */
  seguindo: boolean;
}

/**
 * ⚠️ NADA DISTO SE ANIMA, NEM O SALTO DE ENTRADA — e isto custou uma sessão a perceber.
 *
 * A primeira versão devolvia também um `suave`, para o salto de meia tela entrar a deslizar. No
 * telemóvel isso partia o modo travado: uma rolagem ANIMADA continua a correr depois de pedida,
 * e as rolagens dos vigésimos de segundo seguintes — instantâneas — eram engolidas por ela. A
 * linha descolava-se do meio, ia derivando para a direita, e quando a animação acabava voltava
 * para trás de repente. No aparelho via-se de olho; nenhum teste apanhava, porque em teste o
 * `scrollTo` é um duplo que responde na hora.
 *
 * Sem animação nenhuma, cada pedido chega inteiro. O salto de entrada fica seco, o que é o preço
 * certo: ele acontece uma vez, e uma linha travada que treme acontece o tempo todo.
 */

/**
 * O QUE A VISTA FAZ ENQUANTO A MÚSICA TOCA — e são dois modos, não um.
 *
 * ⚠️ PRIMEIRO A AGULHA ANDA E A MONTAGEM ESTÁ QUIETA. É o que sempre aconteceu, e é o que se
 * quer enquanto ela está à vista: quem está a olhar para um compasso continua a olhar para ele,
 * e a linha vermelha atravessa o ecrã por cima de uma montagem parada.
 *
 * ⚠️ DEPOIS TROCAM DE PAPEL. No instante em que ela ia desaparecer pela direita, a vista trava-a
 * no MEIO e passa a ser a montagem a deslizar por baixo — como num gravador de fita. Daí para a
 * frente a linha fica parada no ecrã e o que se mexe é a música, que é o que se quer ver quando
 * já não há mais ecrã para ela percorrer.
 *
 * A troca custa um salto de meia tela, uma vez só: a agulha vem da borda direita para o meio. É
 * o preço de a travar no meio em vez de a travar na borda, e é onde ela serve — com metade da
 * largura de cada lado, vê-se ao mesmo tempo o que acabou de soar e o que vem a seguir.
 *
 * ⚠️ E O MODO NÃO SE ADIVINHA A CADA PASSO: ele GUARDA-SE. Perguntar só "está à vista?" dava o
 * contrário do que se pede — centrada, ela está à vista, e no passo seguinte a regra mandaria
 * não mexer; ela voltava a derivar até à borda, saltava outra vez para o meio, e a vista virava
 * páginas em vez de deslizar. É o `seguindo` que distingue os dois modos.
 *
 * ⚠️ E QUEM LEVA A AGULHA À MÃO SAI DO SEGUNDO MODO. Voltar ao início, tocar na régua, fechar um
 * ciclo do loop: aí a pessoa escolheu um sítio, e o que ela quer é ver esse sítio e a linha a
 * andar outra vez a partir dele — não a montagem a deslizar por baixo de uma linha presa.
 */
export const passoDaVista = (vista: {
  segundo: number;
  /** Onde a agulha estava no passo anterior, para distinguir andar de ser levada. */
  anterior: number;
  /**
   * Quanto tempo de PAREDE passou desde esse passo, em segundos.
   *
   * É ele que distingue as duas coisas: a música só anda ao ritmo do relógio, e um passo maior
   * do que o tempo que passou é alguém a mover a agulha. Sem isto, um quadro lento parecia um
   * salto e a linha largava o modo travado.
   */
  desdeAnterior: number;
  escala: number;
  rolagemAtual: number;
  larguraVisivel: number;
  maximo: number;
  seguindo: boolean;
}): PassoDaVista => {
  const {
    segundo, anterior, desdeAnterior, escala, rolagemAtual, larguraVisivel, maximo,
  } = vista;
  if (larguraVisivel <= 0) return { rolagem: null, seguindo: vista.seguindo };

  const andou = segundo - anterior;
  // Para trás nunca é a música: é voltar ao início, o fim de um ciclo do loop, um toque na
  // régua. Para a frente, é a música enquanto couber no tempo que passou.
  const saltou = andou < -FOLGA_DA_AGULHA
    || andou > Math.max(0, desdeAnterior) + FOLGA_DA_AGULHA;
  const seguindo = saltou ? false : vista.seguindo;
  const onde = segundo * escala;
  const aVista = onde >= rolagemAtual && onde <= rolagemAtual + larguraVisivel;

  // Modo 1: a agulha anda, a montagem fica. Vale enquanto ela se vir.
  if (!seguindo && aVista) return { rolagem: null, seguindo: false };

  const centrada = rolagemQueCentra(segundo, escala, larguraVisivel, maximo);
  // ⚠️ E NÃO PEDE UMA ROLAGEM QUE JÁ ESTÁ FEITA. Perto do fim a rolagem chega ao máximo e fica
  // lá: sem isto, a tela pedia uma rolagem por vigésimo de segundo para ficar onde já estava —
  // no aparelho, uma animação a lutar com o dedo.
  //
  // ⚠️ E UM SALTO NÃO ENTRA NO MODO 2. Levar a agulha para fora do que se vê leva a vista com
  // ela — mas para a MOSTRAR, e não para a prender: a partir dali ela anda outra vez e a
  // montagem fica quieta, que é o que quem escolheu o sítio está à espera de ver. A primeira
  // versão disto devolvia `seguindo: true` aqui, e tocar na régua longe do ecrã punha a música a
  // deslizar por baixo de uma linha presa.
  if (centrada === rolagemAtual) return { rolagem: null, seguindo: !saltou };

  return { rolagem: centrada, seguindo: !saltou };
};

/** A folga entre a barra do clipe e a borda de que ela se aproxima. */
export const FOLGA_DA_BARRA = 6;

/**
 * ONDE A BARRA DE AÇÕES DO CLIPE FICA, em pixels a contar do princípio DELE.
 *
 * ⚠️ AO PÉ DA AGULHA, e não na ponta do clipe. Na ponta ela funcionava enquanto os clipes
 * coubessem no ecrã; num clipe de dois minutos aproximado — que é onde se corta de verdade — a
 * ponta esquerda está a milhares de pixels de distância, e as ações ficavam inalcançáveis sem
 * rolar para trás à procura delas. Ao pé da linha vermelha ela está sempre à vista, porque é a
 * linha que a vista persegue; e é o sítio com sentido, porque a tesoura corta NA AGULHA.
 *
 * ⚠️ MAS A AGULHA NÃO CHEGA: É PRECISO SABER O QUE SE VÊ. Encostada à direita da agulha, a barra
 * saía pela borda do ecrã sempre que a agulha se aproximava dela — e isso acontece em cada volta
 * da reprodução, antes de a linha travar no meio. Encostada à esquerda, saía pela outra. Num
 * telemóvel as duas metades mal dão para a barra, por isso não há lado seguro: o que decide é a
 * JANELA, e é por isso que ela entra aqui.
 *
 * A ordem das três travas importa. Primeiro o sítio que se quer (ao pé da agulha); depois o que
 * se vê (nunca fora da janela); e por fim o clipe (nunca fora dele), porque uma barra a boiar
 * por cima dos vizinhos mente sobre a quem pertence. Num clipe mais estreito do que a barra, ou
 * fora da janela, a última trava ganha e ela fica no princípio dele — o menos mau dos dois.
 *
 * Tudo em pixels do conteúdo, que é a única régua que os dois lados partilham.
 */
export const lugarDaBarra = (medidas: {
  /** Onde a agulha está, no conteúdo. */
  agulha: number;
  /** Onde o clipe começa, no conteúdo. */
  inicioDoClipe: number;
  larguraDoClipe: number;
  larguraDaBarra: number;
  /** O que se vê, no conteúdo: do princípio ao fim da área das ondas. */
  janelaDe: number;
  janelaAte: number;
}): number => {
  const {
    agulha, inicioDoClipe, larguraDoClipe, larguraDaBarra, janelaDe, janelaAte,
  } = medidas;

  const queria = agulha + 8;
  const naJanela = Math.max(
    janelaDe + FOLGA_DA_BARRA,
    Math.min(queria, janelaAte - larguraDaBarra - FOLGA_DA_BARRA),
  );
  const noClipe = Math.max(
    inicioDoClipe + FOLGA_DA_BARRA,
    Math.min(naJanela, inicioDoClipe + larguraDoClipe - larguraDaBarra - FOLGA_DA_BARRA),
  );
  return noClipe - inicioDoClipe;
};

/**
 * O encaixe de quem NÃO tem andamento escrito, em segundos.
 *
 * ⚠️ VEIO DOS TOKENS DA WEB QUANDO A GRADE MUDOU-SE PARA O NÚCLEO. Ele é o passo do arrasto, e o
 * arrasto agora existe nas duas superfícies: deixá-lo do lado da web obrigaria o app a importar
 * de `src/`, que ele não alcança, ou a ter a sua própria cópia — e duas cópias de um encaixe
 * divergem sem ninguém notar, porque o sintoma é um clipe meio segundo fora do sítio.
 */
export const ENCAIXE_SEM_ANDAMENTO = 0.25;

/** Quatro tempos por compasso. Outras fórmulas ficam para o dia em que houver onde as dizer. */
export const TEMPOS_POR_COMPASSO = 4;

/**
 * Os limites do que se aceita como andamento.
 *
 * Fora disto o número não é um andamento, é um engano de digitação — e um "1200" faria a régua
 * desenhar dezenas de milhares de linhas antes de alguém apagar o zero a mais.
 */
export const BPM_MINIMO = 20;
export const BPM_MAXIMO = 400;

/** Os saltos possíveis da régua, em compassos. Musicais: dobram, e não crescem de dez em dez. */
const PASSOS_EM_COMPASSOS = [1, 2, 4, 8, 16, 32, 64, 128];

/** O menor espaço entre dois números da régua, para não se escreverem uns por cima dos outros. */
const ESPACO_DO_ROTULO = 64;
/** Abaixo disto, as linhas dos tempos deixam de ser linhas e viram uma mancha cinzenta. */
const ESPACO_DO_TEMPO = 14;
/** O encaixe mais fino que ainda se acerta com a mão: abaixo disto ele encaixa no que não se vê. */
const ESPACO_DO_ENCAIXE = 22;

export interface Grade {
  segundosPorTempo: number;
  segundosPorCompasso: number;
  /** De quantos em quantos compassos a régua escreve um número. */
  passoEmCompassos: number;
  /** Há espaço para as linhas dos tempos dentro do compasso? */
  mostrarTempos: boolean;
}

/**
 * A grelha para um andamento, ou `null` quando não há andamento nenhum em que assentar.
 *
 * `bpm` chega como veio do campo de texto — string, vazio, lixo. Tudo o que não for um número
 * dentro dos limites devolve `null`, e a linha do tempo fica como estava.
 */
export const gradeDoCompasso = (bpm: unknown, escala: number): Grade | null => {
  // Vazio, nulo e ausente caem todos no mesmo teste dos limites: `Number('')` e `Number(null)`
  // dão zero, `Number(undefined)` dá NaN, e nenhum deles é um andamento.
  const valor = typeof bpm === 'string' ? Number(bpm.trim()) : Number(bpm);
  if (!(escala > 0)) return null;
  if (!Number.isFinite(valor) || valor < BPM_MINIMO || valor > BPM_MAXIMO) return null;

  const segundosPorTempo = 60 / valor;
  const segundosPorCompasso = segundosPorTempo * TEMPOS_POR_COMPASSO;
  const porCompasso = segundosPorCompasso * escala;

  return {
    segundosPorTempo,
    segundosPorCompasso,
    // O último salto é o teto: num projeto muito afastado, é melhor a régua ficar rala do que
    // escrever números colados.
    passoEmCompassos: PASSOS_EM_COMPASSOS.find((p) => p * porCompasso >= ESPACO_DO_ROTULO)
      ?? PASSOS_EM_COMPASSOS[PASSOS_EM_COMPASSOS.length - 1],
    mostrarTempos: segundosPorTempo * escala >= ESPACO_DO_TEMPO,
  };
};

/**
 * De quanto em quanto tempo um clipe encaixa ao ser largado.
 *
 * ⚠️ O ENCAIXE SEGUE O ZOOM, e não só o andamento. Aproximado, encaixa na semicolcheia, que é
 * onde a mão consegue mesmo mirar; afastado, encaixa no compasso — porque a essa escala meia
 * batida são dois pixels, e um encaixe que ninguém vê é indistinguível de encaixe nenhum.
 *
 * Sem grelha, fica o quarto de segundo de sempre.
 */
export const encaixeDaGrade = (grade: Grade | null, escala: number): number => {
  if (!grade || !(escala > 0)) return ENCAIXE_SEM_ANDAMENTO;
  const candidatos = [
    grade.segundosPorTempo / 4,
    grade.segundosPorTempo / 2,
    grade.segundosPorTempo,
    grade.segundosPorCompasso,
  ];
  return candidatos.find((s) => s * escala >= ESPACO_DO_ENCAIXE) ?? grade.segundosPorCompasso;
};

export interface Marca {
  /** Onde ela cai, em segundos. */
  segundo: number;
  /** Compasso (ou segundo redondo): linha mais viva, e é nela que o número assenta. */
  forte: boolean;
  /** O que a régua escreve ali. As linhas fracas não escrevem nada. */
  rotulo?: string;
}

/** O teto de marcas desenhadas. Uma rede de segurança: nenhum ecrã lê mais do que isto. */
const MAXIMO_DE_MARCAS = 900;

/**
 * As marcas da régua e da grelha, de uma vez só.
 *
 * As duas saem da mesma lista de propósito: enquanto a régua contava de dez em dez segundos e
 * as linhas das pistas contavam por conta própria, bastava mudar uma para o número deixar de
 * assentar na linha que ele nomeia.
 *
 * Com grelha, o número é o do COMPASSO e começa em 1 — é assim que se conta música, e é como
 * qualquer editor o mostra. Sem grelha, volta a ser o segundo.
 */
export const marcasDaRegua = (
  grade: Grade | null,
  duracao: number,
  escala: number,
  passoEmSegundos: number,
): Marca[] => {
  const marcas: Marca[] = [];
  if (!(duracao > 0)) return marcas;

  if (!grade) {
    for (let s = 0; s <= duracao && marcas.length < MAXIMO_DE_MARCAS; s += passoEmSegundos) {
      marcas.push({ segundo: s, forte: true, rotulo: `${Math.round(s)}s` });
    }
    return marcas;
  }

  const { segundosPorCompasso, segundosPorTempo, passoEmCompassos, mostrarTempos } = grade;
  // ⚠️ O COMPASSO SEM NÚMERO SÓ DESENHA SE COUBER. Afastado, o salto entre números é de 16 ou
  // 32 compassos, e riscar na mesma todos os outros encheria a tela de linhas que ninguém
  // consegue contar. Perto, elas são justamente o que se conta.
  const barraVisivel = segundosPorCompasso * escala >= ESPACO_DO_TEMPO;

  for (let c = 0; c * segundosPorCompasso <= duracao; c += 1) {
    if (marcas.length >= MAXIMO_DE_MARCAS) break;
    const inicio = c * segundosPorCompasso;
    const nomeado = c % passoEmCompassos === 0;
    if (nomeado || barraVisivel) {
      marcas.push({ segundo: inicio, forte: true, rotulo: nomeado ? `${c + 1}` : undefined });
    }

    if (!mostrarTempos) continue;
    for (let t = 1; t < TEMPOS_POR_COMPASSO; t += 1) {
      const segundo = inicio + t * segundosPorTempo;
      if (segundo > duracao || marcas.length >= MAXIMO_DE_MARCAS) break;
      marcas.push({ segundo, forte: false });
    }
  }
  return marcas;
};
