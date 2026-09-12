import {
  CSSProperties, FC, ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useRef,
  useState,
} from 'react';
import {
  FiAlertCircle, FiCheck, FiCircle, FiCornerUpLeft, FiCornerUpRight, FiDownload, FiFileText,
  FiFolder, FiHeadphones, FiLoader, FiMessageCircle, FiPause,
  FiPlay, FiRepeat, FiSkipBack, FiTrash2, FiVolume2, FiVolumeX, FiX, FiZoomIn, FiZoomOut,
} from 'react-icons/fi';

import type { EstadoDaMesa } from '@maestra/core/audio/mesa';
import type { CatalogTrack } from '@maestra/core/interfaces/maestra';

import { message } from 'antd';

import useIsMobile from '../../../utils/isMobile';
import { Biblioteca, TIPO_DO_ARRASTO, type ItemDaBiblioteca } from './Biblioteca';
import { FaderEmPe } from './FaderEmPe';
import {
  encaixeDaGrade, gradeDoCompasso, marcasDaRegua, passoDaVista, rolagemQueCentra,
  zoomQueEncaixa,
} from '@maestra/core/audio/grade';
import { fimDaPista, pistaAlvoDoArrasto } from '@maestra/core/audio/pistasDaVersao';
import { rotuloDaGuia } from '@maestra/core/audio/exportar';
import { AVISO_DE_ARMAR } from '@maestra/core/constants/maestra';
import { iniciais, type Presente } from '@maestra/core/audio/aoVivo';
import { IconeDaTimeline, IconeDeEnviar, IconeDoMixer } from './icones';
import { Clipe } from './Clipe';
import casca from './editor.module.scss';
import {
  ALTURA_DA_PISTA, ALTURA_DA_REGUA, ALTURA_DO_RODAPE, ALTURA_DO_TITULO, ALTURA_DO_TRANSPORTE,
  DS, DURACAO_MINIMA,
  LARGURA_DAS_PISTAS, PIXELS_POR_SEGUNDO,
  ZOOM_MAXIMO, ZOOM_MINIMO, corDaPista,
} from './tokens';

/** A medida dos quatro ícones das abas. Uma só, para a fila parecer uma fila. */
const TAMANHO_DO_ICONE_DA_ABA = 15;

// O EDITOR: o Espaço JAM como um editor de música.
//
// O desenho é o da referência que o dono do produto mandou: a fila do título com as abas
// Timeline/Mixer e o Master à direita; a coluna das ferramentas e da biblioteca à esquerda; a
// coluna dos cabeçalhos de pista (tipo, M/S/AT, volume e panorama); e a linha do tempo com o
// transporte, a régua em segundos e a agulha vermelha.
//
// ⚠️ ESTA TELA É ESCURA, e é a única do produto que é. Não é gosto: um editor de música é denso
// e de contraste alto porque se olha para ele durante horas e o que interessa são formas de
// onda, não texto.

const relogio = (segundos: number) => {
  const s = Math.max(0, segundos);
  const m = Math.floor(s / 60);
  const resto = Math.floor(s % 60);
  const decimo = Math.floor((s % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(resto).padStart(2, '0')}.${decimo}`;
};

/**
 * O botão redondo do cabeçalho: fechar, abrir em tela cheia.
 *
 * ⚠️ CIRCULAR, e não um quadrado de cantos arredondados. É o idioma do produto — o voltar, o
 * sino, o menu do sistema e o fechar das folhas são todos círculos —, e um quadradinho aqui
 * lia como "mais um controlo da tela" em vez de "isto tira você daqui".
 */
const redondo = {
  width: 28, height: 28, borderRadius: '50%',
  background: DS.color.bgCampo, border: `1px solid ${DS.color.borda}`,
  color: DS.color.textoApoio, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
} as const;

/**
 * As duas pontas da faixa pintada num controlo de panorama, em percentagem do trilho.
 *
 * O panorama é um DESVIO com sinal: zero é o meio. A tinta sai sempre do centro (50 %) e vai
 * até onde o valor mandar — para a esquerda com valor negativo, para a direita com positivo.
 * Centrado, as duas pontas coincidem e não há faixa nenhuma, que é exatamente o que se quer
 * ver quando não há desvio.
 */
export const faixaDoPan = (pan: number) => {
  const meio = 50;
  const desvio = Math.max(-1, Math.min(1, pan)) * 50;
  return desvio >= 0
    ? { de: `${meio}%`, ate: `${meio + desvio}%` }
    : { de: `${meio + desvio}%`, ate: `${meio}%` };
};

const botaozinho = (ativo: boolean, corAtiva?: string) => ({
  height: 24, minWidth: 28, padding: '0 7px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3,
  background: ativo && corAtiva ? corAtiva : DS.color.bgCampo,
  border: `1px solid ${ativo && corAtiva ? corAtiva : DS.color.borda}`,
  borderRadius: DS.raio.pequeno,
  color: ativo && corAtiva ? '#0d0d10' : DS.color.textoApoio,
  fontSize: 11, fontWeight: 700, cursor: 'pointer',
  fontFamily: DS.font.display,
});

/** Quantos avatares cabem antes de virarem um bolo de círculos. O resto vira "+N". */
const AVATARES_A_MOSTRAR = 3;

/**
 * Quem está com esta música aberta AGORA.
 *
 * ⚠️ SOBREPOSTOS E PEQUENOS, ao lado do título. Um editor de música é uma tela cheia, e uma
 * fila de avatares do tamanho de botões competiria por atenção com os controlos: o que isto
 * responde é "estou sozinho?", e para isso três círculos de vinte e quatro pixels chegam. O
 * nome vai no `title` — quem precisa de saber QUEM, passa o rato.
 *
 * ⚠️ E SÓ APARECE A PARTIR DE DOIS. Sozinho, o meu próprio avatar no cabeçalho não diz nada a
 * ninguém; é ruído permanente para informar o caso em que não há informação.
 */
const FilaDePresentes: FC<{ presentes: Presente[] }> = ({ presentes }) => {
  if (presentes.length < 2) return null;
  const mostrados = presentes.slice(0, AVATARES_A_MOSTRAR);
  const sobram = presentes.length - mostrados.length;
  const circulo: CSSProperties = {
    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: `2px solid ${DS.color.bgPainel}`, marginLeft: -8,
    fontSize: 10, fontWeight: 800, color: DS.color.texto, overflow: 'hidden',
  };

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', paddingLeft: 8, flexShrink: 0 }}
      aria-label={`Na música agora: ${presentes.map((p) => p.nome).join(', ')}`}
    >
      {mostrados.map((pessoa) => (
        <div key={pessoa.id} title={pessoa.nome} style={{ ...circulo, background: DS.color.bgPista }}>
          {pessoa.foto
            ? <img src={pessoa.foto} alt='' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : iniciais(pessoa.nome)}
        </div>
      ))}
      {sobram > 0 && (
        <div style={{ ...circulo, background: DS.color.bgCampo, color: DS.color.textoApoio }}>
          {`+${sobram}`}
        </div>
      )}
    </div>
  );
};

export interface AcoesDoEditor {
  aoSair: () => void;
  aoRenomear: (nome: string) => void;
  /** `pistaAlvo` vazio cria uma pista nova para cada ficheiro. */
  aoAdicionarArquivos: (arquivos: File[], inicio: number, pistaAlvo?: string) => void;
  /**
   * Uma faixa VAZIA, sem áudio nenhum.
   *
   * ⚠️ ELA NÃO PEDE UM FICHEIRO, e é essa a diferença. "+ Adicionar faixa" abria o seletor de
   * ficheiros: não havia como preparar a montagem — voz, guitarra, bateria — antes de ter o
   * áudio de cada uma, e quem queria só mais uma linha para largar um clipe tinha de arranjar
   * um ficheiro primeiro. Encher a faixa é o outro botão, o da própria faixa.
   */
  aoCriarPista: () => void;
  /**
   * `de` só chega quando a mão LARGOU, e é o que o desfazer precisa: durante o arrasto isto é
   * chamado a cada pixel, e um passo por pixel encheria a pilha com dezenas de versões do
   * mesmo gesto.
   *
   * `pista` chega quando o arrasto saiu da faixa onde começou — `para` durante o gesto (é o
   * que faz o clipe seguir a mão de linha em linha) e `de` também no fim, para a seta saber
   * de onde ele veio.
   */
  aoMoverClipe: (
    clipeId: string, inicio: number, de?: number, pista?: { para: string; de?: string },
  ) => void;
  aoCortarClipe: (clipeId: string, emSegundo: number) => void;
  /**
   * Repetir o clipe, encostado ao fim dele próprio.
   *
   * ⚠️ NÃO COPIA ÁUDIO. A cópia aponta para o MESMO ficheiro, com o mesmo recorte — é a mesma
   * economia que faz o corte ser instantâneo. Onde ela entra é conta do núcleo (`copiaDoClipe`),
   * para as duas telas repetirem o clipe no mesmo sítio.
   */
  aoDuplicarClipe: (clipeId: string) => void;
  aoApagarClipe: (clipeId: string) => void;
  aoMudarPista: (pistaId: string, parte: Partial<CatalogTrack>) => void;
  aoApagarPista: (pistaId: string) => void;
  aoSolar: (pistaId: string, solo: boolean) => void;
  aoMestre: (valor: number) => void;
}

export const EditorDaGravacao: FC<{
  titulo: string;
  selo: 'parado' | 'salvando' | 'salvo' | 'erro';
  /** O lote em curso, se houver: dez stems levam um minuto, e um minuto sem sinal é um bug. */
  envio?: { feitos: number; total: number } | null;
/**
   * A guia a ser gerada na saída: a tela precisa de dizer por que não fechou ainda.
   *
   * 0..1 enquanto corre, `null` quando não há nada a correr. ⚠️ E não um `boolean`: no telemóvel
   * isto leva um minuto e meio, e reticências paradas durante um minuto e meio são
   * indistinguíveis de uma tela pendurada.
   */
  gerando?: number | null;
  /** Quem está com esta música aberta agora — eu incluído, e à frente. */
  presentes?: Presente[];
  pistas: CatalogTrack[];
  pistaFixaId?: string | null;
  aoMontar?: () => void;
  estado: EstadoDaMesa;
  picos: (clipeId: string, n: number) => number[];
  transporte: {
    alternar: () => void;
    loopar: (v: boolean) => void;
    irPara: (s: number) => void;
    /**
     * Onde a agulha está AGORA, sem esperar pelo tique de 50 ms.
     *
     * É só para DESENHAR o que desliza — a rolagem e a linha vermelha — a sessenta quadros por
     * segundo, sem redesenhar a montagem inteira sessenta vezes. Sai do mesmo relógio de
     * amostras que alimenta o `estado`, e por isso os dois caminhos nunca discordam.
     */
    posicaoAgora?: () => number;
  };
  /** O status da música, no topo: é o estado da OBRA, e anda com o nome dela. */
  ficha: ReactNode;
  /** O andamento e o tom da gravação aberta, no rodapé, junto dos outros controlos. */
  numeros: ReactNode;
  /**
   * As duas setas. Ausente, elas não aparecem — é o que mantém o editor utilizável por quem só
   * olha, sem lhe oferecer botões que não podem fazer nada.
   */
  historico?: {
    podeDesfazer: boolean;
    podeRefazer: boolean;
    rotuloDesfazer: string;
    rotuloRefazer: string;
    ocupado: boolean;
    desfazer: () => void;
    refazer: () => void;
  };
  /**
   * O andamento da gravação aberta, como está escrito no campo.
   *
   * ⚠️ CHEGA CRU, e é de propósito: o campo é de texto e pode estar vazio, a meio de uma
   * digitação ("12"), ou com um engano. Quem decide se aquilo é um andamento é a grelha, num
   * sítio só — e sem andamento a linha do tempo fica marcada em segundos, como sempre esteve.
   */
  bpm?: string | number | null;
  /** A ficha inteira — identidade, créditos —, para a aba do mesmo nome. */
  fichaCompleta: ReactNode;
  /** A tela de exportar: baixar os stems (ZIP) ou a guia (WAV/MP3), para a aba do mesmo nome. */
  exportar: ReactNode;
  /** A letra, que abre num balão flutuante em vez de ocupar uma aba. */
  letra: ReactNode;
  /** A conversa da equipa sobre a música — o terceiro balão da fila. */
  conversa: ReactNode;
  podeEditar: boolean;
  acoes: AcoesDoEditor;
}> = ({
  titulo, selo, envio, gerando, presentes, pistas, pistaFixaId, aoMontar,
  estado, picos, transporte, ficha, numeros, bpm, historico, fichaCompleta, exportar, letra,
  conversa,
  podeEditar, acoes,
}) => {
  // No telemóvel a montagem não se EDITA — arrastar um clipe para o segundo certo com o dedo,
  // num ecrã de 375 px, erra mais do que acerta, e por isso os clipes lá são só de ver
  // (`semEdicao`). O que muda com a largura é a densidade: coluna estreita, controlos que
  // repartem, biblioteca em gaveta, volume e panorama na Mesa.
  const noCelular = useIsMobile();
  // A BIBLIOTECA ABRE E FECHA NAS DUAS TELAS, e o padrão é o que cada uma pede: no desktop há
  // largura para ela ficar à mostra enquanto se monta; no telemóvel, 256 px de coluna são 68 %
  // do ecrã, e ela começa recolhida para a montagem ter onde acontecer.
  const [bibliotecaAberta, setBibliotecaAberta] = useState(() => window.innerWidth >= 768);
  /** O REC do transporte, armado. Armar não grava — marca a intenção e espera o play. */
  const [armado, setArmado] = useState(false);
  /**
   * As pistas armadas para receber a gravação.
   *
   * Duas armações, como em qualquer mesa: a pista diz ONDE grava, o transporte diz QUANDO. Uma
   * sozinha não faz nada, e é por isso que são dois botões e não um.
   */
  const [armadas, setArmadas] = useState<string[]>([]);
  const alternarArmada = (id: string) => setArmadas((atuais) => (
    atuais.includes(id) ? atuais.filter((a) => a !== id) : [...atuais, id]
  ));

  // ⚠️ O EDITOR TEM O SEU PRÓPRIO SELETOR DE FICHEIROS, e isto conserta um botão que morria em
  // silêncio: o "Adicionar pista" procurava o botão da BIBLIOTECA pelo `aria-label` e clicava
  // nele por baixo do pano. Enquanto a biblioteca estava sempre aberta aquilo passou; desde que
  // ela fecha, o botão deixa de existir no DOM, o `?.` engole a chamada, e carregar em
  // "Adicionar pista" não fazia absolutamente nada.
  //
  // Um componente não deve alcançar dentro de outro por texto de rótulo. Aqui o seletor é
  // nosso, e serve o gesto que sobrou: pôr um ficheiro numa faixa que já existe. Criar a faixa
  // deixou de passar por aqui — ela nasce vazia, e o ficheiro vem depois.
  const seletor = useRef<HTMLInputElement>(null);
  const pistaDoEnvio = useRef<string | null>(null);
  const escolherPara = (pistaId: string) => {
    pistaDoEnvio.current = pistaId;
    seletor.current?.click();
  };

  // ⚠️ A LINHA DO TEMPO ENCOLHE OS CONTROLOS, e não as ondas. A coluna de 256 px come 68 % de
  // um ecrã de 375, e o que sobrava para o áudio — que é o assunto desta aba — era um terço.
  // No telemóvel a coluna fica com o nome e o M/S; o volume e o panorama vivem na Mesa, que é
  // onde a mão vai para mexer neles.
  const larguraDasPistas = noCelular ? 132 : LARGURA_DAS_PISTAS;
  const alturaDaPista = noCelular ? 96 : ALTURA_DA_PISTA;
  // ⚠️ A LINHA DO TEMPO ABRE EM TODA A PARTE, incluindo no telemóvel.
  //
  // Ela já abriu na Mesa lá, com o argumento de que montar é trabalho de rato. O argumento
  // continua verdadeiro e mesmo assim a escolha estava errada: a linha do tempo é a cara do
  // editor, é onde se vê o que a música TEM, e chegar a um Espaço JAM por um ecrã de faders
  // sem ver uma onda é chegar a outro produto. Ver não é montar — e agora que a montagem abre
  // encaixada no ecrã, ver é exatamente o que ela faz bem no telemóvel.
  const [aba, setAba] = useState<'linha' | 'mesa' | 'ficha' | 'exportar'>('linha');

  // ─── O que o selo diz ─────────────────────────────────────────────────────
  //
  // Três coisas podiam estar a acontecer ao mesmo tempo — gravar a ficha, enviar ficheiros,
  // gerar a guia — e antes cada uma tinha o seu próprio texto no cabeçalho, a disputar o mesmo
  // canto. São todas a MESMA pergunta para quem olha ("posso fechar?"), por isso são um sinal
  // só, e a ordem aqui é a da gravidade: o que prende a saída da tela aparece primeiro.
  const aGerar = gerando != null;
  // ⚠️ A GUIA SAIU DAQUI. Ela passou a ter uma tela inteira só para si — a mão a tocar e a
  // percentagem —, e o selo a repetir a mesma frase num canto era o mesmo aviso duas vezes: a
  // pessoa lia um e procurava o outro à espera de que dissessem coisas diferentes.
  const atividade = envio
      ? { texto: `Enviando ${envio.feitos + 1} de ${envio.total}…`, cor: DS.color.primaria, girando: true, falhou: false }
      : selo === 'salvando'
        ? { texto: 'Salvando…', cor: DS.color.textoApoio, girando: true, falhou: false }
        : selo === 'erro'
          ? { texto: 'Falha ao salvar', cor: DS.color.agulha, girando: false, falhou: true }
          : selo === 'salvo'
            ? { texto: 'Salvo', cor: '#22c55e', girando: false, falhou: false }
            : null;
  const [zoom, setZoom] = useState(1);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [editandoNome, setEditandoNome] = useState(false);
  const [rascunho, setRascunho] = useState(titulo);
  const [biblioteca, setBiblioteca] = useState<ItemDaBiblioteca[]>([]);
  const [sobre, setSobre] = useState(false);

  const linha = useRef<HTMLDivElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  /** O clipe que a mão tem agora, e onde ele estava quando a mão o pegou — tempo e pista. */
  const arrasto = useRef<
    { clipeId: string; deslocamentoX: number; inicio: number; pistaId: string } | null
  >(null);
  /** A pilha de faixas, para saber sobre qual delas a mão está. */
  const pilhaDasPistas = useRef<HTMLDivElement>(null);
  const agulhaPresa = useRef(false);
  /** Quem mexeu no zoom manda: o encaixe automático nunca volta a mexer nele. */
  const zoomMexido = useRef(false);
  /** O zoom em que a montagem inteira cabe no ecrã. Medido, porque depende da largura real. */
  const [encaixe, setEncaixe] = useState(ZOOM_MINIMO);

  const escala = PIXELS_POR_SEGUNDO * zoom;
  const duracao = Math.max(DURACAO_MINIMA, Math.ceil(estado.duracao) + 10);
  const largura = duracao * escala + 80;
  const agulha = estado.posicao;

  /** De quantos em quantos segundos a régua põe um número, para os rótulos não se colarem. */
  // ⚠️ OS DEGRAUS VÃO ATÉ AO MINUTO. Ficavam nos 10 s, que a 100 % são 600 px de intervalo e
  // encaixado no telemóvel são 17 px: os números da régua passavam a escrever-se uns por cima
  // dos outros ("100s110s120s"), e uma régua ilegível é pior do que régua nenhuma.
  const passo = escala >= 80 ? 1
    : escala >= 40 ? 2
      : escala >= 20 ? 5
        : escala >= 8 ? 10
          : escala >= 4 ? 30
            : 60;

  // ⚠️ A GRELHA É O QUE FAZ O BPM EXISTIR NA TELA. Antes dela, escrever 128 no rodapé mudava um
  // número no banco e mais nada: a régua continuava a contar segundos e o clipe encaixava de
  // quarto em quarto de segundo, que não é unidade musical nenhuma. Agora a régua conta
  // compassos e o clipe cai onde a música tem uma batida.
  //
  // Sem andamento escrito — que é a maioria dos projetos — tudo isto desliga e volta o que era.
  const grade = useMemo(() => gradeDoCompasso(bpm, escala), [bpm, escala]);
  const passoDoEncaixe = useMemo(() => encaixeDaGrade(grade, escala), [grade, escala]);
  // Uma lista só para a régua e para as linhas das pistas: enquanto cada uma contava por sua
  // conta, bastava mexer numa para o número deixar de assentar na linha que ele nomeia.
  const marcas = useMemo(
    () => marcasDaRegua(grade, duracao, escala, passo),
    [grade, duracao, escala, passo],
  );

  // ⚠️ O ATALHO IGNORA QUEM ESTÁ A ESCREVER. Ctrl+Z dentro de um campo de texto é o desfazer
  // DO CAMPO, e roubá-lo para a montagem apagaria uma letra de propósito e um clipe por engano
  // — a pessoa a escrever o nome de uma pista veria a montagem inteira andar para trás.
  useEffect(() => {
    if (!historico) return undefined;
    const naTecla = (evento: KeyboardEvent) => {
      if (!(evento.metaKey || evento.ctrlKey) || evento.key.toLowerCase() !== 'z') return;
      const alvo = evento.target as HTMLElement | null;
      if (alvo?.closest('input, textarea, [contenteditable="true"]')) return;
      evento.preventDefault();
      if (evento.shiftKey) historico.refazer(); else historico.desfazer();
    };
    window.addEventListener('keydown', naTecla);
    return () => window.removeEventListener('keydown', naTecla);
  }, [historico]);

  // ⚠️ NO TELEMÓVEL A MONTAGEM ABRE ENCAIXADA NO ECRÃ.
  //
  // A 100 % são 60 px por segundo: uma música de dois minutos mede 8 700 px, e num ecrã de 390
  // isso são vinte e dois ecrãs em fila. A pessoa abria a linha do tempo, via seis segundos de
  // onda, e para chegar ao resto tinha de arrastar um polegar de barra de rolagem com 17 px de
  // comprimento — que num telemóvel nem sequer é desenhado. Daí o "não consigo rolar pro lado":
  // o lado existia, mas não havia como o alcançar.
  //
  // Encaixada, a música inteira está à vista de partida e o zoom deixa de ser obrigatório para
  // ser opção. Só na abertura: a partir do primeiro toque nos botões de zoom, quem manda é quem
  // está a olhar.
  useEffect(() => {
    const visivel = rolagem.current?.clientWidth;
    if (aba !== 'linha' || !visivel) return;
    const alvo = zoomQueEncaixa(duracao, visivel - larguraDasPistas);
    setEncaixe(alvo);
    if (noCelular && !zoomMexido.current) setZoom(alvo);
  }, [noCelular, aba, duracao, larguraDasPistas]);

  // ⚠️ AFASTAR VAI SEMPRE ATÉ AO ENCAIXE, e nunca além. O chão dos botões é o menor entre o
  // afastamento normal e o zoom em que a montagem cabe: no desktop isso quase sempre dá os
  // 25 % de sempre (nada muda), e no telemóvel dá exatamente o ponto de partida — sem isto,
  // quem aproximasse uma vez não conseguia voltar a ver a música inteira.
  const zoomMinimo = Math.min(ZOOM_MINIMO, encaixe);

  /**
   * Mudar o zoom SEM perder a agulha de vista.
   *
   * ⚠️ QUEM APROXIMA ESTÁ A PREPARAR UM CORTE. Quer ver a agulha de perto para acertar no sítio
   * exato — e era justamente ela que desaparecia: aproximar multiplica a distância de tudo ao
   * zero, a mesma rolagem passa a apontar para outro segundo, e a montagem saltava para um
   * ponto qualquer da música. O gesto seguinte era sempre rolar à procura da linha vermelha.
   * Aproximar custava dois gestos, e o segundo não tinha nada a ver com o que se queria fazer.
   *
   * ⚠️ E A ROLAGEM É DEPOIS DO DESENHO. O `scrollLeft` novo só existe depois de o conteúdo ter
   * a largura nova: escrito no mesmo instante em que o zoom muda, ele é medido contra a largura
   * ANTIGA e o navegador trava-o no fim da rolagem de antes. É o `requestAnimationFrame` que o
   * põe do outro lado da pintura.
   */
  const mudarZoom = (para: (z: number) => number) => {
    zoomMexido.current = true;
    setZoom((z) => {
      const novo = Math.max(zoomMinimo, Math.min(ZOOM_MAXIMO, para(z)));
      requestAnimationFrame(() => {
        const caixa = rolagem.current;
        if (!caixa) return;
        // Aqui mede-se de propósito: é o zoom que acabou de mudar o tamanho da montagem, e as
        // medidas guardadas ainda são as de antes dele.
        medirAVista();
        caixa.scrollLeft = rolagemQueCentra(
          agulha,
          PIXELS_POR_SEGUNDO * novo,
          medidas.current.vista,
          medidas.current.maximo,
        );
      });
      return novo;
    });
  };

  /**
   * A vista vai buscar a agulha quando ela SAI do que se vê.
   *
   * ⚠️ E NÃO A PERSEGUE ENQUANTO ELA LÁ ESTÁ. É o `null` do núcleo que decide, e essa metade é
   * a mais importante: uma vista que centra a agulha a cada décimo de segundo é PIOR do que uma
   * que não a segue — a onda desliza sem parar debaixo do olho, e fica impossível ler o que quer
   * que seja ou apontar para uma coisa parada. À vista, a montagem não se mexe.
   *
   * ⚠️ E A AGULHA PRESA NA MÃO NÃO SE SEGUE. Arrastá-la para fora do que se vê é um gesto de
   * quem está a levar a linha a um sítio, não de quem a está a ver passar: rolar por baixo da
   * mão movia o alvo enquanto ela o perseguia, e a agulha fugia do dedo.
   */
  const seguindoAAgulha = useRef(false);
  const agulhaAntes = useRef(agulha);
  /** Quando a agulha foi lida pela última vez, para saber quanto tempo de PAREDE passou. */
  const quandoAAgulha = useRef(performance.now());
  const linhaDaAgulha = useRef<HTMLDivElement>(null);
  /**
   * As medidas da janela da montagem, guardadas.
   *
   * ⚠️ NÃO SE MEDEM A CADA QUADRO. Ler `scrollWidth` obriga o navegador a recalcular a posição
   * de TUDO o que está na montagem antes de responder — e o laço de baixo escreve a rolagem no
   * quadro anterior, o que deixa sempre alguma coisa por recalcular. Medido aqui a tocar, com o
   * `scrollWidth` lido a cada quadro: 54 de 100 quadros passavam dos 32 ms, com picos de 349 ms.
   * Era a própria correção da fluidez a criar o engasgo que ela vinha resolver.
   *
   * Elas só mudam quando a montagem muda de tamanho — o zoom, a duração, a janela — e é aí que
   * se voltam a medir.
   */
  const medidas = useRef({ vista: 0, maximo: 0 });
  const medirAVista = useCallback(() => {
    const caixa = rolagem.current;
    if (!caixa) return;
    medidas.current = {
      vista: caixa.clientWidth - larguraDasPistas,
      maximo: caixa.scrollWidth - caixa.clientWidth,
    };
  }, [larguraDasPistas]);
  useLayoutEffect(() => {
    medirAVista();
    window.addEventListener('resize', medirAVista);
    return () => window.removeEventListener('resize', medirAVista);
  }, [medirAVista, escala, largura, pistas.length]);

  /**
   * O DESLIZE, A SESSENTA QUADROS POR SEGUNDO — e fora do React.
   *
   * ⚠️ O TIQUE DA MESA É DE 50 ms, e tem de continuar a ser. Com uma dúzia de faixas, cada
   * redesenho da montagem é caro: medido neste editor a tocar, 34 de 150 quadros passavam dos
   * 32 ms. Subir o tique para sessenta redesenhos por segundo tornaria isso três vezes pior.
   *
   * Só que o que se MEXE precisa dos sessenta. Com a agulha travada no meio e a montagem a
   * deslizar por baixo, vinte passos por segundo veem-se um a um — é a "travadinha" de quem
   * está a olhar para a música a passar.
   *
   * A saída é separar as duas coisas: o React continua a redesenhar vinte vezes por segundo (o
   * relógio, os botões, os clipes), e o que desliza — a rolagem e a linha vermelha — escreve-se
   * à mão a cada quadro, lido do relógio do ÁUDIO. São dois caminhos para o mesmo número, e por
   * isso nunca discordam: `posicaoAgora()` sai do mesmo relógio de amostras que alimenta o
   * `estado`.
   *
   * ⚠️ E SÓ ENQUANTO ELA ESTÁ TRAVADA. No primeiro modo é a agulha que anda sobre uma montagem
   * parada, e aí os 50 ms do tique bastam — mexer na rolagem ali seria mexer no que a pessoa
   * está a olhar. O laço também não corre com a agulha na mão nem com a música parada.
   */
  useEffect(() => {
    const agora = transporte.posicaoAgora;
    if (!estado.tocando || !agora) return undefined;
    let vivo = true;
    let antes = agora();
    let quando = performance.now();
    const quadro = () => {
      if (!vivo) return;
      requestAnimationFrame(quadro);
      const caixa = rolagem.current;
      if (!caixa || agulhaPresa.current) return;

      const segundo = agora();
      // ⚠️ A DECISÃO TAMBÉM É DAQUI, e não do tique. Deixada no caminho do React, a troca para o
      // modo travado chegava até 50 ms atrasada: a agulha passava a borda e só depois saltava
      // para o meio. O tique continua a decidir quando a música está PARADA — um toque na régua,
      // as setas —, que é onde ele é o único caminho.
      const instante = performance.now();
      const passo = passoDaVista({
        segundo,
        anterior: antes,
        desdeAnterior: (instante - quando) / 1000,
        escala,
        rolagemAtual: caixa.scrollLeft,
        larguraVisivel: medidas.current.vista,
        maximo: medidas.current.maximo,
        seguindo: seguindoAAgulha.current,
      });
      antes = segundo;
      quando = instante;
      agulhaAntes.current = segundo;
      seguindoAAgulha.current = passo.seguindo;
      if (passo.rolagem !== null) caixa.scrollLeft = passo.rolagem;
      // A linha anda com a rolagem NO MESMO QUADRO: escrita só uma delas, a agulha voltava a
      // tremer — é a mesma dessincronia que o efeito de layout resolve no caminho do React.
      if (linhaDaAgulha.current) linhaDaAgulha.current.style.left = `${segundo * escala}px`;
    };
    requestAnimationFrame(quadro);
    return () => { vivo = false; };
  }, [estado.tocando, transporte.posicaoAgora, escala, larguraDasPistas]);
  /**
   * ⚠️ `useLayoutEffect`, E ISTO É A DIFERENÇA ENTRE PARADA E AOS SALTOS.
   *
   * A agulha e a rolagem dizem a MESMA coisa por dois caminhos: a posição dela dentro da
   * montagem é um `left` que o React pinta, e o sítio da montagem que se vê é o `scrollLeft` que
   * se escreve aqui. Com um `useEffect`, os dois caminhos caem em quadros DIFERENTES — o
   * navegador pinta a agulha no sítio novo com a rolagem ANTIGA (e ela salta para a frente), e
   * só no quadro seguinte a rolagem a apanha (e ela volta para trás). Vinte vezes por segundo,
   * é uma linha a tremer em vez de uma linha parada.
   *
   * O efeito de layout corre ANTES da pintura: os dois números chegam ao ecrã no mesmo quadro, e
   * a agulha fica onde deve ficar — quieta, com a música a deslizar por baixo.
   */
  useLayoutEffect(() => {
    const caixa = rolagem.current;
    const antes = agulhaAntes.current;
    agulhaAntes.current = agulha;
    if (!caixa || agulhaPresa.current) return;
    // ⚠️ A TOCAR, QUEM MANDA É O LAÇO DE QUADRO. Os dois a escreverem a mesma rolagem davam
    // exatamente o tremor que este caminho existe para evitar: o laço põe-na no sítio do
    // relógio de agora, e 50 ms depois este punha-a no sítio do tique, meio passo atrás.
    if (estado.tocando) return;

    const instante = performance.now();
    const desdeAnterior = (instante - quandoAAgulha.current) / 1000;
    quandoAAgulha.current = instante;
    const passo = passoDaVista({
      segundo: agulha,
      anterior: antes,
      desdeAnterior,
      escala,
      rolagemAtual: caixa.scrollLeft,
      // A largura das ONDAS: a coluna das faixas fica colada à esquerda por cima da montagem, e
      // o que está debaixo dela não está à vista.
      larguraVisivel: medidas.current.vista,
      maximo: medidas.current.maximo,
      seguindo: seguindoAAgulha.current,
    });
    seguindoAAgulha.current = passo.seguindo;
    // ⚠️ SEM `scroll-behavior`, nem no salto de entrada. Aqui a rolagem escreve-se vinte vezes
    // por segundo enquanto a linha está travada: uma rolagem suave a cada passo nunca chegaria
    // ao destino antes do passo seguinte, e a montagem ficava sempre meia tela atrasada.
    if (passo.rolagem !== null) caixa.scrollLeft = passo.rolagem;
  }, [agulha, escala, larguraDasPistas, estado.tocando]);

  /**
   * A RÉGUA E A GRELHA, DESENHADAS UMA VEZ — e não a cada tique.
   *
   * ⚠️ ESTA ERA A CONTA QUE ENGASGAVA O PLAY. A grelha é desenhada DENTRO de cada faixa: com
   * 150 de andamento, uma música de dois minutos tem umas centenas de marcas, e treze faixas
   * multiplicam-nas por treze. Eram milhares de elementos reconstruídos vinte vezes por segundo
   * — e nenhum deles depende da agulha, que é a única coisa que o tique muda.
   *
   * Medido aqui, a 173 %: 82 de 150 quadros passavam dos 32 ms, com picos de 486 ms. Parada, a
   * mesma tela não tinha um único quadro lento.
   *
   * Guardados, os dois voltam ao React como o MESMO elemento, e ele salta o ramo inteiro.
   */
  const daRegua = useMemo(() => marcas.map((marca) => (
    <div
      key={marca.segundo}
      style={{
        position: 'absolute', left: marca.segundo * escala, top: 0, bottom: 0,
        paddingLeft: 6,
        borderLeft: `1px solid ${marca.forte ? DS.color.grelhaForte : DS.color.grelhaFraca}`,
        fontSize: 10, color: DS.color.textoFraco, lineHeight: `${ALTURA_DA_REGUA}px`,
      }}
    >
      {marca.rotulo}
    </div>
  )), [marcas, escala]);

  const daGrelha = useMemo(() => marcas.map((marca) => (
    <div
      key={marca.segundo}
      style={{
        position: 'absolute', left: marca.segundo * escala, top: 0, bottom: 0,
        width: 1,
        // O compasso risca mais forte do que o tempo: é ele que se conta de olho, e uma grelha
        // toda igual não se conta.
        background: marca.forte ? DS.color.grelhaForte : DS.color.grelhaFraca,
        opacity: marca.forte ? 1 : 0.6,
      }}
    />
  )), [marcas, escala]);

  const segundoDoEvento = (evento: { clientX: number }) => {
    const caixa = linha.current;
    if (!caixa) return 0;
    const x = evento.clientX - caixa.getBoundingClientRect().left + caixa.scrollLeft;
    return Math.max(0, Math.min(x / escala, duracao));
  };

  /**
   * A faixa para onde o clipe arrastado vai — `undefined` se ficar na dele.
   *
   * ⚠️ O ÍNDICE É MEDIDO NA PILHA, e não contado pela posição do rato na página: a montagem
   * rola, o cabeçalho é `sticky` e a altura da faixa muda com o tamanho do ecrã. O `y` relativo
   * à pilha dividido pela altura de uma faixa é a linha, e nada disso precisa de saber onde a
   * janela está. O resto da decisão — travar no que existe, deixar a Mix de fora — é do núcleo,
   * e é a mesma no app, onde o gesto é outro.
   */
  const pistaSobAMao = (evento: React.PointerEvent, deId: string): string | undefined => {
    const pilha = pilhaDasPistas.current;
    if (!pilha) return undefined;
    const linhaSobAMao = (evento.clientY - pilha.getBoundingClientRect().top) / alturaDaPista;
    return pistaAlvoDoArrasto(
      pistas,
      pistas.findIndex((p) => p.id === deId),
      Math.floor(linhaSobAMao),
    );
  };

  const aoMover = (evento: React.PointerEvent) => {
    if (agulhaPresa.current) { transporte.irPara(segundoDoEvento(evento)); return; }
    const puxado = arrasto.current;
    if (!puxado) return;
    // O encaixe é ao LARGAR, não durante: encaixar a cada pixel faz o clipe saltar debaixo do
    // dedo, e a pessoa deixa de saber onde ele vai cair.
    const inicio = Math.max(0, segundoDoEvento(evento) - puxado.deslocamentoX / escala);
    // A faixa, essa, muda DURANTE: é o que faz o clipe seguir a mão de linha em linha, e sem
    // isso arrastar para cima ou para baixo não mostrava nada até largar.
    const alvo = pistaSobAMao(evento, puxado.pistaId);
    acoes.aoMoverClipe(puxado.clipeId, inicio, undefined, alvo ? { para: alvo } : undefined);
  };

  const aoLargar = (evento: React.PointerEvent) => {
    if (agulhaPresa.current) { agulhaPresa.current = false; return; }
    const puxado = arrasto.current;
    if (!puxado) return;
    arrasto.current = null;
    const bruto = segundoDoEvento(evento) - puxado.deslocamentoX / escala;
    const destino = Math.max(0, Math.round(bruto / passoDoEncaixe) * passoDoEncaixe);
    const alvo = pistaSobAMao(evento, puxado.pistaId);
    const trocouDePista = !!alvo;
    // ⚠️ UM TOQUE NÃO É UM ARRASTO, e mandava gravar na mesma. Duas consequências, as duas
    // más: um clipe que estivesse fora da grelha (por ter sido posto antes de haver andamento)
    // saltava para o tempo mais próximo só por ter sido SELECIONADO; e a escrita agendada por
    // esse falso movimento chegava depois de quem carregasse em REMOVER, a um clipe que já não
    // existia — daí o "Falha ao salvar" logo a seguir a apagar com sucesso.
    if (!trocouDePista && Math.abs(destino - puxado.inicio) < 0.001) return;
    acoes.aoMoverClipe(
      puxado.clipeId, destino, puxado.inicio,
      alvo ? { para: alvo, de: puxado.pistaId } : undefined,
    );
  };

  const escolherArquivos = (arquivos: File[], inicio: number, pistaAlvo?: string) => {
    if (!arquivos.length || !podeEditar) return;
    acoes.aoAdicionarArquivos(arquivos, inicio, pistaAlvo);
  };

  /**
   * O que largar numa faixa.
   *
   * Duas origens, um gesto: um ficheiro vindo da BIBLIOTECA (que só existe no computador até
   * este instante — é aqui que ele sobe) ou um vindo de fora do navegador.
   */
  const largarNaFaixa = (evento: React.DragEvent, faixaId: string) => {
    evento.preventDefault();
    evento.stopPropagation();
    setSobre(false);
    if (!podeEditar) return;
    const segundo = Math.round(segundoDoEvento(evento) / passoDoEncaixe) * passoDoEncaixe;

    const daBiblioteca = evento.dataTransfer.getData(TIPO_DO_ARRASTO);
    if (daBiblioteca) {
      const item = biblioteca.find((i) => i.id === daBiblioteca);
      if (item) escolherArquivos([item.arquivo], segundo, faixaId);
      return;
    }
    escolherArquivos(Array.from(evento.dataTransfer.files), segundo, faixaId);
  };

  // ─── As peças ─────────────────────────────────────────────────────────────

  // ⚠️ O CABEÇALHO NÃO TEM COR. A fita de 3 px na borda esquerda saiu por pedido do dono do
  // produto, e o argumento é de leitura: a cor existe para distinguir uma faixa da outra na
  // MONTAGEM — no clipe, que é o objeto que se olha, se arrasta e se corta. Repetida numa fita
  // encostada à borda do ecrã, ela competia com a coisa que devia marcar; três fitas coloridas
  // à esquerda puxavam o olho para uma coluna onde não há nada para ver.
  //
  // A faixa calada continua a dizer-se: a coluna inteira esmorece (`opacity`), e o M fica
  // carregado. Era isso que a fita cinzenta fazia, e não se perdeu nada com ela.
  /**
   * As ações de AGORA, para o cabeçalho guardado nunca chamar as de antes.
   *
   * ⚠️ SEM ISTO, GUARDAR O CABEÇALHO SERIA UM DEFEITO E NÃO UMA OTIMIZAÇÃO. Ele é desenhado uma
   * vez e reaproveitado enquanto o que se VÊ não muda — e os botões lá dentro ficam a apontar
   * para o `acoes` daquele momento. Esse fecha sobre a montagem daquele momento: carregar em
   * apagar meio minuto depois escreveria a partir de uma lista de faixas que já não existe.
   *
   * Uma gaveta atualizada a cada render resolve-o sem desfazer a economia: o desenho é velho, a
   * mão que ele chama é sempre a nova.
   */
  const acoesDeAgora = useRef(acoes);
  acoesDeAgora.current = acoes;

  const cabecalhoDaPista = (faixa: CatalogTrack, indice: number) => {
    const daMesa = estado.pistas.find((p) => p.id === faixa.id);
    const calada = Boolean(daMesa?.muda);
    const fixa = faixa.id === pistaFixaId;
    const pan = daMesa?.pan ?? (Number(faixa.pan) || 0);

    // ⚠️ NO TELEMÓVEL OS BOTÕES DIVIDEM A COLUNA, em vez de terem cada um a sua largura fixa.
    // Quatro botões de 28 px com folgas somam 124 px dentro de uma coluna de 132 com recuo —
    // o último saía pela borda e ia pousar EM CIMA da onda, onde além de ficar cortado roubava
    // o toque a quem tentava arrastar a linha do tempo por ali.
    //
    // A conta acima só estava certa enquanto foram três botões; voltaria a partir-se no
    // próximo que aparecesse. Repartida (`flex: 1 1 0`), a linha cabe seja qual for o número
    // de botões e a largura da coluna, e é o botão que encolhe — não a coluna que estoura.
    const repartido = noCelular
      ? { flex: '1 1 0', minWidth: 0, padding: 0, height: 26 }
      : null;

    return (
      <div
        key={faixa.id}
        style={{
          height: alturaDaPista, flexShrink: 0,
          padding: noCelular ? '8px 10px' : '10px 12px',
          display: 'flex', flexDirection: 'column', gap: 8,
          background: DS.color.bgPista,
          borderBottom: `1px solid ${DS.color.borda}`,
          opacity: calada ? 0.6 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            value={faixa.name}
            onChange={(e) => acoesDeAgora.current.aoMudarPista(faixa.id, { name: e.target.value })}
            disabled={!podeEditar || fixa}
            aria-label={`Nome da faixa ${faixa.name}`}
            style={{
              flex: 1, minWidth: 0, padding: 0, background: 'transparent', border: 'none',
              outline: 'none', color: DS.color.texto, fontSize: 13, fontWeight: 600,
              fontFamily: DS.font.display,
            }}
          />
          {podeEditar && !fixa && (
            <button
              type='button'
              onClick={() => acoesDeAgora.current.aoApagarPista(faixa.id)}
              title='Apagar a faixa'
              aria-label={`Apagar a faixa ${faixa.name}`}
              style={{
                background: 'transparent', border: 'none', color: DS.color.textoFraco,
                cursor: 'pointer', display: 'flex', padding: 2,
              }}
            >
              <FiTrash2 size={13} />
            </button>
          )}
        </div>

        {/* ⚠️ O SELETOR DE TIPO SAIU DA TELA. Só `audio` toca: sintetizador, piano e bateria
            pedem notas agendadas e síntese, que é outra engrenagem. Um seletor que guarda uma
            escolha sem consequência ensina errado — a pista parece mudar de natureza e não
            muda. A coluna `kind` fica no banco, com `audio` de padrão, à espera do dia em que
            os outros três signifiquem alguma coisa. */}

        <div style={{ display: 'flex', alignItems: 'center', gap: noCelular ? 3 : 4 }}>
          <button
            type='button'
            onClick={() => acoesDeAgora.current.aoMudarPista(faixa.id, { muted: !calada })}
            aria-label={calada ? `Ouvir ${faixa.name}` : `Silenciar ${faixa.name}`}
            aria-pressed={calada}
            title={calada ? 'Ouvir' : 'Silenciar'}
            // ⚠️ Mudo e solo têm CORES DIFERENTES: são as duas ações mais usadas de uma mesa e
            // são opostas. Pintadas iguais quando acesas, ninguém sabe qual carregou.
            style={{ ...botaozinho(calada, DS.color.textoFraco), ...repartido }}
          >
            M
          </button>
          <button
            type='button'
            onClick={() => acoesDeAgora.current.aoSolar(faixa.id, !daMesa?.solo)}
            aria-label={daMesa?.solo ? 'Ouvir tudo de novo' : `Ouvir só ${faixa.name}`}
            aria-pressed={Boolean(daMesa?.solo)}
            title={daMesa?.solo ? 'Ouvir tudo' : 'Ouvir só esta'}
            style={{ ...botaozinho(Boolean(daMesa?.solo), '#f59e0b'), ...repartido }}
          >
            S
          </button>
          {/* ⚠️ O "AT" SAIU DAQUI. Ele era automação, estava desligado desde sempre, e ocupava
              o lugar do controlo que uma pista realmente precisa numa mesa: o de dizer "é
              NESTA que se grava". Armar uma pista é meio caminho da gravação — a outra metade
              é o REC do transporte, e é a soma dos dois que decide o que acontece no play. */}
          <button
            type='button'
            onClick={() => alternarArmada(faixa.id)}
            aria-pressed={armadas.includes(faixa.id)}
            title={armadas.includes(faixa.id)
              ? `Desarmar ${faixa.name}`
              : `Armar ${faixa.name} para gravar`}
            aria-label={armadas.includes(faixa.id)
              ? `Desarmar ${faixa.name}`
              : `Armar ${faixa.name} para gravar`}
            style={{
              ...botaozinho(false),
              ...repartido,
              background: 'transparent',
              borderColor: armadas.includes(faixa.id) ? DS.color.gravar : DS.color.borda,
              color: DS.color.gravar,
              opacity: armadas.includes(faixa.id) ? 1 : 0.5,
            }}
          >
            <FiCircle size={11} fill={armadas.includes(faixa.id) ? 'currentColor' : 'none'} />
          </button>

          {/* ⚠️ ENVIAR DIRETO PARA ESTA PISTA. Sem isto, uma pista que ficou sem áudio (o clipe
              foi apagado) virava um beco: a única entrada era a biblioteca, e de lá o ficheiro
              só chega por ARRASTO — que não existe no telemóvel, onde a biblioteca é uma gaveta
              que tapa as faixas. A pista ficava lá, vazia, sem forma de a encher. */}
          {podeEditar && !fixa && (
            <button
              type='button'
              onClick={() => escolherPara(faixa.id)}
              title={`Enviar um áudio para ${faixa.name}`}
              aria-label={`Enviar um áudio para ${faixa.name}`}
              style={{ ...botaozinho(false), ...repartido, color: DS.color.textoApoio }}
            >
              <IconeDeEnviar tamanho={14} />
            </button>
          )}
        </div>

        {/* ⚠️ VOLUME E PANORAMA SAEM DA COLUNA NO CELULAR. Eles moram na Mesa, que é a aba
            onde o telemóvel abre e onde o fader tem curso para um dedo. Repetidos aqui, numa
            coluna de 132 px, seriam duas linhas de 4 px de curso — controlos que a mão não
            acerta, a comer a altura que a onda precisa. */}
        {!noCelular && (<>
        <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <FiVolume2 size={13} color={DS.color.textoFraco} />
          <input
            type='range' min={0} max={100}
            value={Math.round((daMesa?.ganho ?? faixa.gain ?? 1) * 100)}
            onChange={(e) => acoesDeAgora.current.aoMudarPista(faixa.id, { gain: Number(e.target.value) / 100 })}
            disabled={!podeEditar}
            aria-label={`Volume de ${faixa.name}`}
            style={{ flex: 1, minWidth: 0, accentColor: DS.color.primaria, cursor: 'pointer' }}
          />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <FiHeadphones size={13} color={DS.color.textoFraco} />
          <input
            type='range' min={-100} max={100}
            value={Math.round(pan * 100)}
            onChange={(e) => acoesDeAgora.current.aoMudarPista(faixa.id, { pan: Number(e.target.value) / 100 })}
            disabled={!podeEditar}
            aria-label={`Panorama de ${faixa.name}`}
            className={casca.pan}
            style={{
              flex: 1, minWidth: 0,
              ...({ '--pan-de': faixaDoPan(pan).de, '--pan-ate': faixaDoPan(pan).ate } as React.CSSProperties),
            }}
          />
          <span style={{
            width: 16, fontSize: 10, color: DS.color.textoFraco, fontFamily: DS.font.mono,
          }}>
            {/* C de centro; senão, o lado e quanto. */}
            {Math.abs(pan) < 0.02 ? 'C' : `${pan < 0 ? 'E' : 'D'}${Math.round(Math.abs(pan) * 100)}`}
          </span>
        </label>
        </>)}
      </div>
    );
  };

  /**
   * A COLUNA DAS FAIXAS, DESENHADA UMA VEZ — e não a cada tique.
   *
   * ⚠️ ELA NÃO DEPENDE DA AGULHA, que é a única coisa que o tique muda. Com uma dúzia de faixas
   * são mais de cem elementos — um campo de texto e cinco botões por linha — reconstruídos e
   * comparados vinte vezes por segundo, para dar sempre o mesmo resultado. É o que sobrava do
   * engasgo do play depois de a grelha deixar de se desenhar faixa a faixa.
   *
   * ⚠️ E A DEPENDÊNCIA É UMA ASSINATURA, e não as coisas de que ela é feita. `estado.pistas` é
   * um objeto NOVO a cada tique — a mesa constrói-o de raiz — e `acoes` também; postos como
   * dependências, o guardado refazia-se sempre e não guardava nada. A assinatura é o que se VÊ:
   * o que a coluna desenha, letra a letra. Se ela não mudar, o desenho não pode ter mudado.
   *
   * ⚠️ CADA COISA QUE O CABEÇALHO LÊ TEM DE ESTAR AQUI. Esquecer uma é um botão que deixa de
   * responder — o M que não acende, o nome que não muda — e é um defeito calado, porque o valor
   * está certo no banco e errado no ecrã. A lista é: o nome e o panorama da faixa, o que a mesa
   * diz dela (calada, solada, ganho, panorama), quem está armado, e as medidas da coluna.
   */
  const assinaturaDaColuna = pistas.map((p) => {
    const daMesa = estado.pistas.find((m) => m.id === p.id);
    return [
      p.id, p.name, p.gain, p.pan,
      daMesa?.muda, daMesa?.solo, daMesa?.ganho, daMesa?.pan,
      armadas.includes(p.id),
    ].join(':');
  }).join('|')
    + `#${podeEditar}:${noCelular}:${alturaDaPista}:${pistaFixaId}`;

  const coluna = useMemo(
    () => pistas.map(cabecalhoDaPista),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assinaturaDaColuna],
  );

  return (
    <div className={casca.tela} style={{ background: DS.color.bgBase, color: DS.color.texto, fontFamily: DS.font.display }}>
      {/* ══════════ FILA DO TÍTULO ══════════
          LADO ESQUERDO: Logo (se tiver) · Título · Status dropdown
          LADO DIREITO: Menu (Timeline/Mixer/Ficha) · X fechar
      ══════════ */}
      <div style={{
        height: ALTURA_DO_TITULO, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        gap: noCelular ? 8 : 16, padding: noCelular ? '0 10px' : '0 18px',
        background: DS.color.bgPainel, borderBottom: `1px solid ${DS.color.borda}`,
      }}>
        {/* LADO ESQUERDO: Título e Status.
            ⚠️ `minWidth: 0` para o título poder ENCOLHER: sem isto um nome comprido empurra as
            abas e o X para fora da tela, que é como o editor ficava intocável no telemóvel. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: noCelular ? 6 : 12,
          minWidth: 0, flex: noCelular ? '1 1 auto' : '0 1 auto',
        }}>
          {editandoNome ? (
            <input
              autoFocus
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              onBlur={() => { setEditandoNome(false); acoes.aoRenomear(rascunho.trim() || titulo); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              aria-label='Nome da música'
              style={{
                background: DS.color.bgCampo, border: `1px solid ${DS.color.primaria}`,
                borderRadius: DS.raio.medio, color: DS.color.texto,
                fontSize: 17, fontWeight: 700, padding: '4px 10px', outline: 'none',
                fontFamily: DS.font.display, minWidth: 200,
              }}
            />
          ) : (
            <h1
              onClick={() => { if (podeEditar) { setRascunho(titulo); setEditandoNome(true); } }}
              title={podeEditar ? 'Clique para renomear' : undefined}
              style={{
                margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em',
                color: DS.color.texto, cursor: podeEditar ? 'text' : 'default',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 320,
              }}
            >
              {titulo}
            </h1>
          )}

          {/* Status dropdown minimalista sem borda.

              ⚠️ NO CELULAR ELE SAI DAQUI, e a conta é simples: o seletor ocupa 116 px de um
              cabeçalho de 375, e o que sobrava para o nome da música eram 45 — "Ra…". Saber QUE
              música está aberta é o trabalho deste cabeçalho; o estado da obra é assunto da
              Ficha, que fica a um toque, e no telemóvel a pessoa está a ouvir, não a gerir
              fases de produção. */}
          {!noCelular && ficha}

          {/* ⚠️ AO LADO DO TÍTULO, e não no canto oposto: a pergunta que estes círculos
              respondem — "estou sozinho nesta música?" — é sobre a MÚSICA, e lê-se junto do
              nome dela. No canto das abas seriam confundidos com mais um controlo. */}
          <FilaDePresentes presentes={presentes ?? []} />
        </div>

        {!noCelular && <div style={{ flex: 1, minWidth: 0 }} />}

        {/* LADO DIREITO: Menu + X fechar. `flexShrink: 0` porque é aqui que está o único
            caminho de saída da tela — se algo tem de ceder largura, não é isto. */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: noCelular ? 8 : 14, flexShrink: 0,
        }}>
          {/* As três vistas da mesma música, no topo: é a primeira escolha de quem entra —
              estou a montar, a misturar, ou a preencher a ficha? — e ela decide o que a tela
              inteira mostra. O que fica em baixo são os controlos do que já está aberto. */}
          <div style={{
            display: 'flex', gap: 2, padding: 3,
            background: DS.color.bgCampo, borderRadius: DS.raio.grande, flexShrink: 0,
          }}>
            {([['linha', 'Timeline'], ['mesa', 'Mixer'], ['ficha', 'Ficha'], ['exportar', 'Exportar']] as const).map(([chave, rotulo]) => (
              <button
                key={chave}
                type='button'
                onClick={() => setAba(chave)}
                aria-pressed={aba === chave}
                title={rotulo}
                aria-label={rotulo}
                style={{
                  height: 28, padding: noCelular ? '0 10px' : '0 14px',
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: aba === chave ? DS.color.bgHover : 'transparent',
                  border: 'none', borderRadius: DS.raio.medio,
                  color: aba === chave ? DS.color.texto : DS.color.textoFraco,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: DS.font.display,
                }}
              >
                {/* Uma medida só para os quatro. Antes eram 15 nos desenhados e 14 nos do
                    react-icons — números quase iguais que davam tamanhos bem diferentes na
                    tela, porque os quadros deles não tinham a mesma ocupação. Com os quadros
                    acertados (ver `icones.tsx`), o mesmo número passa a dar o mesmo tamanho. */}
                {chave === 'linha' ? <IconeDaTimeline tamanho={TAMANHO_DO_ICONE_DA_ABA} />
                  : chave === 'mesa' ? <IconeDoMixer tamanho={TAMANHO_DO_ICONE_DA_ABA} />
                  : chave === 'ficha' ? <FiFileText size={TAMANHO_DO_ICONE_DA_ABA} />
                  : <FiDownload size={TAMANHO_DO_ICONE_DA_ABA} />}
                {/* ⚠️ SEM RÓTULO NO CELULAR. Os quatro nomes somam mais de 300 px, e o que era
                    empurrado para fora da tela por eles era o X — a pessoa entrava no editor e
                    não tinha como sair. O nome continua no `title` e no `aria-label`. */}
                {!noCelular && rotulo}
              </button>
            ))}
          </div>

          <button
            type='button'
            onClick={acoes.aoSair}
            disabled={aGerar}
            title={aGerar ? rotuloDaGuia(gerando) : 'Voltar para Músicas'}
            aria-label='Voltar para Músicas'
            style={{ ...redondo, opacity: aGerar ? 0.4 : 1, cursor: aGerar ? 'wait' : 'pointer' }}
          >
            <FiX size={13} />
          </button>
        </div>

        {/* ⚠️ O SELETOR DE GRAVAÇÃO SAIU DA TELA, a pedido do dono do produto, enquanto ele
            decide como as versões se organizam. O que saiu foi só o CONTROLE: continua a haver
            uma gravação aberta (a principal, ou a mais recente), e é ela que o editor carrega —
            essa escolha vive em `ProjectSpace`. Quando as versões voltarem, volta um botão, não
            um modelo novo. */}

        {/* ⚠️ O ATALHO PARA A SALA DA GRAVAÇÃO SAIU, a pedido do dono do produto: com o editor
            aqui, aquela tela deixou de fazer sentido como destino. Ela continua a existir e
            continua a ser alcançável pela lista de Músicas — é lá que moram os comentários
            presos a um ponto do áudio e o download —, mas não é mais daqui que se vai até ela. */}

      </div>

      {/* ══════════ CORPO ══════════ */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* A biblioteca serve as abas de ÁUDIO. Na ficha e no exportar não há o que arrastar
            para lugar nenhum, e uma coluna de 256 px encostada é só espaço a menos para o
            conteúdo delas.

            ⚠️ NO CELULAR ELA É UMA GAVETA, e não uma coluna: 256 px de coluna fixa são 68 % de
            um ecrã de 375, sobrando um terço para a montagem inteira. Aqui ela dorme fora da
            tela e entra por cima quando alguém a chama — a mesma biblioteca, sem ocupar o sítio
            de quem trabalha. */}
        {aba !== 'ficha' && aba !== 'exportar' && bibliotecaAberta && (
        <div style={noCelular ? {
          position: 'absolute', inset: 0, zIndex: 30,
          background: DS.color.bgPainel, display: 'flex', flexDirection: 'column',
        } : undefined}>
        {noCelular && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', borderBottom: `1px solid ${DS.color.borda}`, flexShrink: 0,
          }}>
            <strong style={{ fontSize: 13, color: DS.color.texto }}>Biblioteca</strong>
            <button
              type='button'
              onClick={() => setBibliotecaAberta(false)}
              aria-label='Fechar a biblioteca'
              style={{ ...redondo, width: 30, height: 30 }}
            >
              <FiX size={14} />
            </button>
          </div>
        )}
        <Biblioteca
          itens={biblioteca}
          aoAbrirPasta={setBiblioteca}
          // Em LOTE: um projeto de stems tem dez, doze faixas, e mandar uma a uma é o tipo de
          // trabalho que faz a pessoa desistir da tela.
          aoEnviar={(arquivos) => {
            escolherArquivos(arquivos, 0);
            // ⚠️ A GAVETA FECHA AO ENVIAR, e isto não é enfeite: ela cobre a tela toda, por
            // cima da montagem E do selo de progresso (que vive numa camada abaixo). Quem
            // enviava ficava a olhar para a mesma lista de ficheiros, sem sinal de que algo
            // estava a acontecer, e só descobria o resultado ao fechar à mão.
            // Fechada, aparece o que interessa: as pistas a nascer e o "Enviando 2 de 4…".
            if (noCelular) setBibliotecaAberta(false);
          }}
          podeEditar={podeEditar}
          aoMontar={aoMontar}
          emGaveta={noCelular}
        />
        </div>
        )}

        {/* ── Transporte + pistas ── */}
        <div style={{
          flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
          // ⚠️ A MONTAGEM É UMA CAMADA SÓ, e é isto que impede a agulha de furar a gaveta.
          //
          // A escada de dentro da montagem (régua 10, coluna 11, canto 12, agulha 100) foi
          // escrita para os seus pedaços se ordenarem ENTRE SI. Sem isolamento, esses números
          // subiam ao contexto da tela inteira e disputavam com a gaveta da biblioteca, que
          // está em 30 — e 100 ganha de 30, por isso a agulha aparecia por cima do painel que
          // devia estar a tapá-la.
          //
          // `isolation` em vez de um z-index: o que se quer não é pôr a montagem num degrau, é
          // dizer que os degraus dela são assunto dela.
          isolation: 'isolate',
        }}>
          {/* O transporte também: não se toca uma ficha, nem se exporta com o play na mão. */}
          {aba !== 'ficha' && aba !== 'exportar' && (
          <div style={{
            height: ALTURA_DO_TRANSPORTE, flexShrink: 0,
            display: 'flex', alignItems: 'center',
            gap: noCelular ? 4 : 10, padding: noCelular ? '0 8px' : '0 16px',
            background: DS.color.bgPainel, borderBottom: `1px solid ${DS.color.borda}`,
          }}>
            <button
              type='button'
              onClick={() => transporte.irPara(0)}
              title='Voltar ao início'
              aria-label='Voltar ao início'
              style={{
                width: 32, height: 32, borderRadius: DS.raio.medio,
                background: 'transparent', border: 'none', color: DS.color.textoApoio,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FiSkipBack size={16} />
            </button>

            <button
              type='button'
              onClick={() => {
                // ⚠️ COM TUDO ARMADO, O PLAY TERIA DE GRAVAR — e não grava, porque a gravação
                // ainda não existe. Deixar a montagem simplesmente TOCAR aqui seria o pior
                // desfecho possível: a pessoa armou a pista, armou o transporte, carregou no
                // play, ouviu tudo andar, e só ia descobrir que não gravou nada ao procurar o
                // take. O aviso custa um toque; o take perdido custa a sessão.
                if (armado && armadas.length && !estado.tocando) {
                  message.warning('A gravação ainda não está disponível. Por agora, envie o áudio pelo botão da faixa.');
                  return;
                }
                transporte.alternar();
              }}
              disabled={estado.carregando}
              title={estado.carregando ? 'Preparando as faixas' : estado.tocando ? 'Pausar' : 'Tocar'}
              aria-label={estado.carregando ? 'Preparando as faixas' : estado.tocando ? 'Pausar' : 'Tocar'}
              style={{
                width: 42, height: 42, borderRadius: '50%',
                // ⚠️ MESMO BOTÃO, MESMA COR, MESMO SÍTIO: play e pause são o mesmo gesto a
                // alternar, e trocar a cor entre os dois faria a barra piscar de identidade a
                // cada toque. O que muda é o BRILHO — aceso enquanto toca, apagado quando não.
                // É o sinal de "está a andar" que se lê de relance, sem procurar o relógio.
                background: estado.carregando ? DS.color.bgCampo : DS.color.primaria,
                border: 'none', color: '#fff',
                cursor: estado.carregando ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                // Parado, é só o círculo azul: uma auréola permanente não diz nada, e a
                // barra inteira à volta dele é chapada. O brilho fica reservado para o
                // instante em que ele significa alguma coisa — enquanto o som anda.
                boxShadow: estado.tocando && !estado.carregando
                  ? `0 0 0 4px ${DS.color.primaria}33, 0 0 22px ${DS.color.primaria}aa`
                  : 'none',
                transition: 'box-shadow .18s ease',
              }}
            >
              {estado.tocando ? <FiPause size={18} /> : <FiPlay size={18} style={{ marginLeft: 2 }} />}
            </button>

            {/* ⚠️ O LOOP OCUPA O LUGAR DO PARAR, a pedido do dono do produto. Parar era o
                único dos três que não fazia nada de novo: é pausar (o botão grande) mais
                voltar ao início (o |◀ ao lado), e ninguém precisa de um terceiro botão para
                encadear dois que já estão ali. O loop, esse, não tinha como se fazer à mão —
                e é o gesto de quem está a ajustar uma mistura: deixar a coisa a rodar e mexer
                nos faders enquanto ouve. */}
            <button
              type='button'
              onClick={() => transporte.loopar(!estado.emLoop)}
              title={estado.emLoop ? 'Desligar o loop' : 'Repetir do início ao fim'}
              aria-label={estado.emLoop ? 'Desligar o loop' : 'Repetir do início ao fim'}
              aria-pressed={estado.emLoop}
              style={{
                width: 32, height: 32, borderRadius: DS.raio.medio,
                background: estado.emLoop ? `${DS.color.primaria}22` : 'transparent',
                border: 'none',
                color: estado.emLoop ? DS.color.primaria : DS.color.textoApoio,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FiRepeat size={15} />
            </button>

            {/* O REC ARMA A GRAVAÇÃO, e armar não é gravar — é a distinção que toda mesa faz.
                Desarmado, é um contorno; armado, enche de vermelho.

                ⚠️ GRAVAR AINDA NÃO EXISTE, e o botão diz isso no `title` em vez de fingir: o
                dia em que existir, dar play com ele armado começa a gravar na pista escolhida.
                Até lá ele guarda a intenção, que é o que um botão armado faz mesmo numa mesa
                de verdade — marca, e espera o play. */}
            <button
              type='button'
              onClick={() => {
                // Armar o transporte sem dizer em que pista é meia intenção: numa mesa, o REC
                // global só sabe o que fazer se alguma pista estiver armada.
                if (!armado && !armadas.length) {
                  message.warning(AVISO_DE_ARMAR.texto);
                  return;
                }
                setArmado((v) => !v);
              }}
              aria-pressed={armado}
              title={armado
                ? 'Armado para gravar. A gravação em si ainda não está disponível.'
                : 'Armar para gravar (a gravação ainda não está disponível)'}
              aria-label={armado ? 'Desarmar a gravação' : 'Armar para gravar'}
              style={{
                // ⚠️ UM CÍRCULO, E NÃO UM ALVO. A borda do botão MAIS o círculo do ícone davam
                // dois anéis concêntricos — o desenho de uma mira, não o do REC. Aqui o botão
                // não tem borda nenhuma: quem desenha o círculo é o ícone, sozinho, como na
                // referência (`Digital Audio WAVE`). Armado, o mesmo círculo enche.
                width: 32, height: 32, borderRadius: '50%',
                background: 'transparent', border: 'none',
                color: DS.color.gravar,
                opacity: armado ? 1 : 0.6,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                filter: armado ? `drop-shadow(0 0 6px ${DS.color.gravar}cc)` : 'none',
                transition: 'opacity .16s ease, filter .16s ease',
              }}
            >
              <FiCircle size={20} strokeWidth={2} fill={armado ? 'currentColor' : 'none'} />
            </button>

            <div style={{ flex: 1 }} />

            {/* O relógio encolhe no telemóvel: em 375 px ele disputa a barra com cinco botões
                e com o zoom, e sete caracteres a 14 px não precisam de tanto peso para se
                lerem. O espaçamento entre letras também sai — ele existe para o número não
                dançar quando os dígitos mudam, e a fonte já é monoespaçada. */}
            <div style={{
              padding: noCelular ? '3px 8px' : '6px 14px', borderRadius: DS.raio.medio,
              background: DS.color.bgCampo, border: `1px solid ${DS.color.borda}`,
              fontFamily: DS.font.mono, fontSize: noCelular ? 12 : 14, color: DS.color.texto,
              letterSpacing: noCelular ? '0.01em' : '0.04em',
              flexShrink: 0,
            }}>
              {relogio(agulha)}
            </div>

            {/* O zoom é da LINHA DO TEMPO: na mesa não há eixo nenhum para aproximar, e três
                controlos que não fazem nada é o que enche uma barra estreita de ruído. */}
            {aba === 'linha' && (<>
            <button
              type='button'
              onClick={() => mudarZoom((z) => z / 1.5)}
              title='Afastar'
              aria-label='Afastar a linha do tempo'
              style={{
                width: 30, height: 30, borderRadius: DS.raio.medio, background: 'transparent',
                border: 'none', color: DS.color.textoApoio, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FiZoomOut size={14} />
            </button>
            <span style={{ width: 42, textAlign: 'center', fontSize: 12, color: DS.color.textoApoio, fontFamily: DS.font.mono }}>
              {Math.round(zoom * 100)}%
            </span>
            <button
              type='button'
              onClick={() => mudarZoom((z) => z * 1.5)}
              title='Aproximar'
              aria-label='Aproximar a linha do tempo'
              style={{
                width: 30, height: 30, borderRadius: DS.raio.medio, background: 'transparent',
                border: 'none', color: DS.color.textoApoio, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <FiZoomIn size={14} />
            </button>
            </>)}
          </div>
          )}

          {aba === 'ficha' ? (
            // A ficha ocupa o lugar das faixas, e é clara: são os MESMOS campos do modal de
            // sempre, montados aqui em vez de flutuarem por cima. Um formulário escuro seria um
            // segundo formulário para os mesmos dados, e dois formulários divergem.
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: DS.color.bgFundoDaLinha, padding: 24 }}>
              {/* A ficha veste a folha do editor: os MESMOS campos do modal, com as cores desta
                  tela. Um cartão branco no meio de um editor escuro é uma janela de outro
                  aplicativo — e obriga o olho a reajustar cada vez que se troca de aba. */}
              <div className={casca.ficha}>
                {fichaCompleta}
              </div>
            </div>
          ) : aba === 'exportar' ? (
            // Mesmo lugar, mesma folha da ficha: o exportar também não tem o que arrastar nem
            // o que tocar — é uma lista de botões de baixar, e um formulário escuro ao lado de
            // outro formulário escuro lê-se como a mesma tela, não como duas.
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: DS.color.bgFundoDaLinha, padding: 24 }}>
              <div className={casca.ficha}>
                {exportar}
              </div>
            </div>
          ) : aba === 'mesa' ? (
            <MesaDeCanais
              pistas={pistas}
              estado={estado}
              podeEditar={podeEditar}
              pistaFixaId={pistaFixaId}
              acoes={acoes}
              noCelular={noCelular}
            />
          ) : (
            // ⚠️ UM SCROLL SÓ para as duas colunas, e é isto que impede o pior erro que uma
            // tela destas pode ter: o cabeçalho de uma pista alinhado com a faixa de OUTRA.
            // Antes cada coluna tinha o seu `overflow`, e bastava rolar uma para o M, o S e o
            // volume deixarem de ser os da onda ao lado — a pessoa calava a pista errada.
            //
            // Quem rola é este contentor. Lá dentro, a coluna dos controlos gruda à esquerda
            // (`sticky`) e a régua gruda em cima, cada uma no seu eixo, e o canto onde as duas
            // se cruzam gruda nos dois.
            <div
              ref={rolagem}
              // A barra do clipe escolhido precisa de saber o que se vê para não sair pela
              // borda; é por esta marca que ela encontra quem rola.
              data-rolagem=''
              // ⚠️ A RODA VERTICAL ROLA DE LADO, no ecrã estreito. Numa linha do tempo o eixo
              // que interessa é o horizontal, e alcançá-lo pedia `shift` + roda ou a barra de
              // rolagem de baixo — dois gestos que quase ninguém conhece, e que no telemóvel
              // nem existem. Quando não há nada para rolar na vertical (o caso normal: duas,
              // três pistas cabem), a roda passa a andar no tempo; havendo, a vertical continua
              // a ser dela. No desktop nada disto acontece: a roda faz o que sempre fez.
              onWheel={(evento) => {
                if (!noCelular) return;
                const caixa = evento.currentTarget;
                if (caixa.scrollHeight > caixa.clientHeight) return;
                if (!evento.deltaY || Math.abs(evento.deltaX) > Math.abs(evento.deltaY)) return;
                caixa.scrollLeft += evento.deltaY;
              }}
              style={{
                flex: 1, minHeight: 0, overflow: 'auto', position: 'relative',
                background: DS.color.bgFundoDaLinha,
                // O dedo rola nos dois eixos, e o gesto morre aqui: sem `contain`, chegar ao
                // fim da linha do tempo passa o arrasto à tela de trás (e no iOS ao "puxar para
                // recarregar"), com o editor a saltar por baixo da mão.
                touchAction: 'pan-x pan-y',
                overscrollBehavior: 'contain',
                // O navegador reposiciona sozinho a rolagem para "segurar" o que está à vista
                // quando o conteúdo muda de tamanho. Aqui isso é um estorvo: mudar o zoom
                // redimensiona a montagem inteira, e a linha do tempo saltava para o meio da
                // música em vez de ficar onde estava no TEMPO.
                overflowAnchor: 'none',
              }}
            >
            <div style={{ display: 'flex', minWidth: 'max-content', minHeight: '100%' }}>
              {/* Cabeçalhos das pistas */}
              <div style={{
                width: larguraDasPistas, flexShrink: 0,
                background: DS.color.bgPainel, borderRight: `1px solid ${DS.color.borda}`,
                position: 'sticky', left: 0, zIndex: 11,
              }}>
                <div style={{
                  height: ALTURA_DA_REGUA,
                  borderBottom: `1px solid ${DS.color.borda}`,
                  display: 'flex', alignItems: 'center', padding: '0 12px',
                  fontSize: 10, letterSpacing: '0.08em', color: DS.color.textoFraco, fontWeight: 600,
                  // O canto: gruda nos DOIS eixos, e por cima da régua — senão a régua passa-lhe
                  // por baixo e o "PISTAS" fica a meio de "0s".
                  position: 'sticky', top: 0, zIndex: 12,
                  background: DS.color.bgPainel,
                }}>
                  FAIXAS
                </div>

                {coluna}

                {/* ⚠️ CRIA A FAIXA, E NÃO PEDE UM FICHEIRO. Este botão abria o seletor de
                    ficheiros, e com isso não havia como preparar a montagem — voz, guitarra,
                    bateria — antes de ter o áudio de cada uma. Encher a faixa é o outro botão,
                    o de enviar, que vive na própria faixa. */}
                {podeEditar && (
                  <button
                    type='button'
                    onClick={() => acoes.aoCriarPista()}
                    aria-label='Adicionar faixa'
                    style={{
                      width: '100%', height: 46,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      background: 'transparent', border: 'none',
                      borderBottom: `1px solid ${DS.color.borda}`,
                      color: DS.color.textoApoio, fontSize: 13, cursor: 'pointer',
                      fontFamily: DS.font.display,
                    }}
                  >
                    + Adicionar faixa
                  </button>
                )}
              </div>

              {/* Linha do tempo */}
              <div
                ref={linha}
                // ⚠️ PONTEIRO, E NÃO RATO. Num ecrã de toque o rato só é imitado depois de o
                // dedo levantar — e nunca em série —, por isso não havia um único `mousemove`
                // entre pousar e levantar: o arrasto de um clipe e o da agulha não estavam
                // travados por regra nenhuma, simplesmente nunca chegavam a acontecer.
                // `pointercancel` fecha o arrasto quando o sistema leva o gesto (uma chamada,
                // o gesto de voltar), senão o clipe ficava colado ao dedo que já não existe.
                onPointerMove={aoMover}
                onPointerUp={aoLargar}
                onPointerCancel={aoLargar}
                onPointerLeave={aoLargar}
                onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
                onDragLeave={() => setSobre(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(false);
                  if (!podeEditar) return;
                  // Fora de uma faixa: cada ficheiro vira uma PISTA nova, no segundo em que foi
                  // largado. É o gesto que quem vem de uma DAW já faz sem pensar.
                  const inicio = Math.round(segundoDoEvento(e) / passoDoEncaixe) * passoDoEncaixe;
                  const daBiblioteca = e.dataTransfer.getData(TIPO_DO_ARRASTO);
                  if (daBiblioteca) {
                    const item = biblioteca.find((i) => i.id === daBiblioteca);
                    if (item) escolherArquivos([item.arquivo], inicio);
                    return;
                  }
                  escolherArquivos(Array.from(e.dataTransfer.files), inicio);
                }}
                style={{
                  // Sem `overflow` nenhum: quem rola é o contentor acima, para os controlos e
                  // as ondas andarem juntos. `flexShrink: 0` porque a largura aqui é a da
                  // MONTAGEM (duração × zoom) e não o que sobra da tela.
                  flexShrink: 0, position: 'relative',
                  outline: sobre ? `2px dashed ${DS.color.primaria}` : 'none',
                  outlineOffset: -2,
                }}
              >
                <div
                  onPointerDown={(evento) => { agulhaPresa.current = true; transporte.irPara(segundoDoEvento(evento)); }}
                  // Marcada como agulha: tocar aqui move o ponto do corte, e é um gesto que
                  // PREPARA a barra do clipe em vez de a fechar.
                  data-agulha=''
                  style={{
                    height: ALTURA_DA_REGUA, width: largura,
                    // A régua é para levar a agulha, e o dedo tem de a poder arrastar: aqui o
                    // gesto é nosso. Rolar continua a ser em qualquer outro sítio da montagem.
                    touchAction: 'none',
                    position: 'sticky', top: 0, zIndex: 10,
                    background: DS.color.bgPainel,
                    borderBottom: `1px solid ${DS.color.borda}`,
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  {daRegua}
                  {/* ⚠️ A DICA É DE RATO, e por isso não vive no telemóvel: lá não há duplo
                      clique, a edição de clipes está desligada (`semEdicao`), e a frase ainda
                      por cima ia escrever-se por cima dos números da régua. */}
                  {!noCelular && (
                    <span style={{
                      position: 'absolute', right: 12, top: 0, lineHeight: `${ALTURA_DA_REGUA}px`,
                      fontSize: 10, color: DS.color.textoInerte,
                    }}>
                      Clique duplo num clipe para remover
                    </span>
                  )}
                </div>

                <div ref={pilhaDasPistas} style={{ position: 'relative', width: largura }}>
                  {pistas.map((faixa, indice) => {
                    const cor = corDaPista(faixa.color_index ?? indice);
                    return (
                      <div
                        key={faixa.id}
                        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
                        onDrop={(e) => largarNaFaixa(e, faixa.id)}
                        style={{
                          height: alturaDaPista,
                          borderBottom: `1px solid ${DS.color.borda}`,
                          position: 'relative',
                        }}
                      >
                        {daGrelha}

                        {(faixa.clips ?? []).map((clipe, ordem) => (
                          <Clipe
                            key={clipe.id}
                            clipe={clipe}
                            indice={ordem}
                            cor={cor}
                            // Uma barra a cada três pixels: um número fixo faz a onda de meio
                            // segundo ficar rendilhada e a de quatro minutos virar um bloco.
                            picos={picos(clipe.id, Math.max(40, Math.min(900, Math.round(((Number(clipe.duration_seconds) || 0) * escala) / 3))))}
                            escala={escala}
                            agulha={agulha}
                            altura={alturaDaPista}
                            selecionado={selecionado === clipe.id}
                            fixo={faixa.id === pistaFixaId}
                            noDedo={noCelular}
                            indiceDaCor={faixa.color_index ?? indice}
                            recuoDaJanela={larguraDasPistas}
                            aoPintar={podeEditar && faixa.id !== pistaFixaId
                              ? (tinta) => acoes.aoMudarPista(faixa.id, { color_index: tinta })
                              : undefined}
                            aoSelecionar={() => setSelecionado((atual) => (atual === clipe.id ? null : clipe.id))}
                            // ⚠️ O `noCelular` SAIU DAQUI. Ele travava o arrasto por tamanho de
                            // ecrã, e a decisão de quando o dedo pode arrastar é do clipe (só
                            // depois de escolhido) — não desta guarda, que é sobre permissão.
                            aoArrastar={(evento) => {
                              if (!podeEditar || faixa.id === pistaFixaId) return;
                              const caixa = linha.current;
                              if (!caixa) return;
                              const x = evento.clientX - caixa.getBoundingClientRect().left + caixa.scrollLeft;
                              arrasto.current = {
                                clipeId: clipe.id,
                                deslocamentoX: x - (Number(clipe.start_seconds) || 0) * escala,
                                inicio: Number(clipe.start_seconds) || 0,
                                pistaId: faixa.id,
                              };
                            }}
                            aoCortar={() => { acoes.aoCortarClipe(clipe.id, agulha); setSelecionado(null); }}
                            aoDuplicar={faixa.id === pistaFixaId
                              ? undefined
                              : () => { acoes.aoDuplicarClipe(clipe.id); setSelecionado(null); }}
                            aoApagar={() => { acoes.aoApagarClipe(clipe.id); setSelecionado(null); }}
                          />
                        ))}
                      </div>
                    );
                  })}

                  {pistas.length === 0 && (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 8,
                      pointerEvents: 'none', paddingTop: 60,
                    }}>
                      <p style={{ margin: 0, fontSize: 13, color: DS.color.textoFraco }}>
                        Arraste os stems desta gravação para aqui.
                      </p>
                    </div>
                  )}

                  {/* A agulha. Fica por cima de tudo, e é ela que diz onde o corte cai.
                      ⚠️ ELA COMEÇA NA RÉGUA, e não no topo das faixas. A bolinha é onde o olho a
                      encontra ao percorrer a régua — é ela que faz a agulha ser um objeto que se
                      pega, e não um risco. Nascendo uma régua abaixo, ela ficava escondida entre
                      os números e a primeira faixa, e a web e o aplicativo desenhavam a mesma
                      montagem com a pega em sítios diferentes.

                      O `top` é negativo porque a agulha mora na pilha das FAIXAS, que começa
                      depois da régua; subir por aqui é o que a deixa atravessá-la sem mudar de
                      pai — e mudar de pai custava-lhe a coordenada horizontal, que é a da
                      pilha. */}
                  <div
                    ref={linhaDaAgulha}
                    onPointerDown={() => { agulhaPresa.current = true; }}
                    data-agulha=''
                    style={{
                      touchAction: 'none',
                      position: 'absolute', left: agulha * escala, top: -ALTURA_DA_REGUA,
                      height: ALTURA_DA_REGUA + Math.max(pistas.length, 1) * alturaDaPista,
                      width: 2, background: DS.color.agulha, cursor: 'grab', zIndex: 100,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                      width: 11, height: 11, borderRadius: '50%',
                      background: DS.color.agulha, boxShadow: `0 0 8px ${DS.color.agulha}`,
                    }} />
                  </div>
                </div>
              </div>
            </div>
            </div>
          )}
        </div>
      </div>
      {/* ══════════ RODAPÉ ══════════ */}
      {/*
        O que vale para a MONTAGEM INTEIRA mora aqui, e não no cabeçalho.
        O cabeçalho ficou a dizer três coisas ao mesmo tempo — que música é esta, que vista está
        aberta, e como está a soar — e a terceira não é do mesmo tipo das outras: o Master não
        identifica nada, ele mexe no som. Descido para o rodapé, o topo volta a ser só
        identidade e navegação, e o volume geral fica ao lado do que ele governa.
      */}
      <div style={{
        height: ALTURA_DO_RODAPE, flexShrink: 0,
        display: 'flex', alignItems: 'center',
        gap: noCelular ? 8 : 14, padding: noCelular ? '0 10px' : '0 18px',
        background: DS.color.bgPainel, borderTop: `1px solid ${DS.color.borda}`,
      }}>
        {/* ⚠️ A PORTA DA BIBLIOTECA MORA NO RODAPÉ, com o resto do que governa a tela inteira
            (o andamento, o tom, o volume geral). No transporte ela ficava entre o play e o
            loop — controlos do que está a SOAR —, e abrir uma pasta não é um gesto de
            transporte. */}
        {podeEditar && (
          <button
            type='button'
            onClick={() => setBibliotecaAberta((v) => !v)}
            aria-pressed={bibliotecaAberta}
            title={bibliotecaAberta ? 'Fechar a biblioteca' : 'Abrir a biblioteca'}
            aria-label={bibliotecaAberta ? 'Fechar a biblioteca' : 'Abrir a biblioteca'}
            style={{
              width: 30, height: 30, borderRadius: DS.raio.medio, flexShrink: 0,
              background: bibliotecaAberta ? DS.color.bgCampo : 'transparent',
              border: 'none',
              color: bibliotecaAberta ? DS.color.texto : DS.color.textoApoio,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background .16s ease, color .16s ease',
            }}
          >
            <FiFolder size={15} />
          </button>
        )}

        {numeros}

        {/* ⚠️ A CONTAGEM DE PISTAS SAI NO CELULAR. Ela quebrava em duas linhas dentro de uma
            barra de 44 px ("0" numa, "pistas" noutra) e roubava a largura do Master, que é o
            único controlo desta barra. Quantas pistas há vê-se na mesa, que está logo acima. */}
        {!noCelular && (
          <span style={{ fontSize: 11, color: DS.color.textoFraco, fontFamily: DS.font.mono }}>
            {pistas.length} {pistas.length === 1 ? 'faixa' : 'faixas'}
          </span>
        )}

        <div style={{ flex: 1, minWidth: 0 }} />

        <div style={{
          display: 'flex', alignItems: 'center', gap: noCelular ? 6 : 10,
          flexShrink: noCelular ? 1 : 0, minWidth: 0,
        }}>
          {/* A palavra "Master" cede ao ícone: o altifalante diz a mesma coisa e ocupa 14 px. */}
          {!noCelular && <span style={{ fontSize: 12, color: DS.color.textoApoio }}>Master</span>}
          <FiVolume2 size={14} color={DS.color.textoFraco} style={{ flexShrink: 0 }} />
          <input
            type='range' min={0} max={100}
            value={Math.round(estado.mestre * 100)}
            onChange={(e) => acoes.aoMestre(Number(e.target.value) / 100)}
            aria-label='Volume geral'
            style={{
              width: noCelular ? '100%' : 160, minWidth: noCelular ? 80 : undefined,
              accentColor: DS.color.primaria, cursor: 'pointer',
            }}
          />
          {/* ⚠️ SEM A PERCENTAGEM AO LADO. O número não diz nada que o fader já não mostre —
              a posição do cursor É o volume — e custava 38 px numa barra que no telemóvel
              não os tem. Saiu primeiro do app; sai agora daqui, para as duas serem a mesma
              barra. O valor continua no `aria-label` do campo, para quem não vê o cursor. */}
        </div>

      </div>

      {/* A ajuda flutua ACIMA do rodapé, e não dentro dele: um círculo de 30 px numa barra de
          44 encostava nas bordas e empurrava o Master para dentro. O `bottom` sai do mesmo
          token da altura do rodapé, para os dois não poderem divergir. */}
      {/* A LETRA num balão, e não numa aba: escreve-se letra a olhar para a montagem, e uma aba
          faria trocar de tela para ler um verso. Mesmo gesto do "?", do outro lado. */}
      {/* O seletor do editor. Fica aqui, fora de qualquer painel que possa fechar — foi
          justamente por viver dentro da biblioteca que o "Adicionar pista" parou de funcionar
          no dia em que ela passou a recolher. */}
      <input
        ref={seletor}
        type='file'
        accept='.mp3,.wav,audio/mpeg,audio/wav'
        multiple
        style={{ display: 'none' }}
        onChange={(evento) => {
          const arquivos = Array.from(evento.target.files || []);
          // Limpa ANTES de usar: escolher o mesmo ficheiro duas vezes seguidas não dispara
          // `change` se o valor não mudar, e o segundo envio nunca aconteceria.
          evento.target.value = '';
          if (!arquivos.length) return;
          // ⚠️ NO FIM DA FAIXA, E NÃO NO ZERO. Um take mandado para uma faixa que já tem áudio
          // nascia em cima do que lá estava: dois clipes no mesmo segundo tocam juntos e
          // desenham-se um por cima do outro, e quem enviava via a montagem engolir o ficheiro.
          // Encostado ao fim, ele aparece a seguir — e sobrepor passa a ser o gesto de arrastar,
          // que é uma escolha, em vez de ser o que acontece sem ninguém pedir.
          const alvo = pistas.find((p) => p.id === pistaDoEnvio.current);
          escolherArquivos(arquivos, fimDaPista(alvo?.clips), pistaDoEnvio.current ?? undefined);
          pistaDoEnvio.current = null;
        }}
      />

      {/* O selo de estado, na mesma fila dos outros flutuantes. Só existe no DOM quando há algo
          a dizer: um indicador permanente deixa de ser lido, e este precisa de ser lido nas
          duas vezes em que importa — a gravar, e quando falhou. */}
      {!!atividade && (
        <div
          className={casca.selo}
          style={{ bottom: ALTURA_DO_RODAPE + 12, color: atividade.cor }}
          title={atividade.texto}
          aria-label={atividade.texto}
          aria-live='polite'
          role='status'
        >
          {atividade.girando
            ? <FiLoader size={14} className={casca.girando} />
            : atividade.falhou ? <FiAlertCircle size={14} /> : <FiCheck size={14} />}
          {atividade.texto}
        </div>
      )}

      {/* AS DUAS SETAS, na coluna dos flutuantes, por cima do "?".
          ⚠️ ELAS SAÍRAM DO TRANSPORTE, onde competiam com o play — o botão que se procura sem
          olhar — e empurravam o relógio num ecrã de 390. Aqui ficam onde este editor já põe o
          que acompanha a montagem sem fazer parte dela.
          O desfazer fica EMBAIXO, mais perto da mão: é ele que se usa dez vezes por cada
          refazer. No HTML a ordem é a normal, e é essa que o teclado percorre. */}
      {historico && (
        <div className={casca.setas} style={{ bottom: ALTURA_DO_RODAPE + 12 + 38 }}>
          {([
            ['desfazer', FiCornerUpLeft, historico.podeDesfazer, historico.rotuloDesfazer],
            ['refazer', FiCornerUpRight, historico.podeRefazer, historico.rotuloRefazer],
          ] as const).map(([qual, Icone, pode, rotulo]) => (
            <button
              key={qual}
              type='button'
              onClick={qual === 'desfazer' ? historico.desfazer : historico.refazer}
              disabled={!pode || historico.ocupado}
              // Uma seta muda não se usa: o rótulo diz o que ela vai desmanchar.
              title={rotulo}
              aria-label={rotulo}
            >
              <Icone size={15} />
            </button>
          ))}
        </div>
      )}

      {/* ⚠️ A CONVERSA É DO PROJETO, e não da gravação aberta: um comentário preso a uma versão
          responde "o que muda NESTA" e morre com ela; isto é o fio do trabalho da equipa sobre a
          música, e fica num sítio só. */}
      <details className={`${casca.ajuda} ${casca.conversa}`} style={{ bottom: ALTURA_DO_RODAPE + 12 }}>
        <summary title='Conversa da equipe' aria-label='Conversa da equipe'>
          <FiMessageCircle size={14} />
        </summary>
        <div>{conversa}</div>
      </details>

      <details className={`${casca.ajuda} ${casca.letra}`} style={{ bottom: ALTURA_DO_RODAPE + 12 }}>
        <summary title='Letra' aria-label='Letra'><FiFileText size={14} /></summary>
        <div>{letra}</div>
      </details>

      <details className={casca.ajuda} style={{ bottom: ALTURA_DO_RODAPE + 12 }}>
        <summary title='Ajuda' aria-label='Ajuda'>?</summary>
        <div>
          <strong>Como se monta</strong>
          <p>Arraste os stems para a linha do tempo, ou use <em>Escolher arquivos</em>. Cada
            ficheiro vira uma pista; largado sobre uma faixa, vira um clipe nela.</p>
          <p>Arraste um clipe para o mover — ele encaixa de um quarto de segundo. Selecione-o e
            use <em>dividir</em> para o cortar onde a agulha está. Clique duplo remove.</p>
          <p><strong>M</strong> cala a faixa, <strong>S</strong> deixa só ela. O primeiro
            controlo é o volume; o segundo, o panorama entre os dois alto-falantes.</p>
        </div>
      </details>
    </div>
  );
};

/**
 * A MESA: as mesmas pistas, vistas como canais.
 *
 * A linha do tempo responde "o que toca quando"; a mesa responde "como isto soa junto". É a
 * mesma montagem — o que muda é a pergunta, e por isso é uma aba e não outra tela.
 */
const MesaDeCanais: FC<{
  pistas: CatalogTrack[];
  estado: EstadoDaMesa;
  podeEditar: boolean;
  pistaFixaId?: string | null;
  acoes: AcoesDoEditor;
  /** No telemóvel o fader estica: é o controlo principal da tela, e um dedo pede curso. */
  noCelular?: boolean;
}> = ({ pistas, estado, podeEditar, acoes, noCelular }) => (
  <div style={{
    flex: 1, minHeight: 0, overflow: 'auto', padding: noCelular ? 12 : 20,
    display: 'flex', gap: noCelular ? 10 : 14, alignItems: 'stretch',
    background: DS.color.bgFundoDaLinha,
  }}>
    {pistas.map((faixa, indice) => {
      const cor = corDaPista(faixa.color_index ?? indice);
      const daMesa = estado.pistas.find((p) => p.id === faixa.id);
      const calada = Boolean(daMesa?.muda);
      const pan = daMesa?.pan ?? (Number(faixa.pan) || 0);
      return (
        <div
          key={faixa.id}
          style={{
            width: 116, flexShrink: 0, padding: 12,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            // ⚠️ No telemóvel o canal não pode acabar a meio: o fader estica até onde a coluna
            // vai, e o que sobrava era um retângulo vazio de meia tela por baixo dos botões.
            justifyContent: noCelular ? 'flex-start' : undefined,
            background: DS.color.bgPista, border: `1px solid ${DS.color.borda}`,
            borderTop: `3px solid ${calada ? DS.color.textoInerte : cor}`,
            borderRadius: DS.raio.grande, opacity: calada ? 0.6 : 1,
          }}
        >
          <span style={{
            width: '100%', fontSize: 12, fontWeight: 600, color: DS.color.texto,
            textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {faixa.name}
          </span>

          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <input
              type='range' min={-100} max={100}
              value={Math.round(pan * 100)}
              onChange={(e) => acoes.aoMudarPista(faixa.id, { pan: Number(e.target.value) / 100 })}
              disabled={!podeEditar}
              aria-label={`Panorama de ${faixa.name} na mesa`}
              className={casca.pan}
              style={{
                width: 84,
                ...({ '--pan-de': faixaDoPan(pan).de, '--pan-ate': faixaDoPan(pan).ate } as React.CSSProperties),
              }}
            />
            <span style={{ fontSize: 10, color: DS.color.textoFraco, fontFamily: DS.font.mono }}>
              {Math.abs(pan) < 0.02 ? 'C' : `${pan < 0 ? 'E' : 'D'}${Math.round(Math.abs(pan) * 100)}`}
            </span>
          </label>

          {/* O fader vertical: é a forma de uma mesa, e é o que deixa comparar seis níveis de
              relance — deitados, seis linhas empilhadas não se comparam. O desenho é o do app;
              ver `FaderEmPe`. */}
          <FaderEmPe
            valor={daMesa?.ganho ?? Number(faixa.gain ?? 1)}
            cor={cor}
            rotulo={`Volume de ${faixa.name} na mesa`}
            travado={!podeEditar}
            aoMudar={(v) => acoes.aoMudarPista(faixa.id, { gain: v })}
          />

          <span style={{ fontSize: 11, color: DS.color.textoApoio, fontFamily: DS.font.mono }}>
            {Math.round((daMesa?.ganho ?? faixa.gain ?? 1) * 100)}
          </span>

          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type='button'
              onClick={() => acoes.aoMudarPista(faixa.id, { muted: !calada })}
              aria-label={calada ? `Ouvir ${faixa.name} na mesa` : `Silenciar ${faixa.name} na mesa`}
              aria-pressed={calada}
              style={botaozinho(calada, DS.color.textoFraco)}
            >
              {calada ? <FiVolumeX size={11} /> : <FiVolume2 size={11} />}
            </button>
            <button
              type='button'
              onClick={() => acoes.aoSolar(faixa.id, !daMesa?.solo)}
              aria-label={daMesa?.solo ? 'Ouvir tudo de novo na mesa' : `Ouvir só ${faixa.name} na mesa`}
              aria-pressed={Boolean(daMesa?.solo)}
              style={botaozinho(Boolean(daMesa?.solo), '#f59e0b')}
            >
              S
            </button>
          </div>
        </div>
      );
    })}

    {pistas.length === 0 && (
      <p style={{ margin: 'auto', fontSize: 13, color: DS.color.textoFraco }}>
        Sem pistas para misturar ainda.
      </p>
    )}
  </div>
);
