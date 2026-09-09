// O que a Mesa precisa de um motor de áudio — e nada mais.
//
// É um subconjunto ESTRUTURAL do `AudioContext`: o do navegador satisfaz isto, e o do
// `react-native-audio-api` também, sem adaptador nenhum. Escrever a interface aqui em vez de
// importar `lib.dom` faz duas coisas que importam:
//
// 1. o núcleo não passa a depender do DOM por causa de áudio (ele corre no app, onde `window`
//    não existe);
// 2. o contexto FALSO dos testes fica pequeno — são estes nove métodos, e não a superfície
//    inteira da Web Audio API.
//
// Se um dia a Mesa precisar de um nó novo (um compressor no mestre, por exemplo), ele entra
// aqui primeiro, e o falso ganha o mesmo — que é o que obriga o teste a acompanhar.

export interface BufferDeAudio {
  readonly duration: number;
  readonly length: number;
  readonly numberOfChannels: number;
  readonly sampleRate: number;
  getChannelData(canal: number): Float32Array;
}

export interface ParametroDeAudio {
  value: number;
  setValueAtTime(valor: number, quando: number): unknown;
  /**
   * A rampa curta que evita o clique.
   *
   * Mudar `gain.value` de 1 para 0 num instante produz um degrau na onda, e um degrau é um
   * estalo audível. `setTargetAtTime` com 10 ms de constante faz a mesma coisa sem o estalo.
   */
  setTargetAtTime(valor: number, quando: number, constante: number): unknown;
}

export interface Destino {
  readonly maxChannelCount?: number;
}

export interface NoDeGanho {
  readonly gain: ParametroDeAudio;
  connect(destino: NoDeGanho | Destino): unknown;
  disconnect(): void;
}

export interface FonteDeAudio {
  buffer: BufferDeAudio | null;
  onended: (() => void) | null;
  connect(destino: NoDeGanho): unknown;
  disconnect(): void;
  /**
   * ⚠️ De uso ÚNICO. Uma fonte que tocou (ou que parou) não volta a arrancar — é assim na Web
   * Audio API, e é por isso que a Mesa deita fora as fontes a cada pausa e a cada busca, e
   * cria outras. Guardar a fonte para reutilizar é o erro clássico aqui.
   */
  start(quando: number, deslocamento: number): void;
  stop(): void;
}

export interface ContextoDeAudio {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: 'suspended' | 'running' | 'closed' | string;
  readonly destination: Destino;
  createGain(): NoDeGanho;
  createBufferSource(): FonteDeAudio;
  createBuffer(canais: number, tamanho: number, taxa: number): BufferDeAudio;
  /**
   * Bytes, ou um caminho.
   *
   * O navegador só aceita `ArrayBuffer`. O `react-native-audio-api` aceita também o caminho de
   * um ficheiro local — e é por aí que o app vai, porque já descarrega o stem para a cache
   * (que é a mesma cache que evita pagar o egress duas vezes).
   */
  decodeAudioData(dados: ArrayBuffer | string): Promise<BufferDeAudio>;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}
