// A folha do EDITOR.
//
// Os valores saem da referência que o dono do produto mandou — o print do editor com as três
// colunas, o acento azul, o Master no topo e as abas Timeline/Mixer.
//
// ⚠️ ESTA TELA NÃO USA O DESIGN SYSTEM DO RESTO DO APP, e é de propósito. O Maestra é claro,
// azul-marca e arredondado; um editor de música é escuro, denso e de contraste alto — é o que
// Ableton, Logic e Pro Tools são, e é o que o olho de quem trabalha com áudio espera. Misturar
// os dois daria uma tela que não é nem uma coisa nem outra.

export const DS = {
  font: {
    display: "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif",
    mono: "'SF Mono', 'JetBrains Mono', 'Geist Mono', monospace",
  },
  color: {
    /** As camadas, do fundo para a frente. */
    bgBase: '#1a1a1e',
    bgPainel: '#212127',
    bgPista: '#2a2a32',
    bgFundoDaLinha: '#1c1c21',
    bgCampo: '#2f2f38',
    bgHover: '#383842',

    borda: '#33333d',
    bordaForte: '#44444f',

    texto: '#e8e8ee',
    textoApoio: '#a6a6b3',
    textoFraco: '#71717f',
    textoInerte: '#4a4a56',

    /** O azul é a ação: o play, os controlos deslizantes, o botão de enviar. */
    primaria: '#3b82f6',
    primariaEscura: '#2563eb',
    /** A agulha e o botão de gravar. */
    agulha: '#ef4444',
    gravar: '#ef4444',

    /** A grelha: a linha de cada segundo, e a mais forte de dois em dois. */
    grelhaForte: '#32323c',
    grelhaFraca: '#26262e',
  },
  raio: { pequeno: 4, medio: 6, grande: 8, pilula: 9999 },
} as const;

/**
 * As cores das pistas.
 *
 * Cada faixa recebe a sua, e é o que dá identidade a um clipe visto de longe. Dão a volta
 * quando as pistas passam de seis.
 */
export const CORES_DAS_PISTAS = [
  '#3b82f6', // azul
  '#a855f7', // roxo
  '#22c55e', // verde
  '#f59e0b', // âmbar
  '#ec4899', // rosa
  '#14b8a6', // turquesa
] as const;

export const corDaPista = (indice: number): string =>
  CORES_DAS_PISTAS[((indice % CORES_DAS_PISTAS.length) + CORES_DAS_PISTAS.length) % CORES_DAS_PISTAS.length];

// ─── Dimensões ───────────────────────────────────────────────────────────────

// ⚠️ AS MEDIDAS DA ESCALA MUDARAM-SE PARA O NÚCLEO quando a linha do tempo passou a existir no
// app também. Elas não são estilo: são a conversão entre segundo e pixel, e é dela que saem a
// régua, o encaixe e o encaixe automático ao abrir. Aqui ficam os nomes pelos quais esta tela
// sempre as chamou.
export {
  PIXELS_POR_SEGUNDO, ZOOM_MAXIMO, ZOOM_MINIMO, ZOOM_MINIMO_ABSOLUTO,
} from '@maestra/core/audio/grade';

export const ALTURA_DA_PISTA = 160;
export const ALTURA_DA_REGUA = 30;
export const LARGURA_DAS_FERRAMENTAS = 256;
export const LARGURA_DAS_PISTAS = 256;
export const ALTURA_DO_TITULO = 68;
export const ALTURA_DO_TRANSPORTE = 62;
/** O rodapé: onde ficam os controlos que valem para a montagem inteira. */
export const ALTURA_DO_RODAPE = 44;

/** O comprimento mínimo da linha do tempo, em segundos. Cresce com a montagem. */
export const DURACAO_MINIMA = 30;

/** O passo do encaixe ao arrastar um clipe. */
// ⚠️ O DONO DO VALOR É O NÚCLEO desde que a grade se mudou para lá: o arrasto existe nas duas
// superfícies, e duas cópias de um encaixe divergem sem ninguém notar — o sintoma é um clipe
// meio segundo fora do sítio. Aqui fica só o nome pelo qual esta tela sempre o chamou.
export { ENCAIXE_SEM_ANDAMENTO as ENCAIXE } from '@maestra/core/audio/grade';
