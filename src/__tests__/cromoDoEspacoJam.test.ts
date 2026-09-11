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
const iconesNoApp = fs.readFileSync(
  path.join(__dirname, '..', '..', 'apps', 'mobile', 'src', 'casca', 'jam', 'mesa', 'icones.tsx'),
  'utf8',
);
const fechar = ler('pages', 'Catalog', 'daw', 'FecharComGuia.tsx');
const fecharNoApp = fs.readFileSync(
  path.join(__dirname, '..', '..', 'apps', 'mobile', 'src', 'casca', 'jam', 'FecharComGuia.tsx'),
  'utf8',
);
// O editor do aparelho: o que é regra de produto tem de valer nos dois.
const app = fs.readFileSync(
  path.join(__dirname, '..', '..', 'apps', 'mobile', 'src', 'app', 'jam', '[artista]', '[projeto]', 'index.tsx'),
  'utf8',
);
// A leitura do projeto mora no núcleo: é lá que o nome do ficheiro chega ao clipe.
const nucleo = fs.readFileSync(
  path.join(__dirname, '..', '..', 'packages', 'core', 'src', 'services', 'db', 'catalog.ts'),
  'utf8',
);
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
    expect(biblioteca).toContain('Enviar todos como faixas');
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

  // ⚠️ E O MASTER NÃO TEM PERCENTAGEM AO LADO. O número não diz nada que o cursor já não
  // mostre, e custava 38 px numa barra que no telemóvel não os tem. Saiu primeiro do app; sai
  // daqui para as duas serem a mesma barra.
  it('o volume geral não escreve a percentagem', () => {
    expect(editor).not.toContain('{Math.round(estado.mestre * 100)}%');
    // O campo continua lá — é ele que anuncia o valor a quem não vê o cursor.
    expect(editor).toContain("aria-label='Volume geral'");
  });

  // ⚠️ O CLIPE DIZ QUE FICHEIRO TOCA, e não em que ordem entrou. "Take 1/2/3" numa faixa com
  // voz, dobra e ad-lib são três rótulos iguais por cima de três ondas parecidas — o número
  // é a única coisa ali que quem montou NÃO reconhece. O número fica como recurso, para o
  // clipe sem ficheiro com nome.
  it('o clipe é rotulado pelo nome do ficheiro, e o take é o recurso', () => {
    const oClipe = semComentarios(clipe);

    expect(oClipe).toContain("tituloDoArquivo(clipe.file_name || '') || `Take ${indice + 1}`");
    // Um nome de ficheiro é tão comprido quanto quem o gravou quis; o clipe não é.
    expect(oClipe).toContain("textOverflow: 'ellipsis'");
    expect(oClipe).toContain("whiteSpace: 'nowrap'");
  });

  // ⚠️ E O NOME CHEGA LÁ, que é a outra metade. `catalog_clips` guarda um `file_id`; o nome
  // vive em `catalog_version_files`, e sem a costura da leitura o `file_name` era um campo do
  // tipo que ninguém preenchia — o rótulo cairia para "Take N" para sempre.
  it('a leitura do projeto costura o nome do ficheiro em cada clipe', () => {
    expect(nucleo).toContain('export const comNomesDosClipes');
    expect(nucleo).toContain('return comNomesDosClipes(data as CatalogProject);');
  });

  // A primeira pista de uma gravação por montar é o áudio que alguém anexou. Chamar-lhe
  // "Test" porque a música se chama Test é dizer duas vezes a mesma coisa e nenhuma vez o
  // que ali está.
  it('montar a mix nomeia a pista pelo ficheiro, e não pelo título da música', () => {
    expect(tela).toContain("tituloDoArquivo(open.audio_file_name || '') || open.title || 'Mix'");
    expect(tela).toContain('name: nomeDoAnexo,');
    expect(tela).toContain('nome: nomeDoAnexo,');
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
    // ⚠️ O FADER EM PÉ É DESENHADO AQUI, e não um `<input type=range>` deitado de lado. O
    // trilho nativo vem creme-claro no meio de uma tela quase preta, com a espessura e o botão
    // que cada navegador decide — num canal de 116 px era uma barra pálida a atravessar o
    // cartão de cima a baixo. O desenho é o do app: trilho escuro de 6, preenchido de baixo
    // para cima na cor da faixa.
    expect(editor).toContain('<FaderEmPe');
    expect(editor).not.toContain("writingMode: 'vertical-lr'");
  });

  // O clipe é o que separa um editor de uma mesa: ele mora num INSTANTE.
  it('o clipe é posicionado no tempo, corta na agulha e some com clique duplo', () => {
    expect(clipe).toContain('inicio * escala');
    expect(clipe).toContain('agulha > inicio');
    expect(clipe).toContain("aria-label='Dividir o clipe na agulha'");
    expect(clipe).toContain('onDoubleClick');
  });

  // ⚠️ O SELO DE ESTADO NÃO VOLTA PARA O CABEÇALHO. Lá ele encostava no X de sair — com um
  // título comprido, "Salvando…" passava POR CIMA do único botão que fecha a tela.
  it('o selo de estado flutua com a letra e o "?", e não no cabeçalho', () => {
    expect(casca).toContain('.selo');
    expect(editor).toContain('casca.selo');

    // ⚠️ A FILA TEM UM PASSO SÓ: 30 de círculo mais 8 de folga — a mesma folga que separa as
    // duas setas na vertical. Com as posições escolhidas uma a uma (18, 62, 106) os intervalos
    // saíam 14 e 14 entre uns e 8 entre outros, e o olho vê o desencontro antes de o medir.
    const fila = (classe: string) =>
      Number(casca.match(new RegExp(`\\.${classe}\\s*\\{[^}]*?right:\\s*(\\d+)px`))?.[1]);
    expect(fila('ajuda')).toBe(18);
    expect(fila('letra')).toBe(56);
    expect(fila('conversa')).toBe(94);
    expect(fila('selo')).toBe(132);

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
    expect(editor).toContain("texto: 'Falha ao salvar'");
    // ⚠️ A GUIA SAIU DO SELO: ela tem uma tela inteira só para si, e a mesma frase num canto
    // era o mesmo aviso duas vezes — a pessoa lia um e procurava o outro à espera de que
    // dissessem coisas diferentes.
    expect(semComentarios(editor)).not.toContain('texto: rotuloDaGuia(gerando)');
  });

  // ⚠️ A GUIA DIZ QUANTO JÁ ANDOU. Codificar MP3 é JavaScript sobre cada amostra: aqui são
  // segundos, no telemóvel foram medidos 101 para 227 de áudio. Reticências paradas durante um
  // minuto e meio são indistinguíveis de uma tela pendurada — e quem espera fecha o aplicativo,
  // que é o gesto que perde o trabalho. O texto mora no núcleo porque as duas telas o escrevem.
  it('a guia diz a percentagem, e o X espera por ela', () => {
    const corpo = semComentarios(editor);
    const espaco = semComentarios(tela);

    expect(corpo).toContain('const aGerar = gerando != null;');
    // O X trava enquanto isso, e explica-se: é a única coisa que responde "por que não fechou".
    expect(corpo).toContain('disabled={aGerar}');
    expect(corpo).toContain("title={aGerar ? rotuloDaGuia(gerando) : 'Voltar para Músicas'}");
    // E a percentagem vem do próprio codificador, e não de um relógio a fingir progresso.
    expect(espaco).toContain('await paraMp3(rendido, setGerando)');
    // ⚠️ Antes do codificador vem a SOMA das faixas, que não sabe dizer quanto falta: até
    // haver um número de verdade, o rótulo é só texto. Um "0%" parado é uma tela pendurada.
    expect(espaco).toContain('setGerando(Number.NaN);');
    // Sair espera pela guia: é o que faz a lista de Músicas tocar a soma da montagem.
    expect(espaco).toContain('await gerarGuia(open);');
  });

  // ⚠️ DUAS PESSOAS NA MESMA MÚSICA. O canal é do NÚCLEO e é UM SÓ para as duas coisas —
  // presença e mudanças da montagem —, porque quem quer ver os avatares é exatamente quem quer
  // ver a montagem mexer-se. Dois canais seriam dois sockets e duas reconexões por nada.
  it('as duas telas assinam o mesmo canal, e marcam as próprias escritas', () => {
    const espaco = semComentarios(tela);
    const oApp = semComentarios(app);

    [espaco, oApp].forEach((fonte) => {
      expect(fonte).toContain("from '@maestra/core/hooks/useJamAoVivo'");
      expect(fonte).toContain('useJamAoVivo(');
      // ⚠️ MARCAR ANTES DE ESCREVER: é isto que impede o clipe de saltar para trás debaixo do
      // dedo quando o meu próprio arrasto volta do Postgres meio segundo depois.
      expect(fonte).toContain('assinaturaDoClipe(');
      expect(fonte).toContain('assinaturaDaPista(');
      // Um UPDATE remenda sem ir ao servidor; o que é novo recarrega.
      expect(fonte).toContain("if (decisao.faca === 'remendarPista')");
      expect(fonte).toContain("if (decisao.faca !== 'remendarClipe') return;");
    });

    // E o arrasto marca-se com a faixa de destino, senão mudar de faixa parecia coisa de outra
    // pessoa e voltava atrás.
    expect(espaco).toContain("minhoClipe(clipeId, { start_seconds: inicio, ...(pista ? { track_id: pista.para } : {}) });");
    expect(oApp).toContain("minhoClipe(clipeId, { start_seconds: inicio, ...(pista ? { track_id: pista.para } : {}) });");
  });

  // Os avatares respondem uma pergunta só — "estou sozinho nesta música?" — e por isso não
  // existem quando a resposta é sim: o meu próprio avatar sozinho é ruído permanente.
  it('os avatares de quem está aqui só aparecem a partir de dois, nas duas telas', () => {
    const corpo = semComentarios(editor);
    const oApp = semComentarios(app);

    expect(corpo).toContain('if (presentes.length < 2) return null;');
    expect(oApp).toContain('{aoVivo.presentes.length > 1 && (');
    // O mesmo número de círculos e a mesma sobra, porque é o mesmo desenho.
    expect(corpo).toContain('const AVATARES_A_MOSTRAR = 3;');
    expect(oApp).toContain('const AVATARES_A_MOSTRAR = 3;');
    // E a inicial vem do núcleo: um nome só com espaços não pode dar um círculo vazio.
    [corpo, oApp].forEach((fonte) => expect(fonte).toContain('iniciais(pessoa.nome)'));
  });

  // ⚠️ COM DUAS PESSOAS, DUAS COISAS DEIXAM DE SER INOFENSIVAS. A pilha do desfazer é de cada
  // um — só entra nela o que EU fiz —, e o perigo nunca foi desfazer o passo do outro: é
  // desfazer o MEU por cima do que ele fez a seguir. E a limpeza da saída apagava de vez tudo o
  // que estivesse marcado nesta gravação, incluindo o que ele ainda pode trazer de volta.
  it('a seta não vai por cima do outro, e a saída leva só o que é meu', () => {
    const espaco = semComentarios(tela);
    const oApp = semComentarios(app);

    [espaco, oApp].forEach((fonte) => {
      // A seta confere o mundo ANTES de escrever, e contra o que se vê — que com o canal ao
      // vivo ligado é o banco a menos de um segundo.
      expect(fonte).toContain('conferirOPasso(saida.passo, {');
      // O passo caduco sai da pilha: repeti-lo dava exatamente o mesmo.
      expect(fonte).toContain('setHistorico(saida.historico);');
      // E a saída leva a lista desta sessão, em vez de tudo o que está marcado.
      expect(fonte).toContain('marcadosPorMim.current');
      expect(fonte).toContain('apenas:');
      // Desfazer um "apagar" tira-o da lista: ele já não é resíduo meu.
      expect(fonte).toContain('(voltando ? desmarquei : marquei)(passo.clipeId);');
    });
  });

  // ⚠️ O X PERGUNTA, E NÃO DECIDE. Gerar a guia é o certo para quem acabou de montar — é o que
  // faz a lista de Músicas tocar o que se fez — e custa um minuto e meio no aparelho a quem
  // entrou só para ouvir e mexeu num fader. Quem sabe qual dos dois é, é quem está lá.
  it('fechar pergunta pela guia, com as mesmas palavras nas duas telas', () => {
    const espaco = semComentarios(tela);
    const oApp = semComentarios(app);
    const aTelaDaWeb = semComentarios(fechar);
    const aTelaDoApp = semComentarios(fecharNoApp);

    // Sem nada por gravar não há pergunta: ela seria uma porta a mais no caminho de sair.
    expect(espaco).toContain('if (sujo.current && podeEditar) setPerguntandoDaGuia(true); else void sair();');
    expect(oApp).toContain('if (sujo.current && podeEditar && aberta) setPerguntandoDaGuia(true);');

    // ⚠️ AS PALAVRAS SÃO DO NÚCLEO. Uma pergunta que muda de texto conforme o aparelho é duas
    // perguntas diferentes — e a que fica sem o preço de "só fechar" engana quem a lê.
    [aTelaDaWeb, aTelaDoApp].forEach((fonte) => {
      expect(fonte).toContain('PERGUNTA_DA_GUIA.titulo');
      expect(fonte).toContain('PERGUNTA_DA_GUIA.gerar');
      expect(fonte).toContain('PERGUNTA_DA_GUIA.sair');
      expect(fonte).toContain('PERGUNTA_DA_GUIA.ficar');
      // A espera ganha da pergunta: quem já escolheu gerar não vê a pergunta por baixo.
      expect(fonte).toContain('if (gerando != null)');
      expect(fonte).toContain('rotuloDaGuia(gerando)');
      // A mão vem do núcleo, repintada com as cores do sistema — e uma vez só.
      expect(fonte).toContain('pintarALottie(ANIMACAO_DA_GUIA, CORES_DA_ANIMACAO)');
    });

    // ⚠️ NA WEB, O `lottie-web` ENTRA TARDE — dentro do efeito, e não no topo do ficheiro. Ele
    // desenha num canvas assim que é carregado, e debaixo do jsdom isso rebenta: com o import no
    // topo, QUALQUER teste da web que importasse o editor morria antes de correr um caso. De
    // lambuja, são 250 kB fora do pacote inicial de quem nunca fecha o Espaço JAM.
    expect(aTelaDaWeb).toContain("import('lottie-web')");
    expect(aTelaDaWeb).not.toContain("import lottie");
  });

  // ⚠️ A GUIA É REGRAVADA NO MESMO CAMINHO A CADA SAÍDA, e é o que a lista de Músicas toca. Uma
  // montagem que renderize mudo — todas as pistas caladas, um áudio que não chegou a
  // descodificar — apagaria a guia boa e deixaria a música sem nada para tocar, sem erro nenhum
  // a explicar porquê. Entre gravar silêncio e não gravar, não gravar é sempre melhor.
  it('uma montagem muda não grava por cima da guia que estava lá', () => {
    const espaco = semComentarios(tela);
    const oApp = semComentarios(app);

    // A trava vem ANTES do codificador: nem vale a pena gastar o MP3 de uma coisa que não soa.
    const aGuia = espaco.slice(espaco.indexOf('const gerarGuia'));
    const ateOCatch = aGuia.slice(0, aGuia.indexOf('} catch {'));
    expect(ateOCatch).toContain('if (!temSom(rendido)) { message.warning(MONTAGEM_MUDA); return; }');
    expect(ateOCatch.indexOf('temSom(')).toBeLessThan(ateOCatch.indexOf('paraMp3('));

    // E o mesmo no aparelho, com a mesma frase — o núcleo é que a escreve — e também antes do
    // codificador, que lá custa um minuto e meio.
    const aGuiaDoApp = oApp.slice(oApp.indexOf('const gerarAGuia'));
    const ateOCatchDoApp = aGuiaDoApp.slice(0, aGuiaDoApp.indexOf('} catch {'));
    expect(ateOCatchDoApp).toContain('if (!temSom(rendido)) { Alert.alert(');
    expect(ateOCatchDoApp).toContain('MONTAGEM_MUDA');
    expect(ateOCatchDoApp.indexOf('temSom(')).toBeLessThan(ateOCatchDoApp.indexOf('bytesDoMp3('));
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
    expect(regra).toContain('right: 132px');
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

    // ⚠️ O QUE MUDA É A MÃO, NÃO O QUE SE PODE FAZER. Isto já travou o clipe inteiro no
    // telemóvel: primeiro levou à frente a barra de ações (dividir e remover são botões, não
    // se carregam por acidente), depois ficou a travar o arrasto mesmo depois de escolhido.
    // Só o duplo-toque que apaga continua de fora, por um motivo que não muda com a tela.
    it('com o dedo o clipe arrasta depois de escolhido, e divide e remove pelos botões', () => {
      const oClipe = semComentarios(clipe);

      expect(corpo).toContain('noDedo={noCelular}');
      // Escolher primeiro: no mesmo ecrã o arrasto horizontal já é o gesto de rolar, e sem um
      // sinal de intenção cada tentativa de percorrer a música mexia num clipe pelo caminho.
      expect(oClipe).toContain('const podeArrastar = !fixo && (!noDedo || selecionado);');
      expect(oClipe).toContain('if (podeArrastar) aoArrastar(evento);');
      // Enquanto não arrasta, o dedo em cima do clipe tem de continuar a rolar a montagem.
      expect(oClipe).toContain("touchAction: podeArrastar ? 'none' : 'auto'");

      // O duplo-toque que apaga é o único gesto que o dedo não tem.
      expect(oClipe).toContain('const semGesto = fixo || noDedo;');
      expect(oClipe).toContain('if (!semGesto) aoApagar();');

      // A barra e a tesoura olham para `fixo`: só a Mix é que não se edita de forma nenhuma.
      expect(oClipe).toContain('{selecionado && !fixo && (');
      expect(oClipe).toContain('const podeCortar = !fixo &&');

      // ⚠️ `noDedo` NÃO é `fixo`: fixo é a pista da Mix, e troca o rótulo do clipe para
      // "Mix".
      expect(oClipe).toContain("{fixo ? 'Mix' :");
    });

    // ⚠️ O ARRASTO NUNCA CHEGAVA A ACONTECER, e não era por regra nenhuma: num ecrã de toque o
    // rato só é imitado DEPOIS de o dedo levantar, e nunca em série. Entre pousar e levantar
    // não havia um único `mousemove` — nem para mexer o clipe, nem para arrastar a agulha.
    it('os gestos da montagem são de ponteiro, e não de rato', () => {
      const oClipe = semComentarios(clipe);

      expect(oClipe).toContain('onPointerDown={(evento) => {');
      expect(oClipe).toContain('onPointerMove={(evento) =>');
      expect(oClipe).not.toContain('onMouseDown');
      expect(oClipe).not.toContain('onMouseMove');

      expect(corpo).toContain('onPointerMove={aoMover}');
      expect(corpo).toContain('onPointerUp={aoLargar}');
      // O sistema pode levar o gesto (uma chamada, o gesto de voltar): sem isto o clipe ficava
      // colado a um dedo que já não existe.
      expect(corpo).toContain('onPointerCancel={aoLargar}');
      expect(corpo).toContain('const aoMover = (evento: React.PointerEvent)');
      expect(corpo).toContain('const aoLargar = (evento: React.PointerEvent)');

      // A régua e a agulha também: levar a agulha é o primeiro tempo de dividir.
      expect(corpo).toContain('onPointerDown={(evento) => { agulhaPresa.current = true;');
      expect(corpo).toContain('onPointerDown={() => { agulhaPresa.current = true; }}');
      expect(corpo.match(/touchAction: 'none'/g)).toHaveLength(2);

      // E a permissão de arrastar deixou de olhar para o tamanho do ecrã: isso é do clipe.
      expect(corpo).toContain('if (!podeEditar || faixa.id === pistaFixaId) return;');
    });

    // ⚠️ ESCOLHER O PONTO DO CORTE NÃO PODE FECHAR A BARRA. Dividir é em dois tempos: leva-se
    // a agulha para dentro do clipe e só depois se corta. Enquanto tocar na régua contava como
    // "clicou fora", o primeiro tempo desfazia o segundo.
    it('mexer na agulha não larga o clipe selecionado', () => {
      const oClipe = semComentarios(clipe);

      expect(oClipe).toContain("alvo?.closest('[data-agulha]')");
      // Ao toque o rato só é imitado depois de o dedo levantar: até lá a barra ficava aberta.
      expect(oClipe).toContain("document.addEventListener('pointerdown', fora)");
      expect(oClipe).toContain("document.removeEventListener('pointerdown', fora)");

      // E as duas coisas que movem a agulha estão marcadas: a régua e a própria agulha.
      expect(corpo.match(/data-agulha=''/g)).toHaveLength(2);
    });

    // Por cima do clipe (onde ela fica no desktop) a barra da PRIMEIRA pista saía pelo topo da
    // área que rola: ficava cortada pela régua, ou invisível.
    it('a barra do clipe cabe dentro dele, com alvos de dedo', () => {
      const oClipe = semComentarios(clipe);

      // ⚠️ SEMPRE DENTRO, EM BAIXO À ESQUERDA. Por cima do clipe, a barra da primeira pista
      // saía pelo topo da área que rola. É onde o app a pôs, e ali serve aos dois.
      expect(oClipe).toContain('bottom: 6, left: 6,');
      expect(oClipe).not.toContain('top: -38');
      expect(oClipe).toContain('noDedo ? { width: 34, height: 34 }');
      // Nos dois botões: um alvo de 26 px acerta-se com o rato e falha-se com o polegar.
      expect(oClipe.match(/\.\.\.alvo,/g)).toHaveLength(2);
    });

    // ⚠️ SÓ OS ÍCONES. "DIVIDIR" e "REMOVER" somavam 190 px de barra por cima de um clipe que
    // muitas vezes mede menos do que isso — e num clipe estreito ela saía pelos dois lados, a
    // tapar os vizinhos. O nome continua no `title` e no `aria-label`.
    it('os botões do clipe são ícones, e não palavras', () => {
      const oClipe = semComentarios(clipe);

      // O texto do botão, e não a palavra em qualquer sítio: ela continua a aparecer no
      // comentário que explica por que ela saiu.
      expect(oClipe).not.toMatch(/\/>\s*DIVIDIR/);
      expect(oClipe).not.toMatch(/\/>\s*REMOVER/);
      expect(oClipe).toContain('<FiScissors size={13} />');
      expect(oClipe).toContain('<FiTrash2 size={13} />');
      expect(oClipe).toContain("aria-label='Dividir o clipe na agulha'");
      expect(oClipe).toContain("aria-label='Remover o clipe'");
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

  // ⚠️ OS DESENHOS SÃO OS MESMOS NAS DUAS SUPERFÍCIES, À VÍRGULA. O arquivo do app já dizia
  // isto num comentário, e um comentário não segura nada: o ícone de pôr áudio na pista foi
  // trocado e nada obrigava a segunda tela a ser trocada também. O editor é A MESMA tela nos
  // dois sítios; dois desenhos parecidos mas não iguais são lidos como dois produtos.
  //
  // Compara o que o traço DESENHA — os caminhos e os quadros —, e não o ficheiro: um usa
  // `stroke="currentColor"` e o outro uma cor recebida, um escreve `<path>` e o outro `<Path>`.
  it('os ícones do editor são os mesmos desenhos nas duas telas', () => {
    // ⚠️ COMPARA A FIGURA INTEIRA, e não só os `d=`. A primeira versão deste teste olhava para
    // os caminhos, e o cartão do ícone de áudio é um `<rect>`: dava para deixar o app com o
    // retângulo noutro sítio sem que nada se queixasse.
    const desenho = (fonte: string) => (semComentarios(fonte)
      // `x={1}` na web é `x="1"` no app — a chave é do JSX, e não do desenho. E `<Path>` do
      // `react-native-svg` é o `<path>` do navegador.
      .replace(/=\{([^}]*)\}/g, '="$1"')
      .toLowerCase()
      .match(/<(?:svg|path|rect|circle|line|polygon|polyline|ellipse)[^>]*>/g) ?? [])
      // A cor é a única coisa que muda de propósito: a web herda-a do CSS, o app recebe-a.
      .map((figura) => figura
        .replace(/stroke="[^"]*"/g, '').replace(/fill="[^"]*"/g, '')
        .replace(/aria-hidden/g, '').replace(/\s+/g, ' '))
      .sort();

    expect(desenho(icones).length).toBeGreaterThanOrEqual(8);
    expect(desenho(iconesNoApp)).toEqual(desenho(icones));
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

  // ⚠️ "+ ADICIONAR FAIXA" CRIA A FAIXA, E NÃO PEDE UM FICHEIRO. Ele abria o seletor, e com
  // isso não havia como preparar a montagem — voz, guitarra, bateria — antes de ter o áudio de
  // cada uma. Encher a faixa é o outro botão, o de enviar, que vive na própria faixa.
  it('adicionar faixa cria a faixa vazia, e o ficheiro vem pelo botão da faixa', () => {
    const corpo = semComentarios(editor);
    const espaco = semComentarios(tela);

    expect(corpo).toContain('onClick={() => acoes.aoCriarPista()}');
    expect(corpo).not.toContain('escolherPara(null)');
    // O seletor sobrou para o outro gesto: um ficheiro NUMA faixa que já existe.
    expect(corpo).toContain('onClick={() => escolherPara(faixa.id)}');

    // E a faixa nasce mesmo vazia: uma linha em `catalog_tracks` e nenhum clipe.
    // ⚠️ LIDO DENTRO DA AÇÃO, e não no ficheiro inteiro: "montar a mix primeiro" também existe
    // no ENVIO de ficheiros, e procurá-lo no ficheiro todo dava um teste que passava com a
    // linha apagada daqui.
    const aCriacao = espaco.slice(espaco.indexOf('aoCriarPista: () => {'));
    const ateOFim = aCriacao.slice(0, aCriacao.indexOf('} catch {'));

    expect(espaco).toContain('aoCriarPista: () => {');
    expect(ateOFim).toContain('await catalogDb.createTrack({');
    expect(ateOFim).toContain('name: nomeDaPistaNova(pistas.map((p) => p.name)),');
    // ⚠️ A PRÓXIMA POSIÇÃO, e não a contagem: apanhado no produto, numa gravação cuja única
    // faixa estava em `position: 1`. A faixa nova nasceu empatada com ela.
    expect(ateOFim).toContain('position: proximaPosicaoDaPista(pistas.map((p) => p.position)),');
    // ⚠️ A Mix primeiro, se a gravação nunca foi montada: ela só existe enquanto não há pistas
    // nenhumas, e a primeira faixa à mão fá-la-ia sair de cena com o áudio dentro.
    expect(ateOFim).toContain('if (porMontar) await montarAMix();');
    expect(ateOFim.indexOf('montarAMix()')).toBeLessThan(ateOFim.indexOf('createTrack('));
    // E o desfazer tem para onde voltar.
    expect(ateOFim).toContain("anotar({ tipo: 'acrescentarPistas', pistaIds: [nascida.id] });");
  });

  // ⚠️ ARRASTAR UM CLIPE ENTRE FAIXAS NÃO EXISTIA: o arrasto só olhava para o eixo do tempo, e
  // mover a voz da faixa errada para a certa obrigava a apagar o clipe e a enviar o ficheiro
  // outra vez.
  it('o clipe arrasta também para cima e para baixo, e a escrita leva a faixa', () => {
    const corpo = semComentarios(editor);
    const espaco = semComentarios(tela);

    // O índice sai da PILHA, e não da posição do rato na página: a montagem rola e o cabeçalho
    // é `sticky`. A decisão do resto é do núcleo, que é a mesma no app.
    expect(corpo).toContain('const pilha = pilhaDasPistas.current;');
    expect(corpo).toContain('pistaAlvoDoArrasto(');
    // A faixa muda DURANTE o gesto: é o que faz o clipe seguir a mão de linha em linha.
    expect(corpo).toContain('acoes.aoMoverClipe(puxado.clipeId, inicio, undefined, alvo ? { para: alvo } : undefined);');
    // E quem o pegou lembra-se da faixa de onde ele saiu.
    expect(corpo).toContain('pistaId: faixa.id,');

    // A tela tira o clipe de uma faixa e põe-no noutra numa passagem só: em dois `setProject`,
    // o render do meio via uma montagem sem o clipe, e a mesa descartava o buffer.
    expect(espaco).toContain('const moverClipeDePista = (clipeId: string, pistaId: string) =>');
    expect(espaco).toContain('...(pista ? { track_id: pista.para } : {}),');
    // E o desfazer devolve o clipe à faixa de onde veio, e não só ao segundo.
    expect(espaco).toContain('? { track_id: voltando ? passo.dePista : passo.paraPista }');
  });

  // ⚠️ O EDITOR TEM O SEU PRÓPRIO SELETOR DE FICHEIROS. O envio para uma faixa procurava o
  // botão da BIBLIOTECA pelo `aria-label` e clicava nele por baixo do pano. Enquanto ela estava
  // sempre aberta aquilo passou; desde que ela recolhe, o botão deixa de existir no DOM, o
  // `?.` engole a chamada, e carregar nele não fazia absolutamente nada.
  it('enviar para uma faixa abre o seletor do próprio editor', () => {
    const corpo = semComentarios(editor);

    // Nada de alcançar dentro de outro componente por texto de rótulo.
    expect(corpo).not.toContain('[aria-label="Escolher arquivos"]');
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
    expect(corpo).toContain('Arme primeiro a faixa onde quer gravar');

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

  // ⚠️ O BPM NÃO FAZIA NADA NA TELA. Escrevia-se um número no rodapé, ele ia para o banco e
  // para a ficha, e a montagem continuava marcada em segundos — com o clipe a encaixar de
  // quarto em quarto de segundo, que não é unidade musical nenhuma.
  it('a régua conta compassos quando há andamento, e o clipe encaixa no tempo', () => {
    const corpo = semComentarios(editor);

    // O andamento chega cru ao editor: quem decide se aquilo é um andamento é a grelha.
    expect(semComentarios(tela)).toContain('bpm={open?.bpm}');
    expect(corpo).toContain('const grade = useMemo(() => gradeDoCompasso(bpm, escala)');

    // ⚠️ UMA LISTA SÓ para a régua e para as linhas das pistas: enquanto cada uma contava por
    // sua conta, bastava mexer numa para o número deixar de assentar na linha que nomeia.
    expect(corpo.match(/\{marcas\.map\(\(marca\) => \(/g)).toHaveLength(2);
    expect(corpo).not.toContain('Math.floor(duracao / passo) + 1');

    // E o encaixe deixou de ser o quarto de segundo fixo: segue a grelha e o zoom.
    expect(corpo).toContain('const passoDoEncaixe = useMemo(() => encaixeDaGrade(grade, escala)');
    expect(corpo.match(/passoDoEncaixe\) \* passoDoEncaixe/g)).toHaveLength(3);
    expect(corpo).not.toContain('/ ENCAIXE) * ENCAIXE');
  });

  // ⚠️ A AGULHA FURAVA A GAVETA. A escada de dentro da montagem (régua 10, coluna 11, canto 12,
  // agulha 100) foi escrita para os seus pedaços se ordenarem ENTRE SI — mas sem isolamento
  // esses números subiam ao contexto da tela e disputavam com a biblioteca, que está em 30. E
  // 100 ganha de 30: com a gaveta aberta no telemóvel, a linha vermelha do tempo aparecia
  // desenhada por cima do painel inteiro.
  it('a montagem é uma camada só, e a agulha não fura a biblioteca', () => {
    const corpo = semComentarios(editor);

    expect(corpo).toContain("isolation: 'isolate'");
    // Isolamento, e não um número: o que se quer não é pôr a montagem num degrau, é dizer que
    // os degraus dela são assunto dela. Subir a gaveta acima de 100 resolveria este caso e
    // deixaria o próximo igual.
    expect(corpo).toContain("position: 'absolute', inset: 0, zIndex: 30");
    expect(corpo).toContain('zIndex: 100');

    // E a escada continua escrita onde se procura por ela.
    expect(casca).toContain('100  a agulha');
    expect(casca).toContain('isolation: isolate');
  });

  // ⚠️ O DETECTOR VIVIA ESCONDIDO NA FICHA, atrás de um botão que era preciso descobrir. No
  // Espaço JAM ele acontece por conta própria, porque o andamento é o que faz a régua contar
  // compassos — e pedir que se digite um número que a máquina consegue ouvir é trabalho que
  // não devia existir.
  it('o andamento é ouvido sozinho, uma vez, e só enche campo vazio', () => {
    const corpo = semComentarios(tela);

    // As regras de QUANDO vivem no núcleo, e a tela só as consulta.
    expect(corpo).toContain('podeOuvirSozinho({');
    expect(corpo).toContain("void analiseDoJam.pedir('bpm_tom');");

    // ⚠️ SÓ SE PREENCHE O QUE SE PEDIU. Sem esta memória, quem apagou o BPM de propósito
    // reencontrava-o preenchido na recarga seguinte: a análise antiga continua no banco, e
    // "campo vazio + análise existe" descreve tanto o primeiro envio como o gesto de o
    // esvaziar.
    expect(corpo).toContain('esperandoOAndamento.current = true;');
    expect(corpo).toContain('if (!esperandoOAndamento.current || !openId) return;');
    // Um que já estava a correr quando a tela abriu conta como pedido, e não pede outro.
    expect(corpo).toContain("if (analiseDoJam.emCurso('bpm_tom')) { esperandoOAndamento.current = true; return; }");

    // E mesmo com a análise na mão, o campo escrito à mão ganha: a análise demora minutos, e
    // nesses minutos a pessoa pode ter escrito o andamento.
    const oPreenchimento = corpo.slice(corpo.indexOf('esperandoOAndamento.current = false;'));
    const ateOFim = oPreenchimento.slice(0, oPreenchimento.indexOf('mudarGravacao({ bpm: detectado })'));
    expect(ateOFim.length).toBeGreaterThan(40);
    expect(ateOFim).toContain('if (bpmLegivel(open?.bpm)) return;');

    // A proveniência só é verdadeira enquanto o campo tiver exatamente o que a máquina ouviu:
    // escrito por cima, o número passa a ser de quem o escreveu, e a marca sai.
    expect(corpo).toContain('ouvido={ouvido !== null && Number(bpmLegivel(open?.bpm)) === ouvido}');

    // A troca de oitava obedece à mesma condição.
    expect(corpo).toContain('outroAndamento(ouvido)');
    expect(corpo).toContain('aria-label={`Trocar para ${alternativa} BPM`}');
  });

  // ⚠️ "FALHA AO SALVAR" LOGO A SEGUIR A APAGAR COM SUCESSO. Tocar num clipe agendava a
  // gravação da posição dele; carregar em REMOVER apagava a linha, e meio segundo depois a
  // escrita adiada chegava a um `id` que já não existia. O clipe sumia (porque foi mesmo
  // removido) e a tela dizia que tinha falhado — um erro vermelho para a única operação da
  // sequência que tinha corrido bem.
  it('apagar cancela o que estava a caminho, e um toque não conta como arrasto', () => {
    const corpo = semComentarios(editor);
    const espaco = semComentarios(tela);

    // A raiz: só se grava a posição de um clipe que MUDOU de sítio.
    expect(corpo).toContain(
      'if (!trocouDePista && Math.abs(destino - puxado.inicio) < 0.001) return;',
    );
    expect(corpo).toContain('inicio: Number(clipe.start_seconds) || 0,');

    // E o que já estava agendado morre com a linha que ele ia atualizar.
    expect(espaco).toContain('esquecer(`clipe:${clipeId}`);');
    expect(espaco).toContain('esquecer(`pista:${pistaId}`);');
    expect(espaco).toContain(
      '(pistas.find((p) => p.id === pistaId)?.clips || []).forEach((c) => esquecer(`clipe:${c.id}`));',
    );

    // ⚠️ E a rede por baixo de tudo: uma linha que já não existe não é uma falha de escrita.
    // Sem isto, a mesma corrida com outra pessoa na mesma gravação daria o mesmo erro inventado.
    const banco = semComentarios(
      fs.readFileSync(path.join(__dirname, '..', '..', 'packages', 'core', 'src', 'services', 'db', 'catalog.ts'), 'utf8'),
    );
    expect(banco).toContain("Promise<CatalogClip | null>");
    expect(banco).toContain("Promise<CatalogTrack | null>");
    expect(banco.match(/\.eq\('id', id\)\.select\('\*'\)\.maybeSingle\(\)/g)).toHaveLength(2);
  });

  // ⚠️ APAGAR PASSOU A SER EM DOIS TEMPOS: marcar agora, apagar de verdade ao fechar. É o que
  // dá às duas setas alguma coisa para onde voltar — e o que impede a linha do tempo de ser um
  // sítio onde ninguém experimenta.
  it('apagar marca em vez de apagar, e o fecho da sessão leva o resíduo', () => {
    const espaco = semComentarios(tela);
    const banco = semComentarios(
      fs.readFileSync(path.join(__dirname, '..', '..', 'packages', 'core', 'src', 'services', 'db', 'catalog.ts'), 'utf8'),
    );

    // A tela marca; quem apaga de verdade é a purga.
    expect(espaco).toContain('catalogDb.marcarClipeApagado(clipeId)');
    expect(espaco).toContain('catalogDb.marcarPistaApagada(pistaId)');
    expect(espaco).not.toContain('catalogDb.deleteClip(');
    expect(espaco).not.toContain('catalogDb.deleteTrack(');

    // ⚠️ E O MARCADO NÃO CHEGA À TELA: o filtro é no servidor, senão o lixo viaja pela rede em
    // cada leitura de uma sessão longa de edição.
    expect(banco).toContain(".is('versions.tracks.deleted_at', null)");
    expect(banco).toContain(".is('versions.tracks.clips.deleted_at', null)");

    // Os dois momentos da limpeza, com a mesma função.
    // A saída leva o que ESTA sessão marcou, e não tudo o que está marcado na gravação: o que
    // é do outro continua lá enquanto ele ainda o pode desfazer.
    expect(espaco).toContain('catalogDb.purgarMontagem(open.id, { apenas: meus })');
    expect(espaco).toContain('antesDe: new Date(Date.now() - UMA_HORA).toISOString()');

    // ⚠️ O ficheiro órfão sai junto: até aqui ele ficava no balde para sempre, invisível, sem
    // tela que o listasse ou removesse.
    expect(banco).toContain('purgarArquivosOrfaos');
    expect(banco).toContain('removerArquivo(BALDE_DO_CATALOGO, caminho)');
  });

  // ⚠️ E A CORRIDA QUE O DESFAZER CRIARIA: a escrita adiada do arrasto ia gravar a posição nova
  // meio segundo depois de a mão parar. Desfazer nessa janela escreveria a antiga e, logo a
  // seguir, a adiada punha o clipe de volta — a seta parecia não funcionar.
  it('as setas cancelam o que estava adiado, e uma de cada vez', () => {
    const espaco = semComentarios(tela);
    const corpo = semComentarios(editor);

    expect(espaco).toContain("esquecer(`clipe:${passo.clipeId}`);");
    expect(espaco).toContain('if (andandoNoTempo) return;');
    // A pilha só anda se a escrita passou: movê-la antes deixaria o histórico a mentir.
    // ⚠️ A PARTIR DA TRANCA, e não do princípio da função: desde que a seta confere o mundo
    // antes de escrever, há um `setHistorico` ANTES do `try` — o do passo que caducou, que sai
    // da pilha sem nada ter ido ao banco. Medido do princípio, o teste encontrava esse e dizia
    // que a ordem estava trocada quando ela não estava.
    const oAndar = espaco.slice(espaco.indexOf('setAndandoNoTempo(true);'));
    const ateOCatch = oAndar.slice(0, oAndar.indexOf('} catch {'));
    expect(ateOCatch.length).toBeGreaterThan(80);
    expect(ateOCatch.indexOf('await aplicarPasso')).toBeLessThan(ateOCatch.indexOf('setHistorico(saida.historico)'));

    // Um passo por GESTO, e não por pixel: o `de` só chega quando a mão largou.
    expect(corpo).toContain('acoes.aoMoverClipe(\n      puxado.clipeId, destino, puxado.inicio,');
    expect(espaco).toContain("tipo: 'mover', clipeId, de, para: inicio,");

    // ⚠️ E o atalho não rouba o Ctrl+Z de quem está a escrever num campo.
    expect(corpo).toContain('alvo?.closest(\'input, textarea, [contenteditable="true"]\')');
  });

  // ⚠️ AS SETAS SAÍRAM DO TRANSPORTE. Ali competiam com o play — o botão que se procura sem
  // olhar — e empurravam o relógio num ecrã de 390. Foram para a coluna dos flutuantes, que é
  // onde este editor já põe o que acompanha a montagem sem fazer parte dela.
  it('as setas flutuam por cima do "?", com o desfazer mais perto da mão', () => {
    const corpo = semComentarios(editor);

    expect(corpo).toContain('className={casca.setas}');
    expect(corpo).toContain('bottom: ALTURA_DO_RODAPE + 12 + 38');
    // A coluna inverte o desenho, e não o HTML: a ordem que o teclado percorre continua a ser
    // desfazer e depois refazer.
    expect(casca).toContain('flex-direction: column-reverse');
    const asSetas = corpo.slice(corpo.indexOf('className={casca.setas}'));
    expect(asSetas.indexOf("'desfazer'")).toBeLessThan(asSetas.indexOf("'refazer'"));

    // E já não estão na barra do transporte.
    const oTransporte = corpo.slice(corpo.indexOf("aria-label='Voltar ao início'"));
    const ateOPlay = oTransporte.slice(0, oTransporte.indexOf('transporte.alternar'));
    expect(ateOPlay.length).toBeGreaterThan(100);
    expect(ateOPlay).not.toContain('FiCornerUpLeft');
  });

  // ⚠️ O VOCABULÁRIO DA TELA É "FAIXA". "Pista" continua a ser o nome das coisas no código, mas
  // quem monta uma música fala em faixas — e a biblioteca já dizia "arrastar um deles para uma
  // faixa" enquanto a coluna ao lado dizia PISTAS.
  it('a tela fala em faixas', () => {
    const corpo = semComentarios(editor);

    expect(corpo).toContain('FAIXAS');
    expect(corpo).toContain('+ Adicionar faixa');
    expect(corpo).toContain("aria-label='Adicionar faixa'");
    expect(corpo).toContain("{pistas.length === 1 ? 'faixa' : 'faixas'}");
    expect(corpo).toContain('`Apagar a faixa ${faixa.name}`');

    // Nenhuma das frases antigas ficou para trás — nem as que só aparecem num aviso.
    for (const antiga of [
      '+ Adicionar pista', "aria-label='Adicionar pista'",
      "'Preparando as pistas'", 'Apagar a pista', 'pelo botão da pista',
    ]) {
      expect(corpo).not.toContain(antiga);
    }
    expect(semComentarios(tela)).not.toContain('enviar as pistas');
    expect(semComentarios(biblioteca)).not.toContain('como pista');
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
