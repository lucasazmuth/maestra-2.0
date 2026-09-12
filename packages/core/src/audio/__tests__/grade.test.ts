import {
  BPM_MAXIMO, BPM_MINIMO, ENCAIXE_SEM_ANDAMENTO, TEMPOS_POR_COMPASSO,
  FOLGA_DA_AGULHA,
  encaixeDaGrade, gradeDoCompasso, marcasDaRegua, passoDaVista, rolagemQueCentra,
} from '../grade';

// O BPM NÃO FAZIA NADA NA TELA.
//
// Escrevia-se um número no rodapé, ele ia para o banco e para a ficha, e a montagem continuava
// marcada em segundos — com o clipe a encaixar de quarto em quarto de segundo, que não é uma
// unidade musical de coisa nenhuma. Num editor o andamento é o que transforma "arrastar até
// parecer certo" em "largar no tempo".

describe('gradeDoCompasso', () => {
  it('120 BPM dá meio segundo por tempo e dois por compasso', () => {
    const grade = gradeDoCompasso(120, 60);
    expect(grade?.segundosPorTempo).toBeCloseTo(0.5, 9);
    expect(grade?.segundosPorCompasso).toBeCloseTo(2, 9);
    expect(TEMPOS_POR_COMPASSO).toBe(4);
  });

  // O campo é de texto: o que sai dele é string, e às vezes está a meio de uma digitação.
  it('lê o andamento escrito como texto', () => {
    expect(gradeDoCompasso('90', 60)?.segundosPorTempo).toBeCloseTo(60 / 90, 9);
    expect(gradeDoCompasso(' 90 ', 60)?.segundosPorTempo).toBeCloseTo(60 / 90, 9);
  });

  // ⚠️ SEM ANDAMENTO NÃO SE INVENTA UM. Uma grelha por omissão diria que a música está em 120
  // quando ninguém disse isso — e o clipe passaria a encaixar num tempo que não existe.
  it('sem andamento, ou com um impossível, não há grelha', () => {
    expect(gradeDoCompasso('', 60)).toBeNull();
    expect(gradeDoCompasso(null, 60)).toBeNull();
    expect(gradeDoCompasso(undefined, 60)).toBeNull();
    expect(gradeDoCompasso('abc', 60)).toBeNull();
    expect(gradeDoCompasso(0, 60)).toBeNull();
    // Um zero a mais no fim: "1200" desenharia dezenas de milhares de linhas.
    expect(gradeDoCompasso(BPM_MAXIMO + 1, 60)).toBeNull();
    expect(gradeDoCompasso(BPM_MINIMO - 1, 60)).toBeNull();
    // E os limites em si valem.
    expect(gradeDoCompasso(BPM_MINIMO, 60)).not.toBeNull();
    expect(gradeDoCompasso(BPM_MAXIMO, 60)).not.toBeNull();
  });

  it('sem escala não há grelha: nada tem tamanho ainda', () => {
    expect(gradeDoCompasso(120, 0)).toBeNull();
    expect(gradeDoCompasso(120, -3)).toBeNull();
  });

  // ⚠️ O SALTO DOBRA, e não cresce de dez em dez: 1, 2, 4, 8 compassos. Uma régua musical que
  // contasse de cinco em cinco compassos punha o número fora da frase em qualquer música.
  it('quanto mais afastado, mais compassos entre dois números', () => {
    // 120 BPM a 100 %: um compasso são 120 px, e cabe um número em cada.
    expect(gradeDoCompasso(120, 60)?.passoEmCompassos).toBe(1);
    // A 10 % o compasso são 12 px: precisa de oito para os números não se colarem.
    expect(gradeDoCompasso(120, 6)?.passoEmCompassos).toBe(8);
    // E a meio caminho, quatro.
    expect(gradeDoCompasso(120, 12)?.passoEmCompassos).toBe(4);
    // Muito afastado, o salto é grande — e continua a ser uma potência de dois.
    const longe = gradeDoCompasso(120, 0.5)?.passoEmCompassos ?? 0;
    expect(longe).toBeGreaterThanOrEqual(32);
    expect(Number.isInteger(Math.log2(longe))).toBe(true);
  });

  // Uma linha a cada dois pixels não é uma grelha, é um fundo cinzento.
  it('as linhas dos tempos só aparecem quando há espaço para elas', () => {
    expect(gradeDoCompasso(120, 60)?.mostrarTempos).toBe(true);
    expect(gradeDoCompasso(120, 2)?.mostrarTempos).toBe(false);
  });
});

describe('encaixeDaGrade', () => {
  // Sem grelha fica o que sempre foi: o quarto de segundo.
  it('sem grelha, o encaixe é o de sempre', () => {
    expect(encaixeDaGrade(null, 60)).toBe(ENCAIXE_SEM_ANDAMENTO);
    expect(encaixeDaGrade(gradeDoCompasso(120, 60), 0)).toBe(ENCAIXE_SEM_ANDAMENTO);
  });

  // ⚠️ O ENCAIXE SEGUE O ZOOM. Afastado, meia batida são dois pixels: encaixar ali é
  // indistinguível de não encaixar, e a pessoa larga o clipe onde não queria.
  it('aproximado encaixa fino, afastado encaixa no compasso', () => {
    const perto = gradeDoCompasso(120, 240);
    expect(encaixeDaGrade(perto, 240)).toBeCloseTo(0.5 / 4, 9);

    const medio = gradeDoCompasso(120, 60);
    expect(encaixeDaGrade(medio, 60)).toBeCloseTo(0.5, 9);

    const longe = gradeDoCompasso(120, 6);
    expect(encaixeDaGrade(longe, 6)).toBeCloseTo(2, 9);
  });

  // Nunca mais fino do que a grelha desenhada, nem mais grosso do que o compasso.
  it('fica sempre entre a semicolcheia e o compasso', () => {
    for (const escala of [1, 5, 20, 60, 200, 600]) {
      const grade = gradeDoCompasso(128, escala);
      const valor = encaixeDaGrade(grade, escala);
      expect(valor).toBeGreaterThanOrEqual(grade!.segundosPorTempo / 4 - 1e-9);
      expect(valor).toBeLessThanOrEqual(grade!.segundosPorCompasso + 1e-9);
    }
  });
});

describe('marcasDaRegua', () => {
  // Sem grelha, a régua é a de sempre: segundos redondos, todos nomeados.
  it('sem grelha conta segundos', () => {
    const marcas = marcasDaRegua(null, 30, 60, 10);
    expect(marcas.map((m) => m.rotulo)).toEqual(['0s', '10s', '20s', '30s']);
    expect(marcas.every((m) => m.forte)).toBe(true);
  });

  // ⚠️ O COMPASSO COMEÇA EM 1, e não em 0. É assim que se conta música, em qualquer partitura e
  // em qualquer editor — um "compasso 0" não existe para quem vai ler isto.
  it('com grelha conta compassos, a partir de 1', () => {
    const grade = gradeDoCompasso(120, 60)!;
    const marcas = marcasDaRegua(grade, 8, 60, 10);
    const nomeadas = marcas.filter((m) => m.rotulo);
    expect(nomeadas[0]).toEqual({ segundo: 0, forte: true, rotulo: '1' });
    expect(nomeadas[1]?.rotulo).toBe('2');
    expect(nomeadas[1]?.segundo).toBeCloseTo(2, 9);
  });

  it('os tempos entram fracos, entre os compassos', () => {
    const grade = gradeDoCompasso(120, 60)!;
    const marcas = marcasDaRegua(grade, 4, 60, 10);
    const fracas = marcas.filter((m) => !m.forte);
    // Três tempos dentro de cada um dos dois primeiros compassos.
    expect(fracas.length).toBeGreaterThanOrEqual(6);
    expect(fracas.every((m) => !m.rotulo)).toBe(true);
    expect(fracas[0].segundo).toBeCloseTo(0.5, 9);
  });

  // Afastado, os tempos desaparecem e sobram os compassos nomeados.
  it('afastado sobram só os números', () => {
    const grade = gradeDoCompasso(120, 2)!;
    const marcas = marcasDaRegua(grade, 240, 2, 60);
    expect(marcas.every((m) => m.forte && m.rotulo)).toBe(true);
  });

  // Nada é desenhado fora da montagem, e nada é desenhado antes de haver montagem.
  it('não passa do fim, nem desenha no vazio', () => {
    const grade = gradeDoCompasso(120, 60)!;
    expect(marcasDaRegua(grade, 0, 60, 10)).toEqual([]);
    expect(marcasDaRegua(null, 0, 60, 10)).toEqual([]);
    expect(marcasDaRegua(grade, 5, 60, 10).every((m) => m.segundo <= 5)).toBe(true);
  });

  // Uma rede de segurança: um andamento alto numa montagem longa não pode pôr dezenas de
  // milhares de nós no ecrã.
  it('tem teto', () => {
    const grade = gradeDoCompasso(400, 600)!;
    expect(marcasDaRegua(grade, 3600, 600, 1).length).toBeLessThanOrEqual(900);
  });
});

// O ZOOM QUE NÃO PERDE A AGULHA.
//
// Quem aproxima a linha do tempo está quase sempre a preparar um corte: quer ver a agulha de
// perto para acertar no sítio. Mas aproximar multiplica a distância de tudo ao zero, e a mesma
// rolagem passa a apontar para outro segundo — a agulha saltava para fora do ecrã, e o gesto
// seguinte era sempre rolar à procura dela. Aproximar custava dois gestos, e o segundo não
// tinha nada a ver com o que se queria fazer.
describe('rolagemQueCentra', () => {
  // 60 s × 60 px/s = 3600 px até à agulha; metade de 800 são 400.
  it('põe o segundo no meio do que se vê', () => {
    expect(rolagemQueCentra(60, 60, 800, 100000)).toBe(3200);
  });

  // ⚠️ E ESCALA COM O ZOOM. É este o ponto todo: a 200 % a agulha está ao DOBRO da distância do
  // zero, e uma rolagem que não a acompanhe aponta para metade do tempo.
  it('acompanha a escala, que é o que o zoom muda', () => {
    expect(rolagemQueCentra(60, 120, 800, 100000)).toBe(6800);
  });

  // Perto do princípio não há montagem à esquerda para encher metade da tela: centrar à força
  // pedia uma rolagem negativa, e o navegador punha-a a zero de qualquer forma — aqui fica dito.
  it('no princípio encosta ao zero, em vez de pedir rolagem negativa', () => {
    expect(rolagemQueCentra(2, 60, 800, 100000)).toBe(0);
  });

  // ⚠️ E NO FIM PÁRA NO FIM. Sem o teto, centrar a agulha do último segundo deixava meia tela
  // de vazio depois do fim da música — e a montagem parecia ter acabado antes do que acabou.
  it('no fim pára onde a rolagem acaba, sem deixar vazio à direita', () => {
    expect(rolagemQueCentra(1000, 60, 800, 5000)).toBe(5000);
  });

  // Uma montagem que cabe inteira na tela não tem para onde rolar: o máximo é 0 ou negativo, e
  // o resultado tem de ser 0 — nunca um número negativo a escorregar para o `scrollLeft`.
  it('sem nada para rolar, fica no zero', () => {
    expect(rolagemQueCentra(60, 60, 800, 0)).toBe(0);
    expect(rolagemQueCentra(60, 60, 800, -200)).toBe(0);
  });
});

// O QUE A VISTA FAZ ENQUANTO A MÚSICA TOCA — e são dois modos, não um.
//
// Primeiro a agulha anda e a montagem está quieta, como sempre esteve. No instante em que ela
// ia desaparecer pela direita, trocam de papel: a linha trava no MEIO e passa a ser a música a
// deslizar por baixo, como num gravador de fita.
//
// ⚠️ E O MODO GUARDA-SE, não se adivinha. Perguntar só "está à vista?" dá o CONTRÁRIO do que se
// pede: centrada, ela está à vista, e no passo seguinte a regra mandaria não mexer — ela voltava
// a derivar até à borda, saltava outra vez para o meio, e a vista virava páginas em vez de
// deslizar. É o `seguindo` que separa os dois modos, e é a parte que se perde primeiro.

/** 800 de largura, 60 px por segundo: vê-se do segundo 0 ao 13,33 com a rolagem no zero. */
const vista = (over: Partial<Parameters<typeof passoDaVista>[0]> = {}) => passoDaVista({
  // Um passo da reprodução: 50 ms de música em 50 ms de relógio.
  segundo: 0, anterior: 0, desdeAnterior: 0.05, escala: 60, rolagemAtual: 0,
  larguraVisivel: 800, maximo: 100000, seguindo: false, ...over,
});

describe('passoDaVista — a agulha anda, a montagem fica', () => {
  it('não mexe em nada enquanto ela está à vista', () => {
    expect(vista({ segundo: 1, anterior: 0.95 })).toEqual({
      rolagem: null, seguindo: false,
    });
    // Nem colada às bordas do que se vê: ali ela ainda se vê.
    expect(vista({ segundo: 800 / 60, anterior: 800 / 60 - 0.05 }).rolagem).toBeNull();
  });

  // ⚠️ E ISTO É O QUE DISTINGUE OS DOIS MODOS. Sem largura medida não há "à vista" nenhum.
  it('sem largura, não decide nada', () => {
    expect(vista({ segundo: 20, larguraVisivel: 0 }).rolagem).toBeNull();
  });
});

describe('passoDaVista — a linha trava e a música desliza', () => {
  // Ia desaparecer pela direita: a vista trava-a no meio (20 × 60 = 1200, menos 400) e passa a
  // ser a montagem a mexer-se.
  it('ao sair pela direita, trava a agulha no meio', () => {
    expect(vista({ segundo: 20, anterior: 19.95 })).toEqual({
      rolagem: 800, seguindo: true,
    });
  });

  // ⚠️ O CASO QUE DEFINE O SEGUNDO MODO. Já a seguir, a agulha está à vista (é o meio do ecrã) —
  // e mesmo assim a rolagem TEM de continuar a andar. Uma regra que só olhasse para "está à
  // vista?" respondia `null` aqui, e a vista voltava a virar páginas em vez de deslizar.
  it('já a seguir, continua a deslizar mesmo com ela à vista', () => {
    expect(vista({ segundo: 20.05, anterior: 20, rolagemAtual: 800, seguindo: true })).toEqual({
      rolagem: 803, seguindo: true,
    });
  });

  // ⚠️ E NÃO PEDE UMA ROLAGEM QUE JÁ ESTÁ FEITA. Perto do fim a rolagem chega ao máximo e fica
  // lá: sem isto, a tela pedia uma rolagem por vigésimo de segundo para ficar onde já estava.
  it('no fim, com a rolagem no máximo, não pede nada', () => {
    expect(vista({
      segundo: 1000, anterior: 999.95, rolagemAtual: 5000, maximo: 5000, seguindo: true,
    })).toEqual({ rolagem: null, seguindo: true });
  });
});

describe('passoDaVista — quem leva a agulha à mão sai do segundo modo', () => {
  // ⚠️ VOLTAR AO INÍCIO, TOCAR NA RÉGUA, FECHAR UM CICLO DO LOOP. Aí a pessoa escolheu um sítio,
  // e o que ela quer é ver esse sítio e a linha a andar outra vez a partir dele — não a montagem
  // a deslizar por baixo de uma linha presa.
  it('um salto larga o modo de seguir', () => {
    const passo = vista({
      segundo: 0, anterior: 40, desdeAnterior: 0.05, rolagemAtual: 2000, seguindo: true,
    });
    expect(passo.seguindo).toBe(false);
    // E leva a vista ao sítio novo, porque de onde ela estava não se via.
    expect(passo.rolagem).toBe(0);
  });

  // Um salto para um sítio que JÁ se vê não mexe na montagem: a pessoa tocou na régua dentro do
  // ecrã, e arrastar-lhe o desenho por baixo do dedo seria mexer no que ela estava a apontar.
  it('um salto para dentro do que se vê não mexe na montagem', () => {
    expect(vista({ segundo: 5, anterior: 40, desdeAnterior: 0.05, seguindo: true })).toEqual({
      rolagem: null, seguindo: false,
    });
  });

  // ⚠️ E A FRONTEIRA É O TEMPO QUE PASSOU, e não o tamanho do passo.
  //
  // Isto começou com um limite fixo de meio segundo, e funcionou até ao dia em que a tela
  // engasgou: com treze faixas no aparelho, um quadro lento entrega 600 ms de música de uma vez.
  // A regra lia-o como alguém a mover a agulha, largava o modo travado, e a linha descolava-se
  // do meio e ia derivando para a direita até sair — travava outra vez, e recomeçava. Via-se de
  // olho no telemóvel, e nenhum caso apanhava porque todos andavam a 50 ms.
  it('um quadro lento é a música a andar, e não alguém a mover a agulha', () => {
    expect(vista({
      segundo: 20.6, anterior: 20, desdeAnterior: 0.6, rolagemAtual: 800, seguindo: true,
    }).seguindo).toBe(true);
  });

  // E o contrário continua a valer: andar mais do que o relógio deixa é alguém.
  it('andar mais do que o tempo que passou é alguém a mover a agulha', () => {
    expect(vista({
      segundo: 40, anterior: 20, desdeAnterior: 0.05, rolagemAtual: 800, seguindo: true,
    }).seguindo).toBe(false);
  });

  // A folga cobre o arredondamento dos dois relógios, e nada mais.
  it('a folga não deixa o arredondamento parecer um salto', () => {
    expect(vista({
      segundo: 20.05 + FOLGA_DA_AGULHA / 2, anterior: 20, desdeAnterior: 0.05,
      rolagemAtual: 800, seguindo: true,
    }).seguindo).toBe(true);
  });
});
