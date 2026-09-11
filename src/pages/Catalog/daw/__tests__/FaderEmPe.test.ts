import { volumeDoToque } from '../FaderEmPe';

// ⚠️ O ZERO DE UM FADER EM PÉ É EMBAIXO. Parece óbvio e é exatamente o tipo de coisa que se
// escreve ao contrário sem notar — o controlo continua a funcionar, só que o gesto de baixar
// sobe. No navegador isso só se descobre com a mão; aqui, com quatro contas.
//
// É a MESMA função do app (`casca/jam/mesa/MesaDeCanais.tsx`), com o mesmo teste: um fader que
// se comportasse ao contrário numa das duas superfícies seria pior do que dois desenhos
// diferentes.

describe('volumeDoToque', () => {
  it('o topo é o máximo e a base é o zero', () => {
    expect(volumeDoToque(0, 200)).toBe(1);
    expect(volumeDoToque(200, 200)).toBe(0);
  });

  it('o meio é metade', () => {
    expect(volumeDoToque(100, 200)).toBe(0.5);
  });

  it('a mão que sai do trilho não passa dos limites', () => {
    expect(volumeDoToque(-40, 200)).toBe(1);
    expect(volumeDoToque(260, 200)).toBe(0);
  });

  it('sem altura medida ainda, cai no zero e não em `Infinity`', () => {
    // Quem trata disso é o próprio limite: `1 - 50/0` é `-Infinity`, e preso entre 0 e 1 dá 0.
    expect(volumeDoToque(50, 0)).toBe(0);
  });
});
