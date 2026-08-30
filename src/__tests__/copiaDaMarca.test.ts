import fs from 'fs';
import path from 'path';

// A marca e as animações do selo do plano são as MESMAS nas duas superfícies.
//
// Eu vinha desenhando o símbolo e escrevendo "Maestra" num `<Text>` no app: a palavra saía na
// fonte do app, e não no lettering da marca. De perto é outra logo — e é o tipo de diferença que
// ninguém reporta como bug, só sente.
//
// O selo tem DUAS animações Lottie (o diamante em loop e o brilho de entrada) e o app o
// mostrava parado. Os JSONs precisam ser cópia exata: o `paintDiamond` caminha na árvore
// procurando nós por forma (`ty === 'gf'`, `ty === 'fl'`), e um arquivo diferente pintaria
// nada — sem erro nenhum, só um diamante cinza.

const raiz = path.join(__dirname, '..', '..');
const daWeb = (...p: string[]) => fs.readFileSync(path.join(raiz, 'src', 'assets', ...p));
const doApp = (...p: string[]) => fs.readFileSync(path.join(raiz, 'apps', 'mobile', 'assets', ...p));

describe('a marca e o selo do plano são os mesmos nos dois', () => {
  it.each([
    ['o símbolo', ['brand', 'maestra-symbol.svg']],
    ['o lettering', ['brand', 'maestra-wordmark.svg']],
  ])('%s é cópia idêntica', (_nome, arquivo) => {
    expect(doApp(...(arquivo as string[]))).toEqual(daWeb(...(arquivo as string[])));
  });

  it.each([
    ['o diamante', 'gradient-diamond.json'],
    ['o brilho', 'badge-shine.json'],
  ])('%s do selo é cópia idêntica', (_nome, arquivo) => {
    expect(doApp('lottie', arquivo)).toEqual(daWeb(arquivo));
  });

  // O lettering tem proporção fixa: esticá-lo deforma a marca. A web guarda isso no
  // `aspect-ratio: 620 / 121`, e o app calcula a largura a partir da altura com os mesmos
  // números — se um dos dois mudar, a marca fica mais gorda ou mais magra só num lugar.
  it('a proporção do lettering é a mesma nos dois', () => {
    const scss = fs.readFileSync(
      path.join(raiz, 'src', 'components', 'MaestraBrand', 'MaestraBrand.module.scss'), 'utf8',
    );
    expect(scss).toContain('aspect-ratio: 620 / 121');
    expect(scss).toContain('.lockup .wordmarkGraphic { height: 0.68em; }');

    const icones = fs.readFileSync(
      path.join(raiz, 'apps', 'mobile', 'src', 'icones', 'index.tsx'), 'utf8',
    );
    expect(icones).toContain('620 / 121');
    expect(icones).toContain('size * 0.68');
  });
});
