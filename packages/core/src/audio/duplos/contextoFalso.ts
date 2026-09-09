// ⚠️ Este arquivo mora FORA de `__tests__` de propósito: o `testMatch` do núcleo trata todo
// arquivo daquela pasta como uma suíte, e um duplo de teste sem `it()` nenhum reprovava a suíte
// inteira com "your test suite must contain at least one test".

import type {
  BufferDeAudio, ContextoDeAudio, ContextoOffline, Destino, FonteDeAudio, Modelador, NoDeGanho,
  Panorama, ParametroDeAudio,
} from '../contexto';

// O motor de áudio de mentira: relógio na mão, e um registo de tudo o que a mesa mandou fazer.
//
// É isto que torna a mesa testável. Áudio de verdade não se testa em CI — não há placa de som,
// e mesmo que houvesse, "tocaram juntas?" não é uma asserção que se escreva. O que SE escreve é
// "as três fontes receberam `start` com o mesmo instante", e para isso basta um duplo que
// aponte os instantes num papel.
//
// O relógio não anda sozinho: `avancar(2)` é o teste a dizer "passaram dois segundos". Um
// relógio real tornaria os testes lentos e instáveis; este torna-os exatos.

export class FonteFalsa implements FonteDeAudio {
  buffer: BufferDeAudio | null = null;
  onended: (() => void) | null = null;
  ligadaA: NoDeGanho | null = null;
  arranques: { quando: number; deslocamento: number; duracao?: number }[] = [];
  parada = false;
  desligada = false;
  /** Uma fonte que já acabou sozinha lança no `stop` — como a de verdade. */
  jaTerminou = false;

  connect(destino: NoDeGanho) { this.ligadaA = destino; return destino; }
  disconnect() { this.desligada = true; }
  start(quando: number, deslocamento: number, duracao?: number) {
    this.arranques.push({ quando, deslocamento, duracao });
  }
  stop() {
    if (this.jaTerminou) throw new Error('InvalidStateError');
    this.parada = true;
  }
}

export class ParametroFalso implements ParametroDeAudio {
  value = 1;
  /** Cada mudança de ganho, na ordem em que aconteceu. */
  historico: { valor: number; quando: number }[] = [];
  setValueAtTime(valor: number, quando: number) { this.value = valor; this.historico.push({ valor, quando }); return this; }
  setTargetAtTime(valor: number, quando: number) { this.value = valor; this.historico.push({ valor, quando }); return this; }
}

export class GanhoFalso implements NoDeGanho {
  gain = new ParametroFalso();
  ligadoA: NoDeGanho | Destino | null = null;
  desligado = false;
  connect(destino: NoDeGanho | Destino) { this.ligadoA = destino; return destino; }
  disconnect() { this.desligado = true; }
}

export class ModeladorFalso implements Modelador {
  curve: Float32Array | null = null;
  oversample = 'none';
  ligadoA: NoDeGanho | Destino | null = null;
  desligado = false;
  connect(destino: NoDeGanho | Destino) { this.ligadoA = destino; return destino; }
  disconnect() { this.desligado = true; }
}

/**
 * A taxa de amostragem do falso.
 *
 * 100 Hz, e não 44100: um buffer de três minutos a 44,1 kHz são oito milhões de números por
 * pista, e uma suíte com meia dúzia deles passa a medir-se em gigabytes. A 100 Hz a aritmética
 * do tempo é exatamente a mesma (um segundo continua a ser um segundo) e o áudio cabe na mão.
 */
export const TAXA_FALSA = 100;

export class PanoramaFalso implements Panorama {
  pan = new ParametroFalso();
  ligadoA: NoDeGanho | Destino | null = null;
  desligado = false;
  connect(destino: NoDeGanho | Destino) { this.ligadoA = destino; return destino; }
  disconnect() { this.desligado = true; }
}

export class BufferFalso implements BufferDeAudio {
  private readonly canais: Float32Array[];

  constructor(
    readonly duration: number,
    readonly numberOfChannels = 2,
    readonly sampleRate = TAXA_FALSA,
    dados?: Float32Array[],
  ) {
    // Uma onda de verdade, e não zeros: os picos são calculados a partir daqui, e um canal
    // vazio faria qualquer teste de onda passar sem provar nada. A amplitude cresce ao longo
    // do buffer, para que um recorte do começo e um do fim sejam distinguíveis.
    this.canais = dados ?? Array.from({ length: numberOfChannels }, () => {
      const total = Math.round(duration * sampleRate);
      const onda = new Float32Array(total);
      for (let i = 0; i < total; i += 1) {
        onda[i] = Math.sin(i / 4) * (0.1 + 0.9 * (i / Math.max(1, total - 1)));
      }
      return onda;
    });
  }

  get length() { return Math.round(this.duration * this.sampleRate); }
  getChannelData(canal: number) { return this.canais[canal] ?? new Float32Array(0); }
}

export class ContextoFalso implements ContextoDeAudio {
  currentTime = 0;
  sampleRate = 44100;
  state: 'suspended' | 'running' | 'closed' = 'suspended';
  destination: Destino = {};

  ganhos: GanhoFalso[] = [];
  fontes: FonteFalsa[] = [];
  fechado = false;
  /** A ordem das chamadas que importam para a sequência (resume antes de start, etc.). */
  passos: string[] = [];

  tetos: ModeladorFalso[] = [];
  panoramas: PanoramaFalso[] = [];

  createGain() { const g = new GanhoFalso(); this.ganhos.push(g); return g; }
  createWaveShaper() { const t = new ModeladorFalso(); this.tetos.push(t); return t; }
  createStereoPanner() { const p = new PanoramaFalso(); this.panoramas.push(p); return p; }
  createBufferSource() { const f = new FonteFalsa(); this.fontes.push(f); this.passos.push('fonte'); return f; }
  createBuffer(canais: number, tamanho: number, taxa: number) {
    return new BufferFalso(tamanho / taxa, canais, taxa, [new Float32Array(tamanho)]);
  }

  /**
   * A duração viaja no TAMANHO dos dados.
   *
   * `buscar` devolve `new ArrayBuffer(180)` e isto dá um buffer de 180 segundos — assim os
   * testes escrevem durações sem precisarem de ficheiros de áudio nenhuns.
   */
  async decodeAudioData(dados: ArrayBuffer | string): Promise<BufferDeAudio> {
    const segundos = typeof dados === 'string' ? Number(dados) || 1 : dados.byteLength;
    return new BufferFalso(segundos);
  }

  async resume() { this.state = 'running'; this.passos.push('resume'); }
  async suspend() { this.state = 'suspended'; this.passos.push('suspend'); }
  async close() { this.state = 'closed'; this.fechado = true; }

  /** O teste a dizer "passaram N segundos". */
  avancar(segundos: number) { this.currentTime += segundos; }

  /** Só as fontes que chegaram a arrancar. */
  get arrancadas() { return this.fontes.filter((f) => f.arranques.length > 0); }
}

/** Um `buscar` que devolve a duração pedida, e falha para as URLs que contenham `falha`. */
export const buscarFalso = (duracoes: Record<string, number>): (url: string) => Promise<ArrayBuffer> =>
  async (url: string) => {
    if (url.includes('falha')) throw new Error('404');
    return new ArrayBuffer(duracoes[url] ?? 180);
  };


/**
 * O contexto que RENDERIZA de mentira.
 *
 * Não soma amostra nenhuma — devolve um buffer do tamanho pedido. O que ele prova é o GRAFO: que
 * a guia passou pelo teto, que cada pista levou o seu ganho e o seu panorama, e que os clipes
 * foram agendados nos instantes certos. A soma em si é do motor de áudio, não nossa.
 */
export class OfflineFalso extends ContextoFalso implements ContextoOffline {
  renderizou = false;

  constructor(readonly canais: number, readonly length: number, readonly taxa: number) {
    super();
    this.sampleRate = taxa;
  }

  async startRendering(): Promise<BufferDeAudio> {
    this.renderizou = true;
    return new BufferFalso(this.length / this.taxa, this.canais, this.taxa);
  }
}
