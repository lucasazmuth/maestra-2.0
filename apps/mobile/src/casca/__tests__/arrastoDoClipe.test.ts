import fs from 'fs';
import path from 'path';

// ARRASTAR UM CLIPE PARA OUTRA FAIXA, no aparelho.
//
// Aqui o gesto vive NO CLIPE (um `Pan` do gesture-handler), e não num contentor por cima da
// montagem como na web. Essa diferença é o que torna as duas regras abaixo necessárias — e as
// duas custaram uma ida ao simulador para aparecer, porque nenhuma delas se vê a ler o código
// com atenção: o arrasto "funcionava" e mesmo assim não gravava a faixa nova.
//
// Não há como disparar um `Pan` num teste de renderização: o que se pode prender é a FORMA do
// gesto. É o que este ficheiro faz. A decisão de para onde o clipe vai é do núcleo
// (`pistaAlvoDoArrasto`), e essa tem testes a sério.

const linha = fs.readFileSync(
  path.join(__dirname, '..', 'jam', 'mesa', 'LinhaDoTempo.tsx'),
  'utf8',
);

/** Sem os comentários: eles falam das regras, e fariam qualquer asserção passar. */
const semComentarios = (fonte: string) => fonte
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

const corpo = semComentarios(linha);

describe('o arrasto do clipe na linha do tempo', () => {
  // ⚠️ O `failOffsetY` CANCELAVA O GESTO assim que o dedo subia 14 pontos. Mover um clipe da
  // voz para a bateria era simplesmente impossível, e morria sem dizer porquê.
  it('o eixo vertical ativa o arrasto em vez de o matar', () => {
    expect(corpo).toContain('.activeOffsetY([-8, 8])');
    expect(corpo).not.toContain('.failOffsetY(');
    // Roubar a rolagem vertical aqui é barato porque só o clipe ESCOLHIDO arrasta.
    expect(corpo).toContain('.enabled(escolhido && podeEditar)');
  });

  // ⚠️ ISTO É O DEFEITO QUE SÓ O APARELHO MOSTROU. Mudar o clipe de faixa DURANTE o gesto
  // desmonta e remonta este componente — e com ele o `Pan` que estava a correr. O dedo
  // continuava no ecrã, o arrasto tinha morrido, e o `onEnd` que grava a faixa nova nunca
  // chegava a acontecer: o clipe ia parar à outra linha na tela e voltava no recarregamento.
  it('o clipe FLUTUA enquanto o dedo o segura, e só muda de faixa ao largar', () => {
    // Enquanto arrasta, o que muda é o desenho.
    expect(corpo).toContain('transform: [{ translateY: flutuando * ALTURA_DA_FAIXA }]');
    // E o que a tela recebe durante o gesto é só o tempo: nenhuma faixa.
    expect(corpo).toContain('aoMoverEnquantoArrasta={(inicio) => aoMover?.(clipe.id, inicio)}');
    // A faixa nova vai no fim, com a de origem, que é o que a seta do desfazer precisa.
    expect(corpo).toContain("faixaDoDegrau(i, degrau, { comOrigem: true })");
    // E o clipe aterra mesmo quando o sistema leva o dedo (uma chamada, o gesto de voltar).
    expect(corpo).toContain('.onFinalize(');
  });

  // O desenho e a gravação não podem discordar: se o clipe desliza para uma linha, é nessa
  // linha que ele tem de cair.
  it('o quanto ele flutua sai da mesma conta que decide a gravação', () => {
    expect(corpo).toContain('const degrauPossivelDa = (i: number) => (degrau: number) => {');
    expect(corpo).toContain('const para = pistaAlvoDoArrasto(pistas, i, i + degrau);');
    expect(corpo).toContain('degrauPossivel={degrauPossivelDa(i)}');
    expect(corpo).toContain('setFlutuando(degrauPossivel(degrau))');
  });
});
