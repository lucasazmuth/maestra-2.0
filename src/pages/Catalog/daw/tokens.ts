// A folha do EDITOR — copiada do projeto de referência que o dono do produto deixou
// (`Digital Audio WAVE`, `src/styles/tokens.ts` e `ProjectHomePageDAW.tsx`).
//
// ⚠️ ESTA TELA NÃO USA O DESIGN SYSTEM DO RESTO DO APP, e é de propósito. O Maestra é claro,
// azul e arredondado; um editor de música é escuro, denso e de contraste alto — é o que Ableton,
// Logic e Pro Tools são, e é o que o olho de quem trabalha com áudio espera. Misturar os dois
// daria uma tela que não é nem uma coisa nem outra.
//
// Os valores são os da referência, à vírgula. Onde há divergência de nome, o comentário diz de
// onde veio.

export const DS = {
  font: {
    display: "'Onest', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    mono: "'Geist Mono', 'JetBrains Mono', 'SF Mono', monospace",
  },
  color: {
    // Camadas de fundo, do mais escuro ao mais claro.
    bgBase: '#0E0E0E',
    bgSurface: '#141414',
    bgRaised: '#1A1A1A',
    bgCard: '#28201B',
    bgHover: '#302822',

    borderSubtle: '#1A1A1A',
    borderDefault: '#2A2A2A',
    borderStrong: '#3D342D',

    textPrimary: '#E8E8F0',
    textSecondary: '#A0A0B8',
    textTertiary: '#6B6B80',
    textDisabled: '#3A3A4A',

    /** Laranja: a ação principal, a agulha, o corte. */
    primary: '#E95216',
    secondary: '#AEE916',
    success: '#33EB28',
    warning: '#FFD727',
    error: '#FF272A',
    info: '#14B4FF',

    /** A grelha da linha do tempo: a linha de cada segundo, e a mais forte de cinco em cinco. */
    gridMajor: '#2E2E3E',
    gridMinor: '#1A1A26',
    /** As faixas alternam de fundo, para o olho não perder a linha em seis pistas. */
    rowAlt1: '#0E0E0E',
    rowAlt2: '#0D0D14',
  },
  radius: { sm: 6, md: 8, lg: 10, xl: 14, full: 9999 },
  transition: { fast: 'all 0.1s ease', base: 'all 0.2s ease' },
} as const;

/** As cores das pistas, na ordem em que são distribuídas. São as da referência. */
export const CORES_DAS_PISTAS = [
  '#E95216', // laranja
  '#AEE916', // lima
  '#33EB28', // verde
  '#14B4FF', // azul
  '#FFD727', // amarelo
  '#FF272A', // vermelho
] as const;

export const corDaPista = (indice: number): string =>
  CORES_DAS_PISTAS[((indice % CORES_DAS_PISTAS.length) + CORES_DAS_PISTAS.length) % CORES_DAS_PISTAS.length];

// ─── Dimensões ───────────────────────────────────────────────────────────────
//
// São as da referência. O `PIXELS_POR_SEGUNDO` é o único que a tela mexe (o zoom), e por isso
// entra como estado em vez de constante.

/** O zoom de partida: 80 pixels por segundo. */
export const ZOOM_PADRAO = 80;
export const ZOOM_MINIMO = 12;
export const ZOOM_MAXIMO = 240;

export const ALTURA_DA_PISTA = 88;
export const ALTURA_DA_REGUA = 32;
export const LARGURA_DA_LATERAL = 220;
export const ALTURA_DO_TOPO = 116;

/** O comprimento mínimo da linha do tempo, em segundos. Cresce com a montagem. */
export const DURACAO_MINIMA = 120;

/** O passo do encaixe ao arrastar um clipe. Um quarto de segundo, como na referência. */
export const ENCAIXE = 0.25;
