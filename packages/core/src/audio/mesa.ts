import type { BufferDeAudio, ContextoDeAudio, FonteDeAudio, NoDeGanho } from './contexto';
import { picos as picosDoBuffer } from './picos';

// A MESA: N pistas de áudio tocando em sincronia, com mutar, solo e volume.
//
// É o motor do editor de stems do Espaço JAM. Vive no núcleo e não conhece nem o navegador nem
// o React Native: recebe um `ContextoDeAudio` de fora. A web passa o `AudioContext` do
// navegador, o app passa o do `react-native-audio-api`, e os testes passam um falso com relógio
// manual — é isso que torna a lógica toda (arranque, busca, solo, falhas) testável sem tocar
// um único som.
//
// ─── Por que as fontes são descartáveis ──────────────────────────────────────
//
// Um `AudioBufferSourceNode` toca UMA vez. Não há `pause`, não há segundo `start`. Portanto:
// pausar = parar as fontes e guardar em que segundo íamos; retomar = criar fontes novas e
// arrancá-las a partir dali. O que persiste entre uma coisa e outra é o BUFFER (caro, é o áudio
// descodificado) e o NÓ DE GANHO de cada pista (para o fader não saltar). As fontes nascem e
// morrem a cada play/pausa/busca.
//
// ─── Por que a sincronia funciona ────────────────────────────────────────────
//
// Todas as fontes recebem `start(quando, deslocamento)` com o MESMO `quando`, um instante no
// futuro. O contexto agenda-as no seu relógio de amostras, não no relógio do JavaScript — a
// precisão é de uma amostra, não dos milissegundos que o JS conseguiria. A antecedência existe
// porque criar seis fontes em JS leva tempo: sem ela, a sexta pediria "agora" já depois de a
// primeira ter começado.

/** Uma pista a carregar: o que a mesa precisa saber antes de ter o áudio. */
export interface Pista {
  id: string;
  nome: string;
  url: string;
  /** 0..1. O que ficou guardado no banco, ou 1. */
  ganhoInicial?: number;
  /** A Mix ★ entra muda quando a gravação tem stems: senão o áudio soa dobrado. */
  mudaInicial?: boolean;
}

export type CargaDaPista = 'na-fila' | 'carregando' | 'pronta' | 'erro';

export interface EstadoDaPista {
  id: string;
  nome: string;
  carga: CargaDaPista;
  erro?: string;
  duracao: number;
  muda: boolean;
  solo: boolean;
  /** A posição do fader. SOBREVIVE ao mute — mutar não é baixar o volume a zero. */
  ganho: number;
}

export interface EstadoDaMesa {
  pistas: EstadoDaPista[];
  tocando: boolean;
  posicao: number;
  /** A da pista mais longa que carregou. */
  duracao: number;
  carregando: boolean;
}

/** Traz os bytes (web) ou o caminho local (app) de uma URL. */
export type Buscar = (url: string) => Promise<ArrayBuffer | string>;

export interface OpcoesDaMesa {
  /**
   * Quanto à frente agendar o arranque, em segundos.
   *
   * 50 ms é folga que sobra para criar as fontes e não é percetível como atraso. Menos que
   * isto e uma mesa com muitas pistas arrisca pedir um instante que já passou.
   */
  antecedencia?: number;
  /**
   * Somar os canais num só.
   *
   * Metade da memória: um stem de 4 minutos passa de ~85 MB para ~42. Ligado no app, onde a
   * memória mata; desligado na web. Custa o panorama estéreo — aceitável num editor de
   * revisão, não num de mistura.
   */
  mono?: boolean;
}

/**
 * O ganho que uma pista deve ter, dado o estado da mesa.
 *
 * Exportada e pura de propósito: é a regra que mais erra na mão (mute vs solo vs fader), e
 * assim testa-se sem contexto nenhum.
 *
 * A ordem importa: MUTE VENCE SOLO. Uma pista mutada e solada fica calada — quem a mutou disse
 * "não quero ouvir isto", e solar outra coisa não desfaz essa vontade.
 */
export const ganhoEfetivo = (
  pista: { muda: boolean; solo: boolean; ganho: number },
  haSolo: boolean,
): number => (pista.muda || (haSolo && !pista.solo) ? 0 : pista.ganho);

interface PistaViva extends EstadoDaPista {
  url: string;
  buffer: BufferDeAudio | null;
  saida: NoDeGanho | null;
  fonte: FonteDeAudio | null;
}

const ANTECEDENCIA_PADRAO = 0.05;
/** A rampa do ganho, em segundos. Curta o bastante para ser instantânea, longa para não estalar. */
const RAMPA = 0.01;

export class Mesa {
  private readonly ctx: ContextoDeAudio;
  private readonly buscar: Buscar;
  private readonly antecedencia: number;
  private readonly mono: boolean;

  private mestre: NoDeGanho | null = null;
  private pistas: PistaViva[] = [];
  private ouvintes = new Set<(e: EstadoDaMesa) => void>();

  private tocando = false;
  /** Em que segundo da música estamos, quando parado. */
  private deslocamento = 0;
  /** O `currentTime` do contexto no instante em que as fontes arrancaram. */
  private inicioNoContexto = 0;
  private descartada = false;

  constructor(ctx: ContextoDeAudio, buscar: Buscar, opcoes: OpcoesDaMesa = {}) {
    this.ctx = ctx;
    this.buscar = buscar;
    this.antecedencia = opcoes.antecedencia ?? ANTECEDENCIA_PADRAO;
    this.mono = opcoes.mono ?? false;
  }

  // ─── Carregar ─────────────────────────────────────────────────────────────

  /**
   * Baixa e descodifica as pistas.
   *
   * Um stem que falha (404, formato que o descodificador não lê) NÃO pode calar os outros: fica
   * marcado como erro, com um "tentar de novo" na tela, e a mesa toca o resto.
   *
   * Quem garante isso é o `try/catch` dentro de `carregarUma` — ele transforma a falha em
   * estado, e a promessa nunca rejeita. (Cheguei a escrever `Promise.allSettled` aqui a pensar
   * que era ele a proteger; a mutação mostrou que `all` e `allSettled` eram indistinguíveis,
   * porque nada rejeita. Ficou o `all`, que é o que a leitura promete.)
   *
   * Sequencial quando `mono` (o app): descodificar quatro WAV de 40 MB ao mesmo tempo é um pico
   * de memória de quatro ficheiros mais quatro PCM — é onde o sistema mata a aplicação.
   */
  async carregar(pistas: Pista[]): Promise<void> {
    if (this.descartada) return;
    this.pararFontes();
    this.soltarPistas();
    this.deslocamento = 0;
    this.tocando = false;

    this.pistas = pistas.map((p) => ({
      id: p.id,
      nome: p.nome,
      url: p.url,
      carga: 'na-fila',
      duracao: 0,
      muda: p.mudaInicial ?? false,
      solo: false,
      ganho: p.ganhoInicial ?? 1,
      buffer: null,
      saida: null,
      fonte: null,
    }));
    this.avisar();

    const carregarUma = async (viva: PistaViva) => {
      viva.carga = 'carregando';
      this.avisar();
      try {
        const dados = await this.buscar(viva.url);
        const cru = await this.ctx.decodeAudioData(dados);
        // A mesa pode ter sido descartada, ou recarregada com outra gravação, enquanto isto
        // corria. Sem esta guarda, o buffer de uma gravação antiga entraria na mesa nova.
        if (this.descartada || !this.pistas.includes(viva)) return;
        viva.buffer = this.mono ? this.paraMono(cru) : cru;
        viva.duracao = viva.buffer.duration;
        viva.saida = this.ctx.createGain();
        viva.saida.gain.value = 0;
        viva.saida.connect(this.saidaMestre());
        viva.carga = 'pronta';
      } catch (e) {
        viva.carga = 'erro';
        viva.erro = e instanceof Error ? e.message : 'Não consegui carregar esta pista.';
      }
      this.avisar();
    };

    if (this.mono) {
      for (const viva of this.pistas) await carregarUma(viva);
    } else {
      await Promise.all(this.pistas.map(carregarUma));
    }

    this.aplicarGanhos();
    this.avisar();
  }

  // ─── Transporte ───────────────────────────────────────────────────────────

  /**
   * Toca todas as pistas prontas, a partir de onde parámos.
   *
   * O `resume` vem ANTES do agendamento e não é cerimónia: na web o contexto nasce suspenso
   * até um gesto da pessoa, e o clique no play é esse gesto. Agendar antes de retomar produz
   * fontes marcadas para um instante que o contexto parado nunca alcança — silêncio sem erro.
   */
  async tocar(): Promise<void> {
    if (this.descartada || this.tocando) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.descartada) return;

    const prontas = this.pistas.filter((p) => p.carga === 'pronta' && p.buffer);
    if (!prontas.length) return;
    if (this.deslocamento >= this.duracaoTotal()) this.deslocamento = 0;

    const quando = this.ctx.currentTime + this.antecedencia;
    for (const pista of prontas) {
      // Uma pista mais curta que o ponto onde estamos simplesmente não entra: pedir um
      // deslocamento além da duração faz o contexto recusar a fonte.
      if (this.deslocamento >= pista.duracao) continue;
      const fonte = this.ctx.createBufferSource();
      fonte.buffer = pista.buffer;
      fonte.connect(pista.saida as NoDeGanho);
      fonte.start(quando, this.deslocamento);
      pista.fonte = fonte;
    }

    this.inicioNoContexto = quando;
    this.tocando = true;
    this.aplicarGanhos();
    this.avisar();
  }

  pausar(): void {
    if (!this.tocando) return;
    this.deslocamento = this.posicao();
    this.pararFontes();
    this.tocando = false;
    void this.ctx.suspend?.();
    this.avisar();
  }

  /** Leva a mesa a um segundo. A tocar, recomeça de lá; parada, só marca o ponto. */
  irPara(segundo: number): void {
    const alvo = Math.max(0, Math.min(segundo, this.duracaoTotal()));
    const estava = this.tocando;
    this.pararFontes();
    this.tocando = false;
    this.deslocamento = alvo;
    if (estava) void this.tocar();
    else this.avisar();
  }

  /**
   * Onde a música está.
   *
   * Derivada do relógio do CONTEXTO, não de um contador nosso: é o mesmo relógio que agendou as
   * fontes, então a agulha na tela e o som nunca divergem, por mais que o JS engasgue.
   */
  posicao(): number {
    const bruta = this.tocando
      ? this.deslocamento + (this.ctx.currentTime - this.inicioNoContexto)
      : this.deslocamento;
    return Math.max(0, Math.min(bruta, this.duracaoTotal()));
  }

  /** Chamado pelo tique da tela: quando a música acaba, a mesa volta ao início e pára. */
  verificarFim(): void {
    if (!this.tocando) return;
    const total = this.duracaoTotal();
    if (total > 0 && this.posicao() >= total) {
      this.pararFontes();
      this.tocando = false;
      this.deslocamento = 0;
      void this.ctx.suspend?.();
      this.avisar();
    }
  }

  // ─── Mistura ──────────────────────────────────────────────────────────────

  mudar(id: string, muda: boolean): void {
    const pista = this.pistas.find((p) => p.id === id);
    if (!pista) return;
    pista.muda = muda;
    this.aplicarGanhos();
    this.avisar();
  }

  solar(id: string, solo: boolean): void {
    const pista = this.pistas.find((p) => p.id === id);
    if (!pista) return;
    pista.solo = solo;
    this.aplicarGanhos();
    this.avisar();
  }

  /** Move o fader. O valor guardado é o do fader — mutar não o apaga. */
  ganho(id: string, valor: number): void {
    const pista = this.pistas.find((p) => p.id === id);
    if (!pista) return;
    pista.ganho = Math.max(0, Math.min(valor, 1));
    this.aplicarGanhos();
    this.avisar();
  }

  // ─── Leitura ──────────────────────────────────────────────────────────────

  estado(): EstadoDaMesa {
    return {
      pistas: this.pistas.map(({ id, nome, carga, erro, duracao, muda, solo, ganho }) => ({
        id, nome, carga, erro, duracao, muda, solo, ganho,
      })),
      tocando: this.tocando,
      posicao: this.posicao(),
      duracao: this.duracaoTotal(),
      carregando: this.pistas.some((p) => p.carga === 'na-fila' || p.carga === 'carregando'),
    };
  }

  ouvir(fn: (e: EstadoDaMesa) => void): () => void {
    this.ouvintes.add(fn);
    return () => { this.ouvintes.delete(fn); };
  }

  /** A mini-onda de uma pista, do buffer que já está na memória. */
  picos(id: string, n: number): number[] {
    const pista = this.pistas.find((p) => p.id === id);
    return pista?.buffer ? picosDoBuffer(pista.buffer, n) : [];
  }

  /** Cala tudo, desliga o grafo e solta os buffers. Sair da tela sem isto deixa a mesa a tocar. */
  async descartar(): Promise<void> {
    if (this.descartada) return;
    this.descartada = true;
    this.pararFontes();
    this.soltarPistas();
    this.mestre?.disconnect();
    this.mestre = null;
    this.tocando = false;
    this.ouvintes.clear();
    await this.ctx.close();
  }

  // ─── Por dentro ───────────────────────────────────────────────────────────

  private saidaMestre(): NoDeGanho {
    if (!this.mestre) {
      this.mestre = this.ctx.createGain();
      this.mestre.gain.value = 1;
      this.mestre.connect(this.ctx.destination);
    }
    return this.mestre;
  }

  private duracaoTotal(): number {
    return this.pistas.reduce((maior, p) => Math.max(maior, p.duracao), 0);
  }

  private aplicarGanhos(): void {
    const haSolo = this.pistas.some((p) => p.solo);
    const agora = this.ctx.currentTime;
    for (const pista of this.pistas) {
      if (!pista.saida) continue;
      pista.saida.gain.setTargetAtTime(ganhoEfetivo(pista, haSolo), agora, RAMPA);
    }
  }

  private pararFontes(): void {
    for (const pista of this.pistas) {
      if (!pista.fonte) continue;
      // `stop()` numa fonte que já terminou sozinha lança. Não é erro nosso — é o fim natural
      // da música a chegar antes do nosso pedido.
      try { pista.fonte.stop(); } catch { /* já tinha acabado */ }
      pista.fonte.disconnect();
      pista.fonte = null;
    }
  }

  private soltarPistas(): void {
    for (const pista of this.pistas) {
      pista.saida?.disconnect();
      pista.saida = null;
      pista.buffer = null;
    }
    this.pistas = [];
  }

  /** Média dos canais num buffer novo. O estéreo original é solto a seguir. */
  private paraMono(buffer: BufferDeAudio): BufferDeAudio {
    if (buffer.numberOfChannels <= 1) return buffer;
    const destino = this.ctx.createBuffer(1, buffer.length, buffer.sampleRate);
    const saida = destino.getChannelData(0);
    const canais = Array.from(
      { length: buffer.numberOfChannels },
      (_, c) => buffer.getChannelData(c),
    );
    for (let i = 0; i < buffer.length; i += 1) {
      let soma = 0;
      for (const canal of canais) soma += canal[i];
      saida[i] = soma / canais.length;
    }
    return destino;
  }

  private avisar(): void {
    const e = this.estado();
    // `forEach` e não `for…of`: o alvo do TypeScript da web é anterior ao ES2015 e recusa
    // iterar um `Set` sem `downlevelIteration`. Foi o build da web que apanhou isto — o do app
    // compila com outro alvo e passava.
    this.ouvintes.forEach((fn) => fn(e));
  }
}
