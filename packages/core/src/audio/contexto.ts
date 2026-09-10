// O que a Mesa precisa de um motor de áudio — e nada mais.
//
// É um subconjunto ESTRUTURAL do `AudioContext`: o do navegador satisfaz isto, e o do
// `react-native-audio-api` também, sem adaptador nenhum. Escrever a interface aqui em vez de
// importar `lib.dom` faz duas coisas que importam:
//
// 1. o núcleo não passa a depender do DOM por causa de áudio (ele corre no app, onde `window`
//    não existe);
// 2. o contexto FALSO dos testes fica pequeno — são estes poucos métodos, e não a superfície
//    inteira da Web Audio API.
//
// Quando a Mesa precisa de um nó novo, ele entra aqui primeiro, e o falso ganha o mesmo — que é
// o que obriga o teste a acompanhar. Foi assim que o teto do mestre entrou.

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

/**
 * O TETO do mestre: um `WaveShaperNode` com uma curva de corte suave.
 *
 * Existe por uma razão de aritmética: seis stems a ganho 1 somados passam de 0 dBFS, e o que
 * passa de 0 dBFS não fica mais alto — fica DISTORCIDO, com o estalo feio de amostras
 * estouradas. Quem ouvisse a mesa iria pensar que os ficheiros que enviou estão ruins.
 *
 * ⚠️ É um modelador de onda, e NÃO um `DynamicsCompressorNode`, e a razão é concreta: o motor
 * do telemóvel (`react-native-audio-api`) não tem compressor. Um limitador só na web seria um
 * som diferente em cada superfície — e o aparelho descobriu isso do pior jeito, com todas as
 * pistas a falharem em "undefined is not a function". O modelador existe nos dois.
 */
export interface Modelador {
  curve: Float32Array | null;
  oversample: string;
  connect(destino: NoDeGanho | Destino): unknown;
  disconnect(): void;
}

/**
 * O PANORAMA de uma pista: onde ela fica entre os dois alto-falantes.
 *
 * −1 é tudo à esquerda, 0 o centro, 1 à direita. É o segundo controlo de qualquer mesa depois
 * do volume, e faz o que o volume não faz: abre espaço entre duas camadas que disputam a mesma
 * frequência, sem baixar nenhuma delas.
 */
export interface Panorama {
  readonly pan: ParametroDeAudio;
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
  /**
   * `quando` no relógio do contexto, `deslocamento` dentro do ficheiro, `duracao` quanto tocar.
   *
   * Os três juntos são o editor inteiro: com um argumento só, todo clipe começaria no zero e
   * duraria o ficheiro. É `start(base + 4.25, 12, 3)` que faz um clipe entrar aos 4,25 s, do
   * segundo 12 do ficheiro, por três segundos.
   */
  start(quando: number, deslocamento: number, duracao?: number): void;
  stop(): void;
}

/**
 * Um contexto que renderiza em vez de tocar: é ele que produz a GUIA.
 *
 * ⚠️ A guia sai do MESMO grafo e do MESMO agendamento que a mesa usa para tocar. É a única
 * forma de garantir que o que se ouve na lista de Músicas é o que se ouviu ao montar — duas
 * implementações de "somar as pistas" divergem no primeiro ajuste, e ninguém descobre até
 * alguém reclamar que "na lista está diferente".
 */
export interface ContextoOffline extends ContextoDeAudio {
  readonly length: number;
  startRendering(): Promise<BufferDeAudio>;
}

export interface ContextoDeAudio {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: 'suspended' | 'running' | 'closed' | string;
  readonly destination: Destino;
  createGain(): NoDeGanho;
  createWaveShaper(): Modelador;
  createStereoPanner(): Panorama;
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
