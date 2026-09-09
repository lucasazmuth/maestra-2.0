import type { BufferDeAudio } from './contexto';

// Os picos de uma onda, para desenhar.
//
// Veio de `src/pages/Catalog/useAudioWaveform.ts`, que fazia isto só na web e só para a onda
// grande. Subiu para o núcleo porque a mesa já tem o `AudioBuffer` descodificado na mão: pedir
// ao wavesurfer para desenhar a mini-onda de cada pista descodificaria o mesmo áudio outra vez,
// e com seis stems seria o PCM inteiro duas vezes na memória — num aparelho, isso é a diferença
// entre funcionar e ser morto pelo sistema.

/**
 * `n` amplitudes entre 0 e 1, uma por balde de amostras.
 *
 * A média do valor absoluto, e não o máximo: o máximo faz qualquer estalo isolado virar uma
 * barra cheia e achata todo o resto, e a onda deixa de dizer onde a música tem corpo.
 *
 * Normalizado pelo maior balde, porque o que interessa é a FORMA — um stem de baixo gravado
 * baixinho e um de bateria alto têm de desenhar ondas comparáveis, senão a do baixo lê como
 * silêncio. O volume relativo é o que o fader mostra, não a onda.
 */
export const picos = (buffer: BufferDeAudio, n: number): number[] => {
  if (n <= 0 || buffer.length === 0 || buffer.numberOfChannels === 0) return [];

  const amostras = buffer.getChannelData(0);
  const porBalde = Math.max(1, Math.floor(amostras.length / n));
  const baldes: number[] = [];

  for (let i = 0; i < n; i += 1) {
    const inicio = i * porBalde;
    // O último balde varre até ao fim: com divisão inexata sobram amostras, e cortá-las faria
    // a onda acabar antes da música.
    const fim = i === n - 1 ? amostras.length : Math.min(inicio + porBalde, amostras.length);
    if (inicio >= amostras.length) { baldes.push(0); continue; }

    let soma = 0;
    for (let j = inicio; j < fim; j += 1) soma += Math.abs(amostras[j]);
    baldes.push(soma / (fim - inicio));
  }

  const maior = Math.max(...baldes);
  // Silêncio absoluto é uma linha reta, não uma divisão por zero.
  return maior > 0 ? baldes.map((v) => v / maior) : baldes;
};
