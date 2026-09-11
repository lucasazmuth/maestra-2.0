import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View,
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
import { ehPistaDaMix, montagemDaVersao } from '@maestra/core/audio/pistasDaVersao';
import { useMesa } from '@maestra/core/audio/useMesa';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import {
  CATALOG_STATUS, CATALOG_STATUS_OPTIONS, MEMORIA_DE_AVISO_BYTES,
} from '@maestra/core/constants/maestra';
import { COR, COR_EDITOR } from '@maestra/core/constants/design';
import type {
  CatalogClip, CatalogProject, CatalogVersion, CatalogVersionFile,
} from '@maestra/core/interfaces/maestra';
import * as catalogo from '@maestra/core/services/db/catalog';

import { BotaoFlutuante } from '@/casca/BotaoFlutuante';
import { Escolha } from '@/casca/Escolha';
import { CampoDoCabecalho, DonoDosCampos } from '@/casca/jam/CampoDoCabecalho';
import { ComentariosDaVersao } from '@/casca/jam/ComentariosDaVersao';
import { FolhaDaVersao } from '@/casca/jam/FolhaDaVersao';
import { ResumoDaFicha } from '@/casca/jam/ResumoDaFicha';
import { BARRAS } from '@/casca/jam/mesa/MiniOnda';
import { Pista } from '@/casca/jam/mesa/Pista';
import { SeletorDeGravacoes } from '@/casca/jam/mesa/SeletorDeGravacoes';
import { LinhaDoTempo } from '@/casca/jam/mesa/LinhaDoTempo';
import { IconeDaTimeline, IconeDoMixer } from '@/casca/jam/mesa/icones';
import { TelaDeExportar, type EmCurso } from '@/casca/jam/mesa/TelaDeExportar';
import {
  partilharGuiaMp3, partilharGuiaWav, partilharStems,
} from '@/casca/jam/mesa/exportarNativo';
import { Transporte } from '@/casca/jam/mesa/Transporte';
import { FichaDaFaixa } from '@/casca/musicas/FichaDaFaixa';
import { buscarNativo, criarContextoNativo, criarOfflineNativo } from '@/nucleo/audio/contextoNativo';
import { useInterrupcoesDeAudio } from '@/nucleo/audio/interrupcoes';
import { escolherAudio, type ArquivoEscolhido } from '@/nucleo/arquivos';
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

const iniciais = (valor?: string | null) => (valor || '?').trim().slice(0, 1).toUpperCase();

const dataCurta = (valor?: string | null) => valor
  ? new Date(valor).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  : 'Data indisponível';

// O chip de status recebe a cor do próprio status; o texto vem da luminância — o roxo da
// Masterização pede letra clara, o amarelo do padrão pede escura. É a mesma conta da web.
const paraRgb = (hex: string) => {
  const valor = hex.replace('#', '');
  const cheio = valor.length === 3 ? valor.split('').map((c) => c + c).join('') : valor;
  return [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16));
};

const coresDoStatus = (status?: string | null) => {
  const cor = CATALOG_STATUS[status as keyof typeof CATALOG_STATUS]?.color || COR_EDITOR.statusPadrao;
  const [r, g, b] = paraRgb(cor);
  const clara = (r * 299 + g * 587 + b * 114) / 1000 > 165;
  return { fundo: cor, texto: clara ? COR_EDITOR.tintaEscura : COR_EDITOR.papel };
};

/** Quanto tempo o "Salvo" fica na tela. Depois disso ele saía do nada; antes disto não saía nunca. */
const DURACAO_DO_SELO = 2000;

/** O compasso do salvamento automático, igual ao do resto do app. */
const ESPERA = 650;

// Fora do componente: são as mesmas duas funções para sempre, e cá dentro seriam objetos novos
// a cada render. `mono` ligado — no telemóvel, somar os canais é metade da memória por pista, e
// a memória é o que mata a aplicação com seis stems abertos.
const DEPENDENCIAS_DA_MESA = { criarContexto: criarContextoNativo, buscar: buscarNativo, mono: true };

// Declarado FORA do componente: dentro, cada render cria uma função nova e o React remonta a
// subárvore.
const Avatar = ({ nome, foto, tamanho }: { nome?: string | null; foto?: string | null; tamanho: number }) => {
  // A moldura branca é o que separa o avatar do fundo azulado do cabeçalho da versão; ela
  // engrossa junto com o círculo (3px no de 44, 2px no de 34, como na folha).
  const forma = {
    width: tamanho, height: tamanho, borderRadius: tamanho / 2,
    borderWidth: tamanho >= 44 ? 3 : 2, borderColor: COR_EDITOR.papel,
  } as const;
  if (foto) return <Image source={{ uri: foto }} style={[forma, estilos.avatarFoto]} />;
  // Sem foto entra o degradê roxo→azul da web, e não um roxo chapado: ele é a passagem entre a
  // cor da marca e a cor de ação, e é o que dá ao avatar vazio o mesmo peso do que tem foto.
  return (
    <LinearGradient
      colors={[COR_EDITOR.avatarDe, COR_EDITOR.avatarAte]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[forma, estilos.avatarVazio]}
    >
      <Text style={[estilos.avatarTexto, { fontSize: tamanho >= 44 ? 14 : 11 }]}>{iniciais(nome)}</Text>
    </LinearGradient>
  );
};

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
  const [statusAberto, setStatusAberto] = useState(false);
  /**
   * Qual metade da gravação está à vista.
   *
   * ⚠️ ABRE NA LINHA DO TEMPO, como a web. Ela é a cara do editor: é onde se vê o que a música
   * TEM. Chegar ao Espaço JAM por um ecrã de faders, sem uma onda à vista, é chegar a outro
   * produto. Ver não é montar, e ver é o que a linha do tempo faz bem no aparelho.
   */
  const [aba, setAba] = useState<Aba>('linha');

  const [fichaAberta, setFichaAberta] = useState(false);

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

  const [comentando, setComentando] = useState<CatalogVersion | null>(null);
  const [contagens, setContagens] = useState<Record<string, number>>({});

  /** Qual gravação está aberta no editor. É ela que a mesa carrega e que o cabeçalho edita. */
  const [abertaId, setAbertaId] = useState<string | null>(null);
  const [bpm, setBpm] = useState('');
  const [tom, setTom] = useState('');


  const buscar = useCallback(async () => {
    if (!projetoId) return;
    try {
      const proximo = await catalogo.getCatalogProject(String(projetoId));
      setProjeto(proximo);
    } catch {
      setProjeto(null);
    } finally {
      setCarregando(false);
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

  // O número no balão de cada gravação. O `getCatalogProject` não traz os comentários junto, e
  // um balão sem número não diz se vale abrir — que é a única coisa que ele precisa dizer.
  const contar = useCallback(async (lista: CatalogVersion[]) => {
    const pares = await Promise.all(lista.map(async (v) => {
      try { return [v.id, (await catalogo.listVersionComments(v.id)).length] as const; }
      catch { return [v.id, 0] as const; }
    }));
    setContagens(Object.fromEntries(pares));
  }, []);

  useEffect(() => {
    if (projeto?.versions?.length) void contar(projeto.versions);
  }, [projeto, contar]);

  // ─── Mexer no estado sem recarregar a tela ────────────────────────────────
  //
  // Renomear uma pista ou mudar um volume não pode chamar `buscar()`: a resposta vinha com um
  // objeto novo, a mesa via pistas "diferentes" e descarregava 400 MB de áudio para mostrar um
  // nome trocado. Estas duas costuras remendam só o que mudou.
  const patcharVersao = (id: string, parte: Partial<CatalogVersion>) => setProjeto((atual) => (
    atual ? {
      ...atual,
      versions: (atual.versions ?? []).map((v) => (v.id === id ? { ...v, ...parte } : v)),
    } : atual
  ));

  const patcharPista = (id: string, parte: Partial<CatalogVersionFile>) => setProjeto((atual) => (
    atual ? {
      ...atual,
      versions: (atual.versions ?? []).map((v) => ({
        ...v,
        files: (v.files ?? []).map((f) => (f.id === id ? { ...f, ...parte } : f)),
      })),
    } : atual
  ));

  const mudar = (parte: Partial<CatalogProject>) =>
    setProjeto((atual) => (atual ? { ...atual, ...parte } : atual));

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
        await catalogo.updateClip(passo.clipeId, { start_seconds: voltando ? passo.de : passo.para });
        break;
      case 'apagarClipe':
        await (voltando ? catalogo.restaurarClipe : catalogo.marcarClipeApagado)(passo.clipeId);
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

  /** `de` só vem quando a mão largou: durante o arrasto isto é chamado a cada pixel. */
  const moverClipe = (clipeId: string, inicio: number, de?: number) => {
    patcharClipe(clipeId, { start_seconds: inicio });
    if (de !== undefined) anotar({ tipo: 'mover', clipeId, de, para: inicio });
    clearTimeout(relogiosDoClipe.current[clipeId]);
    relogiosDoClipe.current[clipeId] = setTimeout(() => {
      catalogo.updateClip(clipeId, { start_seconds: inicio }).catch(() => setSelo('erro'));
    }, ESPERA);
  };

  const cortarClipe = async (clipeId: string, emSegundo: number) => {
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
    esquecerClipe(clipeId);
    setSelo('salvando');
    try {
      await catalogo.marcarClipeApagado(clipeId);
      anotar({ tipo: 'apagarClipe', clipeId });
      await buscar();
      setSelo('salvo');
    } catch { setSelo('erro'); }
  };

  // ─── A mesa ───────────────────────────────────────────────────────────────

  // O fader mexe no som na hora e no banco depois: gravar a cada pixel do arrasto seriam
  // dezenas de escritas para um gesto só. Um relógio por pista — arrastar duas seguidas não
  // pode fazer a segunda cancelar a gravação da primeira.
  const relogiosDoGanho = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => () => {
    Object.values(relogiosDoGanho.current).forEach(clearTimeout);
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

  const mexerNoGanho = (id: string, valor: number) => {
    mesa.ganho(id, valor);
    // A Mix não tem linha no banco: ela é o `audio_file` da gravação, e o volume dela é só
    // desta sessão de escuta.
    if (ehPistaDaMix(id)) return;
    clearTimeout(relogiosDoGanho.current[id]);
    relogiosDoGanho.current[id] = setTimeout(() => {
      const arredondado = Number(valor.toFixed(3));
      catalogo.updateVersionFile(id, { gain: arredondado })
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

  const alternarPrincipal = async (versao: CatalogVersion) => {
    if (!projeto) return;
    const jaEra = versao.id === projeto.primary_version_id;
    try {
      await catalogo.setPrimaryVersion(projeto.id, jaEra ? null : versao.id);
      mudar({ primary_version_id: jaEra ? null : versao.id });
    } catch { /* o estado real volta no próximo refresh */ }
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

  const voltar = () => {
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
        <Pressable onPress={voltar} accessibilityRole="button" accessibilityLabel="Voltar para Músicas">
          <Text style={estilos.voltarTexto}>Voltar para Músicas</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  const status = coresDoStatus(projeto.status);
  const rotuloDoStatus =
    CATALOG_STATUS[projeto.status as keyof typeof CATALOG_STATUS]?.label || projeto.status;

  const principalAberta = Boolean(aberta && aberta.id === projeto.primary_version_id);
  const haSolo = mesa.estado.pistas.some((p) => p.solo);
  const prontas = mesa.estado.pistas.filter((p) => p.carga === 'pronta').length;

  return (
    <LinearGradient colors={[COR_EDITOR.fundoDe, COR_EDITOR.fundoAte]} style={estilos.tela}>
      {/* O relógio e a bateria são pretos no resto do app, que é claro. Aqui o fundo é quase
          preto: sem esta linha, a barra do sistema some por cima da tela. */}
      {/* eslint-disable-next-line react/style-prop-object -- o `style` da barra do sistema é
          'light' ou 'dark', e não uma folha de estilo. */}
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={[
          estilos.rolagem,
          // O fundo reserva o lugar do botão flutuante: sem isto o último cartão ficava por
          // baixo dele e o "mais ações" da última versão era inalcançável.
          { paddingTop: margem.top + 14, paddingBottom: margem.bottom + 110 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* O cabeçalho é o TÍTULO. Voltar de um lado, editar do outro, e o nome da música com a
            largura toda e duas linhas. */}
        <View style={estilos.cabecalho}>
          <Pressable
            style={estilos.redondo}
            onPress={voltar}
            accessibilityRole="button"
            accessibilityLabel="Voltar para Músicas"
          >
            <Feather name="arrow-left" size={18} color={COR_EDITOR.texto} />
          </Pressable>

          <View style={estilos.flex}>
            <Text style={estilos.nomeDaMusica} numberOfLines={2}>{projeto.title}</Text>
          </View>

          {/* AS QUATRO VISTAS DA MESMA MÚSICA, no topo — é a primeira escolha de quem entra
              (estou a montar, a misturar, a preencher a ficha, ou a levar isto embora?) e ela
              decide o que a tela inteira mostra. É onde a web as põe, e pela mesma razão.

              ⚠️ SÓ O ÍCONE, sem rótulo: os quatro nomes somam mais de 300 pt, e o que eles
              empurravam para fora da tela era o botão de voltar — a pessoa entrava no editor e
              não tinha como sair. O nome continua no leitor de tela. É o mesmo corte que a web
              faz abaixo de 760 px.

              ⚠️ O LÁPIS SAIU DAQUI: a ficha virou uma das quatro abas. Dois caminhos para o
              mesmo formulário, um deles escondido num ícone, é um a mais. */}
          <View style={estilos.abas}>
            {ABAS.map(({ chave, rotulo, icone: Icone }) => {
              // ⚠️ A FICHA É A ÚNICA QUE NÃO TROCA A VISTA: ela ABRE A FOLHA, que é o mesmo
              // formulário do catálogo. Na web ela é uma aba como as outras, e aqui não é por
              // uma razão concreta: esse formulário é partilhado com a lista de Músicas, que é
              // uma tela clara. Vesti-lo de escuro para caber nesta aba vestiria também a tela
              // de lá; e um segundo formulário, escuro, com os mesmos campos, seria duas
              // verdades sobre a mesma música. Fica um formulário só, por cima do editor.
              // Enquanto ela está aberta a aba de baixo continua acesa — é para lá que se volta.
              const acesa = aba === chave;
              return (
                <Pressable
                  key={chave}
                  onPress={() => (chave === 'ficha' ? setFichaAberta(true) : setAba(chave))}
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
        </View>

        {/* A segunda linha: o status da música e, ao lado, o andamento e o tom da gravação
            aberta. Envolve para a linha de baixo em telas estreitas em vez de espremer os
            campos — um campo de dois caracteres não se aperta mais do que isso. */}
        <View style={estilos.segundaLinha}>
          <Pressable
            style={[estilos.chip, { backgroundColor: status.fundo }]}
            onPress={() => setStatusAberto(true)}
            accessibilityRole="button"
            accessibilityLabel={`Status: ${rotuloDoStatus}. Toque para trocar.`}
          >
            <Text style={[estilos.chipTexto, { color: status.texto }]} numberOfLines={1}>
              {rotuloDoStatus}
            </Text>
            <Feather name="chevron-down" size={11} color={status.texto} />
          </Pressable>

          <CampoDoCabecalho
            valor={bpm}
            aoMudar={setBpm}
            sufixo="BPM"
            largura={34}
            numerico
            limite={3}
            travado={!aberta}
            rotulo="Andamento da gravação, em BPM"
          />
          <CampoDoCabecalho
            valor={tom}
            aoMudar={setTom}
            sufixo="Tom"
            largura={40}
            maiusculas
            limite={6}
            travado={!aberta}
            rotulo="Tom da gravação"
          />

          {selo !== 'parado' && (
            <Text
              style={[estilos.selo, selo === 'erro' && estilos.seloDeErro]}
              accessibilityLiveRegion="polite"
            >
              {selo === 'salvando' ? 'Salvando…' : selo === 'erro' ? 'Falha ao salvar' : 'Salvo'}
            </Text>
          )}
        </View>

        {/* A linha que resolve a confusão antiga: o número é DAQUELA gravação, com nome e tudo. */}
        <DonoDosCampos
          alerta={!aberta}
          texto={aberta
            ? `de V${aberta.version_number}${aberta.title ? ` · ${aberta.title}` : ''}${principalAberta ? ' ★' : ''}`
            : 'envie uma gravação para registrar andamento e tom'}
        />

        {/* O que é da MÚSICA e não muda de gravação para gravação. Tocar abre a mesma ficha. */}
        <ResumoDaFicha
          dados={{ genero: projeto.genre, lancamento: projeto.release_date }}
          aoTocar={() => setFichaAberta(true)}
        />

        {/* O painel sangra até as bordas: numa tela estreita, o recuo da página somado ao dele
            deixava pouco para o conteúdo, e a moldura não separava nada — é o único bloco. */}
        <View style={estilos.painel}>
          {versoes.length === 0 ? (
            <View style={estilos.semVersoes}>
              <Text style={estilos.semVersoesTitulo}>Este Espaço JAM ainda não tem uploads.</Text>
              <Text style={estilos.semVersoesApoio}>
                Envie a primeira guia, beat ou mix para começar a colaboração.
              </Text>
            </View>
          ) : (
            <View style={estilos.editor}>
              <SeletorDeGravacoes
                versoes={versoes}
                abertaId={abertaId}
                principalId={projeto.primary_version_id}
                aoAbrir={(versao) => setAbertaId(versao.id)}
              />

              {!!aberta && (
                <>
                  {/* Quem gravou, quando, e o que se faz com esta gravação. A estrela marca a
                      principal daqui mesmo, sem abrir a folha de edição. */}
                  <View style={estilos.identidade}>
                    <Avatar nome={aberta.author_name} foto={aberta.author_avatar} tamanho={44} />
                    <View style={estilos.flex}>
                      <Text style={estilos.tituloDaVersao} numberOfLines={1}>
                        {aberta.title || `Versão ${aberta.version_number}`}
                      </Text>
                      <Text style={estilos.autoria} numberOfLines={1}>
                        {aberta.author_name || 'Autor não identificado'} · {dataCurta(aberta.created_at)}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => alternarPrincipal(aberta)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityState={{ selected: principalAberta }}
                      accessibilityLabel={principalAberta
                        ? `Desmarcar V${aberta.version_number} como gravação principal`
                        : `Tornar V${aberta.version_number} a gravação principal`}
                    >
                      <Feather
                        name="star"
                        size={19}
                        color={principalAberta ? COR_EDITOR.estrelaAcesa : COR_EDITOR.estrela}
                      />
                    </Pressable>
                  </View>

                  {/* UM transporte para a gravação inteira. É ele que diz, sem uma palavra, que
                      as pistas abaixo tocam JUNTAS.

                      ⚠️ SÓ NAS ABAS DE ÁUDIO: não se toca uma ficha, nem se exporta com o play
                      na mão. É o mesmo corte que a web faz. */}
                  {aba !== 'exportar' && <Transporte
                    tocando={mesa.estado.tocando}
                    posicao={mesa.estado.posicao}
                    duracao={mesa.estado.duracao}
                    carregando={mesa.estado.carregando}
                    prontas={prontas}
                    emLoop={mesa.estado.emLoop}
                    aoAlternar={mesa.alternar}
                    aoBuscar={mesa.irPara}
                    aoVoltarAoInicio={() => mesa.irPara(0)}
                    aoLoopar={mesa.loopar}
                  />}

                  {aba === 'linha' && (
                    <LinhaDoTempo
                      pistas={pistas}
                      estado={mesa.estado}
                      picos={mesa.picos}
                      duracaoDoClipe={mesa.duracaoDoClipe}
                      bpm={aberta.bpm}
                      podeEditar={podeEditar}
                      aoBuscar={mesa.irPara}
                      aoMover={moverClipe}
                      aoCortar={(id, seg) => { void cortarClipe(id, seg); }}
                      aoApagar={(id) => { void apagarClipe(id); }}
                      historico={podeEditar ? {
                        podeDesfazer: podeDesfazer(historico),
                        podeRefazer: podeRefazer(historico),
                        rotuloDesfazer: rotuloDaSeta('Desfazer', historico.passado[historico.passado.length - 1]),
                        rotuloRefazer: rotuloDaSeta('Refazer', historico.futuro[historico.futuro.length - 1]),
                        ocupado: andandoNoTempo,
                        desfazer: () => { void andarNoTempo('desfazer'); },
                        refazer: () => { void andarNoTempo('refazer'); },
                      } : undefined}
                    />
                  )}

                  {aba === 'exportar' && (
                    <TelaDeExportar
                      pistas={pistas.map((pista) => ({ id: pista.id, nome: pista.nome }))}
                      temStems={prontas > 0}
                      temGuia={Boolean(aberta.audio_file)}
                      emCurso={exportandoEm}
                      aoEnviarStems={() => { void enviarStems(); }}
                      aoEnviarGuiaWav={() => { void enviarGuiaWav(); }}
                      aoEnviarGuiaMp3={() => { void enviarGuiaMp3(); }}
                    />
                  )}

                  {/* O aviso de peso vem ANTES de descodificar, com a conta do tamanho dos
                      ficheiros: depois de descodificar já não há o que avisar. */}
                  {pesado && aba !== 'exportar' && (
                    <Text style={estilos.avisoDePeso}>
                      São muitas pistas grandes para um celular. Se o app fechar sozinho, deixe
                      menos pistas nesta gravação.
                    </Text>
                  )}

                  {/* A ordem das linhas é a das PISTAS (posição no banco), e não a da mesa —
                      para ela, que toca tudo ao mesmo tempo, ordem nenhuma significa nada. */}
                  <View style={aba === 'mesa' ? undefined : estilos.escondida}>
                    {pistas.map((pista, indice) => {
                      const estadoDaPista = mesa.estado.pistas.find((p) => p.id === pista.id);
                      if (!estadoDaPista) return null;
                      return (
                        <Pista
                          key={pista.id}
                          pista={estadoDaPista}
                          indice={indice}
                          // Os picos são POR CLIPE: a pista empilhada do app mostra o primeiro.
                          picos={mesa.picos(pista.clipes[0]?.id ?? '', BARRAS)}
                          // O progresso é o da GRAVAÇÃO, e não o da pista: a duração agora é do
                          // conjunto dos clipes, e a onda empilhada do app desenha o primeiro.
                          progresso={mesa.estado.duracao
                            ? Math.min(mesa.estado.posicao / mesa.estado.duracao, 1)
                            : 0}
                          haSolo={haSolo}
                          aoMudar={() => mexerNoMudo(pista.id, !estadoDaPista.muda)}
                          aoSolar={() => mesa.solar(pista.id, !estadoDaPista.solo)}
                          aoGanho={(v) => mexerNoGanho(pista.id, v)}
                          // A Mix não se renomeia, não se move e não se apaga: ela é o áudio da
                          // própria gravação, e mexer nela é mexer na gravação.
                          // Sem `⋯`: renomear, mover e remover pedem a linha do tempo, e ela
                          // ainda não existe aqui.
                          aoAbrirOpcoes={undefined}
                        />
                      );
                    })}
                  </View>

                  {/* As ações da gravação ficam no rodapé do editor, longe dos controles de
                      escuta: aqui se baixa, se comenta, se abre em tela cheia e se edita. */}
                  <View style={estilos.acoes}>
                    {!!aberta.audio_file && (
                      // "Baixar" no celular é a folha de partilha: dela sai "Guardar em
                      // Ficheiros", e ainda o AirDrop e o WhatsApp — que é como a mix circula.
                      <Pressable
                        style={estilos.acao}
                        onPress={() => Share.share({ url: aberta.audio_file as string })}
                        accessibilityRole="button"
                        accessibilityLabel={`Baixar ou compartilhar V${aberta.version_number}`}
                      >
                        <Feather name="download" size={15} color={COR_EDITOR.acaoIcone} />
                      </Pressable>
                    )}
                    <Pressable
                      style={estilos.acao}
                      onPress={() => setComentando(aberta)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        `Abrir ${contagens[aberta.id] ?? 0} comentários de V${aberta.version_number}`
                      }
                    >
                      <Feather name="message-circle" size={15} color={COR_EDITOR.acaoIcone} />
                      <Text style={estilos.acaoTexto}>{contagens[aberta.id] ?? 0}</Text>
                    </Pressable>
                    <Pressable
                      style={estilos.acao}
                      onPress={() => router.push(`/jam/${artistaId}/${projeto.id}/${aberta.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir a visualização completa de V${aberta.version_number}`}
                    >
                      <Feather name="maximize-2" size={15} color={COR_EDITOR.acaoIcone} />
                    </Pressable>
                    <Pressable
                      style={estilos.acao}
                      onPress={() => { setArquivoInicial(null); setEmEdicao(aberta); setFolhaAberta(true); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Mais ações para V${aberta.version_number}`}
                    >
                      <Feather name="more-vertical" size={15} color={COR_EDITOR.acaoIcone} />
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Enviar flutua como o "+" do catálogo: é o idioma do app para criar numa lista, e fica
          ao alcance do polegar em qualquer ponto da rolagem. `semIlha` porque esta tela mora
          fora das abas — sem isso ele reservaria o lugar de uma barra que não está lá. */}
      <BotaoFlutuante rotulo="Enviar uma versão" aoTocar={subir} semIlha />

      {/* Trocar o status abre a Escolha que sobe de baixo, e não uma lista no fluxo: a lista
          empurrava a tela inteira 217 pt para baixo enquanto estava aberta. */}
      <Escolha
        aberta={statusAberto}
        titulo="Status da música"
        opcoes={CATALOG_STATUS_OPTIONS.map((o) => ({ valor: o.id, rotulo: o.label }))}
        valor={projeto.status}
        aoEscolher={(valor) => { if (valor) mudar({ status: valor }); }}
        aoFechar={() => setStatusAberto(false)}
      />

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
        // Herda da gravação ABERTA: é dela que o andamento e o tom de uma gravação nova
        // provavelmente partem. O gênero continua da música.
        herdar={{ bpm: aberta?.bpm, key: aberta?.key, genre: projeto.genre }}
        autor={{ id: usuario?.id, nome: meuNome, foto: minhaFoto }}
        arquivoInicial={arquivoInicial}
        aoFechar={() => { setFolhaAberta(false); setEmEdicao(null); setArquivoInicial(null); }}
        aoSalvar={buscar}
        aoExcluir={aoExcluirVersao}
      />

      <FichaDaFaixa
        aberta={fichaAberta}
        artistaId={String(artistaId)}
        faixa={catalogo.catalogProjectToItem(projeto, aberta ?? undefined)}
        generos={projeto.genre ? [projeto.genre] : []}
        autor={{ id: usuario?.id, nome: meuNome }}
        aoFechar={() => setFichaAberta(false)}
        aoSalvar={() => { setFichaAberta(false); void buscar(); }}
        // Excluir a música daqui deixa a tela sem assunto: volta para a lista.
        aoExcluir={() => { setFichaAberta(false); voltar(); }}
        aoMudarVersoes={buscar}
      />

      <ComentariosDaVersao
        aberta={Boolean(comentando)}
        versao={comentando}
        autor={{ id: usuario?.id, nome: meuNome, foto: minhaFoto }}
        aoFechar={() => setComentando(null)}
        aoMudar={() => { if (projeto.versions?.length) void contar(projeto.versions); }}
      />
    </LinearGradient>
  );
}

// Todo recuo horizontal desta tela é 18: o da página, o do painel, o dos cartões. Antes eram
// 16, 18 e 22 conforme o bloco, e o olho notava sem saber dizer o quê.
const RECUO = 18;

/**
 * As quatro vistas do editor, na ordem em que a web as põe.
 *
 * ⚠️ A ORDEM É UMA ESCOLHA, e não a de sempre: primeiro montar, depois misturar, depois
 * descrever, e por último levar embora — é a ordem em que o trabalho acontece. E a primeira é a
 * Timeline porque é a cara do editor: quem abre quer ver a música, não um formulário.
 */
type Aba = 'linha' | 'mesa' | 'ficha' | 'exportar';

const ABAS: { chave: Aba; rotulo: string; icone: (p: { tamanho?: number; cor: string }) => React.ReactElement }[] = [
  { chave: 'linha', rotulo: 'Timeline', icone: IconeDaTimeline },
  { chave: 'mesa', rotulo: 'Mixer', icone: IconeDoMixer },
  { chave: 'ficha', rotulo: 'Ficha', icone: ({ tamanho = 15, cor }) => <Feather name="file-text" size={tamanho} color={cor} /> },
  { chave: 'exportar', rotulo: 'Exportar', icone: ({ tamanho = 15, cor }) => <Feather name="download" size={tamanho} color={cor} /> },
];

// ⚠️ ESTA TELA É ESCURA, e é a única do app que é. O Maestra é claro, azul-marca e arredondado;
// um editor de música é escuro, denso e de contraste alto — é o que Ableton, Logic e Pro Tools
// são, e é o que o olho de quem trabalha com áudio espera. A web mudou primeiro, e o app segue:
// é a MESMA tela, e duas peles fariam duas telas. As cores vêm do `COR_EDITOR` do núcleo, com
// as mesmas chaves do `COR_JAM` claro — o que muda é a tinta, não o papel de cada cor.
const estilos = StyleSheet.create({
  // As abas do editor: a mesma escolha da web, com a forma do app.
  // A fila é a da web: as quatro num sulco só, a acesa com o fundo mais claro. As medidas são
  // as de lá (28 de altura, 3 de folga em volta, 2 entre elas), com o alvo do dedo por cima —
  // 28 pt é pequeno para tocar, e o `hitSlop` dá os 44 sem alargar o desenho.
  abas: {
    flexDirection: 'row', gap: 2, alignSelf: 'flex-start', flexShrink: 0,
    padding: 3, borderRadius: 8,
    backgroundColor: COR_EDITOR.acaoFundo,
  },
  aba: {
    width: 34, height: 28, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  abaAcesa: { backgroundColor: COR_EDITOR.cabecaDaVersao },
  // ⚠️ ESCONDIDA, e não desmontada: a mesa guarda gestos (o fader, o solo) e o estado da
  // rolagem. Desmontá-la a cada troca de aba devolveria tudo isso ao princípio, e trocar de aba
  // deixaria de ser olhar de outro sítio para ser recomeçar.
  escondida: { display: 'none' },
  tela: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  espera: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  vazioTexto: { fontSize: 15, color: COR_EDITOR.apoio },
  voltarTexto: { fontSize: 14, fontWeight: '800', color: COR.primaria },

  rolagem: { paddingHorizontal: RECUO },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  redondo: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_EDITOR.fio, backgroundColor: COR_EDITOR.botaoRedondo,
  },
  nomeDaMusica: {
    fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.55, color: COR_EDITOR.texto,
  },

  // Alinhada com o título, e não com o botão de voltar: 44 do botão + 10 de folga.
  segundaLinha: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8,
    marginTop: 8, paddingLeft: 54,
  },
  chip: {
    height: 28, paddingLeft: 12, paddingRight: 8, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  chipTexto: { flexShrink: 1, fontSize: 12, fontWeight: '800' },
  selo: { fontSize: 12, fontWeight: '700', color: COR_EDITOR.apoio },
  seloDeErro: { color: COR.erro },

  painel: {
    marginTop: 14, marginHorizontal: -RECUO, paddingHorizontal: RECUO, paddingVertical: 22,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COR_EDITOR.fio,
    backgroundColor: COR_EDITOR.painel,
  },

  semVersoes: {
    minHeight: 170, padding: 34, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed',
    borderColor: COR_EDITOR.vazioContorno, alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  semVersoesTitulo: { fontSize: 17, fontWeight: '700', color: COR_EDITOR.texto, textAlign: 'center' },
  semVersoesApoio: { fontSize: 14, color: COR_EDITOR.apoioDoVazio, textAlign: 'center', lineHeight: 20 },

  editor: { gap: 14 },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarFoto: { resizeMode: 'cover' },
  avatarVazio: { alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontWeight: '800', color: COR_EDITOR.papel },
  tituloDaVersao: { fontSize: 19, fontWeight: '800', color: COR_EDITOR.titulo },
  autoria: { fontSize: 12, color: COR_EDITOR.apoio },

  avisoDePeso: {
    padding: 10, borderRadius: 10,
    backgroundColor: COR_EDITOR.acaoFundo,
    fontSize: 12, lineHeight: 17, color: COR_EDITOR.texto,
  },
  acoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  acao: {
    height: 36, minWidth: 36, paddingHorizontal: 9, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: COR_EDITOR.acaoFundo,
  },
  acaoTexto: { fontSize: 12, color: COR_EDITOR.acaoIcone },
});
