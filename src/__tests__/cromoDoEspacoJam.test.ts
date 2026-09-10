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

    it('abre na Mesa, e não na linha do tempo', () => {
      // Montar é trabalho de mouse; o que o dedo faz bem é ouvir e mexer nos níveis.
      expect(corpo).toContain("window.innerWidth < 768 ? 'mesa' : 'linha'");
    });

    it('a biblioteca é gaveta, e não uma coluna de 256 px', () => {
      expect(corpo).toContain('bibliotecaAberta');
      expect(corpo).toContain('setBibliotecaAberta(true)');
      expect(corpo).toContain("aria-label='Fechar a biblioteca'");
      // Sobreposta, e não encaixada: é isso que devolve a largura toda à montagem.
      expect(corpo).toContain("position: 'absolute', inset: 0, zIndex: 30");
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

    // E o quadro dos desenhados é recortado no traço, e não o 41×41 do ficheiro.
    const quadros = semComentarios(icones).match(/viewBox="[^"]+"/g) ?? [];
    expect(quadros).toHaveLength(2);
    quadros.forEach((q) => expect(q).not.toContain('0 0 41 41'));
  });

  // O TRANSPORTE: play e pause são o mesmo botão a alternar, e o REC arma antes de gravar.
  it('play e pause são o mesmo botão, e o brilho diz quando está a andar', () => {
    const corpo = semComentarios(editor);

    // Um botão só, que troca de ícone: dois botões separados fariam a barra mudar de forma a
    // cada toque, e o gesto é o mesmo.
    expect(corpo).toContain('estado.tocando ? <FiPause size={18} /> : <FiPlay size={18}');
    // A cor NÃO muda entre tocar e pausar — o que muda é o brilho.
    expect(corpo).toContain('estado.tocando ? `0 0 0 4px ${DS.color.primaria}33');
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
