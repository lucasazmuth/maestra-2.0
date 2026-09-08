import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NytaChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: ToolCall[];
  /**
   * O resultado da ação, como o servidor grava.
   *
   * Isto era `ToolResult[]`, e o tipo MENTIA: `nyta-chat/index.ts` escreve `tool_results` como
   * UM objeto (`{ tool_call_id, success, summary }`), não como lista. Ninguém percebeu porque
   * ninguém lia o campo — ele era carregado do banco e nunca desenhado. Quando o cartão de ação
   * do histórico passou a lê-lo, o `for...of` estourou "iterator method is not callable" na
   * primeira conversa com uma ação executada.
   *
   * A união aceita as duas formas de propósito: a do servidor de hoje, e a lista que linhas
   * antigas podem ter. Quem consome normaliza (ver `acoesDoHistorico`).
   */
  toolResults?: ToolResult | ToolResult[];
  createdAt: string;
  status: 'sending' | 'sent' | 'error';
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  success: boolean;
  summary: string;
  error?: string;
}

export interface PendingToolCall {
  toolCallId: string;
  name: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'confirmed' | 'cancelled' | 'executing' | 'done' | 'error';
}

export interface RateLimitInfo {
  count: number;
  limit: number;
  resetAt: string | null;
}

export interface NytaChatState {
  conversationId: string | null;
  messages: NytaChatMessage[];
  isStreaming: boolean;
  pendingToolCalls: PendingToolCall[];
  rateLimitInfo: RateLimitInfo | null;
  loadingHistory: boolean;
  hasMoreHistory: boolean;
  error: string | null;
  unavailableModules: string[];
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: NytaChatState = {
  conversationId: null,
  messages: [],
  isStreaming: false,
  pendingToolCalls: [],
  rateLimitInfo: null,
  loadingHistory: false,
  hasMoreHistory: true,
  error: null,
  unavailableModules: [],
};

// ─── Slice ────────────────────────────────────────────────────────────────────

const nytaChatSlice = createSlice({
  name: 'nytaChat',
  initialState,
  reducers: {
    setConversationId(state, action: PayloadAction<string | null>) {
      state.conversationId = action.payload;
    },

    addMessage(state, action: PayloadAction<NytaChatMessage>) {
      state.messages.push(action.payload);
    },

    updateMessage(
      state,
      action: PayloadAction<{ id: string } & Partial<NytaChatMessage>>
    ) {
      const index = state.messages.findIndex((m) => m.id === action.payload.id);
      if (index !== -1) {
        state.messages[index] = { ...state.messages[index], ...action.payload };
      }
    },

    setStreaming(state, action: PayloadAction<boolean>) {
      state.isStreaming = action.payload;
    },

    addPendingToolCall(state, action: PayloadAction<PendingToolCall>) {
      state.pendingToolCalls.push(action.payload);
    },

    updateToolCallStatus(
      state,
      action: PayloadAction<{
        toolCallId: string;
        status: PendingToolCall['status'];
      }>
    ) {
      const toolCall = state.pendingToolCalls.find(
        (tc) => tc.toolCallId === action.payload.toolCallId
      );
      if (toolCall) {
        toolCall.status = action.payload.status;
      }
    },

    setRateLimitInfo(state, action: PayloadAction<RateLimitInfo | null>) {
      state.rateLimitInfo = action.payload;
    },

    setLoadingHistory(state, action: PayloadAction<boolean>) {
      state.loadingHistory = action.payload;
    },

    setHasMoreHistory(state, action: PayloadAction<boolean>) {
      state.hasMoreHistory = action.payload;
    },

    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },

    setUnavailableModules(state, action: PayloadAction<string[]>) {
      state.unavailableModules = action.payload;
    },

    clearMessages(state) {
      state.messages = [];
      state.pendingToolCalls = [];
      state.isStreaming = false;
      state.error = null;
      state.hasMoreHistory = true;
      state.unavailableModules = [];
    },

    // Cada artista tem sua própria conversa (nyta_conversations por artist_id):
    // ao trocar de artista o estado inteiro é descartado para o thread não vazar.
    resetConversation(state) {
      // O limite diário é por USUÁRIO/dia, não por conversa — preserva o rateLimitInfo ao
      // resetar a conversa (senão o contador "zerava" visualmente e parecia liberar o limite).
      return { ...initialState, rateLimitInfo: state.rateLimitInfo };
    },

    /**
     * O histórico, na frente do que já está na tela.
     *
     * Ele PULA o que já está lá, por id. A carga do histórico pode rodar duas vezes — dois
     * efeitos, uma reconexão, um remount —, e prepender cego punha a conversa inteira em dobro
     * no store. O React reclamava ("Encountered two children with the same key") e escondia
     * metade, então o sintoma visível era só o aviso no console.
     *
     * Não é hipótese: `src/index.tsx` desligou o StrictMode citando duplicatas como motivo. O
     * lugar de resolver isso é aqui, onde a regra "uma mensagem, um id" pertence — e não numa
     * ferramenta de desenvolvimento desligada para o sintoma não aparecer.
     */
    prependMessages(state, action: PayloadAction<NytaChatMessage[]>) {
      const jaEstao = new Set(state.messages.map((m) => m.id));
      const novas = action.payload.filter((m) => !jaEstao.has(m.id));
      if (novas.length) state.messages = [...novas, ...state.messages];
    },
  },
});

export const {
  setConversationId,
  addMessage,
  updateMessage,
  setStreaming,
  addPendingToolCall,
  updateToolCallStatus,
  setRateLimitInfo,
  setLoadingHistory,
  setHasMoreHistory,
  setError,
  setUnavailableModules,
  clearMessages,
  resetConversation,
  prependMessages,
} = nytaChatSlice.actions;

export default nytaChatSlice.reducer;
