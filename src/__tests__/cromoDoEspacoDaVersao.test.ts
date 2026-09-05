import fs from 'fs';
import path from 'path';

import { COR_VERSAO } from '@maestra/core/constants/design';

// O Espaço da versão do app nativo tem que ser o MESMO da web.
//
// É a única tela ESCURA do produto — o cabeçalho continua claro (é a saída), mas o palco e a
// conversa são quase pretos. Errar isso deixaria a tela parecendo de outro app, e é o tipo de
// coisa que só se percebe abrindo as duas lado a lado.
//
// ⚠️ A folha declara a sala DUAS vezes: um bloco claro (`.track-comments { background: #fff }`)
// e, mais adiante, o bloco escuro que vence por vir depois. Conferir contra o primeiro daria
// uma sala branca onde a web é preta. Os valores abaixo saíram do DOM em execução a 375px, que
// é a única fonte que resolve isso.

const css = fs.readFileSync(
  path.join(__dirname, '..', 'styles', 'gsap-reference.css'),
  'utf8',
);
const semEspacos = (valor: string) => valor.replace(/\s+/g, '');
const folha = semEspacos(css);

describe('cromo do Espaço da versão', () => {
  it('os blocos da sala foram localizados', () => {
    expect(css).toContain('.track-detail-backdrop');
    expect(css).toContain('.track-player {');
    expect(css).toContain('.track-comment-list article');
  });

  it.each(Object.entries(COR_VERSAO))('%s (%s) é o valor que a web usa', (_nome, valor) => {
    // `#ffffff` a folha escreve `#fff`, e `#000000` ela não escreve: usa `rgba(0,0,0,…)`.
    if (valor === '#000000') return;
    const naFolha = valor === '#ffffff' ? '#fff' : valor;
    expect(folha).toContain(semEspacos(naFolha));
  });

  // O palco é escuro e a conversa também. Se um dia alguém "clarear a tela", este é o teste que
  // avisa que a web continua escura.
  it('o palco e a conversa são escuros', () => {
    expect(folha).toContain('background:#090c18');
    expect(folha).toContain(semEspacos('.track-comment-form { border-color: rgba(255,255,255,.12); background: #171717; }'));
  });

  // O traço orgânico gira em 7s enquanto toca — parado, ele é só a moldura da capa.
  it('o traço gira em sete segundos, e só quando toca', () => {
    expect(css).toContain('.track-player.is-playing .track-waveform svg');
    expect(css).toContain('track-wave-spin-breathe 7s linear infinite');
  });

  // O alfinete é uma gota: círculo com um canto quadrado, girado. É o que distingue um
  // comentário PRESO a um ponto do áudio de um comentário solto.
  it('o alfinete do comentário marcado é uma gota', () => {
    expect(css).toContain('border-radius: 50% 50% 50% 0');
    expect(folha).toContain(semEspacos('background: #1479ff'));
  });

  // A régua é fina e o percorrido é branco — não azul. O azul da tela é o do botão de enviar.
  it('a régua é branca sobre translúcido', () => {
    expect(css).toContain('linear-gradient(to right, #fff 0 var(--progress), rgba(255,255,255,.22) var(--progress) 100%)');
  });
});
