import type { ContextoDeAudio } from '@maestra/core/audio/contexto';
import type { Buscar } from '@maestra/core/audio/mesa';

// O motor de áudio da mesa, no navegador.
//
// Aqui não há biblioteca nenhuma a instalar: a Web Audio API É o navegador. O `AudioContext`
// que a mesa do núcleo pede é o mesmo objeto que o `useAudioWaveform` já usa para desenhar as
// ondas do catálogo — o caminho e o CORS do balde estão provados por esse uso.
//
// ⚠️ O contexto nasce SUSPENSO até um gesto da pessoa (política de autoplay). Quem resolve isso
// é a `Mesa`, que chama `resume()` antes de agendar as fontes; o clique no play é o gesto.

export const criarContextoWeb = (): ContextoDeAudio => {
  const Contexto = window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Contexto) throw new Error('Este navegador não toca áudio (AudioContext indisponível).');
  return new Contexto() as unknown as ContextoDeAudio;
};

/**
 * Traz os bytes do stem.
 *
 * Devolve um `ArrayBuffer`, ao contrário do app, que devolve um caminho de ficheiro: no
 * navegador não há disco onde guardar, e o `decodeAudioData` só aceita bytes. O cache aqui é o
 * do próprio navegador (a resposta do balde vem com `cache-control`), e não um nosso.
 */
export const buscarWeb: Buscar = async (url: string) => {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error('Não consegui baixar esta pista.');
  return resposta.arrayBuffer();
};
