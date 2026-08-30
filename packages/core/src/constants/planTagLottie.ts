// A pintura dos dois Lotties do selo do plano — o diamante e o brilho.
//
// Subiu de `src/components/PlanTag` para o núcleo quando o app nativo ganhou o selo animado: as
// cores TÊM que ser injetadas no JSON (o Lottie não herda `currentColor`), e duas cópias da
// tabela de tons dariam um diamante azul na web e outro de outro azul no celular.

export type ToneStops = [string, string, string];

export type PlanTone = 'pro' | 'pending' | 'free';

/** As três paletas do selo: pro no azul primário, pendente no âmbar de aviso, free apagado. */
export const TONE_STOPS: Record<PlanTone, ToneStops> = {
  pro: ['#5b8cff', '#3361ff', '#2a54e0'],
  pending: ['#f0b429', '#dd9a12', '#f0b429'],
  free: ['#c3d0e4', '#aebfda', '#c3d0e4'],
};

/** A cor do brilho que atravessa a pílula, por tom. */
export const SHINE_HEX: Record<PlanTone, string> = {
  pro: '#5b8cff', pending: '#f0b429', free: '#c3d0e4',
};

const hexToUnit = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
};

// deno-lint-ignore no-explicit-any
type LottieAny = Record<string, any>;

// O brilho da tag tinha as barras brancas com mix-blend-mode: overlay — funciona sobre uma cor
// saturada, mas nas pílulas do selo (fundo quase branco, ~8-16% de opacidade) branco sobre branco
// não aparece. A correção troca o branco pela própria cor do tom (mais clara que o fundo da
// pílula) e sobe a opacidade da camada, em blend normal — assim o brilho é visível nos três
// estados sem depender do quanto o fundo por baixo já é claro ou escuro.
export const paintShine = (data: LottieAny, hex: string, opacity = 60): LottieAny => {
  const [r, g, b] = hexToUnit(hex);
  const patched = JSON.parse(JSON.stringify(data)) as LottieAny;

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as LottieAny;
    if (n.ty === 'fl' && n.c?.k?.length === 4) n.c.k = [r, g, b, 1];
    if (n.ty === 4 && n.nm?.startsWith('Shape Layer') && n.ks?.o?.a === 0) n.ks.o.k = opacity;
    Object.values(n).forEach(walk);
  };
  walk(patched);
  return patched;
};

// deno-lint-ignore no-explicit-any
type LottieNode = Record<string, any>;

// O diamante original tem cinco gradientes (as quatro lascas de brilho + o corpo da pedra), todos
// com a MESMA sequência rosa→roxo→azul, gravada como offsets+RGB dentro do JSON — não dá pra
// herdar var(--...) num gradiente de shape do Lottie, então a cor entra recompondo o array. Os tons
// dos três offsets (0 / 0.484 / 1) ficam intactos, só o RGB de cada um muda pela paleta do estado.
export const paintDiamond = (data: LottieNode, stops: ToneStops): LottieNode => {
  const [c0, c1, c2] = stops.map(hexToUnit);
  const patched = JSON.parse(JSON.stringify(data)) as LottieNode;

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as LottieNode;
    if (n.ty === 'gf' && n.g?.k?.k?.length === 12) {
      const k = n.g.k.k as number[];
      n.g.k.k = [k[0], ...c0, k[4], ...c1, k[8], ...c2];
    }
    Object.values(n).forEach(walk);
  };
  walk(patched);
  return patched;
};
