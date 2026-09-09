import type {
  BufferDeAudio, ContextoDeAudio, ContextoOffline, FonteDeAudio, Modelador, NoDeGanho, Panorama,
} from './contexto';
import { picos as picosDoBuffer } from './picos';
import { curvaDoTeto } from './teto';

// A MESA: as pistas de um editor de música, tocando em sincronia.
//
// É o motor do Espaço JAM. Vive no núcleo e não conhece nem o navegador nem o React Native:
// recebe um `ContextoDeAudio` de fora. A web passa o `AudioContext` do navegador, o app passa o
// do `react-native-audio-api`, e os testes passam um falso com relógio manual — é isso que
// torna a lógica toda (agendamento, busca, solo, falhas) testável sem tocar um único som.
//
// ─── Pista e clipe: a diferença que faz disto um editor ──────────────────────
//
// A primeira versão desta mesa tocava N stems, todos a partir do segundo zero. Isso é um
// TOCADOR de camadas. Um editor — Ableton, Logic, Pro Tools — tem um EIXO DO TEMPO: a pista é
// uma faixa vazia, e dentro dela moram CLIPES, cada um com a hora em que entra (`inicio`), o
// recorte dentro do ficheiro (`recorte`) e quanto dura. Arrastar é mudar `inicio`. Cortar ao
// meio é fazer nascer dois clipes sobre o MESMO ficheiro, com recortes diferentes — por isso a
// edição é instantânea e não destrói nada.
//
// ─── Por que as fontes são descartáveis ──────────────────────────────────────
//
// Um `AudioBufferSourceNode` toca UMA vez. Não há `pause`, não há segundo `start`. Portanto:
// pausar = parar as fontes e guardar em que segundo íamos; retomar = criar fontes novas e
// arrancá-las a partir dali. O que persiste entre uma coisa e outra são os BUFFERS (caros: é o
// áudio descodificado) e o nó de ganho de cada pista (para o fader não saltar).
//
// ─── Por que a sincronia funciona ────────────────────────────────────────────
//
// Todas as fontes são agendadas contra o MESMO instante-base, um pouco no futuro. Um clipe que
// entra aos 4,25 s recebe `start(base + 4.25, …)`, e o contexto agenda-o no seu relógio de
// AMOSTRAS, não no relógio do JavaScript — a precisão é de uma amostra. A antecedência existe
// porque criar as fontes em JS leva tempo: sem ela, a última pediria "agora" já depois de a
// primeira ter começado.

/** Um pedaço de áudio numa pista, num instante. */
export interface Clipe {
  id: string;
  /** De onde vem o som. Dois clipes podem partilhar a mesma URL — é o que um corte produz. */
  url: string;
  /** Em que segundo da linha do tempo o clipe começa a soar. */
  inicio: number;
  /** A partir de que segundo DO FICHEIRO. Aparar a ponta esquerda mexe aqui. */
  recorte: number;
  /** Quanto do ficheiro entra. Aparar a ponta direita mexe aqui. */
  duracao: number;
}

/** Uma faixa da mesa: um nome, um volume, um mudo, e os clipes que moram nela. */
export interface Pista {
  id: string;
  nome: string;
  clipes: Clipe[];
  /** 0..1. O que ficou guardado no banco, ou 1. */
  ganhoInicial?: number;
  mudaInicial?: boolean;
  /** −1 esquerda, 0 centro, 1 direita. */
  panInicial?: number;
}

export type CargaDaPista = 'na-fila' | 'carregando' | 'pronta' | 'erro';

export interface EstadoDaPista {
  id: string;
  nome: string;
  carga: CargaDaPista;
  erro?: string;
  muda: boolean;
  solo: boolean;
  /** A posição do fader. SOBREVIVE ao mute — mutar não é baixar o volume a zero. */
  ganho: number;
  /** −1 esquerda, 0 centro, 1 direita. */
  pan: number;
}

export interface EstadoDaMesa {
  pistas: EstadoDaPista[];
  /** O fader que fica depois de todos os outros. */
  mestre: number;
  tocando: boolean;
  posicao: number;
  /** Onde acaba o último clipe. */
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
   * isto e uma mesa com muitos clipes arrisca pedir um instante que já passou.
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

/**
 * Quando e como um clipe entra, dado o ponto em que a mesa está.
 *
 * Pura, exportada e testada à parte porque é a aritmética central do editor, e a que mais
 * silenciosamente erra: um sinal trocado aqui faz o clipe entrar no lugar errado, e som no
 * lugar errado é indistinguível de "o ficheiro está mau" para quem ouve.
 *
 * Devolve `null` quando o clipe já passou inteiro — e é ISSO que impede a mesa de pedir a uma
 * fonte um deslocamento além do fim do ficheiro, que o contexto recusa.
 */
export const agendamentoDoClipe = (
  clipe: Pick<Clipe, 'inicio' | 'recorte' | 'duracao'>,
  /** Em que segundo da linha do tempo a reprodução vai começar. */
  deslocamento: number,
): { atraso: number; recorte: number; duracao: number } | null => {
  const dentro = deslocamento - clipe.inicio;
  // Ainda não chegou: espera o tempo que falta e toca inteiro.
  // `Math.max(0, …)` e não `-dentro`: com `dentro` igual a zero aquilo dá menos zero, que é um
  // número diferente de zero para quem compara com `Object.is` — e foi um teste que o apanhou.
  if (dentro <= 0) return { atraso: Math.max(0, -dentro), recorte: clipe.recorte, duracao: clipe.duracao };
  // Já acabou: não entra. (`>=` e não `>`: um clipe que acaba exatamente aqui não tem o que dar.)
  if (dentro >= clipe.duracao) return null;
  // Estamos a meio dele: entra já, do ponto correspondente, pelo que sobra.
  return { atraso: 0, recorte: clipe.recorte + dentro, duracao: clipe.duracao - dentro };
};

interface ClipeVivo extends Clipe {
  fonte: FonteDeAudio | null;
}

interface PistaViva {
  id: string;
  nome: string;
  clipes: ClipeVivo[];
  carga: CargaDaPista;
  erro?: string;
  muda: boolean;
  solo: boolean;
  ganho: number;
  pan: number;
  saida: NoDeGanho | null;
  panorama: Panorama | null;
}

const ANTECEDENCIA_PADRAO = 0.05;
/** A rampa do ganho, em segundos. Curta o bastante para ser instantânea, longa para não estalar. */
const RAMPA = 0.01;
/** Quantas amostras tem a curva do teto. 2048 é fino o bastante para a dobra não ter degraus. */
const PONTOS_DA_CURVA = 2048;

export class Mesa {
  private readonly ctx: ContextoDeAudio;
  private readonly buscar: Buscar;
  private readonly antecedencia: number;
  private readonly mono: boolean;

  private mestre: NoDeGanho | null = null;
  private teto: Modelador | null = null;
  private ganhoDoMestre = 1;
  private pistas: PistaViva[] = [];
  private ouvintes = new Set<(e: EstadoDaMesa) => void>();

  /**
   * O áudio descodificado, por URL.
   *
   * ⚠️ POR URL, e não por clipe: cortar um clipe ao meio produz dois clipes sobre o mesmo
   * ficheiro, e descodificar duas vezes seria dobrar a memória (dezenas de MB) para tocar
   * exatamente o mesmo som. É também o que faz arrastar um clipe custar zero: a montagem muda,
   * o áudio não.
   */
  private buffers = new Map<string, BufferDeAudio>();
  private falhas = new Map<string, string>();

  private tocando = false;
  /** Em que segundo da linha do tempo estamos, quando parado. */
  private deslocamento = 0;
  /** O `currentTime` do contexto no instante em que a reprodução arrancou. */
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
   * Recebe a montagem e garante que o áudio dela está na memória.
   *
   * ⚠️ CHAMADA A CADA EDIÇÃO, e por isso tem de ser barata quando nada de novo entrou: arrastar
   * um clipe, cortá-lo, mudar-lhe o nome — tudo passa por aqui, e nada disso pode voltar a
   * baixar 400 MB. O que decide é a gaveta de buffers: URL que já lá está não é buscada outra
   * vez, e URL que deixou de ser usada é solta.
   *
   * Um ficheiro que falha (404, formato que o descodificador não lê) NÃO pode calar os outros:
   * as pistas que dependem dele ficam com erro, e a mesa toca o resto.
   *
   * Sequencial quando `mono` (o app): descodificar quatro WAV de 40 MB ao mesmo tempo é um pico
   * de memória de quatro ficheiros mais quatro PCM — é onde o sistema mata a aplicação.
   */
  async carregar(pistas: Pista[]): Promise<void> {
    if (this.descartada) return;

    const tocava = this.tocando;
    this.pararFontes();

    // O grafo de ganhos é reaproveitado por id: sem isto, cada edição criaria um nó novo e o
    // ganho antigo ficaria pendurado no mestre, somando som para sempre.
    const antigas = new Map(this.pistas.map((p) => [p.id, p]));
    this.pistas = pistas.map((nova) => {
      const antiga = antigas.get(nova.id);
      antigas.delete(nova.id);
      return {
        id: nova.id,
        nome: nova.nome,
        clipes: nova.clipes.map((c) => ({ ...c, fonte: null })),
        carga: 'na-fila' as CargaDaPista,
        // O que é ESCUTA (mudo, solo, fader) sobrevive à edição: cortar um clipe não pode
        // acender uma pista que a pessoa tinha calado.
        muda: antiga ? antiga.muda : nova.mudaInicial ?? false,
        solo: antiga ? antiga.solo : false,
        ganho: antiga ? antiga.ganho : nova.ganhoInicial ?? 1,
        pan: antiga ? antiga.pan : nova.panInicial ?? 0,
        saida: antiga?.saida ?? null,
        panorama: antiga?.panorama ?? null,
      };
    });
    // `forEach` e não `for…of`: o alvo do TypeScript da web é anterior ao ES2015 e recusa
    // iterar um `Map` sem `downlevelIteration`.
    antigas.forEach((sobra) => { sobra.saida?.disconnect(); sobra.panorama?.disconnect(); });
    this.avisar();

    const precisas = new Set(pistas.flatMap((p) => p.clipes.map((c) => c.url)));
    Array.from(this.buffers.keys()).forEach((url) => {
      if (!precisas.has(url)) this.buffers.delete(url);
    });
    Array.from(this.falhas.keys()).forEach((url) => {
      if (!precisas.has(url)) this.falhas.delete(url);
    });

    const faltam = Array.from(precisas).filter((url) => !this.buffers.has(url) && !this.falhas.has(url));
    if (faltam.length) {
      for (const pista of this.pistas) {
        if (pista.clipes.some((c) => faltam.includes(c.url))) pista.carga = 'carregando';
      }
      this.avisar();
    }

    const trazer = async (url: string) => {
      try {
        const dados = await this.buscar(url);
        const cru = await this.ctx.decodeAudioData(dados);
        // A mesa pode ter sido descartada, ou recarregada com outra montagem, enquanto isto
        // corria. Sem esta guarda, o buffer de uma gravação antiga entraria na mesa nova.
        if (this.descartada) return;
        this.buffers.set(url, this.mono ? this.paraMono(cru) : cru);
      } catch (e) {
        this.falhas.set(url, e instanceof Error ? e.message : 'Não consegui carregar este áudio.');
      }
    };

    if (this.mono) {
      for (const url of faltam) await trazer(url);
    } else {
      await Promise.all(faltam.map(trazer));
    }
    if (this.descartada) return;

    this.marcarCargas();
    this.ligarSaidas();
    this.aplicarGanhos();
    if (tocava) await this.tocar();
    else this.avisar();
  }

  // ─── Transporte ───────────────────────────────────────────────────────────

  /**
   * Toca a montagem a partir de onde parámos.
   *
   * O `resume` vem ANTES do agendamento e não é cerimónia: na web o contexto nasce suspenso
   * até um gesto da pessoa, e o clique no play é esse gesto. Agendar antes de retomar produz
   * fontes marcadas para um instante que o contexto parado nunca alcança — silêncio sem erro.
   */
  async tocar(): Promise<void> {
    if (this.descartada || this.tocando) return;
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    if (this.descartada) return;
    if (!this.buffers.size) return;
    if (this.deslocamento >= this.duracaoTotal()) this.deslocamento = 0;

    const base = this.ctx.currentTime + this.antecedencia;
    for (const pista of this.pistas) {
      if (!pista.saida) continue;
      for (const clipe of pista.clipes) {
        const buffer = this.buffers.get(clipe.url);
        if (!buffer) continue;
        const quando = agendamentoDoClipe(
          { ...clipe, duracao: this.duracaoEfetiva(clipe) },
          this.deslocamento,
        );
        if (!quando) continue;

        const fonte = this.ctx.createBufferSource();
        fonte.buffer = buffer;
        fonte.connect(pista.saida);
        // Os três argumentos são o editor inteiro: QUANDO tocar, de que ponto do ficheiro, e
        // por quanto tempo. Com um só, todo clipe começaria no zero e duraria o ficheiro.
        fonte.start(base + quando.atraso, quando.recorte, quando.duracao);
        clipe.fonte = fonte;
      }
    }

    this.inicioNoContexto = base;
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

  /** Leva a agulha a um segundo. A tocar, recomeça de lá; parada, só marca o ponto. */
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
   * Onde a agulha está.
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

  /** Move o panorama: −1 esquerda, 0 centro, 1 direita. */
  panoramar(id: string, valor: number): void {
    const pista = this.pistas.find((p) => p.id === id);
    if (!pista) return;
    pista.pan = Math.max(-1, Math.min(valor, 1));
    // A mesma rampa dos ganhos: um salto de panorama estala tanto quanto um salto de volume.
    pista.panorama?.pan.setTargetAtTime(pista.pan, this.ctx.currentTime, RAMPA);
    this.avisar();
  }

  /** O fader que fica depois de todos os outros. */
  mestreEm(valor: number): void {
    this.ganhoDoMestre = Math.max(0, Math.min(valor, 1));
    this.mestre?.gain.setTargetAtTime(this.ganhoDoMestre, this.ctx.currentTime, RAMPA);
    this.avisar();
  }

  // ─── Leitura ──────────────────────────────────────────────────────────────

  estado(): EstadoDaMesa {
    return {
      pistas: this.pistas.map(({ id, nome, carga, erro, muda, solo, ganho, pan }) => ({
        id, nome, carga, erro, muda, solo, ganho, pan,
      })),
      mestre: this.ganhoDoMestre,
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

  /**
   * A onda de um CLIPE, do buffer que já está na memória.
   *
   * Do trecho do clipe, e não do ficheiro inteiro: dois clipes nascidos do mesmo corte
   * desenhariam a mesma onda, e a montagem deixaria de se ler.
   */
  picos(clipeId: string, n: number): number[] {
    for (const pista of this.pistas) {
      const clipe = pista.clipes.find((c) => c.id === clipeId);
      if (!clipe) continue;
      const buffer = this.buffers.get(clipe.url);
      if (!buffer) return [];
      return picosDoBuffer(buffer, n, clipe.recorte, clipe.recorte + this.duracaoEfetiva(clipe));
    }
    return [];
  }

  /** A duração do ficheiro inteiro por trás de um clipe — o limite de quanto se pode esticar. */
  duracaoDoArquivo(url: string): number {
    return this.buffers.get(url)?.duration ?? 0;
  }

  /** Quanto um clipe REALMENTE dura, já limitado pelo fim do ficheiro. */
  duracaoDoClipe(clipeId: string): number {
    for (const pista of this.pistas) {
      const clipe = pista.clipes.find((c) => c.id === clipeId);
      if (clipe) return this.duracaoEfetiva(clipe);
    }
    return 0;
  }

  /**
   * Renderiza a montagem inteira num buffer só — a GUIA da música.
   *
   * ⚠️ O grafo é o MESMO que toca: `fontes → ganho → panorama → mestre → teto`, com o mesmo
   * `agendamentoDoClipe` e o mesmo `ganhoEfetivo`. É isso que garante que a guia soa como o que
   * se ouviu ao montar — duas implementações de "somar as pistas" divergem no primeiro ajuste,
   * e ninguém descobre até alguém reclamar que na lista está diferente.
   *
   * O SOLO não entra: ele é um gesto de escuta ("deixa-me ouvir só esta"), e uma guia gravada
   * com um solo aceso sairia com uma pista só. O mudo entra, porque é decisão de arranjo.
   */
  async renderizar(
    criarOffline: (canais: number, quadros: number, taxa: number) => ContextoOffline,
  ): Promise<BufferDeAudio | null> {
    const duracao = this.duracaoTotal();
    if (!duracao || !this.buffers.size) return null;

    const taxa = this.ctx.sampleRate || 44100;
    const offline = criarOffline(2, Math.ceil(duracao * taxa), taxa);

    const teto = offline.createWaveShaper();
    teto.curve = curvaDoTeto(PONTOS_DA_CURVA);
    teto.oversample = '2x';
    teto.connect(offline.destination);

    const mestre = offline.createGain();
    mestre.gain.value = this.ganhoDoMestre;
    mestre.connect(teto as unknown as NoDeGanho);

    for (const pista of this.pistas) {
      if (pista.carga === 'erro') continue;
      const panorama = offline.createStereoPanner();
      panorama.pan.value = pista.pan;
      panorama.connect(mestre);

      const ganho = offline.createGain();
      // `haSolo: false` de propósito — ver o comentário acima.
      ganho.gain.value = ganhoEfetivo({ ...pista, solo: false }, false);
      ganho.connect(panorama as unknown as NoDeGanho);

      for (const clipe of pista.clipes) {
        const buffer = this.buffers.get(clipe.url);
        if (!buffer) continue;
        const quando = agendamentoDoClipe(
          { ...clipe, duracao: this.duracaoEfetiva(clipe) },
          0,
        );
        if (!quando) continue;
        const fonte = offline.createBufferSource();
        fonte.buffer = buffer;
        fonte.connect(ganho);
        fonte.start(quando.atraso, quando.recorte, quando.duracao);
      }
    }

    return offline.startRendering();
  }

  /** Cala tudo, desliga o grafo e solta os buffers. Sair da tela sem isto deixa a mesa a tocar. */
  async descartar(): Promise<void> {
    if (this.descartada) return;
    this.descartada = true;
    this.pararFontes();
    for (const pista of this.pistas) { pista.saida?.disconnect(); pista.panorama?.disconnect(); }
    this.pistas = [];
    this.buffers.clear();
    this.mestre?.disconnect();
    this.mestre = null;
    this.teto?.disconnect();
    this.teto = null;
    this.tocando = false;
    this.ouvintes.clear();
    await this.ctx.close();
  }

  // ─── Por dentro ───────────────────────────────────────────────────────────

  /**
   * A saída de tudo: `pistas → mestre → teto → alto-falantes`.
   *
   * ⚠️ O TETO NÃO É ENFEITE, É ARITMÉTICA. Seis pistas a ganho 1 somam-se: dois sinais de meia
   * escala em fase dão escala cheia, e a sexta passa de 0 dBFS. O que passa de 0 dBFS não fica
   * mais alto — fica cortado na quina, que é o estalo. Quem abrisse a mesa ia pensar que os
   * ficheiros que enviou estão ruins.
   *
   * É um MODELADOR DE ONDA com uma curva, e não um compressor, porque o motor do telemóvel não
   * tem compressor — a `react-native-audio-api` traz ganho, atraso, filtro, painel e modelador,
   * e nada mais. Isto não foi escolha de gosto: a primeira versão usava
   * `createDynamicsCompressor`, e no aparelho TODAS as pistas morriam em "undefined is not a
   * function", porque aquele nó não existe lá. A curva é a mesma nos dois motores.
   */
  private saidaMestre(): NoDeGanho {
    if (!this.mestre) {
      this.teto = this.ctx.createWaveShaper();
      this.teto.curve = curvaDoTeto(PONTOS_DA_CURVA);
      this.teto.oversample = '2x';
      this.teto.connect(this.ctx.destination);

      this.mestre = this.ctx.createGain();
      this.mestre.gain.value = this.ganhoDoMestre;
      this.mestre.connect(this.teto as unknown as NoDeGanho);
    }
    return this.mestre;
  }

  /**
   * O caminho de uma pista: `fontes → ganho → panorama → mestre`.
   *
   * O panorama vem DEPOIS do ganho porque ele não muda o nível, muda o lugar — e assim o fader
   * continua a dizer a mesma coisa esteja a pista onde estiver entre os alto-falantes.
   */
  private ligarSaidas(): void {
    for (const pista of this.pistas) {
      if (pista.saida || pista.carga === 'erro') continue;
      pista.panorama = this.ctx.createStereoPanner();
      pista.panorama.pan.value = pista.pan;
      pista.panorama.connect(this.saidaMestre());

      pista.saida = this.ctx.createGain();
      pista.saida.gain.value = 0;
      pista.saida.connect(pista.panorama as unknown as NoDeGanho);
    }
  }

  /** A carga de uma pista é a do pior dos ficheiros que ela usa. */
  private marcarCargas(): void {
    for (const pista of this.pistas) {
      const falhou = pista.clipes.find((c) => this.falhas.has(c.url));
      if (falhou) {
        pista.carga = 'erro';
        pista.erro = this.falhas.get(falhou.url);
        continue;
      }
      pista.carga = 'pronta';
      pista.erro = undefined;
    }
  }

  /**
   * Quanto um clipe dura de facto: o que ele pede, limitado pelo que o ficheiro tem.
   *
   * ⚠️ Um clipe NUNCA pode durar mais do que o áudio por trás dele. Sem este limite, a gravação
   * que ainda não foi montada em pistas — cujo clipe nasce com uma duração de reserva, porque a
   * verdadeira só se sabe depois de descodificar — desenhava uma hora de linha do tempo e um
   * retângulo laranja de ponta a ponta.
   */
  private duracaoEfetiva(clipe: Clipe): number {
    const buffer = this.buffers.get(clipe.url);
    if (!buffer) return clipe.duracao;
    return Math.max(0, Math.min(clipe.duracao, buffer.duration - clipe.recorte));
  }

  /** Onde acaba o último clipe de todas as pistas. */
  private duracaoTotal(): number {
    let fim = 0;
    for (const pista of this.pistas) {
      for (const clipe of pista.clipes) fim = Math.max(fim, clipe.inicio + this.duracaoEfetiva(clipe));
    }
    return fim;
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
      for (const clipe of pista.clipes) {
        if (!clipe.fonte) continue;
        // `stop()` numa fonte que já terminou sozinha lança. Não é erro nosso — é o fim natural
        // do clipe a chegar antes do nosso pedido.
        try { clipe.fonte.stop(); } catch { /* já tinha acabado */ }
        clipe.fonte.disconnect();
        clipe.fonte = null;
      }
    }
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
