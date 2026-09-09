import { AudioContext, AudioManager } from 'react-native-audio-api';
import { Directory, File, Paths } from 'expo-file-system';

import type { ContextoDeAudio } from '@maestra/core/audio/contexto';
import type { Buscar } from '@maestra/core/audio/mesa';

// O motor de áudio do app, para a mesa de stems.
//
// ─── Por que uma biblioteca nova, se já há `expo-audio` ─────────────────────
//
// O `expo-audio` toca N faixas ao mesmo tempo e tem volume por faixa — isso ele faz. O que ele
// não tem é RELÓGIO PARTILHADO: cada player é um `AVPlayer` independente, cada um arranca com a
// sua latência e deriva com o tempo. Para ouvir uma camada de cada vez, chega; para julgar se a
// bateria está em cima do baixo, não — e é isso que um editor de stems tem de permitir.
//
// O `react-native-audio-api` é a Web Audio API no telemóvel: o mesmo `AudioContext`,
// `AudioBufferSourceNode` e `GainNode` do navegador. Com ele, a mesa do núcleo corre igual nas
// duas superfícies — um motor só, um conjunto de testes só.
//
// ⚠️ A `Mesa` continua a ser quem toca AQUI DENTRO da tela do editor. Nas outras telas (a lista
// de músicas, o Espaço da Versão) quem toca é o `expo-audio`, como sempre. As duas bibliotecas
// mexem na sessão de áudio do iOS, e por isso a sessão é (re)configurada a cada vez que a mesa
// é criada — sem isso, voltar de uma tela que usou o `expo-audio` deixaria a mesa muda.

/** Onde os stems ficam depois de baixados. Cache: o sistema limpa se precisar do espaço. */
const PASTA = 'pistas';

/**
 * O teto da cache de stems, em bytes.
 *
 * 500 MB é ~12 WAV de quatro minutos: as duas ou três gravações que se está a trabalhar esta
 * semana, e não o catálogo inteiro. O sistema também limpa a pasta de cache quando precisa de
 * espaço, mas só quando o APARELHO aperta — e um aparelho com 128 GB livres nunca aperta,
 * enquanto a nossa pasta cresce sem fim.
 */
const TETO_DA_CACHE = 500 * 1024 * 1024;

/**
 * Configura a sessão de áudio e devolve um contexto.
 *
 * `playback` é a categoria que toca com o interruptor de silêncio ligado e que não pede o
 * microfone — é o que um editor de música precisa e nada além disso. Sem `mixWithOthers`: quem
 * abre a mesa quer ouvir a mesa, não a mesa por cima do Spotify.
 */
export const criarContextoNativo = (): ContextoDeAudio => {
  AudioManager.setAudioSessionOptions({
    iosCategory: 'playback',
    iosMode: 'default',
    iosOptions: ['allowBluetoothA2DP', 'allowAirPlay'],
  });
  void AudioManager.setAudioSessionActivity(true);
  // O cast é a fronteira entre a biblioteca e a interface do núcleo: elas coincidem em tudo o
  // que a mesa usa, mas a da biblioteca tem muito mais, e o núcleo não deve conhecer isso.
  return new AudioContext() as unknown as ContextoDeAudio;
};

/** `mix.wav?x=1` → um nome de ficheiro previsível e sem caracteres estranhos. */
const nomeNaCache = (url: string): string => {
  let hash = 0;
  for (let i = 0; i < url.length; i += 1) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0;
  }
  const extensao = url.split('?')[0].toLowerCase().match(/\.(mp3|wav)$/)?.[1] ?? 'audio';
  return `${Math.abs(hash).toString(36)}.${extensao}`;
};

/**
 * Traz o stem, e guarda-o.
 *
 * Devolve o CAMINHO do ficheiro, e não os bytes: o `decodeAudioData` desta biblioteca aceita um
 * caminho, e assim o áudio nunca passa pela memória do JavaScript — um WAV de 40 MB lido para
 * um `ArrayBuffer` é 40 MB que o motor de JS tem de segurar enquanto descodifica.
 *
 * E é cache de verdade: abrir a mesma gravação dez vezes num dia baixaria 1,7 GB sem isto. O
 * ficheiro fica na pasta de cache, que o sistema pode limpar quando precisar de espaço — se
 * sumir, baixa outra vez.
 */
export const buscarNativo: Buscar = async (url: string) => {
  const pasta = new Directory(Paths.cache, PASTA);
  if (!pasta.exists) pasta.create({ intermediates: true });

  const destino = new File(pasta, nomeNaCache(url));
  if (destino.exists && destino.size) return destino.uri;

  const baixado = await File.downloadFileAsync(url, destino);
  // Depois de baixar, e não antes: assim o ficheiro que acabou de chegar conta para o teto, e
  // uma gravação enorme não passa por cima dele só por ser a última.
  aparar(pasta);
  return baixado.uri;
};

/**
 * Deita fora os stems mais VELHOS até a pasta caber no teto.
 *
 * Mais velhos pela data de modificação, que aqui é a data em que foram baixados: o critério é
 * "há mais tempo que não se abre esta gravação", que é o mais próximo de "não interessa mais"
 * que se consegue sem guardar um registo à parte.
 *
 * Nunca lança: falhar a limpeza não pode impedir a música de tocar. No pior caso a pasta fica
 * grande, e o sistema é que a limpa.
 */
const aparar = (pasta: Directory): void => {
  try {
    const ficheiros = pasta.list().filter((entrada): entrada is File => entrada instanceof File);
    let total = ficheiros.reduce((soma, f) => soma + (f.size ?? 0), 0);
    if (total <= TETO_DA_CACHE) return;

    const porIdade = ficheiros
      .slice()
      .sort((a, b) => (a.modificationTime ?? 0) - (b.modificationTime ?? 0));

    for (const velho of porIdade) {
      if (total <= TETO_DA_CACHE) return;
      total -= velho.size ?? 0;
      velho.delete();
    }
  } catch {
    /* a cache continua grande; o sistema limpa quando precisar */
  }
};
