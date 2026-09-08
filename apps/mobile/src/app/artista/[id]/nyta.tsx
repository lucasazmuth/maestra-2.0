import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_NYTA, RAIO } from '@maestra/core/constants/design';
import { PAYWALL_DISABLED } from '@maestra/core/constants/maestra';
import { CONVITE_DO_CAMPO, RESSALVA_DA_NYTA, saudacaoDaNyta } from '@maestra/core/constants/nytaChat';
import { useEntitlements } from '@maestra/core/hooks/useEntitlements';
import { useNytaChat } from '@maestra/core/hooks/useNytaChat';
import { useNytaConversations } from '@maestra/core/hooks/useNytaConversations';
import { acoesDoHistorico } from '@maestra/core/nucleo/acoesDaNyta';
import type { NytaChatMessage } from '@maestra/core/store/slices/nytaChat';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import { CabecalhoDoChat } from '@/casca/nyta/CabecalhoDoChat';
import { CartaoDeAcao } from '@/casca/nyta/CartaoDeAcao';
import { Conversas } from '@/casca/nyta/Conversas';
import { RecursoBloqueado } from '@/casca/nyta/RecursoBloqueado';
import { TextoDaNyta } from '@/casca/nyta/TextoDaNyta';
import { useArtistaDaRota } from '@/nucleo/artista';
import { useSessao } from '@/nucleo/sessao';

// A Nyta em tela cheia — a porta de `src/pages/NytaChat/index.tsx`.
//
// Tudo que decide a conversa (streaming, histórico, ações com confirmação, limite diário) já
// estava no `useNytaChat` do núcleo. Esta tela só desenha — e é exatamente por isso que ela
// existe: refazer a máquina de estados aqui seria criar uma Nyta diferente da da web.
//
// A resposta chega em PEDAÇOS, e isso depende da porta de `fetch` (ver `nucleo/ambiente`): o
// `fetch` do React Native devolve `Response` sem `body`, e o texto chegaria inteiro no fim,
// parecendo lentidão em vez de defeito. O app registra o `expo/fetch`, que faz streaming.
//
// A navegação aqui tem DOIS níveis, como em qualquer aplicativo de mensagem: a lista de
// conversas é o nível de trás e a conversa fica por cima dela. É o que a web faz abaixo de
// 900px, onde a coluna lateral não cabe — no celular só existe essa forma.

const MAXIMO_DE_LETRAS = 1000;
// A contagem só aparece quando começa a importar. Um "0/1000" fixo não informa nada em 99% das
// mensagens: só conta que existe um limite, e ocupa o rodapé com isso.
const AVISAR_A_PARTIR_DE = MAXIMO_DE_LETRAS - 150;

export default function Nyta() {
  const { id, pergunta } = useLocalSearchParams<{ id: string; pergunta?: string }>();
  const artista = useArtistaDaRota(id);
  const router = useRouter();
  const { sessao } = useSessao();
  const dadosDaConta = (sessao?.user.user_metadata ?? {}) as Record<string, unknown>;
  const nomeDeQuemEntrou = (dadosDaConta.full_name ?? dadosDaConta.name) as string | undefined;
  const direitos = useEntitlements();
  const [texto, setTexto] = useState('');
  const [naLista, setNaLista] = useState(false);
  const margem = useSafeAreaInsets();
  const { conversations, loading: carregandoConversas, refresh, rename, remove } =
    useNytaConversations(id);

  // A conversa nova só ganha linha no banco quando o servidor a cria, na primeira mensagem —
  // por isso é o próprio chat que avisa a hora de recarregar a lista.
  const conversaMudou = useCallback(() => { refresh(); }, [refresh]);
  const lista = useRef<FlatList<NytaChatMessage>>(null);

  const {
    messages, isStreaming, pendingToolCalls, rateLimitInfo, loadingHistory, hasMoreHistory,
    error, unavailableModules,
    conversationId,
    loadOlderMessages, sendMessage, confirmTool, cancelTool, dismissError,
    selectConversation, startNewConversation,
  } = useNytaChat('route', conversaMudou);

  /**
   * A conversa abre no FIM, e cresce por baixo.
   *
   * Havia um efeito que rolava ao mudar `messages.length`, e ele nao dava conta de ABRIR a
   * tela: quando o historico chega de uma vez, o efeito roda antes de o FlatList ter medido as
   * linhas, e o `scrollToEnd` mira uma altura que ainda nao existe. A conversa abria no topo, e
   * quem entrava tinha que rolar ate embaixo para achar o que acabou de ser dito.
   *
   * Quem sabe a altura de verdade e o `onContentSizeChange` (ver `assentar`, no FlatList). O
   * primeiro pouso e SEM animacao — animar uma rolagem de tela inteira que a pessoa nao pediu
   * mostra o historico passando voando —, e dai em diante e animado, que e o certo para o texto
   * que chega enquanto a Nyta escreve.
   */
  const jaAssentou = useRef(false);
  const assentar = useCallback(() => {
    if (!messages.length) return;
    lista.current?.scrollToEnd({ animated: jaAssentou.current });
    jaAssentou.current = true;
  }, [messages.length]);

  // Trocar de conversa e abrir outra tela: a nova tambem tem que pousar no fim, sem animacao.
  useEffect(() => { jaAssentou.current = false; }, [conversationId]);

  // Apagar a conversa aberta deixaria a tela mostrando mensagens que não existem mais.
  const excluir = useCallback(async (alvo: string) => {
    const foi = await remove(alvo);
    if (foi && alvo === conversationId) startNewConversation();
  }, [remove, conversationId, startNewConversation]);

  const enviar = useCallback(() => {
    const limpo = texto.trim();
    if (!limpo || isStreaming) return;
    sendMessage(limpo);
    setTexto('');
  }, [texto, isStreaming, sendMessage]);

  // Pergunta que chega pela rota (o "Adicionar tarefa" do Plano manda uma). Vai SOZINHA, como o
  // `openWithPrompt` da web: lá o botão abre o modal da Nyta com a pergunta já enviada.
  //
  // O `useRef` é o que impede o reenvio: sem ele, qualquer render com o mesmo parâmetro na rota
  // manda de novo — e o histórico enche de cópias da mesma frase.
  const jaPerguntou = useRef<string | null>(null);
  useEffect(() => {
    const texto = typeof pergunta === 'string' ? pergunta.trim() : '';
    if (!texto || jaPerguntou.current === texto || isStreaming) return;
    jaPerguntou.current = texto;
    sendMessage(texto);
  }, [pergunta, isStreaming, sendMessage]);

  const noLimite = !!rateLimitInfo && rateLimitInfo.count >= rateLimitInfo.limit;

  // A Nyta é do plano PRO, e a trava vem ANTES do campo de escrever.
  //
  // Sem isso o app deixava perguntar, mandava, e o servidor respondia 403: a mensagem sumia sem
  // nenhuma explicação na tela. Levei um bom tempo procurando defeito no streaming por causa
  // disso — e quem usasse o app teria a mesma impressão, sem poder investigar.
  //
  // Duas portas para o mesmo lugar, como na web: a checagem local do direito, e o 403 que o
  // servidor devolve (o que cobre a assinatura vencer com a tela aberta).
  if ((!PAYWALL_DISABLED && !direitos.isPro) || error === 'subscription_required') {
    return <RecursoBloqueado recurso="nyta" artistId={String(id)} />;
  }

  const Mensagem = ({ item }: { item: NytaChatMessage }) => {
    // As mensagens de ferramenta são o registro do que a Nyta executou; quem mostra isso é o
    // cartão de ação, não uma bolha com JSON dentro.
    // As mensagens `tool` são o registro cru do que voltou do servidor; quem mostra isso é o
    // cartão, montado a partir da mensagem da Nyta que PEDIU a ação. Uma mensagem dela sem
    // texto mas com ações não some mais: era ela que carregava o cartão.
    if (item.role === 'tool') return null;
    if (!item.content && !item.toolCalls?.length) return null;
    const doArtista = item.role === 'user';

    // A resposta da Nyta NÃO tem recipiente: nem moldura, nem avatar. É texto na própria tela,
    // na largura toda. A pergunta de quem escreve é o único recipiente da conversa, à direita.
    // Ver `COR_NYTA` para o porquê das duas regras.
    //
    // Só a Nyta escreve markdown; o que a pessoa digita fica como digitado — um `*` numa
    // pergunta não deve virar itálico.
    return doArtista ? (
      <View style={estilos.linhaDaPergunta}>
        <Text style={estilos.pergunta}>{item.content}</Text>
      </View>
    ) : (
      <View style={estilos.resposta}>
        {!!item.content && <TextoDaNyta texto={item.content} />}
        {acoesDoHistorico(item, messages, pendingToolCalls.map((a) => a.toolCallId)).map((acao) => (
          <View key={acao.toolCallId} style={estilos.acaoDoHistorico}>
            <CartaoDeAcao acao={acao} somenteLeitura />
          </View>
        ))}
      </View>
    );
  };

  if (naLista) {
    return (
      <Conversas
        conversas={conversations}
        carregando={carregandoConversas}
        ativa={conversationId}
        // Abrir ou criar conversa é o motivo da lista existir: feito isso, ela sai da frente.
        aoEscolher={(alvo) => { setNaLista(false); selectConversation(alvo); }}
        aoCriar={() => { setNaLista(false); startNewConversation(); }}
        aoRenomear={rename}
        aoExcluir={excluir}
        aoSair={() => router.push(`/artista/${id}` as never)}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // O cabeçalho do artista fica acima desta tela: sem o deslocamento, o teclado empurra a
      // conversa por baixo dele.
      keyboardVerticalOffset={110}
    >
      <CabecalhoDoChat
        artista={artista}
        aoSair={() => router.push(`/artista/${id}` as never)}
        aoAbrirConversas={() => setNaLista(true)}
      />

      {!!error && error !== 'subscription_required' && (
        <View style={estilos.erro} accessibilityRole="alert">
          <Feather name="alert-circle" size={16} color={COR.erro} />
          <Text style={estilos.erroTexto}>{error}</Text>
          <Pressable onPress={dismissError} hitSlop={10} accessibilityLabel="Fechar erro">
            <Feather name="x" size={16} color={COR.erro} />
          </Pressable>
        </View>
      )}

      {unavailableModules.length > 0 && (
        <View style={estilos.aviso}>
          <Feather name="alert-circle" size={14} color={COR_NYTA.limiteTexto} />
          <Text style={estilos.avisoTexto}>
            {unavailableModules.length === 1
              ? `O módulo "${unavailableModules[0]}" está temporariamente indisponível.`
              : `Os módulos ${unavailableModules.map((m) => `"${m}"`).join(', ')} estão temporariamente indisponíveis.`}
            {' '}A Nyta responderá com os dados dos demais módulos.
          </Text>
        </View>
      )}

      {messages.length === 0 && !loadingHistory ? (
        // A conversa em branco abre com uma SAUDAÇÃO centrada, e não com uma mensagem da Nyta se
        // apresentando em sete linhas. Aquilo tomava a primeira tela inteira e ninguém lia duas
        // vezes: quem abre o chat pela décima vez já sabe quem é a Nyta.
        <View style={estilos.saudacao}>
          <EmblemaNyta size={34} />
          <Text style={estilos.saudacaoTexto}>{saudacaoDaNyta(nomeDeQuemEntrou)}</Text>
        </View>
      ) : (
        <FlatList
          ref={lista}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={Mensagem}
          contentContainerStyle={estilos.conversa}
          // O histórico antigo carrega ao chegar no TOPO: numa conversa longa a pessoa rola pra
          // cima procurando o que já foi dito, e é ali que faltam mensagens.
          onStartReached={hasMoreHistory ? loadOlderMessages : undefined}
          onStartReachedThreshold={0.2}
          onContentSizeChange={assentar}
          ListHeaderComponent={loadingHistory ? (
            <ActivityIndicator style={estilos.carregando} color={COR.primaria} />
          ) : null}
          ListFooterComponent={(
            <>
              {pendingToolCalls.map((acao) => (
                <CartaoDeAcao
                  key={acao.toolCallId}
                  acao={acao}
                  aoConfirmar={confirmTool}
                  aoCancelar={cancelTool}
                />
              ))}
              {isStreaming && !messages[messages.length - 1]?.content && (
                <ActivityIndicator size="small" color={COR_NYTA.espera} style={estilos.espera} />
              )}
            </>
          )}
        />
      )}

      {/* A reserva de 104px para a ilha de navegação saiu junto com ela: nesta rota a barra de
          abas não é renderizada (ver `_layout.tsx`), e reservar altura para uma barra que não
          existe deixava uma tira vazia embaixo do campo. */}
      <View style={[estilos.barra, { paddingBottom: margem.bottom }]}>
        {noLimite ? (
          <View style={estilos.limite}>
            <Feather name="clock" size={18} color={COR_NYTA.limiteTitulo} />
            <View style={estilos.flex}>
              <Text style={estilos.limiteTitulo}>
                Você usou suas {rateLimitInfo?.limit} mensagens de hoje
              </Text>
              <Text style={estilos.limiteTexto}>
                Volta amanhã · {rateLimitInfo?.count}/{rateLimitInfo?.limit}
              </Text>
            </View>
          </View>
        ) : (
          <>
            {/* Um CARTÃO, e não uma linha: o texto em cima ocupando a largura toda, os
                controles numa fileira embaixo. Numa linha só, o botão de enviar comia a largura
                e uma pergunta de duas frases já rolava dentro de um campo baixinho. */}
            <View style={estilos.campo}>
              <TextInput
                style={estilos.entrada}
                value={texto}
                onChangeText={setTexto}
                placeholder={CONVITE_DO_CAMPO}
                placeholderTextColor={COR_NYTA.espacoReservado}
                maxLength={MAXIMO_DE_LETRAS}
                multiline
                editable={!isStreaming}
                accessibilityLabel={CONVITE_DO_CAMPO}
              />
              <View style={estilos.acoesDoCampo}>
                {texto.length >= AVISAR_A_PARTIR_DE && (
                  <Text style={estilos.disclaimer}>{texto.length}/{MAXIMO_DE_LETRAS}</Text>
                )}
                <Pressable
                  style={[estilos.enviar, (!texto.trim() || isStreaming) && estilos.enviarInativo]}
                  onPress={enviar}
                  disabled={!texto.trim() || isStreaming}
                  accessibilityRole="button"
                  accessibilityLabel="Enviar"
                >
                  <Feather
                    name="arrow-up"
                    size={18}
                    color={!texto.trim() || isStreaming ? COR_NYTA.espacoReservado : COR.sobrePrimaria}
                  />
                </Pressable>
              </View>
            </View>
            <Text style={[estilos.disclaimer, estilos.ressalva]}>{RESSALVA_DA_NYTA}</Text>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR_NYTA.fundo },
  flex: { flex: 1 },
  conversa: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  saudacao: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  // Grande e de peso leve: o tamanho é o que faz a linha ser a saudação da tela em vez de mais
  // um título do app, e o peso leve é o que a impede de gritar.
  saudacaoTexto: {
    maxWidth: 440, color: COR_NYTA.resposta, fontSize: 26, fontWeight: '400',
    lineHeight: 34, textAlign: 'center',
  },
  carregando: { marginBottom: 18 },

  // A resposta: sem moldura, na largura toda. A pergunta: o único recipiente, à direita.
  resposta: { marginBottom: 26 },
  linhaDaPergunta: { alignItems: 'flex-end', marginBottom: 26 },
  pergunta: {
    maxWidth: '84%',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: COR_NYTA.pergunta,
    color: COR_NYTA.perguntaTexto,
    fontSize: 15,
    lineHeight: 22,
  },
  espera: { alignSelf: 'flex-start', marginBottom: 26 },
  acaoDoHistorico: { marginTop: 12 },

  erro: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
    borderBottomWidth: 1, borderBottomColor: COR_NYTA.erroContorno, backgroundColor: COR_NYTA.erroFundo,
  },
  erroTexto: { flex: 1, color: COR.erro, fontSize: 12, lineHeight: 17 },
  aviso: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12,
    backgroundColor: COR_NYTA.limiteFundo,
  },
  avisoTexto: { flex: 1, color: COR_NYTA.limiteTexto, fontSize: 11, lineHeight: 16 },

  // Sem fio e sem faixa branca: a caixa flutua sobre o mesmo fundo da conversa. A borda que
  // separava o campo era um segundo traço a dois pixels do primeiro, e o que ela marcava — onde
  // acaba a conversa e começa o que se escreve — o próprio cartão já marca.
  barra: { paddingTop: 8, paddingHorizontal: 18 },
  campo: {
    gap: 6, paddingTop: 12, paddingHorizontal: 14, paddingBottom: 10,
    borderRadius: 20, borderWidth: 1, borderColor: COR_NYTA.campoContorno,
    backgroundColor: COR.superficie,
    shadowColor: 'rgba(105, 122, 159, .18)', shadowOpacity: 1,
    shadowOffset: { width: 0, height: 6 }, shadowRadius: 20, elevation: 3,
  },
  entrada: {
    maxHeight: 132, paddingVertical: 2,
    color: COR_NYTA.campoTexto, fontSize: 15, lineHeight: 22,
  },
  acoesDoCampo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10 },
  enviar: {
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    borderRadius: 17, backgroundColor: COR_NYTA.enviar,
  },
  enviarInativo: { backgroundColor: COR_NYTA.enviarApagado },
  disclaimer: { color: COR_NYTA.aviso, fontSize: 11 },
  // A ressalva encosta na margem do aparelho de proposito: ela e a ultima linha da tela, e os
  // 12px que havia embaixo dela somavam com os 34 do indicador de home e deixavam o campo
  // flutuando longe da borda.
  ressalva: { marginTop: 8, marginBottom: 2, textAlign: 'center' },

  limite: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1,
    borderColor: COR_NYTA.limiteContorno, backgroundColor: COR_NYTA.limiteFundo,
  },
  limiteTitulo: { color: COR_NYTA.limiteTitulo, fontSize: 13, fontWeight: '800' },
  limiteTexto: { marginTop: 3, color: COR_NYTA.limiteTexto, fontSize: 11 },
});
