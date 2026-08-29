import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_NYTA, RAIO } from '@maestra/core/constants/design';
import { PAYWALL_DISABLED } from '@maestra/core/constants/maestra';
import { useEntitlements } from '@maestra/core/hooks/useEntitlements';
import { useNytaChat } from '@maestra/core/hooks/useNytaChat';
import type { NytaChatMessage } from '@maestra/core/store/slices/nytaChat';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import { FotoDoArtista } from '@/casca/FotoDoArtista';
import { CartaoDeAcao } from '@/casca/nyta/CartaoDeAcao';
import { RecursoBloqueado } from '@/casca/nyta/RecursoBloqueado';
import { useArtistaDaRota } from '@/nucleo/artista';

// A Nyta em tela cheia — a porta de `src/pages/NytaChat/index.tsx`.
//
// Tudo que decide a conversa (streaming, histórico, ações com confirmação, limite diário) já
// estava no `useNytaChat` do núcleo. Esta tela só desenha — e é exatamente por isso que ela
// existe: refazer a máquina de estados aqui seria criar uma Nyta diferente da da web.
//
// A resposta chega em PEDAÇOS, e isso depende da porta de `fetch` (ver `nucleo/ambiente`): o
// `fetch` do React Native devolve `Response` sem `body`, e o texto chegaria inteiro no fim,
// parecendo lentidão em vez de defeito. O app registra o `expo/fetch`, que faz streaming.

const SAUDACAO =
  'Oi! Eu sou a Nyta, sua assistente estratégica aqui na Maestra. '
  + 'Pode me perguntar qualquer coisa sobre seu planejamento, músicas, agenda ou equipe — '
  + 'e eu também posso executar ações por você, sempre com sua confirmação. Como posso te ajudar?';

const MAXIMO_DE_LETRAS = 1000;

export default function Nyta() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const artista = useArtistaDaRota(id);
  const direitos = useEntitlements();
  const [texto, setTexto] = useState('');
  const margem = useSafeAreaInsets();
  const lista = useRef<FlatList<NytaChatMessage>>(null);

  const {
    messages, isStreaming, pendingToolCalls, rateLimitInfo, loadingHistory, hasMoreHistory,
    error, unavailableModules,
    loadOlderMessages, sendMessage, confirmTool, cancelTool, dismissError,
  } = useNytaChat('route');

  // A conversa cresce por baixo: sem isto, cada pedaço que chega fica fora da vista e a pessoa
  // vê a tela parada enquanto a Nyta escreve.
  useEffect(() => {
    if (messages.length) lista.current?.scrollToEnd({ animated: true });
  }, [messages.length, isStreaming]);

  const enviar = useCallback(() => {
    const limpo = texto.trim();
    if (!limpo || isStreaming) return;
    sendMessage(limpo);
    setTexto('');
  }, [texto, isStreaming, sendMessage]);

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
    return <RecursoBloqueado recurso="nyta" />;
  }

  const Mensagem = ({ item }: { item: NytaChatMessage }) => {
    // As mensagens de ferramenta são o registro do que a Nyta executou; quem mostra isso é o
    // cartão de ação, não uma bolha com JSON dentro.
    if (item.role === 'tool' || !item.content) return null;
    const doArtista = item.role === 'user';

    return (
      <View style={[estilos.linha, doArtista && estilos.linhaDoArtista]}>
        {doArtista
          ? <FotoDoArtista artista={artista} tamanho={30} />
          : <EmblemaNyta size={30} />}
        <View style={[estilos.bolha, doArtista && estilos.bolhaDoArtista]}>
          <Text style={[estilos.texto, doArtista && estilos.textoDoArtista]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={estilos.tela}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // O cabeçalho do artista fica acima desta tela: sem o deslocamento, o teclado empurra a
      // conversa por baixo dele.
      keyboardVerticalOffset={110}
    >
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
        <View style={estilos.saudacao}>
          <View style={estilos.linha}>
            <EmblemaNyta size={30} />
            <View style={estilos.bolha}>
              <Text style={estilos.texto}>{SAUDACAO}</Text>
            </View>
          </View>
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
                <View style={estilos.linha}>
                  <EmblemaNyta size={30} />
                  <View style={estilos.bolha}>
                    <ActivityIndicator size="small" color={COR_NYTA.espacoReservado} />
                  </View>
                </View>
              )}
            </>
          )}
        />
      )}

      {/* A ilha de navegação passa POR CIMA do conteúdo, então o rodapé do chat reserva a
          altura dela — os mesmos 104px que a web reserva aqui (ver NytaChat/styles.scss). Sem
          isso, o campo de escrever nasce debaixo da barra. */}
      <View style={[estilos.barra, { paddingBottom: 104 + margem.bottom }]}>
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
            <View style={estilos.campo}>
              <TextInput
                style={estilos.entrada}
                value={texto}
                onChangeText={setTexto}
                placeholder="Pergunte algo à Nyta…"
                placeholderTextColor={COR_NYTA.espacoReservado}
                maxLength={MAXIMO_DE_LETRAS}
                multiline
                editable={!isStreaming}
                accessibilityLabel="Pergunte algo à Nyta"
              />
              <Pressable
                style={[estilos.enviar, (!texto.trim() || isStreaming) && estilos.enviarInativo]}
                onPress={enviar}
                disabled={!texto.trim() || isStreaming}
                accessibilityRole="button"
                accessibilityLabel="Enviar"
              >
                <Feather name="arrow-up" size={18} color={COR.sobrePrimaria} />
              </Pressable>
            </View>
            <View style={estilos.rodapeDaBarra}>
              <Text style={estilos.disclaimer}>
                A Nyta pode cometer erros. Confira informações importantes.
              </Text>
              <Text style={estilos.disclaimer}>{texto.length}/{MAXIMO_DE_LETRAS}</Text>
            </View>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR_NYTA.fundo },
  flex: { flex: 1 },
  conversa: { padding: 24, paddingBottom: 8 },
  saudacao: { flex: 1, padding: 24 },
  carregando: { marginBottom: 18 },

  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 18 },
  linhaDoArtista: { flexDirection: 'row-reverse', alignItems: 'flex-end' },
  bolha: {
    maxWidth: '80%',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COR_NYTA.bolhaContorno,
    backgroundColor: COR_NYTA.bolha,
    // Os cantos são assimétricos e opostos entre si: é o rabinho que diz quem falou, sem
    // precisar de rótulo. Da Nyta, quadrado embaixo à esquerda; do artista, à direita.
    borderRadius: 14,
    borderBottomLeftRadius: 4,
  },
  bolhaDoArtista: {
    borderWidth: 0,
    backgroundColor: COR_NYTA.bolhaDoArtista,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 4,
  },
  texto: { color: COR_NYTA.bolhaTexto, fontSize: 13, lineHeight: 20 },
  textoDoArtista: { color: COR_NYTA.textoDoArtista },

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

  barra: {
    paddingTop: 14, paddingHorizontal: 18, paddingBottom: 12,
    borderTopWidth: 1, borderTopColor: COR_NYTA.barraContorno, backgroundColor: COR_NYTA.bolha,
  },
  campo: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 8,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_NYTA.campoContorno,
    backgroundColor: COR_NYTA.bolha,
  },
  entrada: { flex: 1, maxHeight: 96, color: COR_NYTA.bolhaTexto, fontSize: 13, lineHeight: 19, paddingVertical: 6 },
  enviar: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
    borderRadius: 9, backgroundColor: COR.primaria,
  },
  enviarInativo: { opacity: 0.4 },
  rodapeDaBarra: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  disclaimer: { color: COR_NYTA.aviso, fontSize: 10 },

  limite: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1,
    borderColor: COR_NYTA.limiteContorno, backgroundColor: COR_NYTA.limiteFundo,
  },
  limiteTitulo: { color: COR_NYTA.limiteTitulo, fontSize: 13, fontWeight: '800' },
  limiteTexto: { marginTop: 3, color: COR_NYTA.limiteTexto, fontSize: 11 },
});
