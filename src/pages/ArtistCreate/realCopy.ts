// Dados e textos compartilhados do diagnóstico REAL (usados na tela e no PDF de apresentação).

export type DimKey = 'r' | 'e' | 'a' | 'l';

// Formata números grandes em PT-BR (ex.: 2465588 → "2,5 mi").
export const fmtNum = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (n >= 1_000) return `${Math.round(n / 1000)} mil`;
  return String(n);
};

// Remove travessões dos textos vindos do banco — leitura mais humana.
export const clean = (s: string) => s.replace(/\s*—\s*/g, ', ');

export const DIM_META: { key: DimKey; letter: string; name: string; full: string; sub: string }[] = [
  { key: 'r', letter: 'R', name: 'Reach · Alcance', full: 'Reach', sub: 'Alcance' },
  { key: 'e', letter: 'E', name: 'Earnings · Receita', full: 'Earnings', sub: 'Receita' },
  { key: 'a', letter: 'A', name: 'Audience · Público real', full: 'Audience', sub: 'Público real' },
  { key: 'l', letter: 'L', name: 'Legitimacy · Legitimação', full: 'Legitimacy', sub: 'Legitimação' },
];

// Frases de interpretação por dimensão (alto/baixo) — doc de conteúdo §3.
export const DIM_PHRASE: Record<DimKey, { high: string; low: string }> = {
  r: {
    high: 'Sua música alcança gente além da sua bolha. O algoritmo e as playlists estão trabalhando por você.',
    low: 'Seu alcance digital ainda está abaixo do típico do mercado. Esse costuma ser o ponto de partida de quem quer crescer.',
  },
  e: {
    high: 'Sua carreira já gera receita acima do típico. A música está pagando as contas, e mais.',
    low: 'Sua carreira ainda não se sustenta financeiramente. Isso é mais comum do que parece, e tem solução estratégica.',
  },
  a: {
    high: 'Você tem público de verdade: gente que aparece, compra ingresso e segue a música. Isso é difícil de construir e vale muito.',
    low: 'Seu público comprometido ainda está em construção. A diferença entre quem te alcança e quem realmente te escolhe ainda é grande.',
  },
  l: {
    high: 'Prêmios e imprensa já validam o seu trabalho. O mercado e a crítica reconhecem o que você faz.',
    low: 'Seu trabalho ainda não foi validado por prêmios ou imprensa de expressão. Esse reconhecimento costuma vir com estratégia, não só com talento.',
  },
};

// Mapa dos 16 perfis por "andar" (nº de dimensões altas), do Icon (4) ao Beginner (0).
export const PROFILE_MAP: { tier: string; names: string[] }[] = [
  { tier: '4 altas', names: ['Icon'] },
  { tier: '3 altas', names: ['Hit', 'Spotlight', 'Underpaid', 'Analog'] },
  { tier: '2 altas', names: ['Digital', 'Potential', 'Hype', 'Rising', 'Outlier', 'Bet'] },
  { tier: '1 alta', names: ['Influencer', 'Moneymaker', 'Paradox', 'Cult'] },
  { tier: '0 altas', names: ['Beginner'] },
];
