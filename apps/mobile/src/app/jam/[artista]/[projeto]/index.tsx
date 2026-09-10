import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';

import { ehPistaDaMix, montagemDaVersao, pistasDaGravacao } from '@maestra/core/audio/pistasDaVersao';
import { useMesa } from '@maestra/core/audio/useMesa';
import {
  CATALOG_STATUS, CATALOG_STATUS_OPTIONS, MEMORIA_DE_AVISO_BYTES,
} from '@maestra/core/constants/maestra';
import { COR, COR_JAM } from '@maestra/core/constants/design';
import type { CatalogProject, CatalogVersion, CatalogVersionFile } from '@maestra/core/interfaces/maestra';
import { BALDE_DO_CATALOGO, caminhoNoBalde, removerArquivo } from '@maestra/core/services/armazenamento';
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
import { Transporte } from '@/casca/jam/mesa/Transporte';
import { FichaDaFaixa } from '@/casca/musicas/FichaDaFaixa';
import { buscarNativo, criarContextoNativo } from '@/nucleo/audio/contextoNativo';
import { useInterrupcoesDeAudio } from '@/nucleo/audio/interrupcoes';
import { escolherAudio, type ArquivoEscolhido } from '@/nucleo/arquivos';
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
  const cor = CATALOG_STATUS[status as keyof typeof CATALOG_STATUS]?.color || COR_JAM.statusPadrao;
  const [r, g, b] = paraRgb(cor);
  const clara = (r * 299 + g * 587 + b * 114) / 1000 > 165;
  return { fundo: cor, texto: clara ? COR_JAM.tintaEscura : COR_JAM.papel };
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
    borderWidth: tamanho >= 44 ? 3 : 2, borderColor: COR_JAM.papel,
  } as const;
  if (foto) return <Image source={{ uri: foto }} style={[forma, estilos.avatarFoto]} />;
  // Sem foto entra o degradê roxo→azul da web, e não um roxo chapado: ele é a passagem entre a
  // cor da marca e a cor de ação, e é o que dá ao avatar vazio o mesmo peso do que tem foto.
  return (
    <LinearGradient
      colors={[COR_JAM.avatarDe, COR_JAM.avatarAte]}
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

  const usuario = sessao?.user;
  const dados = (usuario?.user_metadata ?? {}) as Record<string, unknown>;
  const meuNome = (dados.full_name || dados.name || usuario?.email || 'Você') as string;
  const minhaFoto = (dados.avatar_url || dados.picture || null) as string | null;

  const [projeto, setProjeto] = useState<CatalogProject | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [selo, setSelo] = useState<'parado' | 'salvando' | 'salvo' | 'erro'>('parado');
  const [statusAberto, setStatusAberto] = useState(false);

  const [fichaAberta, setFichaAberta] = useState(false);
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

  // ⚠️ O APP AINDA É A MESA, e não o editor. A linha do tempo — clipes que se arrastam, tesoura,
  // régua — entrou primeiro na web, por decisão do dono do produto: a referência é de desktop
  // (220px de lateral e 2400px de linha do tempo) e num telemóvel de 390pt ela precisa de um
  // desenho próprio, com zoom e arrasto de dedo. Até lá, o app lê o MESMO modelo (pistas e
  // clipes) e toca-o empilhado, com mutar, solo e volume.
  //
  // O que saiu daqui foi só a EDIÇÃO dos stems (enviar, renomear, mover, remover): mexer numa
  // montagem que a tela não mostra seria editar às cegas. Envia-se e monta-se na web; aqui
  // ouve-se, comenta-se e manda-se gravação nova.
  const stems = useMemo(() => pistasDaGravacao(aberta), [aberta]);
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

  const voltar = () => {
    if (router.canGoBack()) router.back();
    else router.replace(`/artista/${artistaId}/catalogo`);
  };

  if (carregando) {
    return (
      <LinearGradient colors={[COR_JAM.fundoDe, COR_JAM.fundoAte]} style={estilos.espera}>
        <ActivityIndicator color={COR.primaria} />
      </LinearGradient>
    );
  }

  if (!projeto) {
    return (
      <LinearGradient colors={[COR_JAM.fundoDe, COR_JAM.fundoAte]} style={estilos.espera}>
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
    <LinearGradient colors={[COR_JAM.fundoDe, COR_JAM.fundoAte]} style={estilos.tela}>
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
            <Feather name="arrow-left" size={18} color={COR_JAM.texto} />
          </Pressable>

          <View style={estilos.flex}>
            <Text style={estilos.nomeDaMusica} numberOfLines={2}>{projeto.title}</Text>
          </View>

          {/* Editar daqui é editar a MÚSICA — o Espaço Jam É o projeto. É a mesma ficha do
              catálogo, e não um formulário próprio: um segundo formulário com um subconjunto
              dos campos faria parecer outra entidade. */}
          <Pressable
            style={estilos.redondo}
            onPress={() => setFichaAberta(true)}
            accessibilityRole="button"
            accessibilityLabel="Editar informações da música"
          >
            <Feather name="edit-2" size={16} color={COR_JAM.texto} />
          </Pressable>
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
                        color={principalAberta ? COR_JAM.estrelaAcesa : COR_JAM.estrela}
                      />
                    </Pressable>
                  </View>

                  {/* UM transporte para a gravação inteira. É ele que diz, sem uma palavra, que
                      as pistas abaixo tocam JUNTAS. */}
                  <Transporte
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
                  />

                  {/* O aviso de peso vem ANTES de descodificar, com a conta do tamanho dos
                      ficheiros: depois de descodificar já não há o que avisar. */}
                  {pesado && (
                    <Text style={estilos.avisoDePeso}>
                      São muitas pistas grandes para um celular. Se o app fechar sozinho, deixe
                      menos pistas nesta gravação.
                    </Text>
                  )}

                  {/* A ordem das linhas é a das PISTAS (posição no banco), e não a da mesa —
                      para ela, que toca tudo ao mesmo tempo, ordem nenhuma significa nada. */}
                  <View>
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
                        <Feather name="download" size={15} color={COR_JAM.acaoIcone} />
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
                      <Feather name="message-circle" size={15} color={COR_JAM.acaoIcone} />
                      <Text style={estilos.acaoTexto}>{contagens[aberta.id] ?? 0}</Text>
                    </Pressable>
                    <Pressable
                      style={estilos.acao}
                      onPress={() => router.push(`/jam/${artistaId}/${projeto.id}/${aberta.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir a visualização completa de V${aberta.version_number}`}
                    >
                      <Feather name="maximize-2" size={15} color={COR_JAM.acaoIcone} />
                    </Pressable>
                    <Pressable
                      style={estilos.acao}
                      onPress={() => { setArquivoInicial(null); setEmEdicao(aberta); setFolhaAberta(true); }}
                      accessibilityRole="button"
                      accessibilityLabel={`Mais ações para V${aberta.version_number}`}
                    >
                      <Feather name="more-vertical" size={15} color={COR_JAM.acaoIcone} />
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

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  espera: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  vazioTexto: { fontSize: 15, color: COR_JAM.apoio },
  voltarTexto: { fontSize: 14, fontWeight: '800', color: COR.primaria },

  rolagem: { paddingHorizontal: RECUO },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  redondo: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_JAM.fio, backgroundColor: COR_JAM.botaoRedondo,
  },
  nomeDaMusica: {
    fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.55, color: COR_JAM.texto,
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
  selo: { fontSize: 12, fontWeight: '700', color: COR_JAM.apoio },
  seloDeErro: { color: COR.erro },

  painel: {
    marginTop: 14, marginHorizontal: -RECUO, paddingHorizontal: RECUO, paddingVertical: 22,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COR_JAM.fio,
    backgroundColor: COR_JAM.painel,
  },

  semVersoes: {
    minHeight: 170, padding: 34, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed',
    borderColor: COR_JAM.vazioContorno, alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  semVersoesTitulo: { fontSize: 17, fontWeight: '700', color: COR_JAM.texto, textAlign: 'center' },
  semVersoesApoio: { fontSize: 14, color: COR_JAM.apoioDoVazio, textAlign: 'center', lineHeight: 20 },

  editor: { gap: 14 },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarFoto: { resizeMode: 'cover' },
  avatarVazio: { alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontWeight: '800', color: COR_JAM.papel },
  tituloDaVersao: { fontSize: 19, fontWeight: '800', color: COR_JAM.titulo },
  autoria: { fontSize: 12, color: COR_JAM.apoio },

  avisoDePeso: {
    padding: 10, borderRadius: 10,
    backgroundColor: COR_JAM.acaoFundo,
    fontSize: 12, lineHeight: 17, color: COR_JAM.texto,
  },
  acoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  acao: {
    height: 36, minWidth: 36, paddingHorizontal: 9, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: COR_JAM.acaoFundo,
  },
  acaoTexto: { fontSize: 12, color: COR_JAM.acaoIcone },
});
