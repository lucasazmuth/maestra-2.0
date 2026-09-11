import type { BufferDeAudio } from '../contexto';
import { bytesDoWav, higienizar, nomeDoArquivoDaPista, rotuloDaGuia } from '../exportar';

const buffer = (canais: number[][], taxa = 44100): BufferDeAudio => ({
  duration: canais[0].length / taxa,
  length: canais[0].length,
  numberOfChannels: canais.length,
  sampleRate: taxa,
  getChannelData: (i: number) => Float32Array.from(canais[i]),
} as unknown as BufferDeAudio);

const texto = (v: DataView, em: number, n: number) =>
  Array.from({ length: n }, (_, i) => String.fromCharCode(v.getUint8(em + i))).join('');

describe('bytesDoWav', () => {
  it('escreve o cabeçalho RIFF/WAVE que um leitor de WAV procura', () => {
    const v = new DataView(bytesDoWav(buffer([[0], [0]])).buffer);
    expect(texto(v, 0, 4)).toBe('RIFF');
    expect(texto(v, 8, 4)).toBe('WAVE');
    expect(texto(v, 12, 4)).toBe('fmt ');
    expect(texto(v, 36, 4)).toBe('data');
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(34, true)).toBe(16); // bits por amostra
  });

  it('declara os tamanhos que o formato manda, e eles batem com os bytes de verdade', () => {
    // 3 quadros × 2 canais × 2 bytes = 12 de áudio, 44 de cabeçalho.
    const bytes = bytesDoWav(buffer([[0, 0, 0], [0, 0, 0]]));
    const v = new DataView(bytes.buffer);
    expect(bytes.length).toBe(44 + 12);
    expect(v.getUint32(40, true)).toBe(12); // tamanho do bloco de dados
    expect(v.getUint32(4, true)).toBe(36 + 12); // tamanho do RIFF
    expect(v.getUint16(22, true)).toBe(2); // canais
    expect(v.getUint32(24, true)).toBe(44100); // taxa
    expect(v.getUint32(28, true)).toBe(44100 * 2 * 2); // bytes por segundo
    expect(v.getUint16(32, true)).toBe(4); // bytes por quadro
  });

  it('entrelaça os canais: L, R, L, R — e não um canal inteiro depois do outro', () => {
    // Um WAV com os canais em blocos toca a música inteira à esquerda e depois à direita.
    const v = new DataView(bytesDoWav(buffer([[1, 1], [-1, -1]])).buffer);
    expect(v.getInt16(44, true)).toBe(0x7fff); // quadro 0, esquerda
    expect(v.getInt16(46, true)).toBe(-0x8000); // quadro 0, direita
    expect(v.getInt16(48, true)).toBe(0x7fff); // quadro 1, esquerda
  });

  it('prende a amostra entre −1 e 1 antes de escalar', () => {
    // Sem o limite, 1,5 × 0x7fff transborda os 16 bits e dá a volta: o pico mais alto da
    // música vira um estalo NEGATIVO, e ninguém descobre até ouvir o ficheiro exportado.
    const v = new DataView(bytesDoWav(buffer([[1.5, -1.5]])).buffer);
    expect(v.getInt16(44, true)).toBe(0x7fff);
    expect(v.getInt16(46, true)).toBe(-0x8000);
  });

  it('escala o negativo por 0x8000 e o positivo por 0x7fff', () => {
    // Os dois lados do 16-bit com sinal não são simétricos: −32768 existe, +32768 não.
    const v = new DataView(bytesDoWav(buffer([[0.5, -0.5]])).buffer);
    expect(v.getInt16(44, true)).toBe(Math.trunc(0.5 * 0x7fff));
    expect(v.getInt16(46, true)).toBe(-0x4000);
  });
});

describe('nomeDoArquivoDaPista', () => {
  it('tira o acento e troca o que o sistema de ficheiros não gosta', () => {
    expect(nomeDoArquivoDaPista('Guia · voz/ção', 'wav')).toBe('Guia _ voz_cao.wav');
  });

  it('um nome que só tinha símbolos não vira um ficheiro sem nome', () => {
    expect(higienizar('///')).toBe('pista');
    expect(nomeDoArquivoDaPista('///', 'mp3')).toBe('pista.mp3');
  });

  it('mantém espaço, traço e sublinhado — são nomes de pista legítimos', () => {
    expect(nomeDoArquivoDaPista('Bateria_2 - take 3', 'wav')).toBe('Bateria_2 - take 3.wav');
  });
});

// ⚠️ A PERCENTAGEM NÃO É ENFEITE. Codificar MP3 é JavaScript sobre cada amostra: no computador
// são segundos, no telemóvel foram medidos 101 segundos para 227 de áudio. Reticências que não
// se mexem durante um minuto e meio são indistinguíveis de uma tela pendurada — e quem espera
// fecha o aplicativo, que é exatamente o gesto que perde o trabalho.
describe('rotuloDaGuia', () => {
  it('sem número, diz só que está a fazer', () => {
    expect(rotuloDaGuia()).toBe('Gerando a guia…');
    expect(rotuloDaGuia(null)).toBe('Gerando a guia…');
  });

  it('com número, diz quanto já andou', () => {
    expect(rotuloDaGuia(0)).toBe('Gerando a guia… 0%');
    expect(rotuloDaGuia(0.456)).toBe('Gerando a guia… 46%');
    expect(rotuloDaGuia(1)).toBe('Gerando a guia… 100%');
  });

  // O codificador anda por blocos e o último pedaço pode passar de 1; um "103%" fazia a tela
  // dizer uma coisa que não existe mesmo quando tudo correu bem.
  it('nunca sai de 0 a 100', () => {
    expect(rotuloDaGuia(1.03)).toBe('Gerando a guia… 100%');
    expect(rotuloDaGuia(-0.2)).toBe('Gerando a guia… 0%');
  });

  it('um número que não é número volta ao texto sem percentagem', () => {
    expect(rotuloDaGuia(NaN)).toBe('Gerando a guia…');
  });
});
