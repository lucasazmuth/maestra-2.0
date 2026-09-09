import { ganhoEfetivo, Mesa, type Pista } from '../mesa';
import { buscarFalso, ContextoFalso } from '../duplos/contextoFalso';

// A MESA — o motor que toca os stems em sincronia.
//
// Nada aqui toca som. O que se prova é o contrato: que as fontes arrancam no MESMO instante
// (que é a sincronia), que a posição vem do relógio do contexto, que uma pista partida não
// derruba as outras, e que mutar/solo/fader fazem o que dizem.
//
// A duração de cada pista viaja no tamanho dos dados falsos — ver `contextoFalso.ts`.

const PISTAS: Pista[] = [
  { id: 'voz', nome: 'Voz', url: 'voz.wav' },
  { id: 'bat', nome: 'Bateria', url: 'bat.wav' },
  { id: 'bax', nome: 'Baixo', url: 'bax.wav' },
];

const montar = async (pistas = PISTAS, duracoes: Record<string, number> = {}) => {
  const ctx = new ContextoFalso();
  const mesa = new Mesa(ctx, buscarFalso({ 'voz.wav': 180, 'bat.wav': 180, 'bax.wav': 180, ...duracoes }));
  await mesa.carregar(pistas);
  return { ctx, mesa };
};

describe('a sincronia', () => {
  // ⚠️ ESTE É O TESTE QUE JUSTIFICA A MESA EXISTIR. Se as fontes não partirem do mesmo
  // instante, os stems não estão em fase — e um editor de stems fora de fase não serve.
  it('todas as pistas arrancam no MESMO instante futuro', async () => {
    const { ctx, mesa } = await montar();
    await mesa.tocar();

    const instantes = ctx.arrancadas.map((f) => f.arranques[0].quando);
    expect(instantes).toHaveLength(3);
    expect(new Set(instantes).size).toBe(1);
    // No futuro, não "agora": criar três fontes leva tempo, e a última pediria um instante já
    // passado.
    expect(instantes[0]).toBeGreaterThan(ctx.currentTime);
  });

  it('retoma o contexto ANTES de agendar', async () => {
    // Na web o contexto nasce suspenso. Agendar antes de retomar produz fontes marcadas para
    // um instante que o contexto parado nunca alcança: silêncio, e sem erro nenhum.
    const { ctx, mesa } = await montar();
    await mesa.tocar();
    // O `toContain` primeiro, e não só a comparação de índices: `indexOf` devolve -1 quando o
    // resume nunca acontece, e -1 é menor que qualquer índice — a asserção passaria justamente
    // no caso que ela existe para apanhar.
    expect(ctx.passos).toContain('resume');
    expect(ctx.passos.indexOf('resume')).toBeLessThan(ctx.passos.lastIndexOf('fonte'));
  });
});

describe('o transporte', () => {
  it('a posição segue o relógio do contexto', async () => {
    const { ctx, mesa } = await montar();
    await mesa.tocar();
    ctx.avancar(2);
    expect(mesa.posicao()).toBeCloseTo(2 - 0.05, 5); // menos a antecedência do arranque
  });

  it('pausar congela a posição', async () => {
    const { ctx, mesa } = await montar();
    await mesa.tocar();
    ctx.avancar(10);
    mesa.pausar();
    // O valor ESPERADO, e não o que a mesa devolveu depois de pausar: comparar a posição com
    // ela mesma passa mesmo quando a pausa se esquece de onde ia (0 contra 0).
    expect(mesa.posicao()).toBeCloseTo(10 - 0.05, 5);
    ctx.avancar(30);
    expect(mesa.posicao()).toBeCloseTo(10 - 0.05, 5);
    expect(mesa.estado().tocando).toBe(false);
  });

  it('buscar recria as fontes, porque uma fonte só toca uma vez', async () => {
    const { ctx, mesa } = await montar();
    await mesa.tocar();
    const primeiras = [...ctx.arrancadas];

    mesa.irPara(30);

    expect(primeiras.every((f) => f.parada)).toBe(true);
    const novas = ctx.arrancadas.filter((f) => !primeiras.includes(f));
    expect(novas).toHaveLength(3);
    expect(novas.every((f) => f.arranques[0].deslocamento === 30)).toBe(true);
  });

  it('uma pista mais curta que o ponto buscado não arranca', async () => {
    // Pedir um deslocamento além da duração faz o contexto recusar a fonte.
    const { ctx, mesa } = await montar(PISTAS, { 'bax.wav': 20 });
    mesa.irPara(30);
    await mesa.tocar();
    expect(ctx.arrancadas).toHaveLength(2);
  });

  it('no fim, volta ao início e pára', async () => {
    const { ctx, mesa } = await montar();
    // Começar do meio: a partir do zero, "voltou ao início" e "nunca saiu de lá" são o mesmo
    // estado, e o teste não distingue um do outro.
    mesa.irPara(100);
    await mesa.tocar();
    ctx.avancar(200);
    mesa.verificarFim();
    expect(mesa.estado().tocando).toBe(false);
    expect(mesa.posicao()).toBe(0);
  });
});

describe('a mistura', () => {
  it('solo cala as outras, e tirar devolve', async () => {
    const { mesa } = await montar();
    const ganhoDe = (id: string) => mesa.estado().pistas.find((p) => p.id === id);

    mesa.solar('voz', true);
    expect(ganhoEfetivo({ ...ganhoDe('voz')! }, true)).toBe(1);
    expect(ganhoEfetivo({ ...ganhoDe('bat')! }, true)).toBe(0);

    mesa.solar('voz', false);
    expect(ganhoEfetivo({ ...ganhoDe('bat')! }, false)).toBe(1);
  });

  it('mutar NÃO apaga a posição do fader', async () => {
    // Mutar é "não quero ouvir agora", não "quero isto a zero". Se o fader fosse zerado, tirar
    // o mute devolveria a pista no volume errado — e quem misturou perdia o trabalho.
    const { mesa } = await montar();
    const voz = () => mesa.estado().pistas.find((p) => p.id === 'voz');

    mesa.ganho('voz', 0.4);
    mesa.mudar('voz', true);
    expect(voz()?.ganho).toBe(0.4);

    // E mexer no fader COM a pista mutada não a desmuta: são dois controlos, e ajustar um não
    // pode desfazer o outro pelas costas de quem está a misturar.
    mesa.ganho('voz', 0.7);
    expect(voz()?.muda).toBe(true);
    expect(voz()?.ganho).toBe(0.7);

    mesa.mudar('voz', false);
    expect(voz()?.ganho).toBe(0.7);
  });

  it('mute vence solo', () => {
    // Uma pista mutada e solada fica calada: solar outra coisa não desfaz o "não quero ouvir".
    expect(ganhoEfetivo({ muda: true, solo: true, ganho: 1 }, true)).toBe(0);
    expect(ganhoEfetivo({ muda: false, solo: false, ganho: 0.8 }, false)).toBe(0.8);
    expect(ganhoEfetivo({ muda: false, solo: false, ganho: 0.8 }, true)).toBe(0);
  });
});

describe('quando alguma coisa falha', () => {
  it('uma pista partida não derruba as outras', async () => {
    // Quem protege é o try/catch por pista, dentro do `carregarUma`: ele transforma a falha em
    // estado em vez de a deixar rejeitar. Ver o comentário em `mesa.ts`.
    const { ctx, mesa } = await montar([
      ...PISTAS.slice(0, 2),
      { id: 'ruim', nome: 'Ruim', url: 'falha.wav' },
    ]);

    const estado = mesa.estado();
    expect(estado.pistas.find((p) => p.id === 'ruim')?.carga).toBe('erro');
    expect(estado.pistas.filter((p) => p.carga === 'pronta')).toHaveLength(2);
    expect(estado.duracao).toBe(180);

    await mesa.tocar();
    expect(ctx.arrancadas).toHaveLength(2);
  });

  it('sem nenhuma pista pronta, tocar não faz nada', async () => {
    const { ctx, mesa } = await montar([{ id: 'ruim', nome: 'Ruim', url: 'falha.wav' }]);
    await mesa.tocar();
    expect(ctx.arrancadas).toHaveLength(0);
    expect(mesa.estado().tocando).toBe(false);
  });

  it('parar uma fonte que já acabou sozinha não estoura', async () => {
    const { ctx, mesa } = await montar();
    await mesa.tocar();
    ctx.arrancadas.forEach((f) => { f.jaTerminou = true; });
    expect(() => mesa.pausar()).not.toThrow();
  });
});

describe('descartar', () => {
  it('cala, desliga e fecha o contexto', async () => {
    // Sair da tela sem isto deixa a mesa a tocar por baixo da tela seguinte, e centenas de MB
    // de áudio descodificado presos na memória.
    const { ctx, mesa } = await montar();
    await mesa.tocar();
    await mesa.descartar();

    expect(ctx.fechado).toBe(true);
    expect(ctx.arrancadas.every((f) => f.parada)).toBe(true);
    expect(mesa.estado().pistas).toHaveLength(0);
  });
});

// ⚠️ O limitador do mestre não é enfeite, é aritmética: seis stems a ganho 1 somam-se e passam
// de 0 dBFS, e o que passa de 0 dBFS não fica mais alto — fica cortado. Quem ouvisse a mesa ia
// culpar os próprios ficheiros.
describe('o limitador do mestre', () => {
  it('todo o som passa por ele antes de sair', async () => {
    const ctx = new ContextoFalso();
    const mesa = new Mesa(ctx, buscarFalso({}));
    await mesa.carregar([
      { id: 'a', nome: 'Voz', url: 'a' },
      { id: 'b', nome: 'Bateria', url: 'b' },
    ]);

    expect(ctx.limitadores).toHaveLength(1);
    const limitador = ctx.limitadores[0];
    // O caminho inteiro: pista → mestre → limitador → alto-falantes.
    expect(limitador.ligadoA).toBe(ctx.destination);
    const mestre = ctx.ganhos.find((g) => g.ligadoA === limitador);
    expect(mestre).toBeDefined();
    // E NENHUMA pista fala direto com os alto-falantes: se falasse, o som dela escapava ao teto.
    expect(ctx.ganhos.filter((g) => g.ligadoA === ctx.destination)).toHaveLength(0);
  });

  // Um limitador, e não um compressor de gosto: não faz nada até ao último decibel antes do
  // teto, e aí segura. Um `threshold` mais fundo mudaria a mistura de quem enviou os stems.
  it('segura só no último decibel', async () => {
    const ctx = new ContextoFalso();
    const mesa = new Mesa(ctx, buscarFalso({}));
    await mesa.carregar([{ id: 'a', nome: 'Voz', url: 'a' }]);

    const limitador = ctx.limitadores[0];
    expect(limitador.threshold.value).toBe(-1);
    expect(limitador.ratio.value).toBe(20);
    expect(limitador.knee.value).toBe(0);
  });
});
