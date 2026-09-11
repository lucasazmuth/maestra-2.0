import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';

import {
  HISTORICO_VAZIO, desfazer as desfazerPasso, podeDesfazer, podeRefazer,
  refazer as refazerPasso, registar, rotuloDaSeta,
  type Historico, type PassoDaMontagem,
} from '@maestra/core/audio/historico';
import {
  ehPistaDaMix, montagemDaVersao, nomeDaPistaNova, proximaPosicaoDaPista,
} from '@maestra/core/audio/pistasDaVersao';
import { ZOOM_MAXIMO, ZOOM_MINIMO } from '@maestra/core/audio/grade';
import {
  MONTAGEM_MUDA, bytesDoMp3, caminhoDaGuia, rotuloDaGuia, temSom,
} from '@maestra/core/audio/exportar';
import { useMesa } from '@maestra/core/audio/useMesa';
import { useAnaliseDaVersao } from '@maestra/core/hooks/useAnaliseDaVersao';
import { bpmLegivel, outroAndamento, podeOuvirSozinho } from '@maestra/core/services/db/audioJobs';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import {
  LIMITE_DA_PISTA_BYTES, MAXIMO_DE_PISTAS, MEMORIA_DE_AVISO_BYTES,
} from '@maestra/core/constants/maestra';
import { AZUL_DO_EDITOR, COR, COR_EDITOR } from '@maestra/core/constants/design';
import type {
  CatalogClip, CatalogProject, CatalogTrack, CatalogVersion,
} from '@maestra/core/interfaces/maestra';
import {
  BALDE_DO_CATALOGO, gravarEmCaminhoFixo, tipoDoCatalogo, tituloDoArquivo,
} from '@maestra/core/services/armazenamento';
import * as catalogo from '@maestra/core/services/db/catalog';

import { CampoDoCabecalho } from '@/casca/jam/CampoDoCabecalho';
import { ConversaDoJam } from '@/casca/jam/ConversaDoJam';
import { FolhaDaVersao } from '@/casca/jam/FolhaDaVersao';
import { PALETA_ESCURA, PaletaDaFolhaProvider } from '@/casca/paleta';
import { Fader } from '@/casca/jam/mesa/Fader';
import { MesaDeCanais } from '@/casca/jam/mesa/MesaDeCanais';
import { LinhaDoTempo } from '@/casca/jam/mesa/LinhaDoTempo';
import { IconeDaTimeline, IconeDoMixer } from '@/casca/jam/mesa/icones';
import { BalaoFlutuante } from '@/casca/jam/mesa/BalaoFlutuante';
import { Biblioteca } from '@/casca/jam/mesa/Biblioteca';
import { TelaDeExportar, type EmCurso } from '@/casca/jam/mesa/TelaDeExportar';
import {
  partilharGuiaMp3, partilharGuiaWav, partilharStems,
} from '@/casca/jam/mesa/exportarNativo';
import { Transporte } from '@/casca/jam/mesa/Transporte';
import { FichaDaFaixa } from '@/casca/musicas/FichaDaFaixa';
import { buscarNativo, criarContextoNativo, criarOfflineNativo } from '@/nucleo/audio/contextoNativo';
import { useInterrupcoesDeAudio } from '@/nucleo/audio/interrupcoes';
import {
  enviarParaOCatalogo, escolherAudio, escolherAudios, segundosDoAudio,
  type ArquivoEscolhido,
} from '@/nucleo/arquivos';
import { useArtistaDaRota } from '@/nucleo/artista';
import { useSessao } from '@/nucleo/sessao';

// O Espaço JAM: a MÚSICA, aberta como um editor.
//
// Mora fora das abas do artista de propósito. Na web ela é `position: fixed; inset: 0` e some o
// topo, o rail e a barra — é uma tela cheia, não mais um módulo. Aqui, portanto, é uma tela da
// pilha da raiz, e a barra de abas não aparece.
//
// ─── Por que a tela virou uma mesa ───────────────────────────────────────────
//
// Quem chegava aqui não percebia o modelo: que o Espaço JAM é a MÚSICA e que cada versão é uma
// GRAVAÇÃO dela. A pilha de cartões, cada um com o seu play e a sua onda, dizia o contrário —
// parecia uma lista de faixas soltas. O dono do produto propôs a forma que todo músico já
// conhece: um editor. Ableton, Logic, qualquer um deles ensina em três segundos que um projeto
// tem pistas, e que as pistas tocam JUNTAS.
//
// Daí esta tela:
//   • as gravações são uma FILA DE FICHAS — são alternativas, ouve-se uma de cada vez, e
//     escolher uma é ABRI-LA no editor;
//   • as pistas empilhadas são os STEMS da gravação aberta — essas sim tocam ao mesmo tempo,
//     com mutar, solo e volume;
//   • o transporte é UM só, da gravação aberta, e é ele quem diz que as pistas são camadas de
//     uma coisa e não coisas separadas.
//
// ─── E por que o BPM e o tom voltaram para o cabeçalho ───────────────────────
//
// Eles tinham ido para dentro da ficha porque a tela estava confusa. Mas o que confundia não era
// editar em linha, era não se saber de QUEM era o número. Aqui eles são da gravação ABERTA, e o
// rótulo por baixo diz qual é. Gênero e data ficam na linha da ficha, porque são da música.

/** Quanto tempo o "Salvo" fica na tela. Depois disso ele saía do nada; antes disto não saía nunca. */
const DURACAO_DO_SELO = 2000;

/** O compasso do salvamento automático, igual ao do resto do app. */
const ESPERA = 650;

// Fora do componente: são as mesmas duas funções para sempre, e cá dentro seriam objetos novos
// a cada render. `mono` ligado — no telemóvel, somar os canais é metade da memória por pista, e
// a memória é o que mata a aplicação com seis stems abertos.
const DEPENDENCIAS_DA_MESA = { criarContexto: criarContextoNativo, buscar: buscarNativo, mono: true };

export default function EspacoJam() {
  const { artista: artistaId, projeto: projetoId } = useLocalSearchParams<{
    artista: string; projeto: string;
  }>();
  const margem = useSafeAreaInsets();
  const { sessao } = useSessao();
  /**
   * Quem pode mexer na montagem.
   *
   * ⚠️ A MESMA REGRA DA WEB, e não uma nova: colaborar no JAM ou editar o catálogo. Sem ela,
   * um convidado só de leitura veria clipes que se escolhem, setas que prometem desfazer e
   * botões de remover que o banco ia recusar — e a recusa chegaria como "Falha ao salvar", que
   * não explica nada a quem nunca teve permissão.
   */
  const artista = useArtistaDaRota(String(artistaId));
  const { canCollaborateJam, canEditCatalog } = useArtistCapabilities(artista);
  const podeEditar = canCollaborateJam || canEditCatalog;

  const usuario = sessao?.user;
  const dados = (usuario?.user_metadata ?? {}) as Record<string, unknown>;
  const meuNome = (dados.full_name || dados.name || usuario?.email || 'Você') as string;
  const minhaFoto = (dados.avatar_url || dados.picture || null) as string | null;

  const [projeto, setProjeto] = useState<CatalogProject | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [selo, setSelo] = useState<'parado' | 'salvando' | 'salvo' | 'erro'>('parado');
  /**
   * Qual metade da gravação está à vista.
   *
   * ⚠️ ABRE NA LINHA DO TEMPO, como a web. Ela é a cara do editor: é onde se vê o que a música
   * TEM. Chegar ao Espaço JAM por um ecrã de faders, sem uma onda à vista, é chegar a outro
   * produto. Ver não é montar, e ver é o que a linha do tempo faz bem no aparelho.
   */
  const [aba, setAba] = useState<Aba>('linha');


  // ─── Exportar: os stems (ZIP) e a guia (WAV/MP3) ─────────────────────────
  //
  // Mora aqui, e não na tela de exportar: é aqui que a mesa vive, com os buffers já
  // descodificados, e é aqui que se sabe o endereço da guia já gravada. A tela de lá é pura.
  //
  // ⚠️ NO TELEMÓVEL ISTO É PARTILHAR, e não baixar: não há pasta de transferências que se abra
  // noutro programa. O ficheiro é escrito na cache e entregue à folha do sistema, de onde a
  // pessoa escolhe o destino — AirDrop para o computador onde está o Ableton, Ficheiros,
  // WhatsApp. É o mesmo gesto da web com a forma daqui.
  const [exportandoEm, setExportandoEm] = useState<EmCurso>(null);

  /** Todos falham igual: um alerta com o motivo, e o botão volta ao que era. */
  const exportar = async (qual: Exclude<EmCurso, null>, fazer: () => Promise<void>) => {
    if (exportandoEm) return;
    setExportandoEm(qual);
    try {
      await fazer();
    } catch (e) {
      Alert.alert('Não consegui exportar', e instanceof Error ? e.message : 'Tente de novo.');
    } finally {
      setExportandoEm(null);
    }
  };

  const enviarStems = () => exportar('stems', async () => {
    const quantas = await partilharStems(mesa, criarOfflineNativo, pistas, projeto?.title || 'stems');
    if (!quantas) Alert.alert('Nada para exportar', 'Nenhuma faixa pôde ser renderizada.');
  });

  const enviarGuiaWav = () => exportar('guia-wav', async () => {
    const saiu = await partilharGuiaWav(mesa, criarOfflineNativo, projeto?.title || 'guia');
    if (!saiu) Alert.alert('Ainda não', 'Espere o áudio carregar para exportar a guia.');
  });

  const enviarGuiaMp3 = () => exportar('guia-mp3', async () => {
    if (!aberta?.audio_file) return;
    await partilharGuiaMp3(aberta.audio_file, projeto?.title || 'guia');
  });
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [arquivoInicial, setArquivoInicial] = useState<ArquivoEscolhido | null>(null);
  const [emEdicao, setEmEdicao] = useState<CatalogVersion | null>(null);

  const [conversaAberta, setConversaAberta] = useState(false);

  /** Qual gravação está aberta no editor. É ela que a mesa carrega e que o cabeçalho edita. */
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [bpm, setBpm] = useState('');
  const [tom, setTom] = useState('');


  /**
   * Esta tela ainda está no ar?
   *
   * ⚠️ SAIR DAQUI NÃO CANCELA O QUE JÁ ESTAVA A CORRER. Gerar a guia, subir uma faixa e
   * recarregar a montagem são idas ao servidor que duram segundos; quem carrega no X no meio
   * delas leva a tela embora, e a resposta chega a um componente que já não existe. O React
   * avisa, e o aviso é merecido: é estado escrito no vazio.
   */
  const noAr = useRef(true);
  useEffect(() => () => { noAr.current = false; }, []);

  const buscar = useCallback(async () => {
    if (!projetoId) return;
    try {
      const proximo = await catalogo.getCatalogProject(String(projetoId));
      if (noAr.current) setProjeto(proximo);
    } catch {
      if (noAr.current) setProjeto(null);
    } finally {
      if (noAr.current) setCarregando(false);
    }
  }, [projetoId]);

  useEffect(() => { void buscar(); }, [buscar]);

  const versoes = useMemo(
    () => (projeto?.versions ?? []).slice().sort((a, b) => b.version_number - a.version_number),
    [projeto],
  );

  // Abre a principal — e, sem principal, a mais recente. Também conserta o caso de a gravação
  // aberta ter sido excluída: sem isto, o editor ficaria a apontar para nada.
  useEffect(() => {
    if (!versoes.length) { setAbertaId(null); return; }
    if (abertaId && versoes.some((v) => v.id === abertaId)) return;
    setAbertaId(
      versoes.find((v) => v.id === projeto?.primary_version_id)?.id ?? versoes[0].id,
    );
  }, [versoes, projeto?.primary_version_id, abertaId]);

  const aberta = useMemo(
    () => versoes.find((v) => v.id === abertaId) ?? null,
    [versoes, abertaId],
  );

  /**
   * A música no formato que a ficha entende.
   *
   * ⚠️ MEMOIZADA, e isso não é economia: a ficha recarrega o rascunho sempre que este objeto
   * MUDA DE IDENTIDADE, e construí-lo no JSX fazia um novo a cada render do editor. Com a mesa a
   * bater o relógio vinte vezes por segundo enquanto toca, o que a pessoa estava a escrever era
   * apagado e reposto pelo valor do servidor a cada tique.
   */
  //
  // ⚠️ E TOLERA `projeto` NULO. Os hooks correm ANTES da guarda que devolve o ecrã de espera —
  // na primeira volta ainda não há música nenhuma. Um `as CatalogProject` calava o compilador e
  // estourava no aparelho, que é o pior par possível: tipo que mente e erro que só aparece em
  // execução.
  const itemDaFicha = useMemo(
    () => (projeto ? catalogo.catalogProjectToItem(projeto, aberta ?? undefined) : null),
    [projeto, aberta],
  );

  // A montagem da gravação aberta: as pistas e os clipes de cada uma. É o MESMO modelo e a
  // MESMA função da web — aqui não há "a versão do app" de coisa nenhuma.
  const pistas = useMemo(() => montagemDaVersao(aberta), [aberta]);
  const mesa = useMesa(pistas, DEPENDENCIAS_DA_MESA);
  // Uma chamada tira a sessão de áudio sem avisar; sem isto a mesa fica a achar que toca.
  useInterrupcoesDeAudio(mesa);

  // O peso do que está aberto, estimado antes de descodificar. Ver `MEMORIA_DE_AVISO_BYTES`.
  const pesado = useMemo(
    () => (aberta?.files ?? []).reduce((soma, f) => soma + (f.size_bytes ?? 0), 0) > MEMORIA_DE_AVISO_BYTES,
    [aberta],
  );

  // ─── Salvamento automático ────────────────────────────────────────────────
  //
  // Duas coisas diferentes, e por isso dois relógios: o status é da MÚSICA, o BPM e o tom são da
  // GRAVAÇÃO ABERTA. Cada um compara com o que já está gravado antes de disparar — é o que
  // impede de regravar no primeiro render aquilo que acabou de voltar do servidor.
  const statusGravado = useRef('');
  const numerosGravados = useRef('');

  useEffect(() => { if (projeto) statusGravado.current ||= projeto.status ?? ''; }, [projeto]);

  // Trocar de gravação enche os campos com os números DELA — e marca-os como já gravados, senão
  // a troca dispararia uma gravação do valor que acabou de ser lido.
  useEffect(() => {
    if (!aberta) return;
    const novoBpm = aberta.bpm ? String(aberta.bpm) : '';
    const novoTom = aberta.key ?? '';
    setBpm(novoBpm);
    setTom(novoTom);
    numerosGravados.current = `${aberta.id}|${novoBpm}|${novoTom}`;
  }, [aberta]);

  useEffect(() => {
    if (!projeto || (projeto.status ?? '') === statusGravado.current) return undefined;
    const conta = setTimeout(async () => {
      setSelo('salvando');
      try {
        await catalogo.updateCatalogProject(projeto.id, { status: projeto.status });
        statusGravado.current = projeto.status ?? '';
        setSelo('salvo');
      } catch {
        setSelo('erro');
      }
    }, ESPERA);
    return () => clearTimeout(conta);
  }, [projeto]);

  useEffect(() => {
    if (!aberta) return undefined;
    const chave = `${aberta.id}|${bpm}|${tom}`;
    if (chave === numerosGravados.current) return undefined;
    const conta = setTimeout(async () => {
      setSelo('salvando');
      const numero = Number(bpm.trim());
      // Um BPM fora da faixa é engano de digitação, não uma escolha: 30 a 300 cobre de uma
      // balada a um drum and bass, e o que passa disso vira "sem BPM" em vez de ir para o banco.
      const valido = bpm.trim() ? (Number.isFinite(numero) && numero >= 30 && numero <= 300) : true;
      try {
        const salva = await catalogo.updateCatalogVersion(aberta.id, {
          // Texto, e não número: a coluna é `text` desde sempre, e um "128 " gravado como
          // número voltaria como 128 e apagaria o que a pessoa digitou enquanto digitava.
          bpm: valido && bpm.trim() ? bpm.trim() : null,
          key: tom.trim() || null,
        });
        numerosGravados.current = chave;
        patcharVersao(aberta.id, { bpm: salva.bpm, key: salva.key });
        setSelo('salvo');
      } catch {
        setSelo('erro');
      }
    }, ESPERA);
    return () => clearTimeout(conta);
    // `patcharVersao` é estável (não depende de nada que mude), e listá-la aqui só ruído.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberta, bpm, tom]);

  // ⚠️ O "Salvo" vai embora sozinho. Antes ficava para sempre: `setSelo` nunca voltava a
  // 'parado', e a linha empurrava a tela 25 pt para baixo desde a primeira edição até sair.
  // O erro fica: é a única forma da pessoa saber que a última mudança não pegou.
  useEffect(() => {
    if (selo !== 'salvo') return undefined;
    const conta = setTimeout(() => setSelo('parado'), DURACAO_DO_SELO);
    return () => clearTimeout(conta);
  }, [selo]);

  // ─── Mexer no estado sem recarregar a tela ────────────────────────────────
  //
  // Renomear uma pista ou mudar um volume não pode chamar `buscar()`: a resposta vinha com um
  // objeto novo, a mesa via pistas "diferentes" e descarregava 400 MB de áudio para mostrar um
  // nome trocado. Estas duas costuras remendam só o que mudou.
  /** Remenda a MÚSICA na tela, sem recarregar a montagem por baixo de quem está a escrever. */
  const patcharProjeto = (parte: Partial<CatalogProject>) =>
    setProjeto((atual) => (atual ? { ...atual, ...parte } : atual));

  const patcharVersao = (id: string, parte: Partial<CatalogVersion>) => setProjeto((atual) => (
    atual ? {
      ...atual,
      versions: (atual.versions ?? []).map((v) => (v.id === id ? { ...v, ...parte } : v)),
    } : atual
  ));

  // ⚠️ UMA PISTA DA MONTAGEM É UMA FAIXA (`catalog_tracks`), e não um FICHEIRO. As duas coisas
  // já foram a mesma: antes da linha do tempo, cada stem enviado era uma linha na mesa, e o id
  // da pista era o do ficheiro. Desde que a montagem passou a ter faixas com clipes, o id que
  // circula aqui é o da FAIXA — e este remendo continuou a procurar em `files`, onde nunca
  // encontrava nada. O sintoma: renomear uma faixa voltava atrás no recarregamento, e o volume
  // ajustado não sobrevivia a reabrir a gravação. Ver também o `updateTrack` lá em baixo.
  const patcharPista = (id: string, parte: Partial<CatalogTrack>) => setProjeto((atual) => (
    atual ? {
      ...atual,
      versions: (atual.versions ?? []).map((v) => ({
        ...v,
        tracks: (v.tracks ?? []).map((t) => (t.id === id ? { ...t, ...parte } : t)),
      })),
    } : atual
  ));

  // ─── A guia ───────────────────────────────────────────────────────────────
  //
  // A lista de Músicas toca UMA coisa por música, e essa coisa é a SOMA da montagem. Sem isto, a
  // pessoa montava quatro camadas no telemóvel, voltava para a lista, e ouvia o áudio antigo —
  // sem nada que explicasse porquê.
  //
  // ⚠️ QUANDO: ao SAIR, e só se a montagem mudou. Renderizar a cada edição daria o mesmo
  // resultado final depois de trinta renders e trinta envios de 4 MB — o mesmo arquivo, trinta
  // vezes, para ninguém ouvir vinte e nove deles.
  //
  // ⚠️ ONDE: num caminho FIXO por música, regravado por cima. Se cada render criasse um arquivo
  // novo, uma música editada trinta vezes guardaria trinta guias mortas.
  const sujo = useRef(false);
  /** 0..1 enquanto a guia corre; `null` fora disso. Ver `rotuloDaGuia`, no núcleo. */
  const [gerando, setGerando] = useState<number | null>(null);

  const gerarAGuia = async (): Promise<void> => {
    if (!sujo.current || !aberta || !projeto || !podeEditar) return;
    // ⚠️ COMEÇA SEM CONTA, e não em 0%. Antes do codificador vem a SOMA das faixas, que não
    // sabe dizer quanto falta — e no aparelho ela sozinha leva dezenas de segundos. Um "0%"
    // parado durante esse tempo é o mesmo que reticências paradas: parece uma tela pendurada,
    // que é o que faz alguém fechar o aplicativo a meio. `NaN` faz o rótulo voltar ao texto
    // simples até haver um número de verdade. Ver `rotuloDaGuia`, no núcleo.
    setGerando(Number.NaN);
    try {
      const rendido = await mesa.renderizar(criarOfflineNativo);
      if (!rendido) return;
      // ⚠️ SILÊNCIO NÃO SE GRAVA POR CIMA DA GUIA BOA. Ver `temSom`, no núcleo: entre gravar
      // mudo e não gravar, não gravar é sempre melhor — a montagem continua salva, a guia
      // anterior continua a tocar na lista, e a saída seguinte tenta de novo.
      if (!temSom(rendido)) { Alert.alert('Guia não gravada', MONTAGEM_MUDA); return; }
      const bytes = await bytesDoMp3(rendido, (parte) => {
        if (noAr.current) setGerando(parte);
      });
      const gravado = await gravarEmCaminhoFixo(
        BALDE_DO_CATALOGO, caminhoDaGuia(String(artistaId), projeto.id), bytes.buffer, 'audio/mpeg',
      );

      // ⚠️ A GUIA TEM CAMINHO PRÓPRIO, e o que muda é para onde a gravação aponta. Escrever por
      // cima do ficheiro original seria um laço: a pista da Mix aponta para esse mesmo endereço,
      // e a guia seguinte teria a guia anterior dentro dela, cada vez mais dobrada. E o áudio
      // que a pessoa enviou um dia desapareceria sem forma de voltar atrás.
      await catalogo.updateCatalogVersion(aberta.id, {
        audio_file: gravado.url,
        audio_file_name: 'guia.mp3',
        duration: relogioCurto(rendido.duration),
      });
      sujo.current = false;
      if (!noAr.current) return;
    } catch {
      // Falhar a guia não pode prender a pessoa na tela: a montagem está salva, e a próxima
      // saída tenta de novo.
    } finally {
      if (noAr.current) setGerando(null);
    }
  };

  // ─── A montagem: mover, dividir, remover ──────────────────────────────────
  //
  // Chega ao aparelho a mesma camada que a web tem, e com as mesmas regras, porque elas não são
  // da tela: apagar é MARCAR (a linha fica no banco até a sessão fechar, e é isso que dá às
  // setas alguma coisa para onde voltar), e a pilha do desfazer vive no núcleo.

  /** O remendo local do clipe: arrastar não pode recarregar o projeto a cada pixel. */
  const patcharClipe = (id: string, parte: Partial<CatalogClip>) => setProjeto((atual) => (
    atual ? {
      ...atual,
      versions: (atual.versions ?? []).map((v) => ({
        ...v,
        tracks: (v.tracks ?? []).map((t) => ({
          ...t,
          clips: (t.clips ?? []).map((c) => (c.id === id ? { ...c, ...parte } : c)),
        })),
      })),
    } : atual
  ));

  const relogiosDoClipe = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  /**
   * Esquece uma escrita adiada que já não faz sentido.
   *
   * ⚠️ APAGAR TEM DE CANCELAR O QUE ESTAVA A CAMINHO. Largar um clipe agenda a gravação da
   * posição dele; removê-lo logo a seguir apagava a linha e, meio segundo depois, a escrita
   * adiada chegava a um `id` que já não existia. É o mesmo erro que a web já levou.
   */
  const esquecerClipe = (id: string) => {
    clearTimeout(relogiosDoClipe.current[id]);
    delete relogiosDoClipe.current[id];
  };

  const [historico, setHistorico] = useState<Historico>(HISTORICO_VAZIO);
  const [andandoNoTempo, setAndandoNoTempo] = useState(false);
  const anotar = (passo: PassoDaMontagem) => setHistorico((h) => registar(h, passo));

  const aplicarPasso = async (passo: PassoDaMontagem, sentido: 'desfazer' | 'refazer') => {
    const voltando = sentido === 'desfazer';
    switch (passo.tipo) {
      case 'mover':
        // A escrita adiada do arrasto ia gravar a posição NOVA; cancelá-la é seguro, porque o
        // valor que ela levava é exatamente o que esta linha está a substituir.
        esquecerClipe(passo.clipeId);
        await catalogo.updateClip(passo.clipeId, {
          start_seconds: voltando ? passo.de : passo.para,
          // A pista só entra quando o arrasto trocou de faixa: sem isto, desfazer punha o clipe
          // no segundo certo da faixa errada — onde ele nunca esteve.
          ...(passo.dePista && passo.paraPista
            ? { track_id: voltando ? passo.dePista : passo.paraPista }
            : {}),
        });
        break;
      case 'apagarClipe':
        await (voltando ? catalogo.restaurarClipe : catalogo.marcarClipeApagado)(passo.clipeId);
        break;
      // ⚠️ ESTES DOIS NÃO EXISTIAM AQUI, e a seta mentia: apagar uma faixa era anotado e o
      // desfazer não fazia nada — o botão acendia, dizia "Desfazer: apagar a faixa" e o clique
      // não devolvia coisa nenhuma. Criar uma faixa vazia passou a ser anotado também, e
      // precisa do mesmo caminho de volta.
      case 'apagarPista':
        await (voltando ? catalogo.restaurarPista : catalogo.marcarPistaApagada)(passo.pistaId);
        break;
      case 'acrescentarPistas':
        await Promise.all(passo.pistaIds.map(
          (id) => (voltando ? catalogo.marcarPistaApagada : catalogo.restaurarPista)(id),
        ));
        break;
      case 'cortar':
        await catalogo.updateClip(passo.clipeId, {
          duration_seconds: voltando ? passo.duracaoAntes : passo.duracaoDepois,
        });
        await (voltando ? catalogo.marcarClipeApagado : catalogo.restaurarClipe)(passo.novoClipeId);
        break;
      default:
        break;
    }
  };

  /** ⚠️ Uma seta de cada vez: dois toques seguidos partem de estados que se atropelam. */
  const andarNoTempo = async (sentido: 'desfazer' | 'refazer') => {
    sujo.current = true;
    if (andandoNoTempo) return;
    const saida = sentido === 'desfazer' ? desfazerPasso(historico) : refazerPasso(historico);
    if (!saida) return;
    setAndandoNoTempo(true);
    setSelo('salvando');
    try {
      await aplicarPasso(saida.passo, sentido);
      setHistorico(saida.historico);
      await buscar();
      setSelo('salvo');
    } catch {
      // A pilha não anda se a escrita falhou: movê-la aqui deixaria o histórico a mentir.
      setSelo('erro');
    } finally {
      setAndandoNoTempo(false);
    }
  };

  /**
   * Tira o clipe da faixa onde está e põe-no noutra, sem ir ao banco.
   *
   * ⚠️ UMA MUDANÇA E NÃO DUAS: tirar e pôr na mesma passagem. Em dois `setProjeto`, o render do
   * meio via uma montagem sem o clipe em lado nenhum — e a mesa, que carrega o que vê,
   * descartava o buffer e voltava a descodificá-lo a cada linha que o dedo atravessasse.
   */
  const moverClipeDePista = (clipeId: string, pistaId: string) => setProjeto((atual) => (
    atual ? {
      ...atual,
      versions: (atual.versions ?? []).map((v) => {
        const clipe = (v.tracks ?? []).flatMap((t) => t.clips ?? [])
          .find((c) => c.id === clipeId);
        if (!clipe || clipe.track_id === pistaId) return v;
        return {
          ...v,
          tracks: (v.tracks ?? []).map((t) => ({
            ...t,
            clips: t.id === pistaId
              ? [...(t.clips ?? []).filter((c) => c.id !== clipeId), { ...clipe, track_id: pistaId }]
              : (t.clips ?? []).filter((c) => c.id !== clipeId),
          })),
        };
      }),
    } : atual
  ));

  /**
   * `de` só vem quando a mão largou: durante o arrasto isto é chamado a cada pixel.
   *
   * `pista` chega quando o dedo saiu da faixa onde o arrasto começou — `para` durante o gesto,
   * que é o que faz o clipe seguir a mão de linha em linha, e `de` também no fim, para a seta
   * saber de onde ele veio.
   */
  const moverClipe = (
    clipeId: string, inicio: number, de?: number, pista?: { para: string; de?: string },
  ) => {
    sujo.current = true;
    patcharClipe(clipeId, { start_seconds: inicio });
    if (pista) moverClipeDePista(clipeId, pista.para);
    if (de !== undefined) {
      anotar({
        tipo: 'mover', clipeId, de, para: inicio,
        ...(pista?.de ? { dePista: pista.de, paraPista: pista.para } : {}),
      });
    }
    clearTimeout(relogiosDoClipe.current[clipeId]);
    relogiosDoClipe.current[clipeId] = setTimeout(() => {
      catalogo.updateClip(clipeId, {
        start_seconds: inicio,
        ...(pista ? { track_id: pista.para } : {}),
      }).catch(() => setSelo('erro'));
    }, ESPERA);
  };

  const cortarClipe = async (clipeId: string, emSegundo: number) => {
    sujo.current = true;
    const faixa = (aberta?.tracks ?? []).find((t) => (t.clips ?? []).some((c) => c.id === clipeId));
    const clipe = (faixa?.clips ?? []).find((c) => c.id === clipeId);
    if (!faixa || !clipe) return;

    const inicio = Number(clipe.start_seconds) || 0;
    const duracao = Number(clipe.duration_seconds) || 0;
    const recorte = Number(clipe.offset_seconds) || 0;
    const dentro = emSegundo - inicio;
    if (dentro <= 0.05 || dentro >= duracao - 0.05) return;

    setSelo('salvando');
    try {
      await catalogo.updateClip(clipeId, { duration_seconds: dentro });
      const nascido = await catalogo.createClip({
        track_id: faixa.id,
        file_id: clipe.file_id,
        start_seconds: emSegundo,
        offset_seconds: recorte + dentro,
        duration_seconds: duracao - dentro,
      });
      anotar({
        tipo: 'cortar', clipeId, duracaoAntes: duracao, duracaoDepois: dentro,
        novoClipeId: nascido.id,
      });
      await buscar();
      setSelo('salvo');
    } catch { setSelo('erro'); }
  };

  const apagarClipe = async (clipeId: string) => {
    sujo.current = true;
    esquecerClipe(clipeId);
    setSelo('salvando');
    try {
      await catalogo.marcarClipeApagado(clipeId);
      anotar({ tipo: 'apagarClipe', clipeId });
      await buscar();
      setSelo('salvo');
    } catch { setSelo('erro'); }
  };

  // ─── As faixas ────────────────────────────────────────────────────────────

  /** Renomear escreve na hora e grava depois: o campo é de texto, e cada letra é um render. */
  const relogiosDoNome = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const renomearPista = (id: string, nome: string) => {
    patcharPista(id, { name: nome });
    clearTimeout(relogiosDoNome.current[id]);
    relogiosDoNome.current[id] = setTimeout(() => {
      setSelo('salvando');
      catalogo.updateTrack(id, { name: nome })
        .then(() => setSelo('salvo'))
        .catch(() => setSelo('erro'));
    }, ESPERA);
  };

  /**
   * Apagar a faixa inteira — marcada, como o clipe, para o desfazer a poder devolver.
   *
   * ⚠️ NUNCA A MIX: ela é o áudio da própria gravação, e apagá-la é apagar a gravação.
   */
  const apagarPista = async (id: string) => {
    if (ehPistaDaMix(id)) return;
    sujo.current = true;
    setSelo('salvando');
    try {
      await catalogo.marcarPistaApagada(id);
      anotar({ tipo: 'apagarPista', pistaId: id });
      await buscar();
      setSelo('salvo');
    } catch { setSelo('erro'); }
  };

  /**
   * Escolher áudio do aparelho: para uma faixa que já existe, ou para faixas novas.
   *
   * É este o equivalente honesto da BIBLIOTECA da web. Lá ela é uma gaveta com os ficheiros que
   * já estão no balde, e arrasta-se de lá para a linha do tempo; num telemóvel não há arrasto de
   * ficheiro entre aplicações, e o que existe é o seletor do sistema. Mesmo gesto, mesmo
   * destino: o ficheiro entra na montagem.
   */
  const [envio, setEnvio] = useState<{ feitos: number; total: number } | null>(null);

  /**
   * A gaveta da biblioteca e os ficheiros que estão nela.
   *
   * ⚠️ ELES NÃO SUBIRAM AINDA. Ficam do lado de cá, escolhidos mas parados, e só sobem quando
   * alguém os manda para a montagem — é o desenho da web, e a razão é de conta: escolher doze
   * stems e ver os doze subirem paga armazenamento e egress por tudo o que entrou, inclusive o
   * que a pessoa nem ia usar.
   */
  const [bibliotecaAberta, setBibliotecaAberta] = useState(false);
  const [naBiblioteca, setNaBiblioteca] = useState<ArquivoEscolhido[]>([]);

  const escolherParaABiblioteca = async () => {
    const escolhidos = await escolherAudios();
    if (escolhidos.length) setNaBiblioteca(escolhidos);
  };

  /**
   * Sobe os ficheiros e põe-nos na montagem.
   *
   * Com `pistaId`, cada um vira mais um CLIPE naquela faixa — é assim que se junta um take novo
   * à mesma faixa em vez de encher a montagem de faixas de uma linha só. Sem ele, cada ficheiro
   * vira uma faixa.
   */
  const enviarArquivos = async (escolhidos: ArquivoEscolhido[], pistaId?: string) => {
    if (!aberta || !projeto || !podeEditar || !escolhidos.length) return;

    // A triagem é a da web, com as mesmas três razões para recusar. O aviso é um só: uma caixa
    // por ficheiro recusado seria uma fila de caixas para fechar.
    const recusados: string[] = [];
    const aceites: ArquivoEscolhido[] = [];
    for (const arquivo of escolhidos) {
      if (!tipoDoCatalogo(arquivo.nome)) { recusados.push(`${arquivo.nome}: use MP3 ou WAV`); continue; }
      if ((arquivo.tamanho ?? 0) > LIMITE_DA_PISTA_BYTES) {
        recusados.push(`${arquivo.nome}: maior que ${Math.round(LIMITE_DA_PISTA_BYTES / 1024 / 1024)} MB`);
        continue;
      }
      if (pistas.length + aceites.length >= MAXIMO_DE_PISTAS) {
        recusados.push(`${arquivo.nome}: o limite é ${MAXIMO_DE_PISTAS} faixas`);
        continue;
      }
      aceites.push(arquivo);
    }
    if (recusados.length) Alert.alert('Alguns arquivos ficaram de fora', recusados.join('\n'));
    if (!aceites.length) return;

    // ⚠️ A GAVETA FECHA AO ENVIAR, e isto não é enfeite: ela cobre a tela toda, por cima da
    // montagem E do selo de progresso. Quem enviava ficava a olhar para a mesma lista de
    // ficheiros, sem sinal de que algo estava a acontecer, e só descobria o resultado ao fechar
    // à mão. Fechada, aparece o que interessa: as faixas a nascer e o "Enviando 2 de 4…".
    sujo.current = true;
    setBibliotecaAberta(false);
    setSelo('salvando');
    setEnvio({ feitos: 0, total: aceites.length });
    // ⚠️ CONTAR O QUE ENTROU DE FACTO: um ficheiro pode passar na triagem e mesmo assim não
    // chegar ao fim (sem duração legível). Sem esta conta, o selo dizia "Salvo" depois de não
    // salvar nada.
    let entraram = 0;
    const nascidas: string[] = [];
    try {
      for (let i = 0; i < aceites.length; i += 1) {
        setEnvio({ feitos: i, total: aceites.length });
        const arquivo = aceites[i];
        // A duração vem dos metadados, ANTES de subir: é o tamanho do clipe que vai nascer, e
        // sem ela a tela teria de descodificar 40 MB só para desenhar um retângulo.
        // eslint-disable-next-line no-await-in-loop
        const duracao = await segundosDoAudio(arquivo.uri);
        if (!duracao) continue;

        // eslint-disable-next-line no-await-in-loop
        const enviado = await enviarParaOCatalogo(
          `${artistaId}/${projeto.id}/versions/${aberta.id}/stems`, arquivo,
        );
        // eslint-disable-next-line no-await-in-loop
        const linha = await catalogo.addVersionFile({
          version_id: aberta.id,
          name: tituloDoArquivo(arquivo.nome),
          file_url: enviado.url,
          file_type: arquivo.tipo || null,
          kind: 'stem',
          position: pistas.length + i,
          size_bytes: arquivo.tamanho ?? null,
          duration_seconds: duracao,
        });

        if (pistaId) {
          // eslint-disable-next-line no-await-in-loop
          await catalogo.createClip({
            track_id: pistaId,
            file_id: linha.id,
            start_seconds: 0,
            offset_seconds: 0,
            duration_seconds: duracao,
          });
        } else {
          // eslint-disable-next-line no-await-in-loop
          const nascida = await catalogo.criarPistaComArquivo({
            versionId: aberta.id,
            arquivo: linha,
            nome: tituloDoArquivo(arquivo.nome),
            position: pistas.length + i,
            colorIndex: (pistas.length + i) % 6,
            duracao,
          });
          nascidas.push(nascida.id);
        }
        entraram += 1;
      }

      // Um passo só para o lote inteiro: quem escolhe quatro ficheiros de uma vez fez UM gesto,
      // e desfazê-lo é tirar os quatro — não carregar na seta quatro vezes.
      if (nascidas.length) anotar({ tipo: 'acrescentarPistas', pistaIds: nascidas });
      if (!entraram) { setSelo('erro'); return; }

      // Só o que entrou sai da biblioteca: o que foi recusado continua lá, para a pessoa ver
      // o que ficou por enviar.
      setNaBiblioteca((atuais) => atuais.filter((a) => !aceites.includes(a)));
      await buscar();
      setSelo('salvo');
    } catch {
      setSelo('erro');
    } finally {
      setEnvio(null);
    }
  };

  /**
   * O "+ Adicionar faixa" da coluna: uma faixa VAZIA, sem áudio nenhum.
   *
   * ⚠️ ELE PEDIA UM FICHEIRO, e era essa a coisa errada. Não havia como preparar a montagem —
   * voz, guitarra, bateria — antes de ter o áudio de cada uma, e quem só queria mais uma linha
   * para largar um clipe tinha de arranjar um ficheiro primeiro. Encher a faixa é o outro
   * botão, o de enviar, que vive na própria faixa.
   */
  const adicionarFaixa = async () => {
    if (!aberta || !podeEditar) return;
    if (pistas.length >= MAXIMO_DE_PISTAS) {
      Alert.alert('Faixas a mais', `Uma gravação leva no máximo ${MAXIMO_DE_PISTAS} faixas.`);
      return;
    }
    sujo.current = true;
    setSelo('salvando');
    try {
      // ⚠️ A MIX PRIMEIRO, se a gravação nunca foi montada. Ela só existe enquanto não há
      // pistas nenhumas — e a primeira faixa criada à mão fá-la-ia sair de cena, levando o
      // áudio da gravação com ela.
      if (porMontar) await montarAMix();
      const nascida = await catalogo.createTrack({
        version_id: aberta.id,
        name: nomeDaPistaNova(pistas.map((p) => p.nome)),
        position: proximaPosicaoDaPista((aberta.tracks ?? []).map((t) => t.position)),
        gain: 1,
        muted: false,
        color_index: pistas.length % 6,
      });
      anotar({ tipo: 'acrescentarPistas', pistaIds: [nascida.id] });
      await buscar();
      setSelo('salvo');
    } catch { setSelo('erro'); }
  };

  /** O botão de enviar da FAIXA: um ficheiro só, direto para ela. */
  const enviarPara = async (pistaId: string) => {
    if (!podeEditar) return;
    const escolhido = await escolherAudio();
    if (escolhido) await enviarArquivos([escolhido], pistaId);
  };

  /**
   * Transforma esta gravação numa FAIXA — a primeira, com o áudio que ela já tem.
   *
   * Sem isto, uma gravação que nunca foi montada só tem a Mix sintetizada, que não se arrasta
   * nem se corta: a linha do tempo mostrava a música e não deixava mexer em nada, sem dizer
   * porquê.
   */
  const montarAMix = async () => {
    if (!aberta?.audio_file || !podeEditar) return;
    const duracao = mesa.estado.duracao;
    if (!duracao) { Alert.alert('Ainda não', 'Espere o áudio carregar para montar.'); return; }

    sujo.current = true;
    setBibliotecaAberta(false);
    setSelo('salvando');
      // ⚠️ O NOME SAI DO FICHEIRO, e não do título da música. A primeira pista de uma gravação
      // por montar é o áudio que alguém anexou, e chamar-lhe "Test" porque a música se chama
      // Test é dizer duas vezes a mesma coisa e nenhuma vez o que ali está. O título fica como
      // recurso, para o caso raro de uma gravação com áudio e sem nome de ficheiro.
    const nomeDoAnexo = tituloDoArquivo(aberta.audio_file_name || '') || aberta.title || 'Mix';
    try {
      const linha = await catalogo.addVersionFile({
        version_id: aberta.id,
        name: nomeDoAnexo,
        file_url: aberta.audio_file,
        file_type: null,
        kind: 'stem',
        position: 0,
        duration_seconds: duracao,
      });
      await catalogo.criarPistaComArquivo({
        versionId: aberta.id,
        arquivo: linha,
        nome: nomeDoAnexo,
        position: 0,
        colorIndex: 0,
        duracao,
      });
      await buscar();
      setSelo('salvo');
    } catch { setSelo('erro'); }
  };

  /** A gravação ainda não tem faixas de verdade: o que se vê é a Mix sintetizada. */
  const porMontar = pistas.length === 1 && ehPistaDaMix(pistas[0].id);

  // ─── O andamento, ouvido sozinho ──────────────────────────────────────────
  //
  // O detector de BPM existe desde sempre e vivia escondido na ficha, atrás de um botão que era
  // preciso descobrir. Aqui ele acontece por conta própria na gravação aberta — porque o
  // andamento é o que faz a régua contar COMPASSOS, e pedir a alguém que digite um número que a
  // máquina consegue ouvir é trabalho que não devia existir.
  //
  // As regras de QUANDO (uma vez por gravação, só com o campo vazio, só para quem edita) vivem
  // no núcleo, em `podeOuvirSozinho`: elas guardam cota e guardam trabalho de gente.
  const analiseDoJam = useAnaliseDaVersao(abertaId ?? undefined);
  /**
   * Estamos à espera de um andamento que ainda vai chegar?
   *
   * ⚠️ É ELE QUE IMPEDE O CAMPO DE SE ENCHER SOZINHO OUTRA VEZ. Sem esta memória, quem apagou o
   * BPM de propósito reencontrava-o preenchido na abertura seguinte — a análise antiga continua
   * no banco, e "campo vazio + análise existe" descreve tanto o primeiro envio como o gesto
   * deliberado de o esvaziar.
   */
  const esperandoOAndamento = useRef(false);
  const ouviuNestaVersao = useRef<string | null>(null);
  const [ouvido, setOuvido] = useState<number | null>(null);

  useEffect(() => {
    if (!abertaId || analiseDoJam.carregando) return;
    if (ouviuNestaVersao.current === abertaId) return;
    ouviuNestaVersao.current = abertaId;
    // Já havia um a correr quando esta tela abriu: não se pede outro, mas espera-se por ele.
    if (analiseDoJam.emCurso('bpm_tom')) { esperandoOAndamento.current = true; return; }
    if (!podeOuvirSozinho({
      temAudio: Boolean(aberta?.audio_file),
      bpmEscrito: aberta?.bpm,
      analise: analiseDoJam.analise,
      trabalhos: analiseDoJam.trabalhos,
      podeEditar,
    })) return;
    esperandoOAndamento.current = true;
    void analiseDoJam.pedir('bpm_tom');
  }, [abertaId, aberta?.audio_file, aberta?.bpm, podeEditar, analiseDoJam]);

  useEffect(() => {
    if (!esperandoOAndamento.current || !abertaId) return;
    const detectado = bpmLegivel(analiseDoJam.analise?.bpm);
    if (!detectado) return;
    esperandoOAndamento.current = false;
    // ⚠️ E MESMO ASSIM, SÓ SE AINDA ESTIVER VAZIO. A análise demora minutos, e nesses minutos a
    // pessoa pode ter escrito o andamento à mão — que é a resposta certa por definição, porque
    // o andamento da obra é o que o autor diz que é.
    //
    // ⚠️ ESTA LINHA NÃO TEM TESTE NESTA SUÍTE, e é bom que se saiba: o duplo do detector entrega
    // a análise de uma vez, e não consegui fazê-la CHEGAR no meio de uma digitação — que é
    // exatamente o instante que esta guarda protege. Um teste que não exercita a linha passa
    // com ela e sem ela, e um desses é pior do que nenhum. A regra é a mesma da web, palavra
    // por palavra, e lá ela tem a cobertura que aqui falta.
    if (bpmLegivel(bpm)) return;
    setOuvido(Number(detectado));
    setBpm(detectado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analiseDoJam.analise, abertaId]);

  /**
   * O outro andamento possível, enquanto o que está no campo for o que a máquina ouviu.
   *
   * ⚠️ NÃO É "FALTA DE CONFIANÇA", é ambiguidade real: um trap a 140 e o mesmo trap contado em
   * meio-tempo a 70 têm exatamente as mesmas batidas, e a máquina escolhe uma delas com toda a
   * certeza do mundo. Por isso a troca aparece sempre que existe uma alternativa plausível, e
   * não só quando o número vem inseguro.
   */
  const alternativa = ouvido !== null && Number(bpmLegivel(bpm)) === ouvido
    ? outroAndamento(ouvido)
    : null;

  // ─── O transporte e o zoom ────────────────────────────────────────────────
  //
  // ⚠️ O ZOOM MORA AQUI, e não na linha do tempo: os botões dele vivem na barra do transporte,
  // que é irmã dela e não sua filha. É onde a web os põe.
  const [zoom, setZoom] = useState(1);
  const [zoomMinimo, setZoomMinimo] = useState(ZOOM_MINIMO);
  /** Quem mexeu no zoom manda: o encaixe automático não volta a mexer nele. */
  const zoomMexido = useRef(false);
  const mexerNoZoom = (novo: number) => { zoomMexido.current = true; setZoom(novo); };

  /**
   * A linha do tempo mediu-se e diz qual é o zoom que encaixa a música no ecrã.
   *
   * Afastar vai sempre ATÉ esse encaixe: sem isso, quem aproximasse uma vez não conseguia
   * voltar a ver a música inteira.
   */
  const encaixar = useCallback((minimo: number) => {
    setZoomMinimo(Math.min(ZOOM_MINIMO, minimo));
    if (!zoomMexido.current) setZoom(minimo);
  }, []);

  /**
   * As pistas armadas para gravar, e o REC do transporte.
   *
   * Duas armações, como em qualquer mesa: a pista diz ONDE grava, o transporte diz QUANDO. Uma
   * sozinha não faz nada, e é por isso que são dois botões e não um.
   *
   * ⚠️ GRAVAR AINDA NÃO EXISTE, e os botões dizem isso em vez de fingir.
   */
  /**
   * O nome da música, em edição.
   *
   * Fecha ao sair do campo e ao confirmar. Nome vazio não grava: o título é o que identifica a
   * música no catálogo inteiro, e uma música sem nome some da lista de quem a procura.
   */
  const [renomeando, setRenomeando] = useState(false);
  const [rascunhoDoNome, setRascunhoDoNome] = useState('');

  const fecharONome = () => {
    setRenomeando(false);
    const nome = rascunhoDoNome.trim();
    if (!projeto || !nome || nome === projeto.title) return;
    patcharProjeto({ title: nome });
    setSelo('salvando');
    catalogo.updateCatalogProject(projeto.id, { title: nome })
      .then(() => setSelo('salvo'))
      .catch(() => setSelo('erro'));
  };

  const [armado, setArmado] = useState(false);
  const [armadas, setArmadas] = useState<string[]>([]);
  const alternarArmada = (id: string) => setArmadas((atuais) => (
    atuais.includes(id) ? atuais.filter((a) => a !== id) : [...atuais, id]
  ));
  /**
   * ⚠️ COM TUDO ARMADO, O PLAY TERIA DE GRAVAR — e não grava, porque a gravação ainda não
   * existe. Deixar a montagem simplesmente TOCAR aqui seria o pior desfecho possível: a pessoa
   * armou a faixa, armou o transporte, carregou no play, ouviu tudo andar, e só ia descobrir
   * que não gravou nada ao procurar o take. O aviso custa um toque; o take perdido custa a
   * sessão.
   */
  const tocarOuAvisar = () => {
    if (armado && armadas.length && !mesa.estado.tocando) {
      Alert.alert(
        'A gravação ainda não está disponível',
        'Por agora, envie o áudio pelo botão da faixa.',
      );
      return;
    }
    mesa.alternar();
  };

  const armarOTransporte = () => {
    // Armar o transporte sem dizer em que pista é meia intenção: numa mesa, o REC global só
    // sabe o que fazer se alguma pista estiver armada.
    if (!armado && !armadas.length) {
      Alert.alert('Arme a faixa primeiro', 'Toque no círculo vermelho da faixa onde quer gravar.');
      return;
    }
    setArmado((v) => !v);
  };

  // ─── A mesa ───────────────────────────────────────────────────────────────

  // O fader mexe no som na hora e no banco depois: gravar a cada pixel do arrasto seriam
  // dezenas de escritas para um gesto só. Um relógio por pista — arrastar duas seguidas não
  // pode fazer a segunda cancelar a gravação da primeira.
  const relogiosDoGanho = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const relogiosDoPan = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => () => {
    Object.values(relogiosDoGanho.current).forEach(clearTimeout);
    Object.values(relogiosDoPan.current).forEach(clearTimeout);
  }, []);

  /** Já avisei nesta abertura de tela? O aviso ensina uma vez; repetido, vira obstáculo. */
  const avisouDaMix = useRef(false);

  /**
   * Mutar e desmutar uma pista — com um aviso, e só um, ao acender a Mix.
   *
   * ⚠️ A Mix já é a SOMA dos stems. Acesa junto com eles, cada instrumento soa duas vezes: uma
   * pela camada e outra pela mistura, com o desfasamento do processamento que a mix levou e as
   * camadas não. Não é um bug que se possa evitar por dentro — é o que a pessoa pediu —, mas é
   * quase sempre engano, e ouvir sem entender por que "está estranho" é pior do que ler uma
   * frase.
   */
  const mexerNoMudo = (id: string, muda: boolean) => {
    sujo.current = true;
    mesa.mudar(id, muda);
    const acendendoAMix = !muda && ehPistaDaMix(id);
    const haCamadasNoAr = mesa.estado.pistas.some((p) => !ehPistaDaMix(p.id) && !p.muda);
    if (acendendoAMix && haCamadasNoAr && !avisouDaMix.current) {
      avisouDaMix.current = true;
      Alert.alert(
        'A mix e as faixas juntas',
        'A mix já é a soma das faixas. Com as duas acesas você ouve cada instrumento duas vezes, '
        + 'e o volume dobra. Para comparar, use o S da mix.',
      );
    }
  };

  /**
   * O panorama de uma pista — onde ela fica entre os dois alto-falantes.
   *
   * Grava como o ganho: o som muda AGORA, o banco recebe depois. Ele não existia no app; existia
   * na mesa do núcleo e na web, e era a única coisa de um canal que aqui não se podia mexer.
   */
  /**
   * A letra — da GRAVAÇÃO aberta, e não da música.
   *
   * ⚠️ A MESMA COLUNA QUE A FICHA GRAVA. Por isso o remendo local acontece aqui e a escrita vai
   * para a versão: dois donos da mesma coluna, cada um com o seu relógio, acabariam por gravar
   * um por cima do outro — quem parasse de escrever por último ganhava.
   */
  const relogioDaLetra = useRef<ReturnType<typeof setTimeout> | null>(null);

  const escreverLetra = (texto: string) => {
    if (!aberta) return;
    patcharVersao(aberta.id, { lyrics: texto });
    if (relogioDaLetra.current) clearTimeout(relogioDaLetra.current);
    relogioDaLetra.current = setTimeout(() => {
      setSelo('salvando');
      catalogo.updateCatalogVersion(aberta.id, { lyrics: texto })
        .then(() => setSelo('salvo'))
        .catch(() => setSelo('erro'));
    }, ESPERA);
  };

  const mexerNoPan = (id: string, valor: number) => {
    sujo.current = true;
    mesa.panoramar(id, valor);
    // A Mix não tem linha no banco: ela é o `audio_file` da gravação, e o panorama dela é só
    // desta sessão de escuta.
    if (ehPistaDaMix(id)) return;
    clearTimeout(relogiosDoPan.current[id]);
    relogiosDoPan.current[id] = setTimeout(() => {
      const arredondado = Number(valor.toFixed(3));
      catalogo.updateTrack(id, { pan: arredondado })
        .then(() => patcharPista(id, { pan: arredondado }))
        .catch(() => { /* o valor real volta no próximo carregamento */ });
    }, ESPERA);
  };

  const mexerNoGanho = (id: string, valor: number) => {
    sujo.current = true;
    mesa.ganho(id, valor);
    // A Mix não tem linha no banco: ela é o `audio_file` da gravação, e o volume dela é só
    // desta sessão de escuta.
    if (ehPistaDaMix(id)) return;
    clearTimeout(relogiosDoGanho.current[id]);
    relogiosDoGanho.current[id] = setTimeout(() => {
      const arredondado = Number(valor.toFixed(3));
      catalogo.updateTrack(id, { gain: arredondado })
        .then(() => patcharPista(id, { gain: arredondado }))
        .catch(() => { /* o valor real volta no próximo carregamento */ });
    }, ESPERA);
  };

  // ─── Gravações ────────────────────────────────────────────────────────────

  // O botão de enviar abre direto os arquivos: escolher o áudio é o que a pessoa veio fazer. A
  // folha só aparece depois, já com o título tirado do nome do arquivo.
  const subir = async () => {
    const escolhido = await escolherAudio();
    if (!escolhido) return;
    setEmEdicao(null);
    setArquivoInicial(escolhido);
    setFolhaAberta(true);
  };

  // Excluir a principal deixaria a música muda no catálogo (o banco zera o ponteiro). Promove a
  // mais recente que sobrou.
  const aoExcluirVersao = async () => {
    if (!projeto) return;
    try {
      const proximo = await catalogo.getCatalogProject(projeto.id);
      const restantes = (proximo.versions ?? []).slice().sort((a, b) => b.version_number - a.version_number);
      if (!proximo.primary_version_id && restantes.length) {
        await catalogo.setPrimaryVersion(proximo.id, restantes[0].id);
      }
    } catch { /* o refresh abaixo mostra o estado real de qualquer jeito */ }
    await buscar();
  };

  // ─── A limpeza ────────────────────────────────────────────────────────────
  //
  // ⚠️ NA ABERTURA, SÓ O QUE ESTÁ MARCADO HÁ MUITO. O mesmo projeto pode estar aberto na web ao
  // mesmo tempo, e sem essa folga esta tela apagaria de vez o que a outra ainda pode desfazer —
  // a seta de lá passaria a mentir. Uma hora separa "outra sessão viva" de "sessão que morreu".
  const UMA_HORA = 3600_000;
  const varreuNaAbertura = useRef<string | null>(null);

  useEffect(() => {
    if (!abertaId || varreuNaAbertura.current === abertaId) return;
    varreuNaAbertura.current = abertaId;
    void catalogo.purgarMontagem(abertaId, {
      antesDe: new Date(Date.now() - UMA_HORA).toISOString(),
    }).catch(() => undefined);
  }, [abertaId]);

  /**
   * Fechar o editor: a guia é feita ANTES de a tela sair, e a tela diz que está a fazê-la.
   *
   * ⚠️ ELA JÁ FICOU A CORRER SOZINHA, e o argumento era de peso: foram medidos 101 segundos
   * para 227 de áudio num iPhone 17 Pro, e prender alguém por um minuto e meio num ecrã que
   * pediu para fechar é um mau negócio. Só que a alternativa era pior, e isso só se vê com o
   * aparelho na mão: a tela saía no mesmo instante, sem sinal nenhum, e o trabalho passava a
   * depender de o aplicativo continuar aberto — quem fechasse voltava a uma lista que toca o
   * áudio ANTERIOR, sem nada a explicar porquê. Uma promessa invisível é uma promessa que
   * ninguém sabe que está a quebrar.
   *
   * Com a espera à vista — e com a percentagem a andar, que é o que a distingue de uma tela
   * pendurada — a pessoa sabe o que está a acontecer e porque é que ainda não saiu. É o que a
   * web faz, e é a mesma promessa nos dois sítios.
   *
   * Falhar não prende: o `catch` do `gerarAGuia` engole, e a saída continua.
   */
  const voltar = async () => {
    await gerarAGuia();

    // ⚠️ A SESSÃO FECHA E O QUE FOI APAGADO SAI DE VERDADE, do banco e do balde. É o outro lado
    // do desfazer: enquanto a tela está aberta a linha fica marcada para poder voltar; fechada,
    // não há mais quem a chame de volta, e guardá-la seria só resíduo a acumular.
    //
    // Sem esperar: prender a saída da tela numa ida ao servidor é o pior momento para o fazer, e
    // a limpeza da próxima abertura apanha o que sobrar.
    if (abertaId) void catalogo.purgarMontagem(abertaId).catch(() => undefined);
    if (router.canGoBack()) router.back();
    else router.replace(`/artista/${artistaId}/catalogo`);
  };

  if (carregando) {
    return (
      <LinearGradient colors={[COR_EDITOR.fundoDe, COR_EDITOR.fundoAte]} style={estilos.espera}>
        <ActivityIndicator color={COR.primaria} />
      </LinearGradient>
    );
  }

  if (!projeto) {
    return (
      <LinearGradient colors={[COR_EDITOR.fundoDe, COR_EDITOR.fundoAte]} style={estilos.espera}>
        <Text style={estilos.vazioTexto}>Espaço JAM não encontrado.</Text>
        <Pressable onPress={() => { void voltar(); }} accessibilityRole="button" accessibilityLabel="Voltar para Músicas">
          <Text style={estilos.voltarTexto}>Voltar para Músicas</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  /** As abas que mostram a montagem. As outras duas não se tocam nem se arrastam. */
  const ehDeAudio = aba === 'linha' || aba === 'mesa';
  const prontas = mesa.estado.pistas.filter((p) => p.carga === 'pronta').length;

  return (
    <View style={[estilos.tela, { paddingTop: margem.top }]}>
      {/* O relógio e a bateria são pretos no resto do app, que é claro. Aqui o fundo é quase
          preto: sem esta linha, a barra do sistema some por cima da tela. */}
      {/* eslint-disable-next-line react/style-prop-object -- o `style` da barra do sistema é
          'light' ou 'dark', e não uma folha de estilo. */}
      <StatusBar style="light" />

      {/* ══════════ FILA DO TÍTULO ══════════
          O nome da música à esquerda, as quatro vistas e a saída à direita — a mesma fila da
          web. ⚠️ O TÍTULO TEM DE PODER ENCOLHER (`flex` + `numberOfLines`): sem isso um nome
          comprido empurra as abas e o X para fora do ecrã, que é como o editor ficava
          intocável no telemóvel. */}
      <View style={estilos.filaDoTitulo}>
        {/* ⚠️ O NOME DA MÚSICA RENOMEIA-SE AQUI, como na web: tocar nele abre o campo. Renomear
            era o único caminho que passava obrigatoriamente pela Ficha — e o nome está à vista,
            no topo, que é onde a mão vai. */}
        <View style={estilos.ladoDoTitulo}>
          {renomeando ? (
            <TextInput
              style={[estilos.nomeDaMusica, estilos.nomeEmEdicao]}
              value={rascunhoDoNome}
              onChangeText={setRascunhoDoNome}
              onBlur={fecharONome}
              onSubmitEditing={fecharONome}
              autoFocus
              returnKeyType="done"
              accessibilityLabel="Nome da música"
            />
          ) : (
            <Pressable
              onPress={() => { if (podeEditar) { setRascunhoDoNome(projeto.title); setRenomeando(true); } }}
              accessibilityRole={podeEditar ? 'button' : 'header'}
              accessibilityLabel={podeEditar ? `${projeto.title}. Toque para renomear.` : projeto.title}
            >
              <Text style={estilos.nomeDaMusica} numberOfLines={1}>{projeto.title}</Text>
            </Pressable>
          )}
        </View>

        {/* AS QUATRO VISTAS DA MESMA MÚSICA — é a primeira escolha de quem entra (estou a
            montar, a misturar, a preencher a ficha, ou a levar isto embora?) e ela decide o que
            a tela inteira mostra.

            ⚠️ SÓ O ÍCONE, sem rótulo: os quatro nomes somam mais de 300 pt, e o que eles
            empurravam para fora era a saída. O nome continua no leitor de tela. É o mesmo corte
            que a web faz abaixo de 760 px. */}
        <View style={estilos.abas}>
          {ABAS.map(({ chave, rotulo, icone: Icone }) => {
            const acesa = aba === chave;
            return (
              <Pressable
                key={chave}
                onPress={() => setAba(chave)}
                style={[estilos.aba, acesa && estilos.abaAcesa]}
                hitSlop={{ top: 8, bottom: 8 }}
                accessibilityRole="tab"
                accessibilityState={{ selected: acesa }}
                accessibilityLabel={rotulo}
              >
                <Icone tamanho={16} cor={acesa ? COR_EDITOR.titulo : COR_EDITOR.apoio} />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[estilos.redondo, gerando != null && estilos.inerte]}
          onPress={() => { void voltar(); }}
          disabled={gerando != null}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityState={{ disabled: gerando != null, busy: gerando != null }}
          accessibilityLabel={gerando != null ? rotuloDaGuia(gerando) : 'Voltar para Músicas'}
        >
          <Feather name="x" size={14} color={COR_EDITOR.texto} />
        </Pressable>
      </View>

      {/* ══════════ CORPO ══════════ */}
      <View style={estilos.corpo}>
        {/* A biblioteca serve as abas de ÁUDIO. Na ficha e no exportar não há o que mandar para
            lugar nenhum — e uma gaveta por cima de um formulário é só uma tela a tapar outra. */}
        {bibliotecaAberta && aba !== 'exportar' && aba !== 'ficha' && !!aberta && (
          <Biblioteca
            itens={naBiblioteca}
            podeEditar={podeEditar}
            aoEscolher={() => { void escolherParaABiblioteca(); }}
            aoEnviar={(arquivo) => { void enviarArquivos([arquivo]); }}
            aoEnviarTodos={() => { void enviarArquivos(naBiblioteca); }}
            aoMontar={porMontar ? () => { void montarAMix(); } : undefined}
            aoFechar={() => setBibliotecaAberta(false)}
          />
        )}

        {aba === 'ficha' ? (
          // A ficha ocupa o lugar da montagem, e é ESCURA: são os MESMOS campos do formulário do
          // catálogo, tingidos pela paleta do editor. Um cartão branco no meio de um editor
          // escuro é uma janela de outro aplicativo, e obriga o olho a reajustar a cada troca de
          // aba. E um segundo formulário seriam duas verdades sobre a mesma música — por isso é
          // o mesmo componente, com outra paleta. Ver `casca/paleta.ts`.
          <PaletaDaFolhaProvider value={PALETA_ESCURA}>
            <FichaDaFaixa
              emLinha
              aberta
              artistaId={String(artistaId)}
              faixa={itemDaFicha}
              generos={projeto.genre ? [projeto.genre] : []}
              aoFechar={() => setAba('linha')}
              // ⚠️ NÃO RECARREGA A MONTAGEM a cada gravação automática. O que a ficha grava é a
              // MÚSICA (título, status, gênero, créditos), e um `buscar()` a cada meio segundo
              // de escrita derrubaria e recarregaria os buffers de áudio por baixo do teclado.
              //
              // ⚠️ MAS REMENDA TUDO O QUE FOI GRAVADO, e não só o título. A ficha recarrega o
              // rascunho quando a música que recebe muda de identidade — e remendar só o título
              // fazia exatamente isso com os OUTROS campos velhos: o gênero escolhido, o
              // responsável, os detalhes voltavam ao valor que o servidor tinha mandado na
              // abertura, enquanto o banco já guardava o novo. Gravado e visível deixavam de ser
              // a mesma coisa, e quem escreveu via a escolha desfazer-se sozinha.
              aoSalvar={(salva) => {
                patcharProjeto({
                  title: salva.title ?? projeto.title,
                  status: salva.status,
                  assignee: salva.assignee ?? null,
                  details: salva.details ?? null,
                  release_date: salva.release_date ?? null,
                  cover_image: salva.cover_image ?? null,
                  cover_image_name: salva.cover_image_name ?? null,
                });
                // Gênero, andamento, tom e letra são da GRAVAÇÃO — é de lá que a ficha os lê.
                if (salva.version_id) {
                  patcharVersao(salva.version_id, {
                    genre: salva.genre ?? null,
                    bpm: salva.bpm ?? null,
                    key: salva.key ?? null,
                    lyrics: salva.lyrics ?? null,
                  });
                }
              }}
              aoEstado={setSelo}
              // ⚠️ SEM GUIA: a música foi apagada, e fazer-lhe a mistura agora seria gastar um
              // minuto e meio a renderizar um áudio para uma gravação que já não existe — e a
              // escrevê-lo por cima de uma linha que o banco acabou de levar.
              aoExcluir={() => { sujo.current = false; void voltar(); }}
            />
          </PaletaDaFolhaProvider>
        ) : aba === 'exportar' ? (
          <ScrollView contentContainerStyle={estilos.folhaDaAba}>
            <TelaDeExportar
              pistas={pistas.map((pista) => ({ id: pista.id, nome: pista.nome }))}
              temStems={prontas > 0}
              temGuia={Boolean(aberta?.audio_file)}
              emCurso={exportandoEm}
              aoEnviarStems={() => { void enviarStems(); }}
              aoEnviarGuiaWav={() => { void enviarGuiaWav(); }}
              aoEnviarGuiaMp3={() => { void enviarGuiaMp3(); }}
            />
          </ScrollView>
        ) : (
          <>
            {/* Não se toca uma ficha, nem se exporta com o play na mão — o mesmo corte da web. */}
            <Transporte
              tocando={mesa.estado.tocando}
              posicao={mesa.estado.posicao}
              carregando={mesa.estado.carregando}
              prontas={prontas}
              emLoop={mesa.estado.emLoop}
              armado={armado}
              aoAlternar={tocarOuAvisar}
              aoVoltarAoInicio={() => mesa.irPara(0)}
              aoLoopar={mesa.loopar}
              aoArmar={armarOTransporte}
              zoom={aba === 'linha' ? {
                valor: zoom,
                afastar: () => mexerNoZoom(Math.max(zoomMinimo, zoom / 1.5)),
                aproximar: () => mexerNoZoom(Math.min(ZOOM_MAXIMO, zoom * 1.5)),
              } : undefined}
            />

            {/* O aviso de peso vem ANTES de descodificar, com a conta do tamanho dos ficheiros:
                depois de descodificar já não há o que avisar. Fica logo abaixo do transporte, e
                não dentro de uma das abas — ele é da GRAVAÇÃO, e vale nas duas. */}
            {pesado && (
              <Text style={estilos.avisoDePeso}>
                São muitas pistas grandes para um celular. Se o app fechar sozinho, deixe menos
                pistas nesta gravação.
              </Text>
            )}

            {versoes.length === 0 ? (
              <View style={estilos.semVersoes}>
                <Text style={estilos.semVersoesTitulo}>Este Espaço JAM ainda não tem áudio.</Text>
                <Text style={estilos.semVersoesApoio}>
                  Use a pasta, no rodapé, para enviar a primeira guia, beat ou mix.
                </Text>
              </View>
            ) : aba === 'linha' ? (
              <LinhaDoTempo
                pistas={pistas}
                estado={mesa.estado}
                picos={mesa.picos}
                duracaoDoClipe={mesa.duracaoDoClipe}
                bpm={bpm}
                podeEditar={podeEditar}
                zoom={zoom}
                aoEncaixar={encaixar}
                armadas={armadas}
                aoArmar={alternarArmada}
                aoRenomearPista={(id, nome) => renomearPista(id, nome)}
                aoApagarPista={(id) => { void apagarPista(id); }}
                aoMudarPista={(id, muda) => mexerNoMudo(id, muda)}
                aoSolarPista={(id, solo) => mesa.solar(id, solo)}
                aoEnviarPara={(id) => { void enviarPara(id); }}
                aoAdicionarFaixa={() => { void adicionarFaixa(); }}
                aoBuscar={mesa.irPara}
                aoMover={moverClipe}
                aoCortar={(id, seg) => { void cortarClipe(id, seg); }}
                aoApagar={(id) => { void apagarClipe(id); }}
              />
            ) : (
              <MesaDeCanais
                pistas={pistas}
                estado={mesa.estado}
                podeEditar={podeEditar}
                aoMudar={mexerNoMudo}
                aoSolar={(id, solo) => mesa.solar(id, solo)}
                aoGanho={mexerNoGanho}
                aoPanoramar={mexerNoPan}
              />
            )}
          </>
        )}
      </View>

      {/* ══════════ RODAPÉ ══════════
          O que vale para a MONTAGEM INTEIRA mora aqui, e não no cabeçalho: a porta da
          biblioteca, o andamento, o tom e o volume geral. O topo fica a ser só identidade e
          navegação. */}
      <View style={[estilos.rodape, { paddingBottom: margem.bottom }]}>
        {/* ⚠️ A PORTA DOS FICHEIROS MORA NO RODAPÉ, com o resto do que governa a tela inteira
            (o andamento, o tom, o volume geral). No transporte ela ficava entre o play e o loop
            — controlos do que está a SOAR —, e abrir uma pasta não é gesto de transporte. É
            onde a web a põe.

            Na web ela abre a BIBLIOTECA: uma gaveta com os ficheiros que já estão no balde, de
            onde se arrasta para a linha do tempo. Num telemóvel não há arrasto de ficheiro
            entre aplicações, e o que existe é o seletor do sistema — mesmo gesto, mesmo
            destino. Sem nenhuma gravação ainda, ele abre a folha que cria a primeira: senão o
            convite do ecrã vazio mandava para um beco. */}
        {podeEditar && (
          <Pressable
            onPress={() => (aberta ? setBibliotecaAberta((v) => !v) : void subir())}
            style={[estilos.botaoDoRodape, bibliotecaAberta && estilos.botaoAceso]}
            accessibilityRole="button"
            accessibilityState={{ selected: bibliotecaAberta }}
            accessibilityLabel={!aberta ? 'Enviar a primeira gravação'
              : bibliotecaAberta ? 'Fechar a biblioteca' : 'Abrir a biblioteca'}
          >
            <Feather
              name="folder"
              size={15}
              color={bibliotecaAberta ? COR_EDITOR.texto : COR_EDITOR.apoio}
            />
          </Pressable>
        )}

        {/* O andamento e o tom são DA GRAVAÇÃO aberta, e é o rodapé que diz isso. */}
        <CampoDoCabecalho
          valor={bpm}
          aoMudar={setBpm}
          sufixo="BPM"
          largura={48}
          numerico
          limite={3}
          travado={!aberta || !podeEditar}
          rotulo="Andamento da gravação, em BPM"
          ouvido={ouvido !== null && Number(bpmLegivel(bpm)) === ouvido}
        />

        {/* A troca de oitava. Um toque, e volta com outro: é um interruptor entre as duas
            leituras da mesma batida, não uma correção que se faz uma vez. */}
        {alternativa !== null && (
          <Pressable
            onPress={() => { setOuvido(alternativa); setBpm(String(alternativa)); }}
            style={estilos.outroAndamento}
            accessibilityRole="button"
            accessibilityLabel={`Trocar para ${alternativa} BPM: a mesma batida, contada em dobro ou em meio-tempo`}
          >
            <Text style={estilos.outroAndamentoTexto}>ou {alternativa}?</Text>
          </Pressable>
        )}
        <CampoDoCabecalho
          valor={tom}
          aoMudar={setTom}
          sufixo="Tom"
          largura={52}
          maiusculas
          limite={6}
          travado={!aberta || !podeEditar}
          rotulo="Tom da gravação"
        />

        <View style={estilos.flex} />

        {/* A palavra "Master" cede ao ícone: o altifalante diz a mesma coisa e ocupa 14 pt. */}
        <Feather name="volume-2" size={14} color={COR_EDITOR.rotulo} />
        {/* ⚠️ SEM O NÚMERO AO LADO. O que se ajusta num volume geral é o que se OUVE, e o
            fader já mostra onde está — a percentagem era um dado que ninguém lê e 38 pontos a
            menos para o único controlo desta barra. O leitor de tela continua a dizê-la. */}
        <View style={estilos.mestre}>
          <Fader valor={mesa.estado.mestre} aoMudar={mesa.mestreEm} rotulo="Volume geral" />
        </View>
      </View>

      {/* ── Os flutuantes, na coluna acima do rodapé ── */}

      {/* AS DUAS SETAS, por cima do "?".
          ⚠️ ELAS SAÍRAM DO TRANSPORTE, onde competiam com o play — o botão que se procura sem
          olhar — e empurravam o relógio num ecrã de 402 pontos.
          O desfazer fica EMBAIXO, mais perto da mão: é ele que se usa dez vezes por refazer. */}
      {/* ⚠️ OS FLUTUANTES SÃO DA MONTAGEM, e por isso só existem onde ela está. Na ficha e no
          exportar eles não teriam sobre o que agir — e as setas por cima do Salvar do
          formulário eram um alvo de dedo em cima do outro. */}
      {podeEditar && ehDeAudio && (
        <View style={[estilos.setas, { bottom: margem.bottom + ALTURA_DO_RODAPE + 12 + 38 }]}>
          {([
            ['refazer', 'corner-up-right', podeRefazer(historico), rotuloDaSeta('Refazer', historico.futuro[historico.futuro.length - 1])],
            ['desfazer', 'corner-up-left', podeDesfazer(historico), rotuloDaSeta('Desfazer', historico.passado[historico.passado.length - 1])],
          ] as const).map(([qual, icone, pode, rotulo]) => {
            const inerte = !pode || andandoNoTempo;
            return (
              <Pressable
                key={qual}
                onPress={() => { void andarNoTempo(qual); }}
                disabled={inerte}
                style={estilos.flutuante}
                accessibilityRole="button"
                // Uma seta muda não se usa: o rótulo diz o que ela vai desmanchar.
                accessibilityLabel={rotulo}
                accessibilityState={{ disabled: inerte }}
              >
                <Feather
                  name={icone}
                  size={15}
                  color={inerte ? COR_EDITOR.estrela : COR_EDITOR.acaoIcone}
                />
              </Pressable>
            );
          })}
        </View>
      )}

      {/* A LETRA e a AJUDA, na mesma fila dos outros flutuantes — como na web, que as põe em
          `right: 62` e `right: 18`. São balões, e não abas: escreve-se letra a olhar para a
          montagem, e uma aba faria trocar de tela para ler um verso. */}
      <BalaoFlutuante
        icone="file-text"
        rotulo="Letra"
        largura={300}
        bottom={margem.bottom + ALTURA_DO_RODAPE + 12}
        right={PASSO_DOS_FLUTUANTES + 18}
      >
        <TextInput
          style={estilos.letra}
          value={aberta?.lyrics ?? ''}
          onChangeText={escreverLetra}
          editable={podeEditar}
          multiline
          placeholder="Letra da música…"
          placeholderTextColor={COR_EDITOR.estrela}
          accessibilityLabel="Letra da música"
        />
      </BalaoFlutuante>

      <BalaoFlutuante
        icone="?"
        rotulo="Ajuda"
        largura={300}
        bottom={margem.bottom + ALTURA_DO_RODAPE + 12}
        right={18}
      >
        <Text style={estilos.ajudaTitulo}>Como se monta</Text>
        <Text style={estilos.ajuda}>
          Use a pasta, no rodapé, para escolher os áudios. Cada arquivo vira uma faixa; pelo
          botão da própria faixa, ele entra nela como mais um trecho.
        </Text>
        <Text style={estilos.ajuda}>
          Toque num trecho para escolhê-lo; escolhido, ele se arrasta. A tesoura corta onde a
          agulha está, e a lixeira remove — as setas desfazem.
        </Text>
        <Text style={estilos.ajuda}>
          <Text style={estilos.ajudaForte}>M</Text> cala a faixa,
          {' '}<Text style={estilos.ajudaForte}>S</Text> deixa só ela. Na Mesa ficam o volume e o
          panorama entre os dois alto-falantes.
        </Text>
      </BalaoFlutuante>

      {/* O selo de estado. Só existe quando há algo a dizer: um indicador permanente deixa de
          ser lido, e este precisa de ser lido nas duas vezes em que importa — a gravar, e
          quando falhou. */}
      {/* ⚠️ O SELO FICA EM TODAS AS ABAS, ao contrário das setas e do balão: ele não fala da
          montagem, fala de GRAVAR — e a ficha, que não tem botão de Salvar, é justamente onde
          ele mais precisa de ser lido. */}
      {(selo !== 'parado' || gerando != null) && (
        <View style={[estilos.selo, { bottom: margem.bottom + ALTURA_DO_RODAPE + 12 }]}>
          <Text
            style={[estilos.seloTexto, selo === 'erro' && estilos.seloDeErro]}
            accessibilityLiveRegion="polite"
          >
            {/* Dez stems levam um minuto, e um minuto sem sinal é um bug aos olhos de quem
                espera. A ordem é a da gravidade: o que prende a tela aparece primeiro. */}
            {gerando != null ? rotuloDaGuia(gerando)
              : envio ? `Enviando ${envio.feitos + 1} de ${envio.total}…`
                : selo === 'salvando' ? 'Salvando…'
                  : selo === 'erro' ? 'Falha ao salvar' : 'Salvo'}
          </Text>
        </View>
      )}

      {/* ⚠️ A CONVERSA, E NÃO OS COMENTÁRIOS DA GRAVAÇÃO. Um comentário preso a uma versão
          responde "o que muda NESTA" e morre com ela; a conversa é o fio do trabalho da equipa
          sobre a música, e num sítio só. Ver `ConversaDoJam`.

          ⚠️ NA FILA DA DIREITA, com os outros flutuantes. À esquerda ela ficava por cima do
          botão de silenciar do primeiro canal da Mesa — um flutuante que tapa um controlo é
          pior do que um flutuante a mais. */}
      {ehDeAudio && (
        <Pressable
          onPress={() => setConversaAberta(true)}
          style={[estilos.balao, { bottom: margem.bottom + ALTURA_DO_RODAPE + 12 }]}
          accessibilityRole="button"
          accessibilityLabel="Abrir a conversa da equipe"
        >
          <Feather name="message-circle" size={15} color={COR_EDITOR.acaoIcone} />
        </Pressable>
      )}

      {/* ⚠️ O STATUS DA MÚSICA SAIU DESTA TELA, como na web abaixo de 760 px: o seletor comia
          116 pt de um cabeçalho de 402, e o que sobrava para o nome da música eram 45 — "Ra…".
          Saber QUE música está aberta é o trabalho deste cabeçalho; o estado da obra é assunto
          da Ficha, que fica a um toque. */}

      {/* Enviar versão nova e editar versão usam a MESMA folha — a diferença é só existir uma
          `versao`. */}
      <FolhaDaVersao
        aberta={folhaAberta}
        artistaId={String(artistaId)}
        projetoId={projeto.id}
        nomeDoProjeto={projeto.title}
        versao={emEdicao}
        ehPrincipal={Boolean(emEdicao && emEdicao.id === projeto.primary_version_id)}
        proximoNumero={versoes.length ? Math.max(...versoes.map((v) => v.version_number)) + 1 : 1}
        herdar={{ bpm: aberta?.bpm, key: aberta?.key, genre: projeto.genre }}
        autor={{ id: usuario?.id, nome: meuNome, foto: minhaFoto }}
        arquivoInicial={arquivoInicial}
        aoFechar={() => { setFolhaAberta(false); setEmEdicao(null); setArquivoInicial(null); }}
        aoSalvar={buscar}
        aoExcluir={aoExcluirVersao}
      />

      <ConversaDoJam
        aberta={conversaAberta}
        projetoId={projeto.id}
        autor={{ id: usuario?.id, nome: meuNome, foto: minhaFoto }}
        podeFalar={podeEditar}
        aoFechar={() => setConversaAberta(false)}
      />
    </View>
  );
}

/**
 * As quatro vistas do editor, na ordem em que a web as põe.
 *
 * ⚠️ A ORDEM É UMA ESCOLHA: primeiro montar, depois misturar, depois descrever, e por último
 * levar embora — é a ordem em que o trabalho acontece. E a primeira é a Timeline porque é a cara
 * do editor: quem abre quer ver a música, não um formulário.
 */
type Aba = 'linha' | 'mesa' | 'ficha' | 'exportar';

const ABAS: {
  chave: Aba;
  rotulo: string;
  icone: (p: { tamanho?: number; cor: string }) => React.ReactElement;
}[] = [
  { chave: 'linha', rotulo: 'Timeline', icone: IconeDaTimeline },
  { chave: 'mesa', rotulo: 'Mixer', icone: IconeDoMixer },
  {
    chave: 'ficha',
    rotulo: 'Ficha',
    icone: ({ tamanho = 15, cor }) => <Feather name="file-text" size={tamanho} color={cor} />,
  },
  {
    chave: 'exportar',
    rotulo: 'Exportar',
    icone: ({ tamanho = 15, cor }) => <Feather name="download" size={tamanho} color={cor} />,
  },
];

/** `3:46` — o formato que a lista de Músicas mostra. */
const relogioCurto = (segundos: number) => {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * De quanto em quanto os flutuantes do canto se repetem.
 *
 * ⚠️ UM PASSO SÓ, e daqui: são 30 pontos de círculo mais 8 de folga — a MESMA folga que separa
 * as duas setas na vertical. Com as posições escritas à mão (18, 62, 100) os intervalos saíam
 * 14 e 8, e a fila não parecia uma fila: o olho vê o desencontro antes de saber medi-lo.
 */
const PASSO_DOS_FLUTUANTES = 38;

/** A altura do rodapé, de onde sai a posição dos flutuantes — para os dois não divergirem. */
const ALTURA_DO_RODAPE = 48;
const ALTURA_DO_TITULO = 56;

const estilos = StyleSheet.create({
  // ⚠️ ESTA TELA É ESCURA, e é a única do app que é. O Maestra é claro, azul-marca e
  // arredondado; um editor de música é escuro, denso e de contraste alto — é o que Ableton,
  // Logic e Pro Tools são, e é o que o olho de quem trabalha com áudio espera. A web mudou
  // primeiro, e o app segue: é a MESMA tela, e duas peles fariam duas telas.
  //
  // ⚠️ E NÃO ROLA COMO PÁGINA. O editor é uma tela de trabalho: cabeçalho fixo em cima, rodapé
  // fixo em baixo, e no meio a montagem, que rola por dentro. Numa página que rola, o play e o
  // relógio desapareciam para cima assim que se olhava a terceira faixa.
  tela: { flex: 1, backgroundColor: COR_EDITOR.fundoDe },
  flex: { flex: 1, minWidth: 0 },
  espera: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  vazioTexto: { fontSize: 15, color: COR_EDITOR.apoio },
  voltarTexto: { fontSize: 14, fontWeight: '800', color: AZUL_DO_EDITOR },

  filaDoTitulo: {
    height: ALTURA_DO_TITULO, flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingHorizontal: 10,
    backgroundColor: COR_EDITOR.painel,
    borderBottomWidth: 1, borderBottomColor: COR_EDITOR.fio,
  },
  ladoDoTitulo: { flex: 1, minWidth: 0 },
  nomeDaMusica: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, color: COR_EDITOR.texto },
  nomeEmEdicao: {
    padding: 0, paddingHorizontal: 8, height: 30, borderRadius: 6,
    backgroundColor: COR_EDITOR.botaoRedondo,
    borderWidth: 1, borderColor: AZUL_DO_EDITOR,
  },
  redondo: {
    width: 30, height: 30, borderRadius: 15, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_EDITOR.botaoRedondo,
  },

  // A fila das abas é a da web: as quatro num sulco só, a acesa com o fundo mais claro. As
  // medidas são as de lá (28 de altura, 3 de folga em volta, 2 entre elas), com o alvo do dedo
  // por cima — 28 pt é pequeno para tocar, e o `hitSlop` dá os 44 sem alargar o desenho.
  abas: {
    flexDirection: 'row', gap: 2, flexShrink: 0,
    padding: 3, borderRadius: 8,
    backgroundColor: COR_EDITOR.botaoRedondo,
  },
  aba: { width: 34, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  abaAcesa: { backgroundColor: COR_EDITOR.cabecaDaVersao },
  inerte: { opacity: 0.4 },

  corpo: { flex: 1, minHeight: 0 },
  // A ficha e o exportar não têm o que arrastar nem o que tocar: ocupam o lugar da montagem.
  folhaDaAba: { padding: 20 },
  mesa: { flex: 1 },
  mesaDentro: { paddingHorizontal: 14, paddingVertical: 10, gap: 6 },

  semVersoes: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 34 },
  semVersoesTitulo: { fontSize: 15, fontWeight: '700', color: COR_EDITOR.texto, textAlign: 'center' },
  semVersoesApoio: { fontSize: 13, color: COR_EDITOR.rotulo, textAlign: 'center', lineHeight: 19 },

  avisoDePeso: {
    paddingVertical: 8, paddingHorizontal: 12,
    backgroundColor: COR_EDITOR.botaoRedondo,
    borderBottomWidth: 1, borderBottomColor: COR_EDITOR.fio,
    fontSize: 12, lineHeight: 17, color: COR_EDITOR.apoio,
  },

  rodape: {
    minHeight: ALTURA_DO_RODAPE, flexDirection: 'row', alignItems: 'center',
    gap: 8, paddingHorizontal: 10,
    backgroundColor: COR_EDITOR.painel,
    borderTopWidth: 1, borderTopColor: COR_EDITOR.fio,
  },
  botaoDoRodape: {
    width: 30, height: 30, borderRadius: 6, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  botaoAceso: { backgroundColor: COR_EDITOR.botaoRedondo },
  outroAndamento: {
    height: 26, paddingHorizontal: 8, justifyContent: 'center',
    borderRadius: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: COR_EDITOR.fio,
  },
  outroAndamentoTexto: {
    fontSize: 11, fontWeight: '700', color: COR_EDITOR.apoio, fontVariant: ['tabular-nums'],
  },

  // O Master é o único controlo desta barra, e por isso é ele que fica com o que sobra.
  // ⚠️ FOLGA À DIREITA DO TAMANHO DE MEIO BOTÃO. O botão do fader centra-se no valor, e no
  // máximo isso põe metade dele para lá do fim do trilho — encostado à borda da tela, ele saía
  // cortado ao meio. Onze pontos é exatamente essa metade.
  mestre: { flex: 1, minWidth: 80, maxWidth: 170, marginRight: 11 },

  // ── Os flutuantes ──
  // Eles moram ACIMA do rodapé, e não dentro: um círculo de 34 pt numa barra de 48 encostava
  // nas bordas e empurrava o Master para dentro. É o que a web faz com o "?" e a letra.
  // ⚠️ AS MEDIDAS SÃO AS DA WEB, à letra: 30 de diâmetro, 8 de folga entre eles, 18 da borda.
  // Eu tinha posto 34 e 6, e o resultado era uma coluna com um respiro na vertical diferente do
  // da horizontal — a fila deixava de parecer uma fila.
  setas: { position: 'absolute', right: 18, gap: 8 },
  flutuante: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_EDITOR.botaoRedondo,
    borderWidth: 1, borderColor: COR_EDITOR.vazioContorno,
  },
  // ⚠️ NA MESMA FILA DOS OUTROS, e à esquerda deles — o quarto lugar do passo. Estava no canto
  // oposto: quem carrega em algo olha para o sítio onde acabou de carregar, e o "Salvando…"
  // aparecia do outro lado da tela, longe do gesto que o provocou. É onde a web o põe.
  selo: {
    position: 'absolute', right: PASSO_DOS_FLUTUANTES * 3 + 18,
    height: 30, justifyContent: 'center',
    paddingHorizontal: 12, borderRadius: 15,
    backgroundColor: COR_EDITOR.botaoRedondo,
    borderWidth: 1, borderColor: COR_EDITOR.vazioContorno,
  },
  seloTexto: { fontSize: 11, fontWeight: '700', color: COR_EDITOR.apoio },
  letra: {
    minHeight: 220, maxHeight: 320, textAlignVertical: 'top',
    fontSize: 13, lineHeight: 20, color: COR_EDITOR.texto,
  },
  ajudaTitulo: { fontSize: 12, fontWeight: '700', color: COR_EDITOR.titulo, marginBottom: 6 },
  ajuda: { fontSize: 12, lineHeight: 19, color: COR_EDITOR.apoio, marginBottom: 8 },
  ajudaForte: { fontWeight: '800', color: COR_EDITOR.titulo },
  seloDeErro: { color: COR.erro },
  // ⚠️ UM CÍRCULO, COMO OS OUTROS DOIS. Ele nasceu pílula porque trazia a contagem de
  // comentários ao lado do ícone; a contagem saiu com eles, e ficou uma cápsula mais larga no
  // meio de uma fila de círculos. Os três são agora o mesmo botão, com o mesmo passo entre
  // eles — ver `PASSO_DOS_FLUTUANTES`.
  balao: {
    position: 'absolute', right: PASSO_DOS_FLUTUANTES * 2 + 18,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_EDITOR.botaoRedondo,
    borderWidth: 1, borderColor: COR_EDITOR.vazioContorno,
  },

  avatarFoto: { resizeMode: 'cover' },
  avatarVazio: { alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontWeight: '800', color: COR_EDITOR.papel },
});
