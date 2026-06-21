# Implementation Plan: Rate Limit de Criação de Artista

## Overview

Implementação do rate limit progressivo para criação de perfis de artista e remoção do bloqueio de duplicidade entre usuários. A ordem é: schema/banco → RPCs/triggers → edge function → frontend (hook + páginas). Cada camada valida independentemente, com o banco como fonte de verdade.

## Tasks

- [x] 1. Database schema e infraestrutura
  - [x] 1.1 Criar tabela `artist_deletions` e trigger de exclusão
    - Criar migration com a tabela `artist_deletions` (id, user_id, artist_id, spotify_artist_id, artist_name, was_locked, deleted_at)
    - Criar índices `idx_artist_deletions_user_30d` e `idx_artist_deletions_user_id`
    - Criar função `fn_track_artist_deletion()` e trigger `trg_artist_deletion` (BEFORE DELETE ON artists)
    - Configurar RLS: SELECT para o próprio user_id, sem INSERT/UPDATE/DELETE para authenticated
    - _Requirements: 3.2, 3.10_

  - [x] 1.2 Alterar constraint de unicidade na tabela `artists`
    - Remover constraint global `artists_spotify_artist_id_key` (se existir)
    - Adicionar constraint composta `artists_user_spotify_unique` em `(user_id, spotify_artist_id)`
    - _Requirements: 1.1, 1.3_

  - [x] 1.3 Criar RPC `check_artist_rate_limit`
    - Implementar função PL/pgSQL que retorna jsonb com `can_create`, `pending_count`, `pending_limit`, `cooldown_remaining_seconds`, `cooldown_total_seconds`, `deletions_30d`
    - Lógica de cooldown: 0 exclusões → 0s, 1 → 600s, 2–4 → 86400s, 5+ → 604800s
    - Tempo restante: `max(0, cooldown - (now - last_created_at))`
    - SECURITY DEFINER para acesso à tabela artist_deletions
    - _Requirements: 2.1, 2.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.3_

  - [x] 1.4 Criar RPC `check_self_duplicate`
    - Implementar função PL/pgSQL que retorna boolean verificando existência de (user_id, spotify_artist_id)
    - SECURITY DEFINER
    - _Requirements: 1.2_

- [x] 2. Edge Function — camada de rate limit no `artist-diagnostic`
  - [x] 2.1 Adicionar verificação de rate limit no início do handler
    - Verificar contagem de perfis pendentes (is_locked = true) >= 3 → retornar HTTP 429 com `reason: "pending_limit"`
    - Verificar cooldown ativo baseado em exclusões 30d → retornar HTTP 429 com `reason: "cooldown"` e `remaining_seconds`
    - Verificar auto-duplicidade (user_id + spotify_artist_id) → retornar perfil existente se encontrado
    - Se consulta ao banco falhar → retornar HTTP 500 (fail closed)
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 2.2 Remover validação de duplicidade global e trava de perfil único pendente
    - Remover referências à RPC `check_spotify_artist_exists` na edge function
    - Remover lógica que permitia apenas 1 perfil não-pago
    - _Requirements: 1.1, 1.3_

- [x] 3. Checkpoint — Validar backend
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Frontend — hook e lógica de rate limit
  - [x] 4.1 Reescrever hook `useCanCreateArtist` com RPC de rate limit
    - Nova interface `CanCreateArtistResult` com campos: `canCreate`, `reason`, `pendingCount`, `pendingLimit`, `cooldownRemainingSeconds`, `cooldownTotalSeconds`, `deletions30d`, `loading`, `error`, `retry`
    - Chamar RPC `check_artist_rate_limit` no mount e expor estado reativo
    - Implementar timer que atualiza `cooldownRemainingSeconds` a cada 60s
    - Auto-refresh quando cooldown expira (remover aviso sem reload)
    - Expor função `retry()` para erro de rede
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 4.2 Criar funções puras de cálculo de rate limit em `src/utils/rateLimitCalc.ts`
    - `computeCooldown(deletionCount: number): number` — retorna cooldown em segundos
    - `computeRemainingSeconds(lastCreatedAt: Date, cooldownSeconds: number, now: Date): number`
    - `canCreate(pendingCount: number, remainingSeconds: number): boolean`
    - `getRestrictionPriority(pendingBlocked: boolean, cooldownBlocked: boolean): 'pending_limit' | 'cooldown' | null`
    - `formatRemainingTime(seconds: number): string` — formata em minutos/horas/dias
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7, 5.2, 5.3_

  - [x] 4.3 Write property tests for rate limit calculation functions
    - **Property 6: Cálculo determinístico do cooldown**
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.3**

  - [x] 4.4 Write property tests for pending count and deletion window logic
    - **Property 3: Limite de perfis pendentes** — `canCreate` retorna true sse pendingCount < 3
    - **Property 5: Acurácia da contagem de exclusões (janela de 30 dias)** — filtragem correta por was_locked e janela temporal
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.2, 3.10**

  - [x] 4.5 Write property tests for restriction priority and cross-user creation
    - **Property 7: Prioridade de restrições** — pending_limit tem prioridade sobre cooldown
    - **Property 1: Criação entre usuários distintos é sempre permitida** — user_ids distintos nunca bloqueiam mutuamente
    - **Property 2: Auto-duplicidade é sempre bloqueada** — mesmo user_id + spotify_artist_id é rejeitado
    - **Validates: Requirements 1.1, 1.2, 1.3, 5.3**

- [x] 5. Frontend — atualizar páginas de criação e listagem
  - [x] 5.1 Atualizar `src/pages/ArtistCreate/index.tsx` com rate limit
    - Integrar `useCanCreateArtist` para verificação pré-voo ao montar a página
    - Exibir aviso de limite de pendentes (quantidade exata + orientação) quando `reason === 'pending_limit'`
    - Exibir aviso de cooldown com contagem regressiva quando `reason === 'cooldown'`
    - Desabilitar campo de busca quando `canCreate === false`
    - Exibir botão retry quando `error === true`
    - Remover chamada à RPC `check_spotify_artist_exists` em `handleSelectSpotify`
    - Substituir notice de "outro usuário" por verificação de auto-duplicidade via `check_self_duplicate`
    - _Requirements: 1.1, 1.2, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 5.2 Atualizar `src/pages/Artists/index.tsx` com nova lógica de limite
    - Remover trava de "1 perfil não-pago por vez" em `handleCreate`
    - Integrar `useCanCreateArtist` para verificar rate limit antes de navegar para /criar-artista
    - Exibir toast com mensagem específica quando criação bloqueada (pending_limit ou cooldown)
    - _Requirements: 2.1, 2.2, 5.1, 5.2_

  - [x] 5.3 Remover validação de duplicidade global em `src/services/db/artists.ts`
    - Remover chamada à RPC `check_spotify_artist_exists` na função `createArtist`
    - Remover lógica de bloqueio por "outro usuário já tem esse artista"
    - Manter insert que agora é protegido pela constraint composta `artists_user_spotify_unique`
    - _Requirements: 1.1, 1.3, 1.4_

- [x] 6. Checkpoint — Validar integração completa
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Testes unitários e de integração
  - [x] 7.1 Write unit tests for `useCanCreateArtist` hook
    - Testar estado loading, canCreate true/false, retry, countdown timer
    - Testar auto-refresh quando cooldown expira
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

  - [x] 7.2 Write unit tests for edge function rate limit layer
    - Testar retorno 401 sem JWT
    - Testar retorno 429 com formato correto para pending_limit
    - Testar retorno 429 com formato correto para cooldown
    - Testar retorno de perfil existente para auto-duplicidade
    - Testar retorno 500 quando DB indisponível
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 7.3 Write property test for pending count accuracy
    - **Property 4: Acurácia da contagem de perfis pendentes** — contagem exata de registros com user_id = U AND is_locked = true
    - **Validates: Requirements 2.3, 2.4**

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Database migrations should be applied via Supabase CLI (`supabase migration new` / `supabase db push`)
- A edge function pode ser testada localmente com `supabase functions serve`
- As funções puras de cálculo (4.2) permitem testes de propriedade sem dependência do banco

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["4.1", "4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5"] },
    { "id": 5, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3"] }
  ]
}
```
