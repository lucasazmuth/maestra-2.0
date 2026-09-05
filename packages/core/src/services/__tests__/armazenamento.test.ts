import { tipoDoCatalogo, tituloDoArquivo } from '../armazenamento';

// O envio em si é do Supabase; o que é NOSSO aqui são duas regras que já custaram caro.

describe('o tipo do arquivo no balde do catálogo', () => {
  // Os valores da direita são exatamente os do `allowed_mime_types` do balde `catalog`.
  it.each([
    ['guia.mp3', 'audio/mpeg'],
    ['guia.wav', 'audio/wav'],
    ['capa.jpg', 'image/jpeg'],
    ['capa.jpeg', 'image/jpeg'],
    ['capa.png', 'image/png'],
    ['capa.webp', 'image/webp'],
  ])('%s vira %s', (nome, esperado) => {
    expect(tipoDoCatalogo(nome)).toBe(esperado);
  });

  // O caso que apareceu no aparelho e que motivou a regra: um .wav escolhido nos Ficheiros do
  // iOS chega com `audio/vnd.wave` (a UTI é `com.microsoft.waveform-audio`), que não está na
  // lista do balde — e o envio de um arquivo perfeitamente válido era recusado. A extensão é o
  // que o navegador, o iOS e o balde concordam.
  it('a extensão manda, e não o que o seletor declara', () => {
    expect(tipoDoCatalogo('GUIA-DE-TESTE.WAV')).toBe('audio/wav');
  });

  // HEIC é o formato padrão da câmera do iPhone. O balde recusa, e mesmo se aceitasse nenhum
  // navegador desenha — a capa subiria quebrada na web. Por isso o app converte para JPEG.
  it('recusa HEIC, m4a e o que não tem extensão', () => {
    expect(tipoDoCatalogo('IMG_0042.HEIC')).toBeNull();
    expect(tipoDoCatalogo('memo.m4a')).toBeNull();
    expect(tipoDoCatalogo('sem-extensao')).toBeNull();
  });
});

describe('o nome da gravação tirado do nome do arquivo', () => {
  it.each([
    ['guia vocal v2.wav', 'guia vocal v2'],
    ['mix_final-2.MP3', 'mix final 2'],
    ['   beat   cru .wav', 'beat cru'],
    ['sem extensao', 'sem extensao'],
  ])('%s vira "%s"', (arquivo, esperado) => {
    expect(tituloDoArquivo(arquivo)).toBe(esperado);
  });

  // A coluna do título tem 80; um nome de arquivo despejado por um exportador pode passar disso.
  it('corta em 80, que é o limite da coluna', () => {
    expect(tituloDoArquivo(`${'a'.repeat(200)}.mp3`)).toHaveLength(80);
  });
});
