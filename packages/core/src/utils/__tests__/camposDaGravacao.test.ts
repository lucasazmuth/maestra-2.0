import { soOAndamento, soOTom } from '../camposDaGravacao';

// O que os dois campos da barra de controlos aceitam enquanto se escreve.
//
// ⚠️ FILTRAM NA TECLA, e não validam no fim. Um campo que aceita tudo e recusa ao gravar deixa a
// pessoa escrever "128bpm", sair da tela e descobrir mais tarde que nada foi salvo.

describe('soOAndamento', () => {
  it('deixa passar os algarismos, e mais nada', () => {
    expect(soOAndamento('128')).toBe('128');
    expect(soOAndamento('128bpm')).toBe('128');
    expect(soOAndamento('9,5')).toBe('95');
  });

  // ⚠️ O TECLADO NUMÉRICO NÃO DECIDE NADA. Há teclados que trazem símbolos ao lado dos números, e
  // colar de outro sítio passa por cima de qualquer teclado — o `keyboardType` é uma sugestão ao
  // aparelho, não uma regra do campo.
  it('o que vem colado de outro sítio também passa pelo filtro', () => {
    expect(soOAndamento('~128 BPM~')).toBe('128');
  });

  it('atravessa o campo vazio e o que não tem número nenhum', () => {
    expect(soOAndamento('')).toBe('');
    expect(soOAndamento('rápido')).toBe('');
  });
});

describe('soOTom', () => {
  it('o tom é texto: os algarismos caem', () => {
    expect(soOTom('Am')).toBe('Am');
    expect(soOTom('Am7')).toBe('Am');
  });

  // ⚠️ O SUSTENIDO E O BEMOL NÃO SÃO PONTUAÇÃO. Um filtro de "só letras" apaga o `#` de `C#m` e
  // deixa a pessoa a lutar com o campo sem perceber porquê.
  it('o sustenido fica, e o bemol também — que já é letra', () => {
    expect(soOTom('C#m')).toBe('C#m');
    expect(soOTom('Bb')).toBe('Bb');
    expect(soOTom('F♯')).toBe('F♯');
    expect(soOTom('E♭')).toBe('E♭');
  });

  it('o resto da pontuação cai', () => {
    expect(soOTom('C / Am')).toBe('CAm');
    expect(soOTom('')).toBe('');
  });
});
