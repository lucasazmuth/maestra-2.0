# Implementation Plan: Nyta MVP — Chat Livre com IA

## Overview

Implementação incremental do Nyta MVP: migração de banco para persistência de conversas, Edge Function `nyta-chat` com streaming SSE e function calling via Groq, pipeline RAG com busca semântica, tool definitions com confirmação visual, Redux slice + hook dedicado, e UI de chat full-screen com integração na sidebar.

A implementação segue a ordem: Migração DB → Edge Function core (auth, rate limit, streaming) → RAG pipeline → Tool definitions → Frontend state (Redux + hook) → Componentes UI → Integração na sidebar e roteamento.

## Tasks

- [x] 1. Database migration and schema setup
  - [x] 1.1 Create migration for `nyta_conversations` and `nyta_messages` tables
    - Create `nyta_conversations` table with `id` (uuid PK), `user_id` (FK → auth.users), `artist_id` (FK → artists), `created_at`, `updated_at`, UNIQUE(user_id, artist_id)
    - Create `nyta_messages` table with `id`, `conversation_id` (FK ON DELETE CASCADE), `role` (CHECK IN user/assistant/tool), `content`, `tool_calls` (jsonb), `tool_results` (jsonb), `created_at`, CHECK constraint for content_required
    - Create index `idx_nyta_messages_conv_created` on (conversation_id, created_at DESC)
    - Create partial index `idx_nyta_messages_rate_limit` on (conversation_id, created_at) WHERE role = 'user'
    - Enable RLS on both tables with appropriate policies
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 1.6, 1.8_

- [x] 2. Edge Function — Core infrastructure (auth, validation, rate limiting)
  - [x] 2.1 Create `nyta-chat` Edge Function with JWT validation and request parsing
    - Create `supabase/functions/nyta-chat/index.ts`
    - Implement CORS headers and OPTIONS handler
    - Validate JWT from Authorization header, extract `user_id`
    - Return HTTP 401 for missing/invalid JWT
    - Parse request body and validate `action` field ('message' | 'confirm')
    - _Requirements: 2.7, 2.8_

  - [x] 2.2 Implement request validation for message action
    - Validate `message` field is present and ≤ 2000 characters
    - Validate `artist_id` field is present and is a valid UUID
    - Return HTTP 400 with descriptive JSON error for validation failures
    - _Requirements: 2.11_

  - [ ]* 2.3 Write property test for input validation (Property 5)
    - **Property 5: Input validation rejects oversized and malformed requests**
    - Generate arbitrary strings > 2000 chars, missing fields, empty bodies
    - Verify HTTP 400 without DB persistence or Groq call
    - **Validates: Requirements 2.11**

  - [x] 2.4 Implement subscription validation middleware
    - Query user's subscription status (active, or overdue within 7-day grace)
    - Return HTTP 403 with `error: 'subscription_required'` if invalid
    - Skip validation when `PAYWALL_DISABLED` env var is `true`
    - _Requirements: 7.3, 7.4, 7.7_

  - [ ]* 2.5 Write property test for subscription validation (Property 13)
    - **Property 13: Subscription validation gates access**
    - Generate arbitrary subscription states (expired, overdue beyond 7 days, cancelled)
    - Verify HTTP 403 with correct error body when PAYWALL_DISABLED is false
    - **Validates: Requirements 7.3, 7.4**

  - [x] 2.6 Implement rate limiting logic
    - Count user-role messages for (user_id, artist_id) on current UTC date
    - Return HTTP 429 with `error: 'rate_limit_exceeded'` and `resetAt` if count ≥ 100
    - Return HTTP 503 if rate limit DB query fails (safe default)
    - _Requirements: 6.1, 6.2, 6.5, 6.6_

  - [ ]* 2.7 Write property test for rate limiter (Property 12)
    - **Property 12: Rate limiter rejects at threshold**
    - Generate message counts at boundaries (99, 100, 101)
    - Verify rejection at ≥ 100 with HTTP 429 and no Groq call
    - **Validates: Requirements 6.1, 6.2, 6.5**

- [x] 3. Checkpoint — Core Edge Function validation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Edge Function — Conversation management and streaming
  - [x] 4.1 Implement conversation get-or-create logic
    - Query existing conversation for (user_id, artist_id) pair
    - Create new conversation if none exists (auto-create on first message)
    - Persist user message to `nyta_messages` table
    - _Requirements: 1.5, 1.1_

  - [x] 4.2 Implement conversation context loading (last 20 messages)
    - Load min(N, 20) most recent messages from conversation
    - Format messages for Groq API call (role, content, tool_calls/results)
    - _Requirements: 2.9_

  - [ ]* 4.3 Write property test for context window (Property 4)
    - **Property 4: Conversation context window is bounded**
    - Generate conversations of length 0, 1, 19, 20, 21, 100
    - Verify exactly min(N, 20) messages are included in chronological order
    - **Validates: Requirements 2.9**

  - [x] 4.4 Implement Groq API streaming with SSE response
    - Call Groq API with model `llama-3.3-70b-versatile`, streaming enabled
    - Set response Content-Type to `text/event-stream`
    - Stream text chunks as `type: 'text'` events
    - Emit `type: 'done'` event with `message_id` on completion
    - Persist complete assistant message after stream finishes
    - Handle Groq timeout (30s) with `type: 'error'` SSE event
    - _Requirements: 2.1, 2.10, 1.1_

  - [x] 4.5 Implement system prompt with Nyta persona
    - Define system prompt in Portuguese with Nyta persona (consultora estratégica da indústria musical brasileira)
    - Include available tools definition and instructions for confirmation before destructive actions
    - _Requirements: 2.2_

  - [x] 4.6 Implement tool_call detection and SSE emission (no auto-execution)
    - When Groq returns tool_call, emit SSE event `type: 'tool_call'` with tool_call_id, name, arguments
    - Do NOT execute tool — wait for frontend confirmation
    - Close stream with `type: 'done'` after emitting tool_call events
    - _Requirements: 2.4_

  - [ ]* 4.7 Write property test for tool calls not auto-executed (Property 3)
    - **Property 3: Tool calls are never auto-executed**
    - Generate arbitrary tool_call responses from Groq mock
    - Verify SSE events of type `tool_call` are emitted and no DB writes occur
    - **Validates: Requirements 2.4**

- [x] 5. Edge Function — RAG pipeline
  - [x] 5.1 Implement embedding generation and semantic search
    - Generate embedding of user message using `gte-small` model (384 dimensions)
    - Query `search_similar_plans` RPC with `match_count: 3`, `match_threshold: 0.4`
    - Handle embedding failure gracefully (proceed without RAG)
    - Handle search timeout (5s) gracefully
    - _Requirements: 5.1, 5.2, 5.6_

  - [x] 5.2 Implement direct artist data context retrieval
    - Query artist bio (truncated to 500 chars), last 5 catalog items, next 5 events, all active team members
    - Filter by conversation's `artist_id`
    - Handle query failure gracefully (proceed with semantic only)
    - _Requirements: 5.3, 5.7_

  - [x] 5.3 Implement token budget enforcement for RAG context
    - Cap semantic search results at 2500 tokens
    - Cap direct artist data at 1500 tokens
    - Total combined context ≤ 4000 tokens
    - Truncate content exceeding each allocation
    - If semantic search returns nothing, allow freed budget for additional direct data
    - Inject context into system prompt
    - _Requirements: 5.4, 5.5_

  - [ ]* 5.4 Write property test for RAG token budget (Property 2)
    - **Property 2: RAG context respects token budget**
    - Generate arbitrary-length semantic results and artist data
    - Verify total context ≤ 4000 tokens, semantic ≤ 2500, direct ≤ 1500
    - **Validates: Requirements 5.4**

  - [ ]* 5.5 Write property test for RAG bounded to 3 results (Property 16)
    - **Property 16: RAG semantic search bounded to 3 results**
    - Verify search_similar_plans is called with match_count: 3, match_threshold: 0.4
    - Verify at most 3 plan references injected into system prompt
    - **Validates: Requirements 2.3, 5.2**

- [x] 6. Edge Function — Tool definitions and execution
  - [x] 6.1 Define all tool schemas for Groq function calling
    - Define `create_catalog_item`, `update_catalog_item`, `delete_catalog_item`
    - Define `create_event`, `update_event`, `delete_event`
    - Define `create_team_member`, `update_team_member`, `remove_team_member`
    - Define `update_strategy_task`
    - Use JSON Schema with required fields and descriptions in Portuguese
    - _Requirements: 3.1, 3.7_

  - [x] 6.2 Implement tool confirmation handler (action='confirm')
    - Parse `tool_call_id` and `approved` from request body
    - If approved: execute tool, persist tool result message (role='tool'), stream follow-up response
    - If denied: persist denial message, stream acknowledgement response
    - _Requirements: 2.5, 2.6, 3.5_

  - [x] 6.3 Implement tool execution with permission validation
    - Validate artist_id in tool call matches conversation's artist_id (cross-artist rejection)
    - Validate user is artist owner or member in `artist_members`
    - Execute tool using Supabase service role client (bypass RLS)
    - Return error to model on validation/execution failure
    - _Requirements: 3.2, 3.3, 3.4, 3.6, 3.8, 3.9_

  - [ ]* 6.4 Write property test for cross-artist tool rejection (Property 6)
    - **Property 6: Tool calls cannot cross artist boundaries**
    - Generate tool calls with mismatched artist_ids
    - Verify rejection without execution
    - **Validates: Requirements 3.2, 3.3**

  - [ ]* 6.5 Write property test for ownership/membership guard (Property 7)
    - **Property 7: Tool execution requires ownership or membership**
    - Generate users who are neither owner nor member
    - Verify rejection with insufficient permissions error
    - **Validates: Requirements 3.4, 3.9**

- [x] 7. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Frontend — Redux slice and hook
  - [x] 8.1 Create `nytaChat` Redux slice
    - Create `src/store/slices/nytaChat.ts`
    - Define `NytaChatState` interface with conversationId, messages, isStreaming, pendingToolCalls, rateLimitInfo, loadingHistory, hasMoreHistory, error
    - Implement reducers: addMessage, updateMessage, setStreaming, addPendingToolCall, updateToolCallStatus, setRateLimitInfo, setLoadingHistory, setHasMoreHistory, setError, clearMessages
    - Register slice in `src/store/store.ts`
    - _Requirements: 1.3, 1.7, 8.7_

  - [x] 8.2 Create `useNytaChat` hook with SSE streaming
    - Create `src/hooks/useNytaChat.ts`
    - Implement `sendMessage`: optimistic UI append, POST to nyta-chat, parse SSE stream (text, tool_call, error, done events)
    - Implement `confirmTool` / `cancelTool`: POST action='confirm' with approved flag
    - Implement `loadOlderMessages`: paginated fetch of last 50 messages, prepend to state
    - Implement `clearConversation`: confirmation + delete all messages
    - Handle HTTP 429 (rate limit) → set rateLimitInfo in state
    - Handle HTTP 403 (subscription) → set error state
    - _Requirements: 1.3, 1.7, 2.1, 4.3, 4.4, 6.3, 8.7, 8.9_

  - [ ]* 8.3 Write property test for pagination completeness (Property 1)
    - **Property 1: Pagination returns complete messages without gaps or duplicates**
    - Generate conversations with N messages (0-200), load in batches of 50
    - Verify all N messages returned in chronological order, no duplicates, no gaps
    - **Validates: Requirements 1.7**

- [x] 9. Frontend — Chat UI components
  - [x] 9.1 Create `NytaChatPage` component with full-screen layout
    - Create `src/pages/NytaChat/index.tsx` and `src/pages/NytaChat/styles.scss`
    - Implement full-screen layout (100vh) without default app header
    - Integrate entitlements check via `useEntitlements` hook
    - Render `LockedFeature` component when `nyta` entitlement is false
    - Skip entitlement check when `PAYWALL_DISABLED` is true
    - Load initial 50 messages on mount
    - Display greeting bubble when no messages exist
    - _Requirements: 7.1, 7.2, 7.6, 8.1, 8.10, 1.3, 1.4_

  - [x] 9.2 Create `ChatHeader` component
    - Create `src/pages/NytaChat/components/ChatHeader.tsx`
    - Display artist name, back button (navigate to `/artists/:id`), "Limpar conversa" action
    - Implement clear conversation with confirmation dialog
    - _Requirements: 8.2, 8.9_

  - [x] 9.3 Create `MessageList` component with infinite scroll
    - Create `src/pages/NytaChat/components/MessageList.tsx`
    - Render messages with NytaBubble (left, with avatar) for assistant and UserBubble (right) for user
    - Implement infinite scroll up for loading older messages (batches of 50)
    - Stop loading when no more messages exist
    - Auto-scroll to latest message unless user scrolled up > 100px
    - Display `TypingIndicator` during streaming with progressive text rendering
    - _Requirements: 8.3, 8.6, 8.8, 1.7_

  - [ ]* 9.4 Write property test for message alignment (Property 14)
    - **Property 14: Message alignment matches role**
    - Generate arbitrary messages with roles user/assistant
    - Verify assistant renders left with NytaAvatar, user renders right
    - **Validates: Requirements 8.3**

  - [ ]* 9.5 Write property test for multiple tool calls rendering (Property 11)
    - **Property 11: Multiple tool calls produce individual confirmation cards**
    - Generate responses with N tool_calls (1-5)
    - Verify exactly N ToolConfirmationCard components rendered, each independently actionable
    - **Validates: Requirements 4.9**

  - [x] 9.6 Create `InputBar` component
    - Create `src/pages/NytaChat/components/InputBar.tsx`
    - TextArea with auto-resize (min 1 row, max 4 rows, max 1000 chars)
    - Send button disabled when empty/whitespace-only
    - Enter submits, Shift+Enter inserts newline
    - Disable input while tool calls are pending or rate limit active
    - Display rate limit info ("100/100 mensagens usadas hoje") with countdown
    - _Requirements: 8.4, 8.5, 4.5, 6.4_

  - [ ]* 9.7 Write property test for whitespace send disabled (Property 15)
    - **Property 15: Send button disabled for whitespace-only input**
    - Generate arbitrary whitespace strings (spaces, tabs, newlines, empty)
    - Verify send button remains disabled and Enter does not trigger send
    - **Validates: Requirements 8.5**

  - [ ]* 9.8 Write property test for input disabled while pending (Property 9)
    - **Property 9: Message input is disabled while tool calls are pending**
    - Generate states with 1+ pending tool calls
    - Verify input field and send button are disabled
    - **Validates: Requirements 4.5**

  - [x] 9.9 Create `ToolConfirmationCard` component
    - Create `src/pages/NytaChat/components/ToolConfirmationCard.tsx`
    - Render action name (translated to Portuguese), target entity, parameters as labeled fields
    - Display "Confirmar" (primary, green) and "Cancelar" (secondary, neutral) buttons
    - On confirm: send approved=true, show loading, handle 30s timeout
    - On cancel: send approved=false, replace buttons with "Ação cancelada" text
    - On success/failure result: replace buttons with static indicator
    - Handle network error/timeout: re-enable buttons, show error message
    - Summarize action details within 200 characters
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.6, 4.7, 4.8_

  - [ ]* 9.10 Write property test for ToolConfirmation renders fields (Property 8)
    - **Property 8: ToolConfirmation card renders all required fields**
    - Generate arbitrary tool_call events with various names and arguments
    - Verify action name, target entity, and all arguments render as labeled fields
    - **Validates: Requirements 4.1**

  - [ ]* 9.11 Write property test for action summary limit (Property 10)
    - **Property 10: Tool action summary respects character limit**
    - Generate tool calls with arguments of arbitrary length
    - Verify rendered summary ≤ 200 characters with ellipsis truncation
    - **Validates: Requirements 4.6**

- [x] 10. Checkpoint — Frontend components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Integration — Routing, sidebar, and error handling
  - [x] 11.1 Add route `/artists/:id/nyta` to App router
    - Register `NytaChatPage` component at route `/artists/:id/nyta` in `src/App.tsx`
    - Ensure route is within authenticated + artist-context layout
    - _Requirements: 8.1_

  - [x] 11.2 Add "Nyta" menu item to Sidebar navigation
    - Modify `src/components/Layout/components/Sidebar/` to add "Nyta" item with `FiMessageCircle` icon
    - Position as last item in artist-context navigation (after "Equipe")
    - Show `FiLock` icon when `nyta` entitlement is false
    - Show item only when `artistId` is in route params
    - Apply active state styling when on `/artists/:id/nyta`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 11.3 Implement SSE error handling and connection recovery in UI
    - Handle SSE connection failures: stop typing indicator, show error in chat
    - Handle `type: 'error'` events: display Portuguese error message in thread
    - Handle HTTP 403 from Edge Function: render LockedFeature
    - Handle HTTP 429: display rate limit countdown UI
    - _Requirements: 8.11, 7.5, 6.3, 1.4_

  - [ ]* 11.4 Write unit tests for SSE event parsing and error flows
    - Test text chunk accumulation
    - Test tool_call event handling
    - Test error event display
    - Test done event with message persistence
    - Test 429 → rate limit UI transition
    - Test 403 → LockedFeature transition
    - _Requirements: 2.1, 2.10, 6.3, 7.5_

- [x] 12. Final checkpoint — Full integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between major phases
- Property tests use `fast-check` library (already in devDependencies)
- Edge Function code goes in `supabase/functions/nyta-chat/index.ts` (Deno runtime)
- Frontend components follow existing patterns: pages in `src/pages/`, slices in `src/store/slices/`, hooks in `src/hooks/`
- Existing reusable components: `NytaBubble`, `UserBubble`, `TypingIndicator` from `src/pages/Wizard/chat/`, `LockedFeature` from `src/components/LockedFeature/`
- The `useEntitlements` hook already exists at `src/hooks/useEntitlements.ts`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.4", "2.6"] },
    { "id": 3, "tasks": ["2.3", "2.5", "2.7", "4.1"] },
    { "id": 4, "tasks": ["4.2", "4.5"] },
    { "id": 5, "tasks": ["4.3", "4.4"] },
    { "id": 6, "tasks": ["4.6", "4.7"] },
    { "id": 7, "tasks": ["5.1", "5.2"] },
    { "id": 8, "tasks": ["5.3"] },
    { "id": 9, "tasks": ["5.4", "5.5", "6.1"] },
    { "id": 10, "tasks": ["6.2", "6.3"] },
    { "id": 11, "tasks": ["6.4", "6.5"] },
    { "id": 12, "tasks": ["8.1"] },
    { "id": 13, "tasks": ["8.2"] },
    { "id": 14, "tasks": ["8.3", "9.1"] },
    { "id": 15, "tasks": ["9.2", "9.3", "9.6"] },
    { "id": 16, "tasks": ["9.4", "9.5", "9.7", "9.8", "9.9"] },
    { "id": 17, "tasks": ["9.10", "9.11"] },
    { "id": 18, "tasks": ["11.1", "11.2"] },
    { "id": 19, "tasks": ["11.3"] },
    { "id": 20, "tasks": ["11.4"] }
  ]
}
```
