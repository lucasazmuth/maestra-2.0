import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { CATALOG_STATUS, CATALOG_STATUS_OPTIONS } from '@maestra/core/constants/maestra';
import { COR, COR_JAM, RAIO } from '@maestra/core/constants/design';
import type {
  CatalogProject, CatalogProjectMessage, CatalogVersion,
} from '@maestra/core/interfaces/maestra';
import { supabase } from '@maestra/core/lib/supabase';
import * as catalogo from '@maestra/core/services/db/catalog';

import { FolhaDaVersao } from '@/casca/jam/FolhaDaVersao';
import { FichaDaFaixa } from '@/casca/musicas/FichaDaFaixa';
import { escolherAudio, type ArquivoEscolhido } from '@/nucleo/arquivos';
import { useSessao } from '@/nucleo/sessao';

// O Espaço JAM: a MÚSICA vista pela gravação.
//
// Mora fora das abas do artista de propósito. Na web ela é `position: fixed; inset: 0` e some o
// topo, o rail e a barra — é uma tela cheia, não mais um módulo. Aqui, portanto, é uma tela da
// pilha da raiz, e a barra de abas não aparece.
//
// A ficha técnica (BPM, Tom, Gênero, Lançamento) salva SOZINHA, com meio segundo de espera —
// são quatro campos que se ajustam no meio de uma sessão e ninguém quer parar pra apertar
// Salvar. O selo em cima diz o que aconteceu.

// Nota de peso: a folha da web pede 850, 750 e 650 em vários lugares — passos intermediários
// que só a fonte variável do navegador entrega. O React Native aceita apenas os múltiplos de
// 100, então aqui são 800, 700 e 600. É o valor mais próximo que EXISTE, não o "quase igual"
// de sempre: não há 850 para replicar.

const iniciais = (valor?: string | null) => (valor || '?').trim().slice(0, 1).toUpperCase();

const dataCurta = (valor?: string | null) => valor
  ? new Date(valor).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
  : 'Data indisponível';

// A pílula de status recebe a cor do próprio status; o texto vem da luminância — o roxo da
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

const relogio = (segundos?: number | null) => {
  if (!segundos || !Number.isFinite(segundos)) return '0:00';
  const m = Math.floor(segundos / 60);
  const s = String(Math.floor(segundos % 60)).padStart(2, '0');
  return `${m}:${s}`;
};

// Declarados FORA do componente: dentro, cada render cria uma função nova, o React desmonta o
// campo e o teclado fecha a cada letra digitada.
const Avatar = ({ nome, foto, tamanho }: { nome?: string | null; foto?: string | null; tamanho: number }) => {
  // A moldura branca é o que separa o avatar do fundo azulado do cabeçalho da versão; ela
  // engrossa junto com o círculo (3px no de 44, 2px no de 34, como na folha).
  const forma = {
    width: tamanho, height: tamanho, borderRadius: tamanho / 2,
    borderWidth: tamanho >= 44 ? 3 : 2, borderColor: COR_JAM.papel,
  } as const;
  if (foto) return <Image source={{ uri: foto }} style={[forma, estilos.avatarFoto]} />;
  return (
    <View style={[forma, estilos.avatarVazio]}>
      <Text style={[estilos.avatarTexto, { fontSize: tamanho >= 44 ? 14 : 11 }]}>{iniciais(nome)}</Text>
    </View>
  );
};

const CampoDaFicha = ({ rotulo, ultimaColuna, primeiraLinha, children }: {
  rotulo: string;
  ultimaColuna: boolean;
  primeiraLinha: boolean;
  children: React.ReactNode;
}) => (
  <View style={[
    estilos.campo,
    ultimaColuna && estilos.campoDaSegundaColuna,
    !primeiraLinha && estilos.campoComFioEmCima,
  ]}>
    <Text style={estilos.rotuloDaFicha}>{rotulo}</Text>
    {children}
  </View>
);

export default function EspacoJam() {
  const { artista: artistaId, projeto: projetoId } = useLocalSearchParams<{
    artista: string; projeto: string;
  }>();
  const margem = useSafeAreaInsets();
  const { sessao } = useSessao();
  const canal = useId();

  const usuario = sessao?.user;
  const dados = (usuario?.user_metadata ?? {}) as Record<string, unknown>;
  const meuNome = (dados.full_name || dados.name || usuario?.email || 'Você') as string;
  const minhaFoto = (dados.avatar_url || dados.picture || null) as string | null;

  const [projeto, setProjeto] = useState<CatalogProject | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [selo, setSelo] = useState<'parado' | 'salvando' | 'salvo' | 'erro'>('parado');
  const [statusAberto, setStatusAberto] = useState(false);

  const [conversa, setConversa] = useState<CatalogProjectMessage[]>([]);
  const [texto, setTexto] = useState('');
  const [enviandoTexto, setEnviandoTexto] = useState(false);
  const [erroDaConversa, setErroDaConversa] = useState('');

  const [fichaAberta, setFichaAberta] = useState(false);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [arquivoInicial, setArquivoInicial] = useState<ArquivoEscolhido | null>(null);
  const [emEdicao, setEmEdicao] = useState<CatalogVersion | null>(null);

  const [tocandoId, setTocandoId] = useState<string | null>(null);
  const player = useAudioPlayer();
  const estadoDoSom = useAudioPlayerStatus(player);

  // O que já está no banco. Comparar antes de gravar é o que impede o salvamento automático de
  // disparar no primeiro render, e de gravar de novo o que acabou de voltar do servidor.
  const gravado = useRef('');
  const assinatura = (v: CatalogProject) => JSON.stringify({
    title: v.title, status: v.status, genre: v.genre ?? '', bpm: v.bpm ?? '',
    key: v.key ?? '', release_date: v.release_date ?? '',
  });

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

  const buscarConversa = useCallback(async () => {
    if (!projetoId) return;
    try {
      setConversa(await catalogo.listCatalogProjectMessages(String(projetoId)));
    } catch {
      setErroDaConversa('Não foi possível carregar o chat.');
    }
  }, [projetoId]);

  useEffect(() => { void buscar(); }, [buscar]);
  useEffect(() => { void buscarConversa(); }, [buscarConversa]);

  // O chat é ao vivo: duas pessoas na mesma música é o caso de uso da tela. O sufixo do `useId`
  // está aqui pela mesma razão de sempre — canal com nome repetido recusa o segundo `.on()`.
  useEffect(() => {
    if (!projetoId) return undefined;
    const inscricao = supabase
      .channel(`jam-projeto-${projetoId}-${canal}`)
      .on(
        'postgres_changes',
        {
          event: '*', schema: 'public', table: 'catalog_project_messages',
          filter: `project_id=eq.${projetoId}`,
        },
        () => { void buscarConversa(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(inscricao); };
  }, [buscarConversa, projetoId, canal]);

  // Meio segundo depois da última tecla. Menos que isso grava a cada letra do BPM.
  useEffect(() => {
    if (!projeto || assinatura(projeto) === gravado.current) return undefined;
    const conta = setTimeout(async () => {
      setSelo('salvando');
      try {
        const salvo = await catalogo.updateCatalogProject(projeto.id, {
          title: projeto.title, status: projeto.status, genre: projeto.genre,
          bpm: projeto.bpm, key: projeto.key, release_date: projeto.release_date,
        });
        gravado.current = assinatura({ ...projeto, ...salvo });
        setSelo('salvo');
      } catch {
        setSelo('erro');
      }
    }, 650);
    return () => clearTimeout(conta);
  }, [projeto]);

  const versoes = useMemo(
    () => (projeto?.versions ?? []).slice().sort((a, b) => b.version_number - a.version_number),
    [projeto],
  );

  const mudar = (parte: Partial<CatalogProject>) =>
    setProjeto((atual) => (atual ? { ...atual, ...parte } : atual));

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

  // O botão Upload abre direto os arquivos: escolher o áudio é o que a pessoa veio fazer. A
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

  const enviarTexto = async () => {
    const conteudo = texto.trim();
    if (!projeto || !conteudo || enviandoTexto) return;
    setEnviandoTexto(true);
    setErroDaConversa('');
    try {
      const enviada = await catalogo.createCatalogProjectMessage({
        project_id: projeto.id,
        author_id: usuario?.id ?? null,
        author_name: meuNome,
        author_avatar: minhaFoto,
        text: conteudo,
      });
      setConversa((atual) => (atual.some((m) => m.id === enviada.id) ? atual : [...atual, enviada]));
      setTexto('');
    } catch {
      setErroDaConversa('Não foi possível enviar. Tente novamente.');
    } finally {
      setEnviandoTexto(false);
    }
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
      <KeyboardAvoidingView
        style={estilos.tela}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            estilos.rolagem,
            { paddingTop: margem.top + 22, paddingBottom: 36 + margem.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* A etiqueta vira um kicker no topo: com o cabeçalho quebrando em linhas ela caía
              em cima da pílula de status. */}
          <Text style={estilos.etiqueta}>ESPAÇO JAM</Text>

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
              <Text style={estilos.nomeDaMusica} numberOfLines={1}>{projeto.title}</Text>
            </View>

            <Pressable
              style={[estilos.pilula, { backgroundColor: status.fundo }]}
              onPress={() => setStatusAberto((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={`Status: ${rotuloDoStatus}. Toque para trocar.`}
            >
              <Text style={[estilos.pilulaTexto, { color: status.texto }]} numberOfLines={1}>
                {rotuloDoStatus}
              </Text>
              <Feather name="chevron-down" size={11} color={status.texto} />
            </Pressable>

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

          {statusAberto && (
            <View style={estilos.listaDeStatus}>
              {CATALOG_STATUS_OPTIONS.map((opcao) => {
                const cores = coresDoStatus(opcao.id);
                return (
                  <Pressable
                    key={opcao.id}
                    style={estilos.opcaoDeStatus}
                    onPress={() => { mudar({ status: opcao.id }); setStatusAberto(false); }}
                    accessibilityRole="button"
                    accessibilityLabel={opcao.label}
                  >
                    <View style={[estilos.bolinha, { backgroundColor: cores.fundo }]} />
                    <Text style={estilos.opcaoTexto}>{opcao.label}</Text>
                    {projeto.status === opcao.id && (
                      <Feather name="check" size={15} color={COR.primaria} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          {selo !== 'parado' && (
            <Text style={estilos.selo} accessibilityLiveRegion="polite">
              {selo === 'salvando' ? 'Salvando…' : selo === 'erro' ? 'Falha ao salvar' : 'Salvo automaticamente'}
            </Text>
          )}

          {/* O painel sangra até as bordas: numa tela estreita, o recuo da página somado ao dele
              deixava pouco para o conteúdo, e a moldura não separava nada — é o único bloco. */}
          <View style={estilos.painel}>
            <View style={estilos.ficha}>
              <CampoDaFicha rotulo="BPM" ultimaColuna={false} primeiraLinha>
                <TextInput
                  style={estilos.valorDaFicha}
                  value={projeto.bpm ?? ''}
                  onChangeText={(t) => mudar({ bpm: t })}
                  placeholder="—"
                  placeholderTextColor={COR_JAM.rotulo}
                  keyboardType="number-pad"
                  accessibilityLabel="BPM"
                />
              </CampoDaFicha>
              <CampoDaFicha rotulo="TOM" ultimaColuna primeiraLinha>
                <TextInput
                  style={estilos.valorDaFicha}
                  value={projeto.key ?? ''}
                  onChangeText={(t) => mudar({ key: t })}
                  placeholder="—"
                  placeholderTextColor={COR_JAM.rotulo}
                  accessibilityLabel="Tom"
                />
              </CampoDaFicha>
              <CampoDaFicha rotulo="GÊNERO" ultimaColuna={false} primeiraLinha={false}>
                <TextInput
                  style={estilos.valorDaFicha}
                  value={projeto.genre ?? ''}
                  onChangeText={(t) => mudar({ genre: t })}
                  placeholder="—"
                  placeholderTextColor={COR_JAM.rotulo}
                  accessibilityLabel="Gênero"
                />
              </CampoDaFicha>
              <CampoDaFicha rotulo="LANÇAMENTO" ultimaColuna primeiraLinha={false}>
                <Text style={estilos.valorDaFicha}>
                  {projeto.release_date
                    ? new Date(`${projeto.release_date}T12:00:00`).toLocaleDateString('pt-BR')
                    : '—'}
                </Text>
              </CampoDaFicha>
            </View>

            <View style={estilos.linhaDoUpload}>
              <Pressable
                style={estilos.upload}
                onPress={subir}
                accessibilityRole="button"
                accessibilityLabel="Enviar uma versão"
              >
                <Feather name="upload" size={16} color={COR_JAM.papel} />
                <Text style={estilos.uploadTexto}>Upload</Text>
              </Pressable>
            </View>

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
                          <Feather
                            name={tocando ? 'pause-circle' : 'play-circle'}
                            size={46}
                            color={versao.audio_file ? COR.primaria : COR_JAM.estrela}
                          />
                        </Pressable>
                        {versao.audio_file ? (
                          <View style={estilos.flex}>
                            {/* A onda do WaveSurfer não existe aqui: ela desenha a partir do
                                arquivo inteiro baixado, e o app toca por streaming. A barra diz
                                a mesma coisa que a onda dizia de útil — onde a faixa está. */}
                            <View style={estilos.trilho}>
                              <View
                                style={[
                                  estilos.progresso,
                                  {
                                    width: noAr && estadoDoSom.duration
                                      ? `${Math.min(100, (estadoDoSom.currentTime / estadoDoSom.duration) * 100)}%`
                                      : '0%',
                                  },
                                ]}
                              />
                            </View>
                            <Text style={estilos.tempo}>
                              {noAr
                                ? `${relogio(estadoDoSom.currentTime)} / ${relogio(estadoDoSom.duration)}`
                                : versao.duration || '—'}
                            </Text>
                          </View>
                        ) : (
                          <Text style={estilos.semAudioTexto}>Nenhum áudio anexado</Text>
                        )}
                      </View>

                      <View style={estilos.rodapeDaVersao}>
                        <Text style={estilos.autoria} numberOfLines={2}>
                          {versao.author_name || 'Autor não identificado'} · {dataCurta(versao.created_at)}
                        </Text>
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
                  );
                })}
              </View>
            )}
          </View>

          <View style={estilos.painelDoChat}>
            <View style={estilos.cabecalhoDoChat}>
              <Text style={estilos.tituloDoChat}>Chat do projeto</Text>
              <View style={estilos.contagem}>
                <Text style={estilos.contagemTexto}>
                  {conversa.length} {conversa.length === 1 ? 'mensagem' : 'mensagens'}
                </Text>
              </View>
            </View>

            <View style={estilos.mensagens}>
              {conversa.length === 0 ? (
                <View style={estilos.chatVazio}>
                  <View style={estilos.iconeDoChatVazio}>
                    <Feather name="message-circle" size={22} color={COR.primaria} />
                  </View>
                  <Text style={estilos.chatVazioTitulo}>Comece a conversa</Text>
                  <Text style={estilos.chatVazioApoio}>
                    Alinhe decisões do projeto sem misturar com os comentários marcados no áudio.
                  </Text>
                </View>
              ) : (
                conversa.map((fala) => (
                  <View key={fala.id} style={estilos.mensagem}>
                    <Avatar nome={fala.author_name} foto={fala.author_avatar} tamanho={34} />
                    <View style={estilos.flex}>
                      <Text style={estilos.autorDaMensagem}>{fala.author_name}</Text>
                      <Text style={estilos.dataDaMensagem}>{dataCurta(fala.created_at)}</Text>
                      <Text style={estilos.textoDaMensagem}>{fala.text}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={estilos.compositor}>
              <TextInput
                style={estilos.entradaDoChat}
                value={texto}
                onChangeText={setTexto}
                maxLength={5000}
                placeholder="Escreva uma mensagem…"
                placeholderTextColor={COR_JAM.rotulo}
                editable={!enviandoTexto}
                accessibilityLabel="Mensagem para o chat do projeto"
              />
              <Pressable
                style={[estilos.enviar, (!texto.trim() || enviandoTexto) && estilos.enviarApagado]}
                onPress={enviarTexto}
                disabled={!texto.trim() || enviandoTexto}
                accessibilityRole="button"
                accessibilityLabel="Enviar mensagem"
              >
                {enviandoTexto
                  ? <ActivityIndicator size="small" color={COR_JAM.papel} />
                  : <Feather name="send" size={16} color={COR_JAM.papel} />}
              </Pressable>
            </View>

            {!!erroDaConversa && <Text style={estilos.erroDoChat}>{erroDaConversa}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
        herdar={{ bpm: projeto.bpm, key: projeto.key, genre: projeto.genre }}
        autor={{ id: usuario?.id, nome: meuNome, foto: minhaFoto }}
        arquivoInicial={arquivoInicial}
        aoFechar={() => { setFolhaAberta(false); setEmEdicao(null); setArquivoInicial(null); }}
        aoSalvar={buscar}
        aoExcluir={aoExcluirVersao}
      />

      <FichaDaFaixa
        aberta={fichaAberta}
        artistaId={String(artistaId)}
        faixa={catalogo.catalogProjectToItem(
          projeto,
          (projeto.versions ?? []).find((v) => v.id === projeto.primary_version_id),
        )}
        generos={projeto.genre ? [projeto.genre] : []}
        autor={{ id: usuario?.id, nome: meuNome }}
        aoFechar={() => setFichaAberta(false)}
        aoSalvar={() => { setFichaAberta(false); void buscar(); }}
        // Excluir a música daqui deixa a tela sem assunto: volta para a lista.
        aoExcluir={() => { setFichaAberta(false); voltar(); }}
        aoMudarVersoes={buscar}
      />
    </LinearGradient>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  espera: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  vazioTexto: { fontSize: 15, color: COR_JAM.apoio },
  voltarTexto: { fontSize: 14, fontWeight: '800', color: COR.primaria },

  rolagem: { paddingHorizontal: 18 },
  etiqueta: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.76, textTransform: 'uppercase',
    color: COR_JAM.rotulo, textAlign: 'center', marginBottom: 10,
  },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  redondo: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COR_JAM.fio, backgroundColor: COR_JAM.botaoRedondo,
  },
  nomeDaMusica: { fontSize: 25, fontWeight: '800', letterSpacing: -0.625, color: COR_JAM.texto },
  pilula: {
    minHeight: 40, maxWidth: 132, paddingLeft: 14, paddingRight: 10, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  pilulaTexto: { flexShrink: 1, fontSize: 12, fontWeight: '800' },
  listaDeStatus: {
    marginTop: 10, borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_JAM.fio,
    backgroundColor: COR_JAM.papel, overflow: 'hidden',
  },
  opcaoDeStatus: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  opcaoTexto: { flex: 1, fontSize: 14, fontWeight: '700', color: COR_JAM.texto },
  selo: { marginTop: 10, fontSize: 12, fontWeight: '700', color: COR_JAM.apoio },

  painel: {
    marginTop: 18, marginHorizontal: -18, paddingHorizontal: 18, paddingVertical: 22,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COR_JAM.fio,
    backgroundColor: COR_JAM.painel,
  },
  ficha: { flexDirection: 'row', flexWrap: 'wrap' },
  campo: { width: '50%', paddingVertical: 14, paddingRight: 14 },
  campoDaSegundaColuna: { paddingLeft: 14, paddingRight: 0, borderLeftWidth: 1, borderLeftColor: COR_JAM.fio },
  campoComFioEmCima: { borderTopWidth: 1, borderTopColor: COR_JAM.fio },
  rotuloDaFicha: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.76, textTransform: 'uppercase',
    color: COR_JAM.rotulo, marginBottom: 10,
  },
  valorDaFicha: { minHeight: 25, padding: 0, fontSize: 16, fontWeight: '600', color: COR_JAM.texto },

  linhaDoUpload: { marginVertical: 26, flexDirection: 'row' },
  upload: {
    minWidth: 132, minHeight: 48, paddingHorizontal: 15, borderRadius: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COR.primaria,
    shadowColor: 'rgba(47, 96, 246, .24)', shadowOpacity: 1,
    shadowOffset: { width: 0, height: 14 }, shadowRadius: 28, elevation: 6,
  },
  uploadTexto: { fontSize: 15, fontWeight: '800', color: COR_JAM.papel },

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
    paddingTop: 14, paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: COR_JAM.cabecaDaVersao,
  },
  avatarFoto: { resizeMode: 'cover' },
  avatarVazio: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR_JAM.avatarDe,
  },
  avatarTexto: { fontWeight: '800', color: COR_JAM.papel },
  tituloDaVersao: { fontSize: 20, fontWeight: '800', color: COR_JAM.titulo },
  crachas: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cracha: {
    paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: COR_JAM.crachaContorno, backgroundColor: COR_JAM.papel,
  },
  crachaTexto: { fontSize: 12, fontWeight: '800', color: COR_JAM.cracha },

  reproducao: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  trilho: { height: 6, borderRadius: 3, backgroundColor: COR_JAM.acaoFundo, overflow: 'hidden' },
  progresso: { height: 6, borderRadius: 3, backgroundColor: COR.primaria },
  tempo: { marginTop: 8, fontSize: 12, color: COR_JAM.apoio },
  semAudioTexto: { flex: 1, fontSize: 13, fontStyle: 'italic', color: COR_JAM.apoio },

  rodapeDaVersao: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 18, paddingBottom: 18,
  },
  autoria: { flex: 1, fontSize: 13, color: COR_JAM.apoio },
  acao: {
    height: 36, paddingHorizontal: 9, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_JAM.acaoFundo,
  },

  painelDoChat: {
    marginTop: 30, marginHorizontal: -18,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: COR_JAM.fio,
    backgroundColor: COR_JAM.painelDoChat,
  },
  cabecalhoDoChat: {
    minHeight: 74, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 10,
    borderBottomWidth: 1, borderBottomColor: COR_JAM.fio,
  },
  tituloDoChat: { fontSize: 14, fontWeight: '800', color: COR_JAM.texto },
  contagem: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: COR_JAM.acaoFundo },
  contagemTexto: { fontSize: 11, fontWeight: '700', color: COR_JAM.apoioDoVazio },
  mensagens: { padding: 22, gap: 16 },
  mensagem: { flexDirection: 'row', gap: 10 },
  autorDaMensagem: { fontSize: 13, fontWeight: '800', color: COR_JAM.texto },
  dataDaMensagem: { fontSize: 10, color: COR_JAM.rotulo, marginTop: 2 },
  textoDaMensagem: { fontSize: 13, lineHeight: 19, color: COR_JAM.legenda, marginTop: 6 },
  chatVazio: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 18 },
  iconeDoChatVazio: {
    width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_JAM.acaoFundo,
  },
  chatVazioTitulo: { fontSize: 14, fontWeight: '700', color: COR_JAM.texto },
  chatVazioApoio: { fontSize: 12, lineHeight: 18, color: COR_JAM.apoio, textAlign: 'center' },
  compositor: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 14, paddingHorizontal: 18, paddingBottom: 18,
    borderTopWidth: 1, borderTopColor: COR_JAM.fio,
  },
  entradaDoChat: {
    flex: 1, height: 42, paddingHorizontal: 11, borderRadius: 12,
    borderWidth: 1, borderColor: COR_JAM.fio, backgroundColor: COR_JAM.entradaFundo,
    fontSize: 14, color: COR_JAM.texto,
  },
  enviar: {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR.primaria,
  },
  enviarApagado: { opacity: 0.45 },
  erroDoChat: { paddingHorizontal: 18, paddingBottom: 14, fontSize: 13, color: COR.erro },
});
