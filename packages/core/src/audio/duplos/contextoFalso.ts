// ⚠️ Este arquivo mora FORA de `__tests__` de propósito: o `testMatch` do núcleo trata todo
// arquivo daquela pasta como uma suíte, e um duplo de teste sem `it()` nenhum reprovava a suíte
// inteira com "your test suite must contain at least one test".

import type {
  BufferDeAudio, ContextoDeAudio, Destino, FonteDeAudio, NoDeGanho, ParametroDeAudio,
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
  arranques: { quando: number; deslocamento: number }[] = [];
  parada = false;
  desligada = false;
  /** Uma fonte que já acabou sozinha lança no `stop` — como a de verdade. */
  jaTerminou = false;

  connect(destino: NoDeGanho) { this.ligadaA = destino; return destino; }
  disconnect() { this.desligada = true; }
  start(quando: number, deslocamento: number) { this.arranques.push({ quando, deslocamento }); }
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

export class BufferFalso implements BufferDeAudio {
  constructor(
    readonly duration: number,
    readonly numberOfChannels = 2,
    readonly sampleRate = 44100,
    private readonly dados?: Float32Array[],
  ) {}
  get length() { return Math.round(this.duration * this.sampleRate); }
  getChannelData(canal: number) { return this.dados?.[canal] ?? new Float32Array(0); }
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

  createGain() { const g = new GanhoFalso(); this.ganhos.push(g); return g; }
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
