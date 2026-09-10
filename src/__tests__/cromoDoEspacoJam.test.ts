import fs from 'fs';
import path from 'path';

import {
  ALTURA_DA_PISTA, ALTURA_DA_REGUA, ALTURA_DO_TITULO, ALTURA_DO_TRANSPORTE, CORES_DAS_PISTAS,
  ALTURA_DO_RODAPE, DS, ENCAIXE, LARGURA_DAS_FERRAMENTAS, LARGURA_DAS_PISTAS,
  PIXELS_POR_SEGUNDO,
  corDaPista,
} from '../pages/Catalog/daw/tokens';

// O EDITOR do Espaço JAM é o desenho do projeto de referência que o dono do produto deixou
// (`~/Downloads/Digital Audio WAVE`, `ProjectHomePageDAW.tsx` e `src/styles/tokens.ts`).
//
// Este teste é o que impede a cópia de virar aproximação. Os valores abaixo foram lidos daquele
// arquivo, à vírgula — e o dia em que alguém "arredondar" 88 para 90 ou trocar o laranja por
// azul da marca, a suíte diz onde estava escrito o contrário.
//
// ⚠️ ESTA TELA NÃO SEGUE O DESIGN SYSTEM CLARO DO RESTO DO PRODUTO, e é de propósito: um editor
// de música é escuro, denso e de contraste alto porque se olha para ele durante horas e o que
// interessa são formas de onda. Ableton, Logic, Pro Tools, Reaper — todos escuros.

const ler = (...partes: string[]) => fs.readFileSync(path.join(__dirname, '..', ...partes), 'utf8');

const editor = ler('pages', 'Catalog', 'daw', 'EditorDaGravacao.tsx');
const clipe = ler('pages', 'Catalog', 'daw', 'Clipe.tsx');
const casca = ler('pages', 'Catalog', 'daw', 'editor.module.scss');
const biblioteca = ler('pages', 'Catalog', 'daw', 'Biblioteca.tsx');
const icones = ler('pages', 'Catalog', 'daw', 'icones.tsx');
const tela = ler('pages', 'Catalog', 'ProjectSpace.tsx');
const campos = ler('components', 'ficha', 'campos.tsx');
const exportar = ler('pages', 'Catalog', 'daw', 'TelaDeExportar.tsx');

/** Só o código: um comentário que NOMEIA o que saiu não é o que saiu. */
const semComentarios = (valor: string) => valor.replace(/\/\/.*$/gm, '');

describe('cromo do editor do Espaço JAM', () => {
  // As dimensões da referência. São elas que dão à tela a densidade de um editor: uma faixa de
  // 160px cabe uma onda legível e cinco controlos no cabeçalho, e uma de 40 não cabe nada.
  it('as dimensões são as da referência', () => {
    expect(PIXELS_POR_SEGUNDO).toBe(60);
    expect(ALTURA_DA_PISTA).toBe(160);
    expect(ALTURA_DA_REGUA).toBe(30);
    expect(LARGURA_DAS_FERRAMENTAS).toBe(256);
    expect(LARGURA_DAS_PISTAS).toBe(256);
    expect(ALTURA_DO_TITULO).toBe(68);
    expect(ALTURA_DO_TRANSPORTE).toBe(62);
    expect(ALTURA_DO_RODAPE).toBe(44);
    // O encaixe do arrasto: um quarto de segundo.
    expect(ENCAIXE).toBe(0.25);
  });

  it('as cores são as da referência: escuro, com o azul na ação e o vermelho na agulha', () => {
    expect(DS.color.bgBase).toBe('#1a1a1e');
    expect(DS.color.bgPainel).toBe('#212127');
    expect(DS.color.bgPista).toBe('#2a2a32');
    expect(DS.color.primaria).toBe('#3b82f6');
    expect(DS.color.agulha).toBe('#ef4444');
  });

  it('a paleta das pistas dá a volta', () => {
    expect(CORES_DAS_PISTAS).toHaveLength(6);
    // A sétima pista repete a primeira, em vez de ficar sem cor.
    expect(corDaPista(6)).toBe(CORES_DAS_PISTAS[0]);
    // E um índice negativo não estoura o array.
    expect(corDaPista(-1)).toBe(CORES_DAS_PISTAS[5]);
  });

  // ⚠️ O que vale para a MONTAGEM INTEIRA mora no rodapé, e não no cabeçalho: o Master não
  // identifica nada, ele mexe no som, e no topo fazia o cabeçalho dizer três coisas ao mesmo
  // tempo — que música é esta, que vista está aberta, e como está a soar.
  // ⚠️ A divisão entre as duas barras: em cima, o que diz QUE MÚSICA é e QUE VISTA está aberta
  // — a primeira escolha de quem entra. Em baixo, o que governa o que já está aberto: o
  // andamento e o tom da gravação, a contagem de pistas e o volume geral.
  it('as abas ficam no topo, e os controlos no rodapé', () => {
    const rodape = editor.slice(editor.indexOf('══════════ RODAPÉ'));
    const cabecalho = editor.slice(
      editor.indexOf('══════════ FILA DO TÍTULO'),
      editor.indexOf('══════════ CORPO'),
    );

    expect(cabecalho).toContain("'Timeline'");
    expect(cabecalho).toContain("'Mixer'");
    expect(cabecalho).toContain("'Ficha'");
    expect(rodape).toContain('Volume geral');
    expect(rodape).toContain('{numeros}');

    // E o corte tem de ser de verdade, não uma segunda cópia em cada barra.
    expect(cabecalho).not.toContain('Volume geral');
    expect(rodape).not.toContain("'Timeline'");
  });

  // ⚠️ O fechar e o tela cheia são CÍRCULOS. É o idioma do produto — o voltar, o sino, o menu
  // do sistema e o fechar das folhas são todos redondos —, e um quadradinho aqui lia como "mais
  // um controlo da tela" em vez de "isto tira você daqui".
  it('os botões do cabeçalho são redondos', () => {
    // O molde é um só, e é ele que os botões do cabeçalho vestem — cada um pode temperá-lo
    // (o de sair fica apagado enquanto a guia é gerada), mas a forma sai daqui.
    expect(editor).toMatch(/const redondo = \{[\s\S]{0,120}borderRadius: '50%'/);
    expect(editor).toContain('...redondo');
  });

  // ⚠️ A ficha veste a folha do EDITOR, e é a mesma ficha do modal claro. Um cartão branco no
  // meio de um editor escuro é uma janela de outro aplicativo, e obriga o olho a reajustar a
  // cada troca de aba. Duplicar o formulário para o pintar de escuro seria pior: dois
  // formulários para os mesmos dados divergem no primeiro campo novo.
  it('a ficha é escura, e é a mesma do modal', () => {
    expect(casca).toContain('.ficha {');
    // O antd inteiro em modo escuro, só ali dentro.
    expect(tela).toContain('theme.darkAlgorithm');
    // E o campo de envio pergunta a cor a quem o hospeda, porque vive em estilo em linha.
    expect(campos).toContain('var(--ficha-fundo');
    expect(casca).toContain('--ficha-fundo:');
  });

  // ⚠️ Nada de seletor de TIPO enquanto só o áudio toca: um controlo que guarda uma escolha
  // sem consequência ensina errado — a pista parece mudar de natureza e não muda.
  it('a pista não oferece tipo nenhum', () => {
    expect(editor).not.toContain('Tipo da pista');
    expect(editor).not.toContain('TIPOS_DE_PISTA');
  });

  // A tela é ESCURA. Um editor claro seria o único do mercado, e não por bom motivo.
  it('a tela é escura, e o fundo do corpo acompanha', () => {
    expect(editor).toContain('DS.color.bgBase');
    expect(casca).toContain('#1a1a1e');
  });

  // ⚠️ Quem faz o editor cobrir o app é o `display: none` na moldura, e não o z-index. O Espaço
  // JAM já teve 2147483000 aqui, e o número nunca fez nada.
  it('a moldura do app é escondida, e a camada sai do token', () => {
    expect(casca).toContain('body.jam-space-open .top-navigation');
    expect(casca).toContain('body.jam-space-open .app-rail');
    expect(casca).toContain('body.jam-space-open .mobile-nav');
    expect(casca).toContain('var(--z-tela-cheia)');
  });

  // As quatro zonas do desenho: biblioteca, cabeçalhos, régua e faixas. Sem uma delas não é um
  // editor — é um tocador com enfeites.
  it('as quatro zonas estão na tela', () => {
    expect(biblioteca).toContain('LARGURA_DAS_FERRAMENTAS');
    expect(editor).toContain('<Biblioteca');
    expect(editor).toContain('LARGURA_DAS_PISTAS');
    expect(editor).toContain('ALTURA_DA_REGUA');
    expect(editor).toContain('ALTURA_DA_PISTA');
  });

  // ⚠️ A pasta é lida NO NAVEGADOR e nada sobe até alguém arrastar. Enviar tudo o que a pessoa
  // abriu paga armazenamento e egress por ficheiros que ela nem ia usar, e enche a montagem de
  // pistas que ninguém pediu.
  it('a biblioteca pré-visualiza a pasta, e só o arrasto envia', () => {
    expect(biblioteca).toContain('webkitdirectory');
    expect(biblioteca).toContain('draggable');
    expect(biblioteca).toContain('Nada sobe para a nuvem enquanto você não');
    // E o lote continua a existir: um projeto de stems tem dez faixas, e uma a uma ninguém faz.
    expect(biblioteca).toContain('Enviar todos como pistas');
    expect(editor).toContain('largarNaFaixa');
  });

  // Os controlos que a referência mostra em cada pista, e o Master no topo.
  it('cada pista tem tipo, mudo, solo, volume e panorama; e há um Master', () => {
    expect(editor).toContain('Panorama de');
    expect(editor).toContain('Volume geral');
    // ⚠️ Mudo e solo em cores diferentes: são as duas ações mais usadas de uma mesa, e são
    // opostas. Pintadas iguais quando acesas, ninguém sabe qual carregou.
    expect(editor).toContain("botaozinho(calada, DS.color.textoFraco)");
    expect(editor).toContain("botaozinho(Boolean(daMesa?.solo), '#f59e0b')");
  });

  // As duas vistas da mesma montagem: a linha do tempo responde "o que toca quando", a mesa
  // responde "como isto soa junto".
  it('há as três abas, e a mesa tem faders verticais', () => {
    expect(editor).toContain("'Timeline'");
    expect(editor).toContain("'Mixer'");
    expect(editor).toContain("'Ficha'");

    // Na ficha não há o que arrastar nem o que tocar: a coluna e o transporte somem.
    expect(editor).toContain("aba !== 'ficha'");
    // A letra é um balão, e não uma aba: escreve-se letra a olhar para a montagem.
    expect(editor).toContain('casca.letra');
    expect(casca).toContain('.letra');
    // Os dois ícones são desenho do dono do produto; o traço segue a cor da aba em vez de ficar
    // cinza para sempre.
    expect(icones).toContain('currentColor');
    // Sem os comentários: o arquivo NOMEIA a cor antiga para explicar a troca, e nomear não é
    // pintar. (É a segunda vez que este teste tropeça nisso.)
    expect(semComentarios(icones)).not.toContain('#898989');
    expect(editor).toContain('MesaDeCanais');
    expect(editor).toContain("writingMode: 'vertical-lr'");
  });

  // O clipe é o que separa um editor de uma mesa: ele mora num INSTANTE.
  it('o clipe é posicionado no tempo, corta na agulha e some com clique duplo', () => {
    expect(clipe).toContain('inicio * escala');
    expect(clipe).toContain('agulha > inicio');
    expect(clipe).toContain('DIVIDIR');
    expect(clipe).toContain('onDoubleClick');
  });

  // ⚠️ O SELO DE ESTADO NÃO VOLTA PARA O CABEÇALHO. Lá ele encostava no X de sair — com um
  // título comprido, "Salvando…" passava POR CIMA do único botão que fecha a tela.
  it('o selo de estado flutua com a letra e o "?", e não no cabeçalho', () => {
    expect(casca).toContain('.selo');
    expect(editor).toContain('casca.selo');

    // Na mesma fila dos outros dois flutuantes, e à esquerda deles.
    const fila = (classe: string) =>
      Number(casca.match(new RegExp(`\\.${classe}\\s*\\{[^}]*?right:\\s*(\\d+)px`))?.[1]);
    expect(fila('ajuda')).toBe(18);
    expect(fila('letra')).toBe(62);
    expect(fila('selo')).toBe(106);

    // E o JSX do cabeçalho não escreve mais nenhum dos três textos naquele canto. O que fica
    // é o `title` do X ("Gerando a guia…"), que é a explicação de por que ele está travado —
    // aparece no hover, não por cima do botão.
    const cabecalho = semComentarios(editor.slice(
      editor.indexOf('FILA DO TÍTULO'), editor.indexOf('CORPO'),
    ));
    expect(cabecalho).not.toContain('Salvando…');
    expect(cabecalho).not.toContain('Enviando {envio');
    // Nenhum texto ancorado à direita: era isso que passava por cima do X.
    expect(cabecalho).not.toContain("position: 'absolute', right: 18");
  });

  // Um indicador que está sempre na tela deixa de ser lido — e este precisa de ser lido nas
  // duas vezes em que importa: enquanto grava, e quando falha.
  it('o selo só existe quando há algo a acontecer, e roda enquanto trabalha', () => {
    expect(editor).toContain('{!!atividade && (');
    expect(editor).toContain('casca.girando');
    expect(casca).toContain('@keyframes girar');
    // Os três sinais viram UM: são a mesma pergunta para quem olha ("posso fechar?").
    expect(editor).toContain("texto: 'Salvando…'");
    expect(editor).toContain("texto: 'Gerando a guia…'");
    expect(editor).toContain("texto: 'Falha ao salvar'");
  });

  // ⚠️ O TEXTO FICA NA TELA, ao lado do ícone — e não só no `title`. Redondo e mudo, o selo
  // passava despercebido: uma roda de 14 px a girar num canto não diz a ninguém "estou a
  // gravar o teu trabalho" se a pessoa não estiver já a olhar para ela.
  it('o selo escreve o que está a acontecer, e não só o ícone', () => {
    // ⚠️ FILHO do elemento, e não `title=`/`aria-label=` — que é onde o texto já estava e não
    // se lia sem passar o rato por cima. Por isso a linha SOZINHA, e não `toContain`: a string
    // aparece três vezes no arquivo, e duas delas são atributos.
    const linhas = semComentarios(editor).split('\n').map((l) => l.trim());
    expect(linhas).toContain('{atividade.texto}');

    // E a forma acompanha: pílula com o texto ao lado, e não um círculo de ícone só.
    const regra = casca.match(/\.selo\s*\{[^}]*\}/)?.[0] ?? '';
    expect(regra).not.toContain('border-radius: 50%');
    expect(regra).toContain('gap:');
    // Ancorada pela direita: cresce para a esquerda, e a letra e o "?" não saem do lugar
    // quando o texto muda de comprimento.
    expect(regra).toContain('right: 106px');
    expect(regra).not.toMatch(/\bwidth:/);
  });

  // O transporte tem três botões, e o terceiro é o LOOP. Parar saiu porque não fazia nada de
  // novo: é pausar (o botão grande) mais voltar ao início (o |◀ ao lado). O loop, esse, não
  // se faz encadeando outros dois.
  it('o transporte repete em vez de parar, e o botão diz quando está aceso', () => {
    const corpo = semComentarios(editor);
    expect(corpo).toContain('FiRepeat');
    expect(corpo).toContain('transporte.loopar(!estado.emLoop)');
    // Aceso é visível, e não só no `title`: quem volta à tela precisa de saber se aquilo está
    // a repetir antes de carregar no play.
    expect(corpo).toContain('aria-pressed={estado.emLoop}');
    expect(corpo).toContain("estado.emLoop ? `${DS.color.primaria}22` : 'transparent'");

    // E o quadrado do parar não fica por aí, nem o comando dele.
    expect(corpo).not.toContain('FiSquare');
    expect(corpo).not.toContain('transporte.parar');
  });

  // ⚠️ A ONDA COMEÇA NA BORDA DO CLIPE. O clipe está em `inicio * escala`, no instante exato
  // em que o som entra; um recuo lateral aqui dentro desenha o ataque à direita de onde ele
  // soa, e a 400 % de zoom isso vê-se a olho — justamente no zoom em que se alinham coisas.
  it('a onda encosta nas laterais do clipe, e só respira em cima e em baixo', () => {
    const envolucro = semComentarios(clipe)
      .split('\n')
      .find((l) => l.includes('<Onda') || l.includes('padding')) ?? '';
    const recuo = semComentarios(clipe).match(/padding: '(\d+)px (\d+)(?:px)?'/);
    expect(recuo).not.toBeNull();
    // Vertical pode respirar; horizontal, não.
    expect(Number(recuo![2])).toBe(0);
    expect(Number(recuo![1])).toBeGreaterThan(0);
    expect(envolucro).toBeTruthy();
  });

  // ⚠️ UM SCROLL SÓ para as duas colunas. Com um `overflow` em cada uma, bastava rolar a
  // esquerda para o M, o S e o volume deixarem de ser os da onda ao lado — e a pessoa calava
  // ou baixava a pista errada sem perceber que estava a olhar para o cabeçalho de outra.
  it('os controlos e as ondas rolam juntos, num scroll só', () => {
    const corpo = semComentarios(editor);

    // A coluna dos controlos não rola sozinha… (o recorte vai até ao fim do `style`, e não
    // até à primeira chaveta: há interpolações `${...}` pelo meio.)
    // `larguraDasPistas` (a variável) e não a constante: a coluna encolhe no telemóvel, mas
    // continua a ser a MESMA coluna — e é ela que tem de grudar em vez de rolar sozinha.
    const inicioDaColuna = corpo.indexOf('width: larguraDasPistas');
    const coluna = corpo.slice(inicioDaColuna, corpo.indexOf('}}>', inicioDaColuna));
    expect(coluna).not.toContain('overflowY');
    expect(coluna).not.toContain('overflow:');
    // …ela GRUDA à esquerda enquanto o contentor rola por baixo.
    expect(coluna).toContain("position: 'sticky'");
    expect(coluna).toContain('left: 0');

    // E a linha do tempo também não: quem tem o `overflow` é o contentor das duas. O `}}` tem
    // de ser procurado A PARTIR do `style={{` — antes dele há os `onDrop={(e) => {…}}`, e o
    // recorte saía vazio (e um recorte vazio não contém nada, por isso passava sempre).
    const daLinha = corpo.slice(corpo.indexOf('ref={linha}'));
    const abreEstilo = daLinha.indexOf('style={{');
    const estiloDaLinha = daLinha.slice(abreEstilo, daLinha.indexOf('}}', abreEstilo));
    expect(estiloDaLinha.length).toBeGreaterThan(40);
    expect(estiloDaLinha).not.toContain('overflow');
  });

  // ⚠️ O TELEMÓVEL É OUTRA TELA, e o desktop não pode sentir nada disto. Em 375 px o editor
  // era intocável: a biblioteca sozinha ocupava 256 px (68 %) e o X de sair ficava 269 px fora
  // da janela — entrava-se e não se saía. Cada linha aqui guarda uma dessas correções.
  describe('no telemóvel', () => {
    const corpo = semComentarios(editor);

    // ⚠️ A LINHA DO TEMPO ABRE EM TODA A PARTE. Já abriu na Mesa aqui, com o argumento de que
    // montar é trabalho de rato — verdadeiro, e ainda assim a escolha errada: a linha do tempo
    // é a cara do editor, é onde se vê o que a música tem, e chegar ao Espaço JAM por um ecrã
    // de faders sem ver uma onda é chegar a outro produto. Ver não é montar.
    it('abre na linha do tempo, como no desktop', () => {
      expect(corpo).toContain("useState<'linha' | 'mesa' | 'ficha' | 'exportar'>('linha')");
      expect(corpo).not.toContain("'mesa' : 'linha'");
    });

    it('a biblioteca começa fechada, e sobreposta quando abre', () => {
      // ⚠️ O PADRÃO É POR LARGURA, e não por tela: no desktop há espaço para ela ficar à
      // mostra enquanto se monta; em 375 px são 68 % do ecrã, e a montagem fica sem onde
      // acontecer. O mesmo botão serve as duas.
      expect(corpo).toContain('useState(() => window.innerWidth >= 768)');
      // Sobreposta, e não encaixada: é isso que devolve a largura toda à montagem.
      expect(corpo).toContain("position: 'absolute', inset: 0, zIndex: 30");
      expect(corpo).toContain("aria-label='Fechar a biblioteca'");
      // E estica: uma gaveta de 256 px dentro de um ecrã de 375 é uma coluna com outro nome.
      expect(corpo).toContain('emGaveta={noCelular}');
      expect(semComentarios(biblioteca)).toContain("width: emGaveta ? '100%' : LARGURA_DAS_FERRAMENTAS");
    });

    it('as abas perdem o rótulo para o X caber', () => {
      expect(corpo).toContain('{!noCelular && rotulo}');
      // Sem texto, o nome tem de sobrar em algum lado — senão o botão fica mudo.
      expect(corpo).toContain('title={rotulo}');
      expect(corpo).toContain('aria-label={rotulo}');
    });

    it('o clipe não se arrasta nem se apaga com o dedo', () => {
      expect(corpo).toContain('semEdicao={noCelular}');
      expect(semComentarios(clipe)).toContain('const travado = fixo || semEdicao;');
      // ⚠️ `semEdicao` NÃO é `fixo`: fixo é a pista da Mix, e troca o rótulo do clipe para
      // "Mix". Um clipe normal num telemóvel continua a ser "Take N".
      expect(semComentarios(clipe)).toContain("{fixo ? 'Mix' : `Take ${indice + 1}`}");
    });

    it('a coluna encolhe, e as faixas acompanham a mesma altura', () => {
      expect(corpo).toContain('const larguraDasPistas = noCelular ? 132 : LARGURA_DAS_PISTAS;');
      expect(corpo).toContain('const alturaDaPista = noCelular ? 96 : ALTURA_DA_PISTA;');
      // ⚠️ A altura tem de ser a MESMA nos dois lados: cabeçalho e faixa desalinhados é o bug
      // que o scroll único acabou de corrigir, e uma altura só para um dos lados traz de volta.
      expect(corpo).not.toContain('height: ALTURA_DA_PISTA');
      expect(corpo).not.toContain('altura={ALTURA_DA_PISTA}');
    });
  });

  // ⚠️ OS QUATRO ÍCONES DAS ABAS TÊM DE PARECER DO MESMO TAMANHO, e `size` igual não basta
  // para isso. Os dois desenhados vinham num quadro de 41×41 com o traço no miolo (41 % e 46 %
  // de ocupação); os dois do react-icons enchem 75–83 % do seu. Com `size` 15 e 14, a tela
  // mostrava 6,2 px de tinta na Timeline contra 11,7 px na Ficha — quase o dobro, e a fila
  // parecia dois pares de ícones diferentes.
  it('os ícones das abas têm a mesma medida e o mesmo enquadramento', () => {
    const corpo = semComentarios(editor);

    // Uma medida só, e nomeada: quatro números soltos voltam a divergir no próximo ajuste.
    expect(corpo).toContain('const TAMANHO_DO_ICONE_DA_ABA = 15;');
    expect(corpo.match(/TAMANHO_DO_ICONE_DA_ABA/g)?.length).toBe(5); // a declaração + os quatro
    expect(corpo).not.toMatch(/<FiFileText size=\{14\}[^>]*\/>\s*\n\s*:\s*<FiDownload/);

    // E o quadro dos desenhados é recortado no traço, e não o 41×41 do ficheiro. Vale para
    // TODOS os ícones do arquivo, e não para uma contagem fixa: prender o número fazia o teste
    // quebrar a cada ícone novo sem que nada estivesse errado.
    const quadros = semComentarios(icones).match(/viewBox="[^"]+"/g) ?? [];
    expect(quadros.length).toBeGreaterThanOrEqual(2);
    quadros.forEach((q) => expect(q).not.toContain('0 0 41 41'));
  });

  // ⚠️ OS FLUTUANTES FICAM ACIMA DA COLUNA DAS PISTAS. Eles usavam `--z-cartao`, que vale 2 —
  // abaixo dos 11 da coluna. O "Enviando 1 de 4…" nascia por trás dos controlos e saía cortado
  // ao meio; no telemóvel, onde a coluna e o selo disputam os mesmos 375 px, ficava ilegível.
  // O token não estava errado por ser token: ele descreve "detalhe DENTRO de um cartão", e
  // estes três não estão dentro de cartão nenhum.
  it('o selo, a letra e o "?" flutuam acima da coluna e da régua', () => {
    const camada = Number(casca.match(/\$camada-dos-flutuantes:\s*(\d+)/)?.[1]);
    expect(camada).toBeGreaterThan(12); // acima do canto onde a régua e a coluna se cruzam

    const corpo = semComentarios(editor);
    const daColuna = Number(corpo.match(/position: 'sticky', left: 0, zIndex: (\d+)/)?.[1]);
    const daGaveta = Number(corpo.match(/position: 'absolute', inset: 0, zIndex: (\d+)/)?.[1]);
    expect(camada).toBeGreaterThan(daColuna);
    // E abaixo da gaveta: aberta, ela tapa tudo, e é para isso que serve.
    expect(camada).toBeLessThan(daGaveta);

    // Nenhum dos três volta ao token do cartão.
    const regras = casca.match(/\.(selo|ajuda)\s*\{[^}]*\}/g) ?? [];
    expect(regras.length).toBeGreaterThanOrEqual(2);
    regras.forEach((regra) => expect(regra).not.toContain('--z-cartao'));
  });

  // ⚠️ O EDITOR TEM O SEU PRÓPRIO SELETOR DE FICHEIROS. O "Adicionar pista" procurava o botão
  // da BIBLIOTECA pelo `aria-label` e clicava nele por baixo do pano. Enquanto ela estava
  // sempre aberta aquilo passou; desde que ela recolhe, o botão deixa de existir no DOM, o
  // `?.` engole a chamada, e carregar em "Adicionar pista" não fazia absolutamente nada.
  it('adicionar pista abre o seletor do próprio editor', () => {
    const corpo = semComentarios(editor);

    // Nada de alcançar dentro de outro componente por texto de rótulo.
    expect(corpo).not.toContain('[aria-label="Escolher arquivos"]');
    expect(corpo).toContain("onClick={() => escolherPara(null)}");
    // O input vive FORA de qualquer painel que possa fechar.
    expect(corpo).toContain('ref={seletor}');
    expect(corpo).toContain("accept='.mp3,.wav,audio/mpeg,audio/wav'");
    // ⚠️ Limpar o valor ANTES de usar: escolher o mesmo ficheiro duas vezes seguidas não
    // dispara `change` se o valor não mudar, e o segundo envio nunca aconteceria.
    const aoMudar = corpo.slice(corpo.indexOf('ref={seletor}'));
    expect(aoMudar.indexOf("evento.target.value = ''")).toBeLessThan(aoMudar.indexOf('escolherArquivos('));
  });

  // Uma pista que ficou sem áudio era um beco: a única entrada era a biblioteca, e de lá o
  // ficheiro só chega por ARRASTO — que não existe no telemóvel, onde ela é uma gaveta que tapa
  // as faixas. A pista ficava lá, vazia, sem forma de a encher.
  it('cada pista tem por onde receber um áudio', () => {
    const corpo = semComentarios(editor);

    expect(corpo).toContain('escolherPara(faixa.id)');
    expect(corpo).toContain('IconeDeEnviar');
    // Na fila do M e do S, que é onde a mão já está.
    const aFila = corpo.slice(corpo.indexOf("aria-label={calada ?"), corpo.indexOf('</div>', corpo.indexOf('escolherPara(faixa.id)')));
    expect(aFila).toContain('escolherPara(faixa.id)');
    // A pista da Mix não recebe: ela é o áudio da gravação, e não uma faixa de montagem.
    expect(corpo).toContain('{podeEditar && !fixa && (');
  });

  // ⚠️ "SALVO" SÓ QUANDO ALGO FOI SALVO. Um ficheiro pode passar a triagem (é WAV, cabe no
  // limite) e ainda assim não chegar ao fim — o envio salta os que não têm duração legível.
  // Sem contar o que entrou de facto, o selo pintava um "Salvo" verde por cima de uma
  // montagem que continuava vazia, e o aviso do motivo passava despercebido ao lado dele.
  it('o envio não diz "Salvo" quando nada entrou', () => {
    const daTela = semComentarios(tela);
    const oEnvio = daTela.slice(daTela.indexOf('const enviarPistas'));

    expect(oEnvio).toContain('let entraram = 0;');
    expect(oEnvio).toContain('entraram += 1;');
    // A guarda vem ANTES do "salvo": é ela que impede o verde.
    const guarda = oEnvio.indexOf('if (!entraram)');
    const salvo = oEnvio.indexOf("setSaveState('salvo')");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(salvo);
  });

  // ⚠️ A PORTA DA BIBLIOTECA MORA NO RODAPÉ, com o resto do que governa a tela inteira (o
  // andamento, o tom, o volume geral). No transporte ela ficava entre o play e o loop —
  // controlos do que está a SOAR —, e abrir uma pasta não é um gesto de transporte.
  it('a biblioteca abre e fecha pelo rodapé, nas duas telas', () => {
    const corpo = semComentarios(editor);
    const rodape = corpo.slice(corpo.indexOf('ALTURA_DO_RODAPE, flexShrink: 0'));

    expect(rodape).toContain('setBibliotecaAberta((v) => !v)');
    expect(rodape).toContain('aria-pressed={bibliotecaAberta}');
    // Antes do BPM: o `numeros` (andamento e tom) vem depois dela na fila.
    expect(rodape.indexOf('setBibliotecaAberta')).toBeLessThan(rodape.indexOf('{numeros}'));

    // E não sobrou nenhuma porta no transporte. ⚠️ O fim do recorte é procurado A PARTIR do
    // início dele: `ALTURA_DO_RODAPE` aparece primeiro no import, no topo do ficheiro, e sem
    // isso o slice saía vazio — e um recorte vazio não contém nada, por isso passava sempre.
    const inicioDoTransporte = corpo.indexOf('ALTURA_DO_TRANSPORTE, flexShrink: 0');
    const transporte = corpo.slice(inicioDoTransporte, corpo.indexOf('ALTURA_DO_RODAPE, flexShrink: 0', inicioDoTransporte));
    expect(transporte.length).toBeGreaterThan(500);
    expect(transporte).not.toContain('setBibliotecaAberta');
  });

  // O TRANSPORTE: play e pause são o mesmo botão a alternar, e o REC arma antes de gravar.
  it('play e pause são o mesmo botão, e o brilho diz quando está a andar', () => {
    const corpo = semComentarios(editor);

    // Um botão só, que troca de ícone: dois botões separados fariam a barra mudar de forma a
    // cada toque, e o gesto é o mesmo.
    expect(corpo).toContain('estado.tocando ? <FiPause size={18} /> : <FiPlay size={18}');
    // ⚠️ O RECORTE É DO BOTÃO, e não do ficheiro: `: 'none',` aparece em meia dúzia de
    // estilos por aqui, e uma asserção solta passava com a sombra de volta no repouso.
    // ⚠️ O RECORTE É O BOTÃO INTEIRO, do rótulo até ao fecho. Ancorá-lo no `onClick` quebrou
    // quando o handler ganhou a guarda da gravação; ancorá-lo no `width: 42` apanhava o
    // `style` do ÍCONE, que vem logo a seguir. Do rótulo ao `</button>` não há como enganar.
    const inicioDoPlay = corpo.indexOf("aria-label={estado.carregando");
    const estiloDoPlay = corpo.slice(inicioDoPlay, corpo.indexOf('</button>', inicioDoPlay));
    expect(estiloDoPlay.length).toBeGreaterThan(300);

    // A cor NÃO muda entre tocar e pausar — o que muda é o brilho.
    expect(estiloDoPlay).toContain('`0 0 0 4px ${DS.color.primaria}33');
    // E parado é SÓ o círculo: a auréola permanente não dizia nada, num transporte em que
    // tudo à volta é chapado.
    expect(estiloDoPlay).toContain('estado.tocando && !estado.carregando');
    expect(estiloDoPlay).not.toContain('0 0 16px');
  });

  // ⚠️ O "AT" SAIU DA PISTA. Ele era automação, estava desligado desde sempre, e ocupava o
  // lugar do controlo que uma pista realmente precisa numa mesa: dizer "é NESTA que se grava".
  it('cada pista arma a gravação no lugar do antigo AT', () => {
    const corpo = semComentarios(editor);

    expect(corpo).not.toContain('Automação — ainda não disponível');
    expect(corpo).toContain('alternarArmada(faixa.id)');
    expect(corpo).toContain('aria-pressed={armadas.includes(faixa.id)}');
  });

  // ⚠️ SÃO DUAS ARMAÇÕES, e não uma: a pista diz ONDE se grava, o transporte diz QUANDO. É
  // assim em qualquer mesa, e é por isso que são dois botões.
  it('o REC do transporte exige uma pista armada, e o play não finge que gravou', () => {
    const corpo = semComentarios(editor);

    // Armar o transporte sem pista é meia intenção: avisa em vez de armar.
    expect(corpo).toContain('if (!armado && !armadas.length)');
    expect(corpo).toContain('Arme primeiro a pista onde quer gravar');

    // ⚠️ E COM TUDO ARMADO, O PLAY NÃO TOCA. Deixar a montagem simplesmente andar seria o pior
    // desfecho: a pessoa armou tudo, ouviu correr, e só descobria que não gravou ao procurar o
    // take. O aviso custa um toque; o take perdido custa a sessão.
    expect(corpo).toContain('if (armado && armadas.length && !estado.tocando)');
    expect(corpo).toContain('A gravação ainda não está disponível');
    const oPlay = corpo.slice(corpo.indexOf('if (armado && armadas.length'));
    expect(oPlay.indexOf('return;')).toBeLessThan(oPlay.indexOf('transporte.alternar()'));
  });

  // ⚠️ ARMAR NÃO É GRAVAR, e é a distinção que toda mesa faz. A gravação ainda não existe: o
  // botão guarda a intenção e diz isso no `title`, em vez de acender e não fazer nada.
  it('o REC arma e desarma, e é um círculo só', () => {
    const corpo = semComentarios(editor);

    expect(corpo).toContain('setArmado((v) => !v)');
    expect(corpo).toContain('aria-pressed={armado}');
    // Enche quando arma; vazio quando não.
    expect(corpo).toContain("fill={armado ? 'currentColor' : 'none'}");
    // ⚠️ SEM BORDA no botão: a borda mais o círculo do ícone davam dois anéis concêntricos —
    // o desenho de uma mira, e não o do REC.
    const oRec = corpo.slice(corpo.indexOf('setArmado((v) => !v)'));
    const estilo = oRec.slice(oRec.indexOf('style={{'), oRec.indexOf('}}', oRec.indexOf('style={{')));
    expect(estilo).toContain("border: 'none'");

    // E continua a dizer que gravar ainda não existe, em vez de prometer.
    expect(corpo).toContain('ainda não está disponível');
  });

  // ⚠️ OS BOTÕES DA PISTA REPARTEM A COLUNA, no telemóvel — não têm cada um a sua largura.
  // Quatro botões de 28 px com folgas somam 124 dentro de uma coluna de 132 com recuo: o
  // último saía pela borda e ia pousar EM CIMA da onda, cortado, roubando o toque a quem
  // tentava arrastar a linha do tempo por ali. E a conta voltaria a partir-se no próximo botão
  // que aparecesse.
  it('no celular os botões da pista dividem a largura em vez de estourá-la', () => {
    const corpo = semComentarios(editor);

    expect(corpo).toContain("? { flex: '1 1 0', minWidth: 0, padding: 0, height: 26 }");

    // Repartido em TODOS: um que ficasse de fora empurraria os outros na mesma.
    const inicio = corpo.indexOf('const repartido = noCelular');
    const fim = corpo.indexOf('VOLUME E PANORAMA', inicio) > 0
      ? corpo.indexOf('{!noCelular && (<>', inicio)
      : corpo.length;
    const aPista = corpo.slice(inicio, fim);
    expect(aPista.length).toBeGreaterThan(500);
    expect(aPista.match(/\.\.\.repartido/g)).toHaveLength(4);
  });

  // ⚠️ O LADO TEM DE SER ALCANÇÁVEL. Num ecrã estreito a barra de rolagem horizontal ou é um
  // polegar de 17 px ou não é desenhada de todo, e `shift` + roda não é gesto que se adivinhe.
  it('no celular a roda anda no tempo, e o dedo rola sem arrastar a tela de trás', () => {
    const corpo = semComentarios(editor);

    // Só no celular: no desktop a roda faz o que sempre fez.
    const aRoda = corpo.slice(corpo.indexOf('onWheel={(evento) => {'));
    const corpoDaRoda = aRoda.slice(0, aRoda.indexOf('}}'));
    expect(corpoDaRoda.length).toBeGreaterThan(80);
    expect(corpoDaRoda).toContain('if (!noCelular) return;');
    // Havendo o que rolar na vertical, a vertical continua a ser dela.
    expect(corpoDaRoda).toContain('if (caixa.scrollHeight > caixa.clientHeight) return;');
    expect(corpoDaRoda).toContain('caixa.scrollLeft += evento.deltaY;');

    // O gesto morre no editor: sem isto, chegar ao fim da linha do tempo passa o arrasto à
    // tela de trás e o editor salta por baixo da mão.
    expect(corpo).toContain("overscrollBehavior: 'contain'");
    expect(corpo).toContain("touchAction: 'pan-x pan-y'");
    // Mudar o zoom redimensiona a montagem inteira; sem isto o navegador "segura" o que está à
    // vista e a linha do tempo salta para o meio da música.
    expect(corpo).toContain("overflowAnchor: 'none'");
  });

  // ⚠️ AFASTAR VAI SEMPRE ATÉ AO ENCAIXE. Sem isto, quem aproximasse uma vez no telemóvel não
  // conseguia voltar a ver a música inteira: o botão parava nos 25 % e o encaixe era 3 %.
  it('o afastamento chega ao zoom em que a montagem cabe', () => {
    const corpo = semComentarios(editor);

    expect(corpo).toContain('const zoomMinimo = Math.min(ZOOM_MINIMO, encaixe);');
    expect(corpo).toContain('setZoom((z) => Math.max(zoomMinimo, z / 1.5))');
    // Quem mexe no zoom manda: o encaixe automático não volta a mexer nele.
    expect(corpo).toContain('zoomMexido.current = true;');
    expect(corpo).toContain('if (noCelular && !zoomMexido.current) setZoom(alvo);');
  });

  // ⚠️ A DICA DO DUPLO CLIQUE É DE RATO. No telemóvel não há duplo clique, a edição de clipes
  // está desligada, e a frase ainda por cima escrevia-se por cima dos números da régua.
  it('a dica do duplo clique não aparece no celular', () => {
    expect(semComentarios(editor)).toContain('{!noCelular && (\n                    <span');
  });

  // A voz da marca não usa travessão: onde ele aparecia, a frase foi reescrita.
  it('a tela de exportar oferece stems e guia, sem travessão na copy', () => {
    expect(exportar).toContain('Baixar stems (.zip)');
    expect(exportar).toContain('Baixar guia (.mp3)');
    expect(exportar).toContain('Baixar guia (.wav)');

    // Só o que a pessoa LÊ NA TELA: os comentários do arquivo continuam livres para explicar
    // as decisões — e explicam, com travessão e tudo.
    const soCodigo = semComentarios(exportar).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(soCodigo).not.toContain('—');
  });
});
