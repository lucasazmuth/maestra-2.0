import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NytaChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
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

    prependMessages(state, action: PayloadAction<NytaChatMessage[]>) {
      state.messages = [...action.payload, ...state.messages];
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
