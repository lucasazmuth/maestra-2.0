# Chartmetric Rate Limit Compliance — Bugfix Design

## Overview

A integração com a API Chartmetric sofre de throttling silencioso e perda de dados porque as Edge Functions `artist-enrich-chartmetric` e `collect-metrics` não respeitam rate limits. A função `cmGet()` duplicada em ambas trata HTTP 429 como erro genérico (`null`), ignora completamente os headers de rate limit, e as chamadas são disparadas em paralelo sem pacing. A estratégia de correção consiste em extrair um módulo HTTP compartilhado (`_shared/chartmetric-client.ts`) que encapsula: leitura de headers de quota, retry com backoff exponencial em 429, pacing proativo baseado em `X-RateLimit-Remaining`, e execução sequencial/bounded-concurrency. Ambas as Edge Functions migram para consumir esse módulo.

## Glossary

- **Bug_Condition (C)**: Qualquer chamada HTTP à API Chartmetric feita sem tratamento de 429, sem leitura de headers de rate limit, ou sem pacing entre requisições
- **Property (P)**: Chamadas HTTP que respeitam a janela de sliding window — lêem headers, pausam proativamente, fazem retry com backoff em 429, e controlam concorrência
- **Preservation**: Comportamento de parsing de respostas (`.obj`), tratamento de erros não-429, fluxo de autenticação, persistência de dados e idempotência devem permanecer inalterados
- **cmGet()**: Função duplicada em ambas Edge Functions que faz GET autenticado à API Chartmetric — será substituída pelo módulo compartilhado
- **Sliding Window**: Algoritmo de rate limiting da Chartmetric que conta requisições numa janela temporal deslizante
- **X-RateLimit-Remaining**: Header retornado pela API indicando requisições restantes na janela atual
- **X-RateLimit-Reset**: Header retornado pela API indicando timestamp (epoch seconds) de quando a janela reseta
- **Bounded Concurrency**: Padrão de execução onde no máximo N requisições são feitas simultaneamente

## Bug Details

### Bug Condition

O bug se manifesta quando qualquer Edge Function faz requisições à API Chartmetric. A função `cmGet()` dispara `fetch()` sem ler headers de resposta para rate limiting, trata 429 como falha genérica retornando `null`, e `Promise.all` dispara múltiplas requisições simultaneamente ultrapassando a janela de sliding window.

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request of type { path: string, token: string, concurrentRequests: number }
  OUTPUT: boolean

  hasNo429Handling := request does NOT check for response.status === 429
  ignoresRateLimitHeaders := request does NOT read X-RateLimit-Remaining or X-RateLimit-Reset
  noPacing := concurrentRequests > 1 AND no delay between sequential requests
  noBackoff := on repeated 429 responses, no exponential wait is applied

  RETURN hasNo429Handling
         OR ignoresRateLimitHeaders
         OR noPacing
         OR noBackoff
END FUNCTION
```

### Examples

- **429 sem retry**: `cmGet("/api/artist/123/stat/spotify", token)` recebe 429 → retorna `null` → dado perdido permanentemente nesta invocação
- **Parallel burst em enrich**: `Promise.all([cmGet(stat), cmGet(wpl), cmGet(social), cmGet(playlists)])` dispara 4 requests simultâneos → 2-3 recebem 429 → enriquecimento incompleto
- **Batch sem pacing**: `collect-metrics` processa 20 artistas, cada um com 3-4 requests paralelos → ~60-80 requests sem delay → a maioria recebe 429 após os primeiros artistas
- **Headers ignorados**: Resposta contém `X-RateLimit-Remaining: 2` mas a próxima chamada dispara imediatamente sem pausa → resulta em 429 evitável

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Parse de respostas 2xx: extrair `.obj` do JSON body e retornar dados normalmente
- Erros não-429 (4xx/5xx): continuar retornando `null` sem retry
- Fluxo de autenticação: `/api/token` com refresh token permanece idêntico
- Persistência: dados salvos em `artists.content.chartmetricProfile` (enrich) e `artist_metrics_snapshots` (collect) com mesma estrutura
- Idempotência: `enriched === true` retorna early sem chamadas adicionais
- Token indisponível: retorna `{ ok: false, reason: "chartmetric_unavailable" }`

**Scope:**
Todos os inputs que NÃO envolvem chamadas HTTP à API Chartmetric devem ser completamente não-afetados. Inclui:
- Queries ao Supabase (verificação de PRO, busca de artistas elegíveis, inserção de snapshots)
- Lógica de cálculo de deltas e métricas
- Tratamento de CORS e validação de requisição
- Fluxo de autenticação do usuário via Supabase Auth

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **Ausência de tratamento de HTTP 429**: `cmGet()` verifica apenas `!res.ok` e retorna `null` — não diferencia 429 de outros erros, logo não há oportunidade de retry
   - Ambas as funções têm a mesma implementação: `if (!res.ok) return null;`
   - Nenhuma lê `res.headers` para rate limit metadata

2. **Chamadas paralelas sem controle**: `Promise.all` dispara todas as requests simultaneamente
   - `artist-enrich-chartmetric`: 4 chamadas paralelas (spStat, wpl, social, playlists)
   - `collect-metrics`: 3 chamadas paralelas (spStat, wpl, artistInfo) por artista, multiplicado por N artistas em sequência sem delay

3. **Ausência de pacing proativo**: Não há leitura de `X-RateLimit-Remaining` para antecipar throttling antes de receber 429

4. **Sem backoff exponencial**: Mesmo que se adicionasse retry simples, sem backoff o sistema martelaria o endpoint repetidamente sem dar tempo à janela de resetar

## Correctness Properties

Property 1: Bug Condition - Rate Limit Compliance on 429

_For any_ HTTP request to the Chartmetric API where the response status is 429 (Too Many Requests), the fixed `cmGet()` function SHALL read the `X-RateLimit-Reset` header, wait until that timestamp, and retry the request with exponential backoff for subsequent 429s, up to a maximum number of attempts.

**Validates: Requirements 2.1, 2.5**

Property 2: Preservation - Non-429 Response Handling

_For any_ HTTP request to the Chartmetric API where the response status is NOT 429, the fixed code SHALL produce exactly the same behavior as the original code: parse `.obj` from 2xx responses, return `null` for other errors, preserving all existing data extraction and error handling logic.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `supabase/functions/_shared/chartmetric-client.ts` (NEW)

**Module**: Shared Chartmetric HTTP client with rate-limit awareness

**Specific Changes**:

1. **Create shared module** `supabase/functions/_shared/chartmetric-client.ts`:
   - Export class `ChartmetricClient` que encapsula token e estado de rate limit
   - Método `get(path: string): Promise<any | null>` substitui `cmGet()`
   - Método `getToken(): Promise<string | null>` substitui `getCmToken()` / `cmToken()`
   - Estado interno: `remaining`, `resetAt`, `consecutiveRetries`

2. **429 Detection & Retry**:
   - Após cada `fetch()`, verificar `response.status === 429`
   - Ler `X-RateLimit-Reset` header (epoch seconds) → calcular delay como `resetAt - Date.now()/1000`
   - Sleep pelo delay calculado, então retry
   - Máximo de 3 retries por request individual

3. **Proactive Pacing**:
   - Após cada resposta (2xx ou 429), ler `X-RateLimit-Remaining` e `X-RateLimit-Limit`
   - Se `remaining <= threshold` (ex: remaining ≤ 2), sleep até `resetAt` antes de fazer próxima request
   - Threshold configurável (default: 2 requests restantes)

4. **Exponential Backoff**:
   - Base delay: valor de `X-RateLimit-Reset` ou 1 segundo se header ausente
   - Multiplicador: `2^attempt` (1s, 2s, 4s, 8s...)
   - Jitter: ±10% aleatório para evitar thundering herd
   - Max delay cap: 30 segundos

5. **Sequential/Bounded Concurrency Execution**:
   - Exportar helper `sequentialGet(paths: string[]): Promise<(any | null)[]>`
   - Executa requests uma por vez com pacing entre elas baseado no estado de rate limit
   - Alternativa: `boundedGet(paths: string[], concurrency: number)` para max 2 concurrent

6. **Inter-artist delay** em `collect-metrics`:
   - Entre cada artista no loop, inserir delay mínimo (ex: 500ms) + delay dinâmico baseado em `X-RateLimit-Remaining`
   - Se remaining está baixo, esperar até reset antes de processar próximo artista

7. **Migrar `artist-enrich-chartmetric`**:
   - Substituir `Promise.all([cmGet(...), ...])` por `client.sequentialGet([...])` ou bounded(2)
   - Remover `cmGet()` e `cmToken()` locais, importar de `_shared/chartmetric-client.ts`

8. **Migrar `collect-metrics`**:
   - Substituir `Promise.all([cmGet(...), ...])` dentro de `fetchMetricsFromChartmetric` por `client.sequentialGet([...])`
   - No loop de artistas, usar `client.waitIfNeeded()` entre iterações
   - Remover `cmGet()` e `getCmToken()` locais, importar do módulo compartilhado

### Proposed API Surface

```typescript
// supabase/functions/_shared/chartmetric-client.ts

interface ChartmetricClientConfig {
  refreshToken: string;
  maxRetries?: number;          // default: 3
  pacingThreshold?: number;     // default: 2 (remaining requests before proactive pause)
  maxBackoffMs?: number;        // default: 30000
  interRequestDelayMs?: number; // default: 200 (minimum gap between requests)
}

class ChartmetricClient {
  constructor(config: ChartmetricClientConfig);
  
  /** Obtém access token via refresh token */
  getToken(): Promise<string | null>;
  
  /** GET autenticado com rate-limit handling. Retorna .obj ou null */
  get(path: string): Promise<any | null>;
  
  /** Executa múltiplos GETs sequencialmente com pacing */
  sequentialGet(paths: string[]): Promise<(any | null)[]>;
  
  /** Pausa se remaining está abaixo do threshold. Usar entre artistas no batch. */
  waitIfNeeded(): Promise<void>;
}
```

## Testing Strategy

### Validation Approach

A estratégia de testes segue duas fases: primeiro, demonstrar o bug no código não-corrigido com counterexamples, depois verificar que a correção funciona e preserva comportamento existente.

### Exploratory Bug Condition Checking

**Goal**: Surfacer counterexamples que demonstrem o bug ANTES de implementar a correção. Confirmar ou refutar a análise de root cause.

**Test Plan**: Criar mocks da API Chartmetric que retornam 429 com headers de rate limit. Invocar `cmGet()` original e observar que retorna `null` sem retry. Invocar `Promise.all` com múltiplas chamadas e observar burst sem pacing.

**Test Cases**:
1. **429 sem retry**: Mock retorna 429 com `X-RateLimit-Reset` → `cmGet()` retorna `null` imediatamente (will fail on unfixed code — no retry)
2. **Headers ignorados**: Mock retorna 200 com `X-RateLimit-Remaining: 0` → próxima chamada dispara sem delay (will fail on unfixed code — no pacing)
3. **Parallel burst**: Chamar `Promise.all([cmGet(), cmGet(), cmGet(), cmGet()])` → todas disparam simultaneamente sem controle (will fail on unfixed code — no concurrency control)
4. **Batch sem delay**: Simular loop de 5 artistas chamando `fetchMetricsFromChartmetric` → requests disparam sem inter-artist delay (will fail on unfixed code)

**Expected Counterexamples**:
- `cmGet()` retorna `null` em 429 sem tentativa de retry
- Nenhuma leitura de headers `X-RateLimit-*` em nenhum ponto do código
- Requests disparam em < 10ms de intervalo (burst)

### Fix Checking

**Goal**: Verificar que para todos os inputs onde a bug condition é verdadeira, a função corrigida produz o comportamento esperado.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  result := ChartmetricClient.get(request.path)
  ASSERT:
    IF response.status == 429 THEN
      retryWasCalled == true
      AND delayApplied >= (resetAt - now)
      AND result != null (if retry succeeds within maxRetries)
    IF X-RateLimit-Remaining <= threshold THEN
      nextRequestDelay >= (resetAt - now)
    IF consecutiveRetries > 1 THEN
      delay increases exponentially
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos os inputs onde a bug condition NÃO se aplica, a função corrigida produz o mesmo resultado que a original.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT ChartmetricClient.get(request.path) == cmGet_original(request.path, token)
END FOR
```

**Testing Approach**: Property-based testing é recomendado para preservation checking porque:
- Gera muitos cenários de resposta HTTP (2xx, 4xx, 5xx não-429) automaticamente
- Captura edge cases como headers malformados, respostas sem `.obj`, timeouts de rede
- Garante forte evidência de que comportamento não-429 permanece inalterado

**Test Plan**: Observar comportamento do código UNFIXED para respostas 2xx e erros não-429, então escrever property-based tests que verificam que o novo client produz resultados idênticos.

**Test Cases**:
1. **200 response parsing**: Verificar que `client.get()` retorna `.obj` do JSON body identicamente ao `cmGet()` original
2. **Non-429 error handling**: Verificar que 400, 401, 403, 500, 502 continuam retornando `null`
3. **Token flow preservation**: Verificar que `client.getToken()` produz mesmo resultado que `getCmToken()` original
4. **Data persistence unchanged**: Verificar que dados salvos no Supabase mantêm mesma estrutura

### Unit Tests

- Testar `ChartmetricClient.get()` com mock 429 → verificar retry e delay
- Testar exponential backoff: 1s, 2s, 4s para retries consecutivos
- Testar proactive pacing: `X-RateLimit-Remaining: 1` → pausa antes de próxima request
- Testar max retries exceeded → retorna `null` após N tentativas
- Testar `sequentialGet()` → requests executam uma por vez com delay entre elas
- Testar jitter no backoff está dentro de ±10%

### Property-Based Tests

- Gerar respostas HTTP aleatórias (status, headers, body) e verificar: se status !== 429 → resultado idêntico ao `cmGet()` original
- Gerar sequências de responses com `X-RateLimit-Remaining` decrescente e verificar que pacing é aplicado antes de remaining chegar a zero
- Gerar séries de 429 responses e verificar que delay entre retries cresce exponencialmente

### Integration Tests

- Testar `artist-enrich-chartmetric` end-to-end com rate limit mock → enriquecimento completa com dados corretos
- Testar `collect-metrics` batch com 5 artistas e rate limit mock → todos processados sem 429 excessivo
- Testar recovery: mock que retorna 429 nas primeiras 2 requests e 200 depois → dados coletados com sucesso após retry
