import fs from 'fs';
import path from 'path';

// O CHAT EM TELA CHEIA É REGRA DE MOBILE, e isso mora inteiro no CSS.
//
// No telefone as barras roubam a altura justamente do que importa numa conversa, e a tela é
// estreita demais para carregar moldura: ali o chat toma tudo. Numa janela de 1400px o mesmo
// tratamento fazia a conversa virar uma ilha sem endereço — sem dizer em que perfil se estava,
// sem caminho de volta que não fosse a setinha da própria faixa, e sem nada em volta lembrando
// que aquilo ainda era o Maestra.
//
// Nada disso aparece num teste de renderização: o jsdom não tem largura de verdade e aplica
// media query nenhuma. Sem este arquivo, tirar o `@media` de volta deixa a suíte inteira verde e
// devolve o desktop ao estado que o usuário reprovou.

const raiz = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(raiz, 'styles', 'gsap-reference.css'), 'utf8');

const QUEBRA = '@media (max-width: 700px)';

/**
 * Para cada REGRA cujo seletor menciona `alvo`, a media query que a envolve (ou null quando a
 * regra está solta, valendo em qualquer largura).
 *
 * Percorre o arquivo contando chaves em vez de usar expressão regular: as media queries daqui
 * chegam minificadas, com dezenas de regras numa linha só, e qualquer recorte por texto pegaria
 * o bloco errado. Comentários saem antes — a palavra aparece neles, e comentário não é regra.
 */
const mediasDasRegrasCom = (alvo: string): (string | null)[] => {
  const fonte = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const achados: (string | null)[] = [];
  const pilha: (string | null)[] = [];
  let prelúdio = '';

  for (const c of fonte) {
    if (c === '{') {
      const seletor = prelúdio.trim().replace(/\s+/g, ' ');
      if (!seletor.startsWith('@') && seletor.includes(alvo)) {
        achados.push([...pilha].reverse().find((m) => m !== null) ?? null);
      }
      pilha.push(seletor.startsWith('@media') ? seletor : null);
      prelúdio = '';
    } else if (c === '}') {
      pilha.pop();
      prelúdio = '';
    } else {
      prelúdio += c;
    }
  }
  return achados;
};

describe('o chat em tela cheia', () => {
  it('o varredor acha as regras do modo imersivo', () => {
    // Guarda do próprio teste: se o seletor for renomeado, os `every` abaixo passariam a
    // percorrer uma lista vazia e este arquivo viraria decoração.
    expect(mediasDasRegrasCom('app-layout-imersivo').length).toBeGreaterThanOrEqual(4);
  });

  it('só vale até 700px, a mesma quebra do rail e da tab bar', () => {
    const medias = mediasDasRegrasCom('app-layout-imersivo');

    expect(medias.every((m) => m === QUEBRA)).toBe(true);
  });

  // A regra é boa justamente por NÃO valer em qualquer largura: uma regra solta venceria no
  // desktop e devolveria a tela cheia.
  it('nenhuma regra do modo imersivo fica solta', () => {
    expect(mediasDasRegrasCom('app-layout-imersivo')).not.toContain(null);
  });

  // Quem esconde a barra da Maestra é o CSS, dentro da mesma quebra. Antes quem decidia era o
  // JSX (`!imersivo && topNavigation()`), e aí a barra sumia no desktop também — que é o
  // defeito que este arquivo existe para não deixar voltar.
  it('a barra da Maestra sai de cena pelo CSS, e só no mobile', () => {
    const medias = mediasDasRegrasCom(':has(.app-layout-imersivo) .top-navigation');

    expect(medias).toEqual([QUEBRA]);
  });

  it('o Layout desenha a barra da Maestra sem perguntar pela rota', () => {
    const layout = fs.readFileSync(path.join(raiz, 'components', 'Layout', 'index.tsx'), 'utf8');

    expect(layout).toContain('{topNavigation()}');
    expect(layout).not.toContain('!imersivo && topNavigation()');
  });

  // O outro lado: a rota continua marcada em toda largura. Se o Layout parasse de pôr a classe,
  // as regras acima existiriam sem nada para casar e o mobile perderia a tela cheia.
  it('a rota do chat continua marcada, em qualquer largura', () => {
    const layout = fs.readFileSync(path.join(raiz, 'components', 'Layout', 'index.tsx'), 'utf8');

    expect(layout).toContain("imersivo ? ' app-layout-imersivo' : ''");
  });
});
