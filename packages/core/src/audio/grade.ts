
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
