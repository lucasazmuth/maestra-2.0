# Requirements Document

## Introduction

Nyta MVP — Chat Livre com IA para a plataforma Maestra. A Nyta é a consultora estratégica IA da Maestra, que atualmente opera como wizard guiado (script determinístico + geração de conteúdo via Groq/Llama). Esta fase transforma a Nyta num chat aberto onde o artista com assinatura Pro ativa pode fazer perguntas livres sobre seu planejamento, catálogo, agenda e equipe — e a Nyta pode executar ações (criar, editar, excluir) nos módulos do artista mediante confirmação visual do usuário.

O escopo inclui: migração de banco para persistência de histórico de conversas, Edge Function `nyta-chat` com streaming, function calling (tool use) via Groq, busca semântica RAG para injetar contexto relevante, UI de chat dedicada em página full-screen (`/artists/:id/nyta`), controle de acesso Pro-only, e rate limiting de 100 interações/dia por artista.

## Glossary

- **Nyta_Chat_Page**: Página dedicada `/artists/:id/nyta` que exibe o chat livre com a Nyta em tela cheia, otimizada para mobile.
- **Nyta_Edge_Function**: Edge Function `nyta-chat` no Supabase que recebe mensagens do usuário, injeta contexto via RAG, executa chamadas ao Groq com function calling, e retorna respostas em streaming.
- **Nyta_Conversation**: Conversa contínua entre a Nyta e o usuário para um artista específico. Existe uma única conversa por par (user_id, artist_id).
- **Nyta_Message**: Mensagem individual dentro de uma Nyta_Conversation, com role (`user`, `assistant`, `tool`) e conteúdo textual ou structured (tool calls/results).
- **Function_Calling**: Mecanismo do Groq que permite à IA declarar intenção de executar ações (tools) nos módulos do artista (catálogo, agenda, equipe, planejamento).
- **Tool_Confirmation**: Componente visual (botão) exibido ao usuário no chat quando a Nyta propõe uma ação destrutiva ou criativa, pedindo confirmação antes da execução.
- **RAG_Context**: Contexto relevante do artista obtido via busca semântica (embedding) nos dados do planejamento, catálogo, agenda e equipe, injetado no prompt da IA.
- **Rate_Limiter**: Mecanismo que limita o usuário a 100 interações (mensagens enviadas pelo usuário) por dia por artista.
- **Streaming_Response**: Resposta da Nyta entregue token a token via SSE (Server-Sent Events) para feedback visual imediato.
- **Entitlements_Hook**: Hook `useEntitlements` que verifica se o usuário tem plano Pro e feature `nyta` habilitada.

## Requirements

### Requirement 1: Persistência de Conversas

**User Story:** Como artista Pro, eu quero que meu histórico de chat com a Nyta seja salvo permanentemente, para que eu possa retomar a conversa de onde parei em qualquer dispositivo.

#### Acceptance Criteria

1. THE Nyta_Edge_Function SHALL persist every user message and assistant response in the `nyta_messages` table within 5 seconds of generation.
2. IF message persistence fails due to a database error, THEN THE Nyta_Edge_Function SHALL return an SSE error event indicating that the message could not be saved, and SHALL NOT deliver the assistant response to the frontend as if it were successfully persisted.
3. WHEN the Nyta_Chat_Page mounts for a given artist, THE Nyta_Chat_Page SHALL load the last 50 messages from the Nyta_Conversation for that (user_id, artist_id) pair and display them in chronological order (oldest at the top, newest at the bottom).
4. IF loading message history fails due to a network or database error, THEN THE Nyta_Chat_Page SHALL display an error message in Portuguese with a retry option.
5. WHEN no Nyta_Conversation exists for the (user_id, artist_id) pair, THE Nyta_Edge_Function SHALL create one automatically upon receiving the first user message.
6. THE `nyta_messages` table SHALL store `role` (user, assistant, tool), `content` (text, maximum 10,000 characters), `tool_calls` (jsonb, nullable), `tool_results` (jsonb, nullable), and `created_at` (timestamptz) for each message.
7. WHEN the user scrolls up in the Nyta_Chat_Page, THE Nyta_Chat_Page SHALL load older messages in batches of 50 (infinite scroll pagination); WHEN no older messages remain, THE Nyta_Chat_Page SHALL stop issuing further load requests and display no additional loading indicator.
8. THE database schema SHALL enforce a UNIQUE constraint on (user_id, artist_id) in the `nyta_conversations` table to guarantee one conversation per artist per user.

### Requirement 2: Edge Function — Chat com Streaming e Function Calling

**User Story:** Como artista Pro, eu quero receber respostas da Nyta em tempo real (streaming), para que eu não precise esperar a resposta completa antes de começar a ler.

#### Acceptance Criteria

1. WHEN the user sends a message, THE Nyta_Edge_Function SHALL call the Groq API with model `llama-3.3-70b-versatile`, streaming enabled, and return the response as Server-Sent Events (SSE) with `Content-Type: text/event-stream`, where each text chunk is sent as an event with type `text` and each tool_call is sent as an event with type `tool_call` containing the tool name, tool_call_id, and arguments as JSON.
2. THE Nyta_Edge_Function SHALL include a system prompt in Portuguese that defines the Nyta persona (consultora estratégica da indústria musical brasileira), the available tools, and instructions to always ask for confirmation before executing destructive actions.
3. THE Nyta_Edge_Function SHALL inject RAG_Context (retrieved via semantic search from `strategic_plans` and artist data) into the system prompt, limited to the 3 most relevant results with similarity threshold 0.4.
4. WHEN the Groq API returns a tool_call in the response, THE Nyta_Edge_Function SHALL NOT execute the tool immediately; instead it SHALL send an SSE event of type `tool_call` containing the tool_call_id, function name, and parsed arguments to the frontend for user confirmation.
5. WHEN the frontend sends a tool confirmation (approved), THE Nyta_Edge_Function SHALL execute the confirmed tool against the database and return the result as a streamed follow-up assistant message via SSE.
6. IF the user denies a tool confirmation, THEN THE Nyta_Edge_Function SHALL persist the denial as a message with role `assistant` in the `nyta_messages` table and return a streamed assistant response acknowledging that the action was cancelled.
7. THE Nyta_Edge_Function SHALL validate the JWT token from the Authorization header and extract the authenticated user_id before processing any request.
8. IF the JWT is missing or invalid, THEN THE Nyta_Edge_Function SHALL return HTTP 401 without processing the message.
9. THE Nyta_Edge_Function SHALL include up to the last 20 messages from the conversation as context in the Groq API call to maintain conversational coherence; if fewer than 20 messages exist, all available messages SHALL be included.
10. IF the Groq API returns an error or times out (30 seconds), THEN THE Nyta_Edge_Function SHALL return an SSE event with type `error` and a message in Portuguese describing the failure, then close the stream.
11. IF the request body is missing required fields (`message` or `artist_id`) or `message` exceeds 2000 characters, THEN THE Nyta_Edge_Function SHALL return HTTP 400 with a JSON body containing an error message indicating the validation failure.
12. IF the RAG embedding generation fails, THEN THE Nyta_Edge_Function SHALL proceed with the Groq API call without RAG_Context and include only the direct artist data in the system prompt.

### Requirement 3: Function Calling — Tools Disponíveis

**User Story:** Como artista Pro, eu quero que a Nyta possa criar, editar e excluir itens no meu catálogo, agenda, equipe e planejamento mediante minha confirmação, para que eu consiga gerenciar meu projeto pela conversa.

#### Acceptance Criteria

1. THE Nyta_Edge_Function SHALL expose the following tools to the Groq function calling interface: `create_catalog_item`, `update_catalog_item`, `delete_catalog_item`, `create_event`, `update_event`, `delete_event`, `create_team_member`, `update_team_member`, `remove_team_member`, `update_strategy_task`.
2. WHEN the Groq model invokes a tool, THE Nyta_Edge_Function SHALL validate that the `artist_id` parameter in the tool call matches the artist_id from the conversation context.
3. IF a tool call references an `artist_id` different from the conversation context, THEN THE Nyta_Edge_Function SHALL reject the tool call and return an error message to the model indicating that cross-artist operations are not permitted.
4. THE Nyta_Edge_Function SHALL execute tool calls using the Supabase service role client to bypass RLS, after validating that the authenticated user is the artist owner (`artists.user_id` matches JWT user_id) or is listed in the `artist_members` table for the target artist_id.
5. WHEN a tool execution succeeds, THE Nyta_Edge_Function SHALL persist a message with role `tool` containing the tool name and a result summary (maximum 500 characters) in the `nyta_messages` table.
6. IF a tool execution fails due to a database error, THEN THE Nyta_Edge_Function SHALL return the error to the model and THE Nyta SHALL inform the user in Portuguese that the action failed.
7. THE tool definitions SHALL use JSON Schema to describe parameters, with all required fields marked and descriptions in Portuguese.
8. IF a tool call fails due to a validation error (missing required parameters, invalid parameter values, or referenced entity not found), THEN THE Nyta_Edge_Function SHALL return an error to the model indicating the specific validation failure, and THE Nyta SHALL inform the user in Portuguese what needs to be corrected.
9. IF the authenticated user is neither the artist owner nor a member listed in the `artist_members` table for the target artist_id, THEN THE Nyta_Edge_Function SHALL reject the tool call and return an error message to the model indicating insufficient permissions.

### Requirement 4: Confirmação Visual de Ações

**User Story:** Como artista, eu quero ver um botão de confirmação antes que a Nyta execute qualquer ação nos meus dados, para que eu mantenha controle total sobre o que é modificado.

#### Acceptance Criteria

1. WHEN the Nyta response contains a tool_call, THE Nyta_Chat_Page SHALL render a Tool_Confirmation card showing the action name, target entity, and parameters as labeled fields in Portuguese (e.g., "Ação: Criar item no catálogo", "Título: Novo Single").
2. THE Tool_Confirmation card SHALL display two buttons: "Confirmar" (primary, green) and "Cancelar" (secondary, neutral).
3. WHEN the user clicks "Confirmar", THE Nyta_Chat_Page SHALL send the tool_call_id with `approved: true` to the Nyta_Edge_Function, display a loading indicator, and wait a maximum of 30 seconds for the result to arrive.
4. WHEN the user clicks "Cancelar", THE Nyta_Chat_Page SHALL send the tool_call_id with `approved: false` to the Nyta_Edge_Function and replace the confirmation buttons with a static text indicating the action was cancelled.
5. WHILE a Tool_Confirmation is pending (neither confirmed nor cancelled), THE Nyta_Chat_Page SHALL disable the message input field to prevent the user from sending new messages.
6. THE Tool_Confirmation card SHALL display the action details within 200 characters, summarizing what will be created, modified, or deleted.
7. IF the confirmation or cancellation request fails due to a network error or the 30-second timeout elapses without a response, THEN THE Nyta_Chat_Page SHALL re-enable the message input field, display an error message in Portuguese indicating the action could not be completed, and allow the user to retry by keeping the "Confirmar" and "Cancelar" buttons active.
8. WHEN the tool execution result arrives after confirmation, THE Nyta_Chat_Page SHALL replace the Tool_Confirmation card buttons with a static success or failure indicator based on the result, and re-enable the message input field.
9. WHEN the Nyta response contains multiple tool_calls, THE Nyta_Chat_Page SHALL render one Tool_Confirmation card per tool_call and require individual confirmation or cancellation for each.

### Requirement 5: Busca Semântica (RAG) para Contexto

**User Story:** Como artista, eu quero que a Nyta tenha conhecimento sobre meu planejamento, catálogo, agenda e equipe ao responder, para que as respostas sejam relevantes ao meu contexto real.

#### Acceptance Criteria

1. WHEN a user message is received, THE Nyta_Edge_Function SHALL generate an embedding of the message using the Supabase Edge Runtime `gte-small` model (384 dimensions).
2. WHEN the message embedding is generated, THE Nyta_Edge_Function SHALL query the `strategic_plans` table via the existing `search_similar_plans` RPC using the message embedding, with `match_count: 3` and `match_threshold: 0.4`.
3. WHEN the message embedding is generated, THE Nyta_Edge_Function SHALL query the artist's direct data (from `artists.content`, `catalog_items`, `events`, `artist_members`) filtering by the conversation's `artist_id`, and include a structured summary containing: artist bio (truncated to 500 characters), up to 5 most recent catalog items (title and type), up to 5 upcoming events (title and date), and all active team members (name and role).
4. THE combined RAG context injected into the system prompt SHALL NOT exceed 4000 tokens; THE Nyta_Edge_Function SHALL allocate up to 2500 tokens for semantic search results and up to 1500 tokens for direct artist data, truncating content that exceeds each allocation.
5. IF the semantic search returns no results above the similarity threshold, THEN THE Nyta_Edge_Function SHALL proceed with only the direct artist data context (no strategic plan references), and MAY use the freed semantic search token budget (2500 tokens) for additional direct artist data.
6. IF the embedding generation fails or the `search_similar_plans` RPC returns an error or does not respond within 5 seconds, THEN THE Nyta_Edge_Function SHALL proceed with only the direct artist data context and log the failure.
7. IF the direct artist data query fails, THEN THE Nyta_Edge_Function SHALL proceed with only the semantic search results as context; IF both the semantic search and the direct data query fail, THEN THE Nyta_Edge_Function SHALL proceed without RAG context and include a notice in the system prompt that contextual data was unavailable.

### Requirement 6: Rate Limiting

**User Story:** Como sistema, eu preciso limitar o uso do chat para evitar abuso e controlar custos da API Groq, mantendo o serviço sustentável.

#### Acceptance Criteria

1. WHEN a user message is received, THE Nyta_Edge_Function SHALL count user-role messages in `nyta_messages` with `created_at` on the current UTC date for the given (user_id, artist_id) pair, and IF the count is 100 or more, THE Nyta_Edge_Function SHALL reject the message without persisting it or calling the Groq API.
2. WHEN the daily limit is reached, THE Nyta_Edge_Function SHALL return HTTP 429 with a JSON body containing `error: 'rate_limit_exceeded'` and `resetAt` (ISO 8601 timestamp of next UTC midnight).
3. WHEN the Nyta_Chat_Page receives HTTP 429, THE Nyta_Chat_Page SHALL display a message in Portuguese informing the user that the daily limit was reached and showing the time remaining until reset in "X horas e Y minutos" format.
4. WHILE the rate limit is active, THE Nyta_Chat_Page SHALL disable the message input field, display the remaining time until reset updated every 60 seconds, and show the text "100/100 mensagens usadas hoje".
5. THE rate limit counter SHALL be derived from counting user-role messages in `nyta_messages` with `created_at` on the current UTC date for the given (user_id, artist_id) pair.
6. IF the rate limit count query fails due to a database error, THEN THE Nyta_Edge_Function SHALL reject the message with HTTP 503 and a JSON body containing `error: 'service_unavailable'` to prevent unmetered usage.

### Requirement 7: Controle de Acesso (Pro-only)

**User Story:** Como sistema, eu preciso restringir o acesso ao chat da Nyta apenas para usuários com assinatura Pro ativa, para que o feature funcione como diferencial pago.

#### Acceptance Criteria

1. WHEN the user navigates to `/artists/:id/nyta`, THE Nyta_Chat_Page SHALL check the `nyta` entitlement via the Entitlements_Hook before rendering any chat content.
2. IF the `nyta` entitlement is `false`, THEN THE Nyta_Chat_Page SHALL render the existing `LockedFeature` component with the `nyta` configuration (icon, title, benefits, gradient).
3. THE Nyta_Edge_Function SHALL verify that the authenticated user has an active subscription (status `active`, or status `overdue` with billing due date no older than 7 days) before processing any message.
4. IF the user does not have an active subscription, THEN THE Nyta_Edge_Function SHALL return HTTP 403 with `error: 'subscription_required'`.
5. WHEN the Nyta_Chat_Page receives HTTP 403 with `error: 'subscription_required'` from the Nyta_Edge_Function, THE Nyta_Chat_Page SHALL render the `LockedFeature` component with the `nyta` configuration, replacing the chat interface.
6. WHILE the `PAYWALL_DISABLED` environment variable is `true`, THE Nyta_Chat_Page SHALL render the chat without checking entitlements.
7. WHILE the `PAYWALL_DISABLED` environment variable is `true`, THE Nyta_Edge_Function SHALL skip subscription validation and process messages regardless of subscription status.

### Requirement 8: UI do Chat — Página Dedicada

**User Story:** Como artista Pro, eu quero acessar o chat da Nyta numa página dedicada full-screen otimizada para mobile, para que eu possa interagir confortavelmente no celular.

#### Acceptance Criteria

1. THE Nyta_Chat_Page SHALL be accessible at the route `/artists/:id/nyta` and SHALL occupy 100% of the viewport height (full-screen layout without the default app header).
2. THE Nyta_Chat_Page SHALL display a compact header with the artist name, a back button (navigates to `/artists/:id`), and a "Limpar conversa" action.
3. THE Nyta_Chat_Page SHALL display messages in a scrollable area with the Nyta messages aligned to the left (with NytaAvatar) and user messages aligned to the right, reusing the existing `NytaBubble` and `UserBubble` components.
4. THE Nyta_Chat_Page SHALL display a fixed input bar at the bottom with a TextArea (auto-resize, min 1 row, max 4 rows, maximum 1000 characters) and a send button; pressing Enter (without Shift) SHALL submit the message, and Shift+Enter SHALL insert a newline, following the existing `nyta-input-bar` pattern.
5. WHILE the input field is empty or contains only whitespace, THE Nyta_Chat_Page SHALL keep the send button disabled.
6. WHEN the Nyta is responding (streaming), THE Nyta_Chat_Page SHALL display the existing `TypingIndicator` component followed by progressively rendered text as SSE tokens arrive.
7. WHEN the user sends a message, THE Nyta_Chat_Page SHALL immediately append the message to the thread (optimistic UI), disable the send button, and start the streaming response.
8. THE Nyta_Chat_Page SHALL auto-scroll to the latest message when new content arrives, unless the user has manually scrolled up more than 100px from the bottom.
9. WHEN the user clicks "Limpar conversa", THE Nyta_Chat_Page SHALL display a confirmation dialog; upon confirmation, it SHALL delete all messages from the Nyta_Conversation and reset the UI to the empty state.
10. WHEN the Nyta_Chat_Page loads with no existing messages in the Nyta_Conversation, THE Nyta_Chat_Page SHALL display a single Nyta greeting bubble introducing herself and inviting the user to ask a question.
11. IF the SSE connection fails or an error event is received during streaming, THEN THE Nyta_Chat_Page SHALL stop the typing indicator and display an error message in Portuguese within the chat thread indicating that the response could not be completed.

### Requirement 9: Migração de Banco de Dados

**User Story:** Como sistema, eu preciso criar as tabelas para persistir conversas e mensagens do chat Nyta, garantindo integridade referencial e performance.

#### Acceptance Criteria

1. THE migration SHALL create a `nyta_conversations` table with columns: `id` (uuid PK, DEFAULT gen_random_uuid()), `user_id` (uuid FK → auth.users, NOT NULL), `artist_id` (uuid FK → artists, NOT NULL), `created_at` (timestamptz, DEFAULT now()), `updated_at` (timestamptz, DEFAULT now()), with a UNIQUE constraint on (user_id, artist_id).
2. THE migration SHALL create a `nyta_messages` table with columns: `id` (uuid PK, DEFAULT gen_random_uuid()), `conversation_id` (uuid FK → nyta_conversations ON DELETE CASCADE, NOT NULL), `role` (text NOT NULL, CHECK IN ('user', 'assistant', 'tool')), `content` (text, nullable), `tool_calls` (jsonb, nullable), `tool_results` (jsonb, nullable), `created_at` (timestamptz, DEFAULT now()), with a CHECK constraint ensuring that messages with role 'user' or 'assistant' have non-null `content`.
3. THE migration SHALL create an index on `nyta_messages(conversation_id, created_at DESC)` for pagination queries.
4. THE migration SHALL enable Row Level Security (RLS) on both tables with the following policies: for `nyta_conversations`, a SELECT and INSERT policy allowing access where `user_id` matches `auth.uid()`; for `nyta_messages`, a SELECT, INSERT, and DELETE policy allowing access where `conversation_id` belongs to a `nyta_conversations` row whose `user_id` matches `auth.uid()`.
5. THE migration SHALL create a partial index on `nyta_messages(conversation_id, created_at)` filtered by `role = 'user'` for rate limit counting.
6. THE existing `ai_chat_messages` table SHALL remain unchanged; the new tables are separate and dedicated to the Nyta free-chat feature.

### Requirement 10: Navegação e Integração com Sidebar

**User Story:** Como artista Pro, eu quero acessar o chat da Nyta facilmente a partir do menu de navegação, para que eu não precise lembrar a URL.

#### Acceptance Criteria

1. THE Sidebar SHALL display a "Nyta" menu item with the `FiMessageCircle` icon as the last item in the artist-context navigation list (after the "Equipe" item).
2. WHEN the user clicks the "Nyta" sidebar item, THE application SHALL navigate to `/artists/:id/nyta`, replacing `:id` with the current artist's ID from the route params.
3. WHILE the `nyta` entitlement is `false`, THE Sidebar SHALL display a `FiLock` icon next to the "Nyta" menu item label (aligned to the right), and clicking the item SHALL still navigate to `/artists/:id/nyta` where the `LockedFeature` component handles the paywall display.
4. THE Nyta menu item SHALL be visible only within an artist context (when `artistId` is present in the route params); when no artist is selected, the item SHALL NOT be rendered.
5. WHILE the user is on the `/artists/:id/nyta` route, THE Sidebar SHALL render the "Nyta" menu item in the active state (white text, bold weight), matching the existing active-item styling pattern.
