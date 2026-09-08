import fs from 'fs';
import path from 'path';

// AS DUAS FAIXAS DO TOPO DO CHAT, e por que elas precisam ser a mesma.
//
// No mobile a lista de conversas cobre o chat inteiro: as duas faixas ocupam o MESMO lugar da
// tela, uma atrás da outra, e a pessoa passa de uma para a outra num toque. Enquanto a do chat
// usava o círculo de 51px do sistema e a da lista um par de 30px inventado ali, a troca parecia
// mudar de aplicativo — que foi exatamente o que o usuário viu.
//
// Nada disso se vê num teste de renderização: o jsdom não tem largura e não aplica media query,
// e ambos os cabeçalhos existem na árvore o tempo todo.

const componentes = path.join(__dirname, '..', 'pages', 'NytaChat', 'components');
const ler = (arquivo: string) => fs.readFileSync(path.join(componentes, arquivo), 'utf8');

const chatTsx = ler('ChatHeader.tsx');
const listaTsx = ler('ConversationSidebar.tsx');
const chatScss = ler('ChatHeader.scss');
const listaScss = ler('ConversationSidebar.scss');

/** O corpo de um bloco `seletor { ... }`, por contagem de chaves. */
const corpoDe = (fonte: string, seletor: string): string => {
  const inicio = fonte.indexOf(seletor);
  if (inicio < 0) return '';
  const abre = fonte.indexOf('{', inicio);
  let nivel = 0;
  for (let i = abre; i < fonte.length; i += 1) {
    if (fonte[i] === '{') nivel += 1;
    else if (fonte[i] === '}') {
      nivel -= 1;
      if (nivel === 0) return fonte.slice(abre + 1, i);
    }
  }
  return '';
};

/** O valor de uma propriedade no primeiro nível do bloco (ignora blocos aninhados). */
const propriedade = (corpo: string, nome: string): string | null => {
  const semAninhados = corpo.replace(/\{[^{}]*\}/g, '');
  const achado = new RegExp(`(?:^|;|\\n)\\s*${nome}:\\s*([^;\\n]+)`).exec(semAninhados);
  return achado ? achado[1].trim() : null;
};

/** O tamanho passado a um ícone do react-icons, ex.: `<FiArrowLeft size={21} />`. */
const tamanhoDoIcone = (fonte: string, icone: string): string | null => {
  const achado = new RegExp(`<${icone} size=\\{(\\d+)\\}`).exec(fonte);
  return achado ? achado[1] : null;
};

describe('as duas faixas do topo do chat', () => {
  // A forma vem do `.round-control` de `styles/gsap-reference.css` — o círculo branco que a
  // marca, o sino e o menu do sistema já usam. É ele que impede cada tela de inventar o seu.
  it('as duas usam o círculo do sistema, e não um controle próprio', () => {
    expect(chatTsx).toContain("className='round-control chat-header__icone chat-header__voltar'");
    expect(listaTsx).toContain("className='round-control nyta-conversations__back'");
    expect(listaTsx).toContain("className='round-control nyta-conversations__new'");
  });

  it('a seta de voltar tem o mesmo tamanho nas duas', () => {
    const noChat = tamanhoDoIcone(chatTsx, 'FiArrowLeft');

    expect(noChat).toBe('21');
    expect(tamanhoDoIcone(listaTsx, 'FiArrowLeft')).toBe(noChat);
  });

  // O ícone da direita não é o mesmo desenho (um abre a lista, o outro cria conversa), mas ocupa
  // o mesmo canto e precisa pesar igual.
  it('o ícone da direita tem o mesmo tamanho nas duas', () => {
    const noChat = tamanhoDoIcone(chatTsx, 'FiMessageSquare');

    expect(noChat).toBe('20');
    expect(tamanhoDoIcone(listaTsx, 'FiPlus')).toBe(noChat);
  });

  it('a tira tem o mesmo recuo e o mesmo intervalo nas duas', () => {
    const doChat = corpoDe(chatScss, '.chat-header {');
    const daLista = corpoDe(listaScss, '&__head {');

    expect(propriedade(daLista, 'padding')).toBe(propriedade(doChat, 'padding'));
    expect(propriedade(daLista, 'gap')).toBe(propriedade(doChat, 'gap'));
    expect(propriedade(doChat, 'padding')).toBe('12px 14px');
  });

  // Acima de 900px a lista deixa de ser a tela e vira uma coluna de 248px: ali o controle de
  // 51px come metade da largura, e a escala volta a ser a da coluna. Ver o `@media` no SCSS.
  // As leituras passam pelo `propriedade`, que ancora o nome no começo da declaração. Um
  // `toMatch(/width:\s*34px/)` solto aceitava `min-width: 34px` como se fosse `width` — e foi
  // assim que a versão anterior deste teste deixou passar um `width: 51px` no desktop.
  it('na coluna do desktop os controles voltam à escala dela', () => {
    const novoNoDesktop = corpoDe(
      corpoDe(listaScss, '@media (min-width: 901px)'),
      '.nyta-conversations .nyta-conversations__new {',
    );

    expect(propriedade(novoNoDesktop, 'width')).toBe('34px');
    expect(propriedade(novoNoDesktop, 'height')).toBe('34px');
    expect(propriedade(corpoDe(listaScss, '&__perfil {'), 'width')).toBe('34px');
  });
});
