# Bugfix Requirements Document

## Introduction

A integração com a API Chartmetric nas Edge Functions `artist-enrich-chartmetric` e `collect-metrics` não implementa nenhum tratamento de rate limiting. A função `cmGet()` trata respostas HTTP 429 (Too Many Requests) como erros genéricos, retornando `null` sem retry. Chamadas paralelas via `Promise.all` excedem a janela de sliding window da API, causando throttling silencioso e perda de dados. A Chartmetric documenta headers `X-RateLimit-Limit`, `X-RateLimit-Remaining` e `X-RateLimit-Reset` que devem ser lidos para conformidade.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the Chartmetric API returns HTTP 429 (Too Many Requests) THEN the system treats it as a generic error and returns `null` without any retry attempt

1.2 WHEN the Chartmetric API returns rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) THEN the system ignores them completely, never reading or acting on remaining quota

1.3 WHEN `artist-enrich-chartmetric` fetches deep metrics THEN the system fires 4 requests simultaneously via `Promise.all` without any pacing, exceeding the sliding window rate limit

1.4 WHEN `collect-metrics` processes a batch of artists THEN the system fires 3+ parallel requests per artist via `Promise.all` with no delay between artists, causing ~60-80 unpaced requests for a batch of 20 artists

1.5 WHEN a 429 response is received repeatedly THEN the system has no exponential backoff mechanism, continuing to return `null` for every subsequent attempt in the same invocation

### Expected Behavior (Correct)

2.1 WHEN the Chartmetric API returns HTTP 429 THEN the system SHALL read the `X-RateLimit-Reset` header, sleep until that timestamp, and retry the request

2.2 WHEN the Chartmetric API returns rate limit headers THEN the system SHALL read `X-RateLimit-Remaining` and proactively pause before making the next request when remaining quota approaches zero

2.3 WHEN `artist-enrich-chartmetric` fetches deep metrics THEN the system SHALL execute requests sequentially or with bounded concurrency (max 1-2 concurrent), inserting a delay between requests to maintain a constant cadence within the sliding window

2.4 WHEN `collect-metrics` processes a batch of artists THEN the system SHALL insert a delay between artists and limit per-artist concurrency, gating throughput on `X-RateLimit-Remaining` rather than a fixed worker count

2.5 WHEN a 429 response is received repeatedly (after initial retry) THEN the system SHALL apply exponential backoff with increasing delays between retries, up to a configurable maximum number of attempts

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the Chartmetric API returns a successful response (HTTP 2xx) THEN the system SHALL CONTINUE TO parse the `.obj` field from the JSON body and return the data normally

3.2 WHEN the Chartmetric API returns a non-429 error (HTTP 4xx/5xx other than 429) THEN the system SHALL CONTINUE TO return `null` for that request (existing error handling behavior)

3.3 WHEN the Chartmetric refresh token is used to obtain an access token THEN the system SHALL CONTINUE TO authenticate and retrieve the token using the existing `/api/token` endpoint flow

3.4 WHEN all metrics are successfully fetched and processed THEN the system SHALL CONTINUE TO save enrichment data to the `artists` table (enrich function) and insert snapshots into `artist_metrics_snapshots` table (collect function) with the same data structure

3.5 WHEN an artist has already been enriched (`enriched === true`) THEN the system SHALL CONTINUE TO return early with `alreadyEnriched: true` without making additional API calls

3.6 WHEN the Chartmetric token is unavailable THEN the system SHALL CONTINUE TO return `{ ok: false, reason: "chartmetric_unavailable" }` without attempting API calls
