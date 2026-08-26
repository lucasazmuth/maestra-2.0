import fs from 'fs';
import path from 'path';

// A escada de z-index do app.
//
// Ela existia na prática antes de existir por escrito: dois overlays independentes escolheram
// 3000, e o confete escolheu 4000 para ficar acima. O que faltava era declarar — sem a escada
// escrita, quem precisa aparecer por cima de algo escolhe um número maior no chute, e é assim que
// se chega a um z-index de 2.147.483.000 (que existe neste repositório, no Espaço JAM).
//
// Este teste guarda duas coisas: que os degraus continuam em ordem, e que ninguém voltou a
// escrever número solto onde já existe token.

const raiz = path.join(__dirname, '..', '..');
const ler = (p: string) => fs.readFileSync(path.join(raiz, p), 'utf8');

const ESCADA = [
  'cartao',
  'portao',
  'tela-cheia',
  'coluna',
  'painel',
  'rail',
  'topo',
  'overlay',
  'confete',
  'carregando',
] as const;

const valores = (): Record<string, number> => {
  const css = ler('styles/gsap-reference.css');
  const out: Record<string, number> = {};
  for (const nome of ESCADA) {
    const m = new RegExp(`--z-${nome}:\\s*(\\d+)`).exec(css);
    expect(m).not.toBeNull();
    out[nome] = Number(m![1]);
  }
  return out;
};

describe('escada de camadas', () => {
  it('declara todos os degraus', () => {
    expect(Object.keys(valores())).toHaveLength(ESCADA.length);
  });

  // Se dois degraus empatarem ou trocarem de ordem, a escada para de significar alguma coisa e
  // volta a ser chute — que é exatamente o que ela existe para evitar.
  it('os degraus sobem, sem empate', () => {
    const v = valores();
    const ordenados = ESCADA.map((n) => v[n]);
    for (let i = 1; i < ordenados.length; i += 1) {
      expect(ordenados[i]).toBeGreaterThan(ordenados[i - 1]);
    }
  });

  // 1000 é onde o antd põe os modais dele. Overlay nosso abaixo disso apareceria por baixo de um
  // Modal do antd, que é justamente o oposto do que "overlay de tela cheia" promete.
  it('o overlay passa dos modais do antd', () => {
    expect(valores().overlay).toBeGreaterThan(1000);
  });

  // O confete comemora o que aconteceu NO overlay: por baixo dele, ninguém vê.
  it('o confete fica acima do overlay', () => {
    const v = valores();
    expect(v.confete).toBeGreaterThan(v.overlay);
  });

  it('os arquivos da escada usam o token, não o número', () => {
    const alvos: [string, string][] = [
      ['pages/Wizard/chat/widgets.tsx', 'var(--z-overlay)'],
      ['pages/ActionPlan/index.tsx', 'var(--z-overlay)'],
      ['components/SuccessConfetti.tsx', 'var(--z-confete)'],
      ['components/spinner/spinner.scss', 'var(--z-carregando)'],
      ['pages/Catalog/ProjectSpace.module.scss', 'var(--z-tela-cheia)'],
    ];
    for (const [arquivo, token] of alvos) {
      expect(ler(arquivo)).toContain(token);
    }
  });

  // O Espaço JAM tinha 2147483000 — o teto do int32 — e o número nunca fez nada: os ancestrais
  // `position: fixed` do `jam-space-open` prendiam aquela camada num contexto próprio. Quem faz o
  // JAM cobrir o app é o `display: none` no topo, no rail e no painel.
  //
  // Este teste existe para o dia em que algo aparecer por cima do JAM e a reação for subir o
  // número de novo: não vai funcionar, e a resposta está no comentário daquele arquivo.
  it('o Espaço JAM não voltou a escalar número', () => {
    const jam = ler('pages/Catalog/ProjectSpace.module.scss');
    // `matchAll` espalhado exige um target mais novo que o do projeto; exec em laco resolve.
    const padrao = /z-index:\s*(\d+)/g;
    const numeros: number[] = [];
    for (let m = padrao.exec(jam); m; m = padrao.exec(jam)) numeros.push(Number(m[1]));
    expect(numeros).toEqual([]);
  });

  // O portão do wizard fica em 20 e ainda assim é coberto pelo overlay em 3000 — um é `absolute`
  // dentro da conversa, o outro é `fixed` na raiz. Numero alto nao resolve contexto errado, e o
  // dia em que alguem tentar "consertar" isso subindo o portao, este teste explica por que nao.
  it('o portão do wizard fica abaixo do overlay, de propósito', () => {
    const v = valores();
    expect(v.portao).toBeLessThan(v.overlay);
  });
});
