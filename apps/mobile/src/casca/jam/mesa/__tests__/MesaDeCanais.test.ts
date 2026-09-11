import { volumeDoToque } from '../MesaDeCanais';

// ⚠️ O ZERO DE UM FADER EM PÉ É EMBAIXO. Parece óbvio e é exatamente o tipo de coisa que se
// escreve ao contrário sem notar — o controlo continua a funcionar, só que o gesto de baixar
// sobe. Num aparelho isso só se descobre com o dedo; aqui, com três contas.

describe('volumeDoToque', () => {
  it('o topo é o máximo e a base é o zero', () => {
    expect(volumeDoToque(0, 200)).toBe(1);
    expect(volumeDoToque(200, 200)).toBe(0);
  });

  it('o meio é metade', () => {
    expect(volumeDoToque(100, 200)).toBe(0.5);
  });

  it('o dedo que sai do trilho não passa dos limites', () => {
    expect(volumeDoToque(-40, 200)).toBe(1);
    expect(volumeDoToque(260, 200)).toBe(0);
  });

  it('sem altura medida ainda, cai no zero e não em `Infinity`', () => {
    // Antes do primeiro `onLayout` a altura é zero. Quem trata disso é o próprio limite —
    // `1 - 50/0` é `-Infinity`, e preso entre 0 e 1 dá 0.
    expect(volumeDoToque(50, 0)).toBe(0);
  });
});
