import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, Share, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { CATALOG_STATUS, CATALOG_STATUS_OPTIONS } from '@maestra/core/constants/maestra';
import { COR, COR_JAM } from '@maestra/core/constants/design';
import type { CatalogProject, CatalogVersion } from '@maestra/core/interfaces/maestra';
import * as catalogo from '@maestra/core/services/db/catalog';

import { BotaoFlutuante } from '@/casca/BotaoFlutuante';
import { Escolha } from '@/casca/Escolha';
import { ComentariosDaVersao } from '@/casca/jam/ComentariosDaVersao';
import { FolhaDaVersao } from '@/casca/jam/FolhaDaVersao';
import { Onda, SemOnda } from '@/casca/jam/Onda';
import { ResumoDaFicha } from '@/casca/jam/ResumoDaFicha';
import { FichaDaFaixa } from '@/casca/musicas/FichaDaFaixa';
import { escolherAudio, type ArquivoEscolhido } from '@/nucleo/arquivos';
import { useSessao } from '@/nucleo/sessao';

// O Espaço JAM: a MÚSICA vista pela gravação.
//
// Mora fora das abas do artista de propósito. Na web ela é `position: fixed; inset: 0` e some o
// topo, o rail e a barra — é uma tela cheia, não mais um módulo. Aqui, portanto, é uma tela da
// pilha da raiz, e a barra de abas não aparece.
//
// ─── A ordem da tela é a ordem do que a pessoa veio fazer ────────────────────
//
// Quem abre isto veio OUVIR versões, comentá-las e mandar novas. A tela anterior estava na
// ordem do banco: projeto, metadados, versões, chat — e metade do ecrã (441 pt) passava antes
// da primeira versão. Uma grelha 2×2 de BPM/tom/gênero/data, quase sempre com quatro traços,
// era o bloco mais alto da tela. O título tinha ~104 pt de largura para 25 px em peso 800.
//
// Agora: o cabeçalho é o título em duas linhas, o status virou um chip por baixo dele, a ficha
// técnica virou UMA linha (que abre a mesma ficha do lápis), e o upload flutua como o "+" do
// catálogo. As versões começam a ~200 pt.
//
// O chat do projeto saiu em 09/09/2026, por decisão do dono do produto: ficam os comentários
// da versão. A tabela e as funções do núcleo continuam lá para o dia em que ele voltar.

// Nota de peso: a folha da web pede 850, 750 e 650 em vários lugares — passos intermediários
// que só a fonte variável do navegador entrega. O React Native aceita apenas os múltiplos de
// 100, então aqui são 800, 700 e 600. É o valor mais próximo que EXISTE, não o "quase igual"
// de sempre: não há 850 para replicar.

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
  const [tocandoId, setTocandoId] = useState<string | null>(null);
  const player = useAudioPlayer();
  const estadoDoSom = useAudioPlayerStatus(player);

  // O único campo que esta tela ainda edita em linha é o STATUS, pelo chip. BPM, tom, gênero e
  // data saíram daqui para a ficha (o lápis e a linha-resumo abrem a mesma), então o salvamento
  // automático só tem uma coisa para vigiar. Comparar antes de gravar é o que impede disparar no
  // primeiro render e regravar o que acabou de voltar do servidor.
  const gravado = useRef('');
  const assinatura = (v: CatalogProject) => v.status;

  const buscar = useCallback(async () => {
    if (!projetoId) return;
    try {
      const proximo = await catalogo.getCatalogProject(String(projetoId));
      setProjeto(proximo);
      gravado.current = assinatura(proximo);
    } catch {
      setProjeto(null);
    } finally {
      setCarregando(false);
    }
  }, [projetoId]);

  useEffect(() => { void buscar(); }, [buscar]);

  // O número no balão de cada versão. O `getCatalogProject` não traz os comentários junto, e
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

  // Meio segundo depois da mudança. É o mesmo ritmo do resto do app, mesmo aqui sendo um toque só.
  useEffect(() => {
    if (!projeto || assinatura(projeto) === gravado.current) return undefined;
    const conta = setTimeout(async () => {
      setSelo('salvando');
      try {
        const salvo = await catalogo.updateCatalogProject(projeto.id, { status: projeto.status });
        gravado.current = assinatura({ ...projeto, ...salvo });
        setSelo('salvo');
      } catch {
        setSelo('erro');
      }
    }, 650);
    return () => clearTimeout(conta);
  }, [projeto]);

  // ⚠️ O "Salvo" vai embora sozinho. Antes ficava para sempre: `setSelo` nunca voltava a
  // 'parado', e a linha empurrava a tela 25 pt para baixo desde a primeira edição até sair.
  // O erro fica: é a única forma da pessoa saber que a última mudança não pegou.
  useEffect(() => {
    if (selo !== 'salvo') return undefined;
    const conta = setTimeout(() => setSelo('parado'), DURACAO_DO_SELO);
    return () => clearTimeout(conta);
  }, [selo]);

  const versoes = useMemo(
    () => (projeto?.versions ?? []).slice().sort((a, b) => b.version_number - a.version_number),
    [projeto],
  );

  /** A favorita: é dela que a linha-resumo tira o BPM e o tom, e é dela que versões novas herdam. */
  const favorita = useMemo(
    () => versoes.find((v) => v.id === projeto?.primary_version_id) ?? null,
    [versoes, projeto?.primary_version_id],
  );

  const mudar = (parte: Partial<CatalogProject>) =>
    setProjeto((atual) => (atual ? { ...atual, ...parte } : atual));

  // Tocar na onda leva a reprodução ao ponto tocado — é o `onSeek` do WaveSurfer da web. Se a
  // versão ainda não está no ar, começa por ela: sem isso, tocar na onda de uma versão parada
  // não faria nada, e o gesto mais óbvio da tela seria o único sem resposta.
  const buscarNoAudio = (versao: CatalogVersion, segundo: number) => {
    if (!versao.audio_file) return;
    if (tocandoId !== versao.id) {
      player.replace({ uri: versao.audio_file });
      setTocandoId(versao.id);
    }
    player.seekTo(segundo);
    player.play();
  };

  const tocar = (versao: CatalogVersion) => {
    if (!versao.audio_file) return;
    if (tocandoId === versao.id) {
      if (estadoDoSom.playing) player.pause(); else player.play();
      return;
    }
    player.replace({ uri: versao.audio_file });
    player.play();
    setTocandoId(versao.id);
  };

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
      await buscar();
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
            largura toda e duas linhas — antes ele disputava a fila com uma pílula de status de
            até 132 pt e sobravam-lhe ~104 pt, que é 7 a 9 caracteres. */}
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

        {/* A segunda linha: o status como um chip pequeno, e o selo de gravação ao lado. O
            status saiu da fila do título porque não é o assunto — é um atributo. */}
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

          {selo !== 'parado' && (
            <Text
              style={[estilos.selo, selo === 'erro' && estilos.seloDeErro]}
              accessibilityLiveRegion="polite"
            >
              {selo === 'salvando' ? 'Salvando…' : selo === 'erro' ? 'Falha ao salvar' : 'Salvo'}
            </Text>
          )}
        </View>

        {/* A ficha técnica numa linha. BPM e tom vêm da FAVORITA (são da gravação); gênero e
            data, da música. Tocar abre a mesma ficha do lápis. */}
        <ResumoDaFicha
          dados={{
            bpm: favorita?.bpm, tom: favorita?.key,
            genero: projeto.genre, lancamento: projeto.release_date,
          }}
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
            <View style={estilos.listaDeVersoes}>
              {versoes.map((versao) => {
                const principal = versao.id === projeto.primary_version_id;
                const noAr = tocandoId === versao.id;
                const tocando = noAr && estadoDoSom.playing;
                return (
                  <View
                    key={versao.id}
                    style={[
                      estilos.versao,
                      principal && estilos.versaoPrincipal,
                      !versao.audio_file && estilos.versaoSemAudio,
                    ]}
                  >
                    <View style={estilos.identidade}>
                      <Avatar nome={versao.author_name} foto={versao.author_avatar} tamanho={44} />
                      <View style={estilos.flex}>
                        <Text style={estilos.tituloDaVersao} numberOfLines={1}>
                          {versao.title || `Versão ${versao.version_number}`}
                        </Text>
                      </View>
                      <View style={estilos.crachas}>
                        <View style={estilos.cracha}>
                          <Text style={estilos.crachaTexto}>V{versao.version_number}</Text>
                        </View>
                        {/* Estrela em vez de etiqueta: além de dizer qual é a principal,
                            marca outra sem abrir a folha de edição. */}
                        <Pressable
                          onPress={() => alternarPrincipal(versao)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityState={{ selected: principal }}
                          accessibilityLabel={principal
                            ? `Desmarcar V${versao.version_number} como versão principal`
                            : `Tornar V${versao.version_number} a versão principal`}
                        >
                          <Feather
                            name="star"
                            size={17}
                            color={principal ? COR_JAM.estrelaAcesa : COR_JAM.estrela}
                          />
                        </Pressable>
                      </View>
                    </View>

                    <View style={estilos.reproducao}>
                      <Pressable
                        onPress={() => tocar(versao)}
                        disabled={!versao.audio_file}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={versao.audio_file
                          ? (tocando ? `Pausar V${versao.version_number}` : `Tocar V${versao.version_number}`)
                          : 'Nenhum áudio anexado'}
                      >
                        {/* O triângulo é NU: a web desenha o ícone a 42px num alvo de 46
                            sem fundo e sem anel. Circulado ele lê como botão primário e
                            disputa atenção com o botão de enviar, que é o único azul cheio. */}
                        <Feather
                          name={tocando ? 'pause' : 'play'}
                          size={42}
                          color={versao.audio_file ? COR.primaria : COR_JAM.estrela}
                        />
                      </Pressable>
                      {versao.audio_file ? (
                        <Onda
                          url={versao.audio_file}
                          segundo={noAr ? estadoDoSom.currentTime : 0}
                          // A versão sem áudio tem o cartão levemente tingido; a onda só
                          // aparece nas com áudio, então o fundo dela é sempre o branco.
                          fundo={COR_JAM.papel}
                          aoBuscar={(ponto) => buscarNoAudio(versao, ponto)}
                        />
                      ) : (
                        <SemOnda />
                      )}
                    </View>

                    <View style={estilos.rodapeDaVersao}>
                      <Text style={estilos.autoria} numberOfLines={2}>
                        {versao.author_name || 'Autor não identificado'} · {dataCurta(versao.created_at)}
                      </Text>
                      <View style={estilos.acoes}>
                        {/* "Baixar" no celular é a folha de partilha: dela sai "Guardar em
                            Ficheiros", que é o equivalente do download do navegador, e ainda
                            o AirDrop e o WhatsApp — que é como a mix costuma circular. */}
                        {!!versao.audio_file && (
                          <Pressable
                            style={estilos.acao}
                            onPress={() => Share.share({ url: versao.audio_file as string })}
                            accessibilityRole="button"
                            accessibilityLabel={`Baixar ou compartilhar V${versao.version_number}`}
                          >
                            <Feather name="download" size={15} color={COR_JAM.acaoIcone} />
                          </Pressable>
                        )}
                        <Pressable
                          style={estilos.acao}
                          onPress={() => setComentando(versao)}
                          accessibilityRole="button"
                          accessibilityLabel={
                            `Abrir ${contagens[versao.id] ?? 0} comentários de V${versao.version_number}`
                          }
                        >
                          <Feather name="message-circle" size={15} color={COR_JAM.acaoIcone} />
                          <Text style={estilos.acaoTexto}>{contagens[versao.id] ?? 0}</Text>
                        </Pressable>
                        <Pressable
                          style={estilos.acao}
                          onPress={() => router.push(`/jam/${artistaId}/${projeto.id}/${versao.id}`)}
                          accessibilityRole="button"
                          accessibilityLabel={
                            `Abrir a visualização completa de V${versao.version_number}`
                          }
                        >
                          <Feather name="maximize-2" size={15} color={COR_JAM.acaoIcone} />
                        </Pressable>
                        <Pressable
                          style={estilos.acao}
                          onPress={() => { setArquivoInicial(null); setEmEdicao(versao); setFolhaAberta(true); }}
                          accessibilityRole="button"
                          accessibilityLabel={`Mais ações para V${versao.version_number}`}
                        >
                          <Feather name="more-vertical" size={15} color={COR_JAM.acaoIcone} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })}
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
        // Herda da FAVORITA: é a gravação de referência, e é dela que o andamento e o tom de
        // uma versão nova provavelmente partem. O gênero continua da música.
        herdar={{ bpm: favorita?.bpm, key: favorita?.key, genre: projeto.genre }}
        autor={{ id: usuario?.id, nome: meuNome, foto: minhaFoto }}
        arquivoInicial={arquivoInicial}
        aoFechar={() => { setFolhaAberta(false); setEmEdicao(null); setArquivoInicial(null); }}
        aoSalvar={buscar}
        aoExcluir={aoExcluirVersao}
      />

      <FichaDaFaixa
        aberta={fichaAberta}
        artistaId={String(artistaId)}
        faixa={catalogo.catalogProjectToItem(projeto, favorita ?? undefined)}
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
    flexDirection: 'row', alignItems: 'center', gap: 10,
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

  listaDeVersoes: { gap: 14 },
  versao: {
    borderRadius: 18, borderWidth: 1, borderColor: COR_JAM.contornoDaVersao,
    backgroundColor: COR_JAM.papel, overflow: 'hidden',
    shadowColor: 'rgba(74, 99, 145, .1)', shadowOpacity: 1,
    shadowOffset: { width: 0, height: 20 }, shadowRadius: 50, elevation: 3,
  },
  versaoPrincipal: { borderColor: COR_JAM.contornoDaPrincipal },
  versaoSemAudio: { backgroundColor: COR_JAM.semAudio },
  identidade: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 14, paddingHorizontal: RECUO, paddingBottom: 10,
    backgroundColor: COR_JAM.cabecaDaVersao,
  },
  avatarFoto: { resizeMode: 'cover' },
  avatarVazio: { alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontWeight: '800', color: COR_JAM.papel },
  tituloDaVersao: { fontSize: 20, fontWeight: '800', color: COR_JAM.titulo },
  crachas: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cracha: {
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: COR_JAM.crachaContorno, backgroundColor: COR_JAM.papel,
  },
  crachaTexto: { fontSize: 12, fontWeight: '800', color: COR_JAM.cracha },

  reproducao: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16, paddingHorizontal: RECUO,
  },

  rodapeDaVersao: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: RECUO, paddingBottom: RECUO,
  },
  autoria: { flex: 1, fontSize: 13, color: COR_JAM.apoio },
  acoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  acao: {
    height: 36, minWidth: 36, paddingHorizontal: 9, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: COR_JAM.acaoFundo,
  },
  acaoTexto: { fontSize: 12, color: COR_JAM.acaoIcone },
});
