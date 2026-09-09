import { ContextoFalso, buscarFalso } from '../duplos/contextoFalso';
import { Mesa, agendamentoDoClipe, ganhoEfetivo, type Pista } from '../mesa';

// A mesa, sem tocar um som.
//
// Áudio de verdade não se testa em integração — não há placa de som no CI, e mesmo que
// houvesse, "tocaram em sincronia?" não é uma asserção que se escreva. O que SE escreve é "as
// três fontes receberam o mesmo instante-base", "o clipe que entra aos 4 s pediu 4 s de
// atraso", "quem procurou o segundo 6 entrou no meio do clipe pelo ponto certo". Para isso
// basta um contexto falso com relógio na mão, que aponta num papel tudo o que lhe pedem.
//
// A duração de cada ficheiro viaja no TAMANHO dos dados falsos — ver `contextoFalso.ts`.

const clipe = (over: Partial<{ id: string; url: string; inicio: number; recorte: number; duracao: number }> = {}) => ({
  id: 'c1', url: 'a', inicio: 0, recorte: 0, duracao: 10, ...over,
});

const pista = (over: Partial<Pista> = {}): Pista => ({
  id: 'p1', nome: 'Voz', clipes: [clipe()], ...over,
});

const montar = (pistas: Pista[], duracoes: Record<string, number> = {}) => {
  const ctx = new ContextoFalso();
  const mesa = new Mesa(ctx, buscarFalso({ a: 60, b: 60, ...duracoes }));
  return { ctx, mesa };
};

describe('agendamentoDoClipe', () => {
  // A aritmética central do editor, e a que erra em silêncio: um sinal trocado põe o som no
  // lugar errado, e som no lugar errado é indistinguível de "o ficheiro está mau" para quem ouve.
  it('um clipe ainda por vir espera o tempo que falta', () => {
    expect(agendamentoDoClipe({ inicio: 4, recorte: 2, duracao: 3 }, 0))
      .toEqual({ atraso: 4, recorte: 2, duracao: 3 });
  });

  it('a partir do próprio início do clipe, ele entra já e inteiro', () => {
    expect(agendamentoDoClipe({ inicio: 4, recorte: 2, duracao: 3 }, 4))
      .toEqual({ atraso: 0, recorte: 2, duracao: 3 });
  });

  // O caso que faz a busca funcionar: procurar o segundo 6 de um clipe que vai de 4 a 7 tem de
  // entrar AGORA, dois segundos à frente no ficheiro, e durar só o que sobra.
  it('procurar no meio de um clipe entra já, do ponto certo, pelo que sobra', () => {
    expect(agendamentoDoClipe({ inicio: 4, recorte: 2, duracao: 3 }, 6))
      .toEqual({ atraso: 0, recorte: 4, duracao: 1 });
  });

  it('um clipe que já acabou não entra', () => {
    expect(agendamentoDoClipe({ inicio: 4, recorte: 0, duracao: 3 }, 8)).toBeNull();
    // Exatamente no fim também não: um clipe que acaba aqui não tem o que dar, e pedir-lhe
    // zero segundos seria uma fonte a mais para nada.
    expect(agendamentoDoClipe({ inicio: 4, recorte: 0, duracao: 3 }, 7)).toBeNull();
  });
});

describe('ganhoEfetivo', () => {
  it('mute vence solo', () => {
    // Quem mutou disse "não quero ouvir isto"; solar outra coisa não desfaz essa vontade.
    expect(ganhoEfetivo({ muda: true, solo: true, ganho: 1 }, true)).toBe(0);
  });

  it('com solo aceso, quem não está solado cala', () => {
    expect(ganhoEfetivo({ muda: false, solo: false, ganho: 0.8 }, true)).toBe(0);
    expect(ganhoEfetivo({ muda: false, solo: true, ganho: 0.8 }, true)).toBe(0.8);
  });

  it('sem solo nenhum, cada pista fica no seu fader', () => {
    expect(ganhoEfetivo({ muda: false, solo: false, ganho: 0.4 }, false)).toBe(0.4);
  });
});

describe('Mesa', () => {
  it('agenda todos os clipes contra o MESMO instante-base', async () => {
    const { ctx, mesa } = montar([
      pista({ id: 'p1', clipes: [clipe({ id: 'c1', url: 'a', inicio: 0, duracao: 5 })] }),
      pista({ id: 'p2', clipes: [clipe({ id: 'c2', url: 'b', inicio: 0, duracao: 5 })] }),
    ]);
    await mesa.carregar([
      pista({ id: 'p1', clipes: [clipe({ id: 'c1', url: 'a', inicio: 0, duracao: 5 })] }),
      pista({ id: 'p2', clipes: [clipe({ id: 'c2', url: 'b', inicio: 0, duracao: 5 })] }),
    ]);
    ctx.avancar(3);
    await mesa.tocar();

    const arranques = ctx.arrancadas.map((f) => f.arranques[0].quando);
    expect(arranques).toHaveLength(2);
    // É ISTO que faz as camadas soarem juntas. Sem o instante partilhado, cada fonte arrancava
    // no momento em que o JavaScript chegasse a ela — dezenas de milissegundos de diferença.
    expect(new Set(arranques).size).toBe(1);
    // E o instante é no FUTURO: criar as fontes leva tempo, e pedir "agora" à última já seria
    // depois de a primeira ter começado.
    expect(arranques[0]).toBeGreaterThan(ctx.currentTime);
  });

  it('um clipe que entra mais tarde é agendado com o atraso dele', async () => {
    const { ctx, mesa } = montar([]);
    await mesa.carregar([pista({
      clipes: [
        clipe({ id: 'c1', inicio: 0, duracao: 4 }),
        clipe({ id: 'c2', inicio: 10, duracao: 4 }),
      ],
    })]);
    await mesa.tocar();

    const [primeiro, segundo] = ctx.arrancadas.map((f) => f.arranques[0]);
    expect(segundo.quando - primeiro.quando).toBeCloseTo(10, 6);
  });

  // Os três argumentos do `start` são o editor inteiro: com um só, todo clipe começaria no zero
  // e duraria o ficheiro.
  it('cada clipe pede o seu recorte e a sua duração', async () => {
    const { ctx, mesa } = montar([]);
    await mesa.carregar([pista({
      clipes: [clipe({ id: 'c1', inicio: 2, recorte: 12, duracao: 3 })],
    })]);
    await mesa.tocar();

    expect(ctx.arrancadas[0].arranques[0]).toMatchObject({ deslocamento: 12, duracao: 3 });
  });

  it('procurar dentro de um clipe entra já, do ponto certo', async () => {
    const { ctx, mesa } = montar([]);
    await mesa.carregar([pista({
      clipes: [clipe({ id: 'c1', inicio: 4, recorte: 2, duracao: 6 })],
    })]);
    mesa.irPara(7);
    await mesa.tocar();

    const arranque = ctx.arrancadas[0].arranques[0];
    expect(arranque.quando).toBeCloseTo(ctx.currentTime + 0.05, 6);
    expect(arranque.deslocamento).toBeCloseTo(5, 6);
    expect(arranque.duracao).toBeCloseTo(3, 6);
  });

  it('um clipe que já passou não arranca', async () => {
    const { ctx, mesa } = montar([]);
    await mesa.carregar([pista({
      clipes: [
        clipe({ id: 'passado', inicio: 0, duracao: 3 }),
        clipe({ id: 'futuro', inicio: 20, duracao: 3 }),
      ],
    })]);
    mesa.irPara(10);
    await mesa.tocar();

    // Sem esta guarda, a mesa pediria à fonte um deslocamento além do fim do ficheiro — que o
    // contexto recusa, e o clipe seguinte nunca chegaria a ser agendado.
    expect(ctx.arrancadas).toHaveLength(1);
  });

  // ⚠️ O ponto que faz o corte ser instantâneo: dois clipes do mesmo ficheiro descodificam UMA
  // vez. Descodificar duas seria dobrar dezenas de MB para tocar exatamente o mesmo som.
  it('dois clipes do mesmo ficheiro baixam o áudio uma vez só', async () => {
    let idas = 0;
    const ctx = new ContextoFalso();
    const mesa = new Mesa(ctx, async (url) => { idas += 1; return new ArrayBuffer(url === 'a' ? 60 : 60); });
    await mesa.carregar([pista({
      clipes: [
        clipe({ id: 'c1', url: 'a', inicio: 0, recorte: 0, duracao: 5 }),
        clipe({ id: 'c2', url: 'a', inicio: 5, recorte: 5, duracao: 5 }),
      ],
    })]);
    expect(idas).toBe(1);
  });

  // Arrastar um clipe é uma reprogramação de fontes, não um download.
  it('mover um clipe não volta a baixar o áudio', async () => {
    let idas = 0;
    const ctx = new ContextoFalso();
    const mesa = new Mesa(ctx, async () => { idas += 1; return new ArrayBuffer(60); });
    await mesa.carregar([pista({ clipes: [clipe({ inicio: 0 })] })]);
    await mesa.carregar([pista({ clipes: [clipe({ inicio: 8 })] })]);
    expect(idas).toBe(1);
  });

  it('um ficheiro que falha só derruba as pistas que o usam', async () => {
    const ctx = new ContextoFalso();
    const mesa = new Mesa(ctx, buscarFalso({ boa: 30 }));
    await mesa.carregar([
      pista({ id: 'ok', clipes: [clipe({ id: 'c1', url: 'boa' })] }),
      pista({ id: 'ruim', clipes: [clipe({ id: 'c2', url: 'falha' })] }),
    ]);

    const estado = mesa.estado();
    expect(estado.pistas.find((p) => p.id === 'ok')?.carga).toBe('pronta');
    expect(estado.pistas.find((p) => p.id === 'ruim')?.carga).toBe('erro');
    expect(estado.pistas.find((p) => p.id === 'ruim')?.erro).toBeTruthy();
    // E a que está boa TOCA: uma pista com problema não pode calar a gravação inteira.
    await mesa.tocar();
    expect(ctx.arrancadas).toHaveLength(1);
  });

  it('a duração é onde acaba o último clipe', async () => {
    const { mesa } = montar([]);
    await mesa.carregar([
      pista({ id: 'p1', clipes: [clipe({ id: 'c1', inicio: 0, duracao: 4 })] }),
      pista({ id: 'p2', clipes: [clipe({ id: 'c2', url: 'b', inicio: 30, duracao: 6 })] }),
    ]);
    expect(mesa.estado().duracao).toBe(36);
  });

  it('a posição segue o relógio do contexto, e a pausa congela', async () => {
    const { ctx, mesa } = montar([]);
    await mesa.carregar([pista({ clipes: [clipe({ duracao: 30 })] })]);
    await mesa.tocar();

    ctx.avancar(5);
    // Menos a antecedência: a reprodução só começa daí a 50 ms.
    expect(mesa.posicao()).toBeCloseTo(4.95, 2);
    mesa.pausar();
    ctx.avancar(10);
    expect(mesa.posicao()).toBeCloseTo(4.95, 2);
  });

  it('o que é escuta sobrevive à edição', async () => {
    const { mesa } = montar([]);
    await mesa.carregar([pista({ clipes: [clipe()] })]);
    mesa.mudar('p1', true);
    mesa.ganho('p1', 0.3);

    // Cortar um clipe não pode acender uma pista que a pessoa tinha calado, nem repor o fader.
    await mesa.carregar([pista({ clipes: [clipe({ inicio: 5 })] })]);
    const depois = mesa.estado().pistas[0];
    expect(depois.muda).toBe(true);
    expect(depois.ganho).toBe(0.3);
  });

  it('a onda de um clipe é a do recorte dele, e não a do ficheiro', async () => {
    const { mesa } = montar([]);
    await mesa.carregar([pista({
      clipes: [
        clipe({ id: 'comeco', inicio: 0, recorte: 0, duracao: 5 }),
        clipe({ id: 'fim', inicio: 5, recorte: 50, duracao: 5 }),
      ],
    })]);

    const comeco = mesa.picos('comeco', 16);
    const fim = mesa.picos('fim', 16);
    expect(comeco).toHaveLength(16);
    expect(fim).toHaveLength(16);
    // Dois clipes nascidos do mesmo corte desenhariam a mesma onda se o recorte fosse ignorado,
    // e a montagem deixaria de se ler. (A onda do falso cresce ao longo do buffer.)
    expect(comeco).not.toEqual(fim);
  });

  it('descartar fecha o contexto', async () => {
    const { ctx, mesa } = montar([]);
    await mesa.carregar([pista({ clipes: [clipe()] })]);
    await mesa.descartar();
    expect(ctx.state).toBe('closed');
  });

  // O contexto nasce suspenso no navegador até um gesto da pessoa. Agendar antes de retomar
  // produz fontes marcadas para um instante que o contexto parado nunca alcança.
  it('retoma o contexto ANTES de agendar', async () => {
    const { ctx, mesa } = montar([]);
    await mesa.carregar([pista({ clipes: [clipe()] })]);
    await mesa.tocar();
    expect(ctx.passos.indexOf('resume')).toBeLessThan(ctx.passos.indexOf('fonte'));
  });
});

// ⚠️ O teto do mestre não é enfeite, é aritmética: seis pistas a ganho 1 somam-se e passam de
// 0 dBFS, e o que passa de 0 dBFS não fica mais alto — fica cortado.
describe('o teto do mestre', () => {
  it('todo o som passa por ele antes de sair', async () => {
    const { ctx, mesa } = montar([]);
    await mesa.carregar([
      pista({ id: 'p1', clipes: [clipe({ id: 'c1', url: 'a' })] }),
      pista({ id: 'p2', clipes: [clipe({ id: 'c2', url: 'b' })] }),
    ]);

    expect(ctx.tetos).toHaveLength(1);
    const teto = ctx.tetos[0];
    expect(teto.ligadoA).toBe(ctx.destination);
    expect(ctx.ganhos.find((g) => g.ligadoA === teto)).toBeDefined();
    // E NENHUMA pista fala direto com os alto-falantes: se falasse, o som dela escapava ao teto.
    expect(ctx.ganhos.filter((g) => g.ligadoA === ctx.destination)).toHaveLength(0);
  });

  it('recebe a curva, e sobreamostra', async () => {
    const { ctx, mesa } = montar([]);
    await mesa.carregar([pista({ clipes: [clipe()] })]);

    const teto = ctx.tetos[0];
    expect(teto.curve).toBeInstanceOf(Float32Array);
    expect((teto.curve as Float32Array).length).toBeGreaterThan(1000);
    expect(teto.oversample).toBe('2x');
  });
});
