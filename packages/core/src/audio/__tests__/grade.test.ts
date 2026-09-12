import {
  BPM_MAXIMO, BPM_MINIMO, ENCAIXE_SEM_ANDAMENTO, TEMPOS_POR_COMPASSO,
  MARGEM_DE_SEGUIR,
  encaixeDaGrade, gradeDoCompasso, marcasDaRegua, rolagemQueCentra, rolagemQueSegue,
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

// A VISTA QUE SEGUE A AGULHA — mas só quando ela foge.
//
// Hoje, carregar em tocar era ficar a rolar atrás da linha vermelha com a mão. E a correção
// fácil — centrar a agulha a cada décimo de segundo — é PIOR do que o defeito: a onda desliza
// sem parar debaixo do olho e fica impossível ler o que quer que seja.
describe('rolagemQueSegue', () => {
  // 800 de largura, rolagem em 0: a agulha a 60 px está à vista.
  it('não mexe em nada enquanto a agulha está à vista', () => {
    expect(rolagemQueSegue(1, 60, 0, 800, 100000)).toBeNull();
    // Nem colada às bordas do que se vê: ali ela ainda se vê.
    expect(rolagemQueSegue(0, 60, 0, 800, 100000)).toBeNull();
    expect(rolagemQueSegue(800 / 60, 60, 0, 800, 100000)).toBeNull();
  });

  // Passou a borda direita: a vista vira a página e ela reaparece perto da esquerda, com uma
  // tela inteira de música por tocar à frente.
  it('quando ela passa a borda, a vista vai buscá-la', () => {
    // 20 s × 60 = 1200 px, menos 10 % de 800 = 80 → 1120.
    expect(rolagemQueSegue(20, 60, 0, 800, 100000)).toBe(1120);
  });

  // ⚠️ E NÃO COLADA À BORDA. Aterrar em cima da esquerda deixa a pessoa sem ver nada do que
  // acabou de passar, no instante exato em que a vista saltou.
  it('deixa um respiro atrás dela, e não a encosta à borda', () => {
    const nova = rolagemQueSegue(20, 60, 0, 800, 100000)!;
    expect(20 * 60 - nova).toBe(800 * MARGEM_DE_SEGUIR);
  });

  // ⚠️ NOS DOIS SENTIDOS. Voltar ao início e o fim de um ciclo do loop deixam a agulha ATRÁS do
  // que se vê, e o problema é o mesmo: a pergunta não é "andou para a frente?" mas "ainda está
  // à vista?". Sem isto, repetir do início deixava a tela parada no fim da música.
  it('vai buscá-la também quando ela salta para trás', () => {
    expect(rolagemQueSegue(0, 60, 5000, 800, 100000)).toBe(0);
  });

  // ⚠️ E NÃO PEDE UMA ROLAGEM QUE JÁ ESTÁ FEITA. Perto do fim a agulha sai do ecrã com a rolagem
  // já no máximo: devolver o mesmo número faria a tela pedir uma rolagem por décimo de segundo
  // para ficar onde já está — no aparelho, uma animação a lutar com o dedo.
  it('no fim, com a rolagem no máximo, não pede nada', () => {
    expect(rolagemQueSegue(1000, 60, 5000, 800, 5000)).toBeNull();
  });

  // Sem largura medida ainda não há "à vista" nenhum para comparar.
  it('sem largura, não decide nada', () => {
    expect(rolagemQueSegue(20, 60, 0, 0, 100000)).toBeNull();
  });
});
