import fs from 'fs';
import path from 'path';

// Mesmo molde dos outros testes de cromo: as cores do wizard nativo têm de ser as da folha.
//
// Aqui o alvo é diferente dos outros: a web declara TUDO como token `--wz-*` no topo de
// `styles.scss`, então a comparação é token a token, e não "existe em algum lugar da folha".
// Um token que mude de valor na web e não aqui é uma tela que muda só de um lado.

const folha = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'Wizard', 'styles.scss'), 'utf8',
);
const app = fs.readFileSync(
  path.join(__dirname, '..', '..', 'apps', 'mobile', 'src', 'casca', 'wizard', 'cores.ts'), 'utf8',
);

/** O valor de um token `--wz-*` / `--wiz-*` na folha. */
const token = (nome: string): string => {
  const achado = folha.match(new RegExp(`--${nome}:\\s*([^;]+);`));
  if (!achado) throw new Error(`a folha não declara --${nome}`);
  return achado[1].trim();
};

const PARES: [string, string][] = [
  ['wz-blue', 'blue'],
  ['wz-blue-ink', 'blueInk'],
  ['wz-blue-soft', 'blueSoft'],
  ['wz-blue-tint', 'blueTint'],
  ['wz-ink', 'ink'],
  ['wz-text', 'text'],
  ['wz-muted', 'muted'],
  ['wz-faint', 'faint'],
  ['wz-quiet', 'quiet'],
  ['wz-quiet-strong', 'quietStrong'],
  ['wz-marker', 'marker'],
  ['wz-line', 'line'],
  ['wz-line-2', 'line2'],
  ['wz-surface', 'surface'],
  ['wz-surface-2', 'surface2'],
  ['wz-canvas', 'canvas'],
  ['wz-danger', 'danger'],
  ['wz-warn', 'warn'],
  ['wz-ok', 'ok'],
];

describe('cromo do wizard', () => {
  it.each(PARES)('--%s é o mesmo do app (%s)', (nomeDoToken, chave) => {
    // A folha escreve o valor com comentário na mesma linha em alguns casos.
    const valor = token(nomeDoToken).replace(/\s*\/\/.*$/, '').trim();
    const noApp = app.match(new RegExp(`\\b${chave}: ('[^']+'|COR\\.\\w+)`));
    expect(noApp).not.toBeNull();
    const escrito = noApp![1];
    // `blue` é o azul de ação do app inteiro: lá ele vem do `COR.primaria`, e não de um literal.
    if (escrito.startsWith('COR.')) {
      const design = fs.readFileSync(
        path.join(__dirname, '..', '..', 'packages', 'core', 'src', 'constants', 'design.ts'), 'utf8',
      );
      const campo = escrito.slice(4);
      const daPaleta = design.match(new RegExp(`${campo}: '([^']+)'`));
      expect(daPaleta![1].toLowerCase()).toEqual(valor.toLowerCase());
      return;
    }
    expect(escrito.slice(1, -1).toLowerCase()).toEqual(valor.toLowerCase());
  });

  it('o recuo e o avatar do celular são os da folha', () => {
    expect(token('wiz-gutter-m')).toBe('14px');
    expect(token('wiz-avatar')).toBe('26px');
    expect(app).toContain('recuo: 14');
    expect(app).toContain('avatar: 26');
  });
});
