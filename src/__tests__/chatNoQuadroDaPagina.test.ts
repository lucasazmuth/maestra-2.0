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

// A SETA DE VOLTAR DA LISTA DE CONVERSAS, e por que ela só existe no mobile.
//
// Ela nasceu como a saída da gaveta: abaixo de 900px a lista cobre o chat inteiro, e sem a seta
// a pessoa fica presa nela. Fixa ao lado, com o chat dentro do quadro da página, a barra da
// Maestra e o rail já levam de volta — e uma terceira porta para o mesmo lugar só faz procurar
// em três. No lugar dela entra a foto do perfil, que diz o que a seta não dizia: de quem é a
// conversa.
describe('a seta de voltar da lista de conversas', () => {
  const scss = fs.readFileSync(
    path.join(raiz, 'pages', 'NytaChat', 'components', 'ConversationSidebar.scss'), 'utf8',
  );

  /** O corpo do bloco `@media (min-width: 901px)`, achado por contagem de chaves. */
  const blocoDoDesktop = (() => {
    const inicio = scss.indexOf('@media (min-width: 901px)');
    if (inicio < 0) return '';
    const abre = scss.indexOf('{', inicio);
    let nivel = 0;
    for (let i = abre; i < scss.length; i += 1) {
      if (scss[i] === '{') nivel += 1;
      else if (scss[i] === '}') {
        nivel -= 1;
        if (nivel === 0) return scss.slice(abre + 1, i);
      }
    }
    return '';
  })();

  it('o bloco do desktop foi localizado', () => {
    expect(blocoDoDesktop).toContain('nyta-conversations');
  });

  it('some no desktop, e a foto do perfil toma o lugar', () => {
    expect(blocoDoDesktop).toMatch(/\.nyta-conversations__back\s*\{[^}]*display:\s*none/);
    expect(blocoDoDesktop).toMatch(/\.nyta-conversations__perfil\s*\{[^}]*display:\s*block/);
  });

  // A foto nasce escondida: quem a acende é a media query. Sem isto ela apareceria TAMBÉM no
  // mobile, ao lado da seta, e o cabeçalho da gaveta ficaria com dois círculos.
  it('a foto nasce escondida', () => {
    expect(scss).toMatch(/&__perfil\s*\{[^}]*display:\s*none/);
  });

  // As duas quebras precisam continuar opostas. A gaveta é `max-width: 900px` e a troca é
  // `min-width: 901px`: mexer numa sem a outra deixa uma faixa de largura com a lista em gaveta
  // e sem saída, ou com a seta e a foto ao mesmo tempo.
  it('a quebra é a mesma em que a lista deixa de ser gaveta', () => {
    expect(scss).toContain('@media (max-width: 900px)');
    expect(scss).toContain('@media (min-width: 901px)');
  });

  it('o cabeçalho da lista desenha os dois, e deixa a largura escolher', () => {
    const componente = fs.readFileSync(
      path.join(raiz, 'pages', 'NytaChat', 'components', 'ConversationSidebar.tsx'), 'utf8',
    );

    // Pela CLASSE, e não pelo `className` inteiro: os botões carregam o `round-control` do
    // sistema junto (ver `cabecalhosDoChat.test.ts`), e prender a string completa aqui fazia
    // este teste reprovar por uma mudança que não é a dele.
    expect(componente).toMatch(/className='[^']*nyta-conversations__back'/);
    expect(componente).toMatch(/className='[^']*nyta-conversations__perfil'/);
  });
});
