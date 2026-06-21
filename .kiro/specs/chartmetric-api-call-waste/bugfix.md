# Bugfix Requirements Document

## Introduction

A API do Chartmetric está sendo chamada repetidamente sem necessidade, gerando custo excessivo de créditos. O endpoint `get-ids` foi chamado 40+ vezes em um único dia para o mesmo artista (quase todas com erro), e outros endpoints de enriquecimento são invocados em duplicata com segundos de diferença. O problema afeta diretamente o custo operacional da plataforma.

Evidência no banco: o artista "Heinzy" tem `cm_artist_id = 4655534` (já resolvido), `fetched_at = 2026-06-20T18:53:53`, mas `enriched = "false"` e `genres = null`, `similar = null`. O guard de idempotência nunca é satisfeito, causando loop infinito de chamadas.

Adicionalmente, os dados buscados na etapa de diagnóstico (ex: `/api/artist/:id` às 18:53) não são reutilizados na etapa seguinte de criação do planejamento estratégico (chamada repetida às 18:55). Cada módulo deveria consumir os dados já persistidos no `content.chartmetricProfile` ao invés de re-buscar da API.

As causas raiz são: (1) ausência de persistência do estado "artista não existe na CM", (2) guard de idempotência falho que permite re-execuções infinitas, (3) ausência de TTL/cache nos dados do Chartmetric, (4) múltiplos triggers concorrentes sem deduplicação, (5) dados não compartilhados entre módulos/etapas do fluxo, (6) chamadas automatizadas de backend sem vinculação a assinatura PRO.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN o Wizard abre para um artista que não existe na Chartmetric (get-ids retorna null) THEN o sistema chama `artist-enrich-chartmetric` a cada abertura sem nunca persistir o estado "não encontrado", resultando em chamadas infinitas ao endpoint get-ids

1.2 WHEN o artista existe na Chartmetric mas é pequeno (sem genres/similar retornados pela API) THEN o guard de idempotência (`enriched === true && genres?.length && similar?.length`) falha e o sistema re-executa o enriquecimento completo (6 chamadas à API) em toda abertura do Wizard, mesmo com `fetched_at` recente

1.3 WHEN o Wizard abre para um artista já enriquecido com `fetched_at` recente (minutos/horas atrás) THEN o sistema dispara `artist-enrich-chartmetric` novamente porque não há verificação de TTL/freshness no frontend antes de disparar

1.4 WHEN o ProfileUnlock completa o pagamento THEN o sistema dispara `artist-enrich-chartmetric` incondicionalmente sem verificar se os dados já foram buscados recentemente (sem checar `fetched_at`)

1.5 WHEN o Wizard e o ProfileUnlock disparam enriquecimento simultaneamente para o mesmo artista THEN duas execuções concorrentes da Edge Function fazem chamadas duplicadas à API do Chartmetric (12 chamadas ao invés de 6)

1.6 WHEN o `collect-metrics` resolve o cm_artist_id para um artista que já tem `cm_artist_id` salvo no content THEN o sistema chama get-ids via API novamente ao invés de reusar o ID persistido no banco

1.7 WHEN o usuário completa a etapa de diagnóstico (que busca `/api/artist/:id` com sucesso e salva no content) e logo em seguida entra na etapa de criação do planejamento estratégico THEN o sistema chama `/api/artist/:id` novamente ao invés de consumir os dados já salvos em `content.chartmetricProfile`

1.8 WHEN o `collect-metrics` roda automaticamente para um artista cujo dono NÃO tem assinatura PRO ativa THEN o sistema deveria barrar a chamada, mas a verificação PRO no `collect-metrics` SOMENTE se aplica à coleta mensal — outros triggers de backend (como cron ou webhook) podem não verificar

### Expected Behavior (Correct)

2.1 WHEN o get-ids retorna null (artista não existe na Chartmetric) THEN o sistema SHALL persistir um marcador `cm_not_found: true` com `cm_not_found_at: ISO` no content do artista e não re-tentar por pelo menos 7 dias

2.2 WHEN o artista existe na Chartmetric mas genres/similar estão vazios E o enriquecimento já rodou (dados foram buscados com `fetched_at` válido) THEN o sistema SHALL considerar o artista como enriquecido e não re-buscar, aceitando que artistas pequenos podem não ter esses dados — o guard de idempotência SHALL usar `fetched_at` dentro do TTL como condição suficiente

2.3 WHEN o Wizard abre para um artista com `chartmetricProfile.fetched_at` dentro do TTL (24 horas) THEN o sistema SHALL usar os dados em cache e não disparar `artist-enrich-chartmetric`, independente de genres/similar estarem vazios

2.4 WHEN o ProfileUnlock completa o pagamento THEN o sistema SHALL verificar `chartmetricProfile.fetched_at` e só disparar enriquecimento se os dados estão stale (> 24 horas ou ausentes)

2.5 WHEN múltiplos triggers tentam enriquecer o mesmo artista simultaneamente THEN o sistema SHALL executar apenas uma chamada à API do Chartmetric e as subsequentes devem receber a resposta `alreadyEnriched` ou ser ignoradas (deduplicação)

2.6 WHEN o `collect-metrics` precisa do cm_artist_id e o artista já tem `content.chartmetricProfile.cm_artist_id` persistido THEN o sistema SHALL reusar o ID salvo sem chamar get-ids novamente

2.7 WHEN um módulo subsequente (ex: criação do planejamento estratégico) precisa de dados do artista que já foram buscados e salvos em `content.chartmetricProfile` na etapa anterior (ex: diagnóstico) THEN o sistema SHALL consumir os dados persistidos no banco ao invés de fazer nova chamada à API, só buscando novamente se o dado específico necessário estiver ausente

2.8 WHEN qualquer chamada automatizada de backend à API do Chartmetric é disparada THEN o sistema SHALL verificar que o dono do artista tem assinatura PRO ativa antes de executar — se não tiver PRO, a chamada SHALL ser bloqueada e logada como "skipped_no_pro"

2.9 WHEN a primeira coleta automatizada de backend ocorre para um artista novo THEN o sistema SHALL agendar a próxima coleta para 30 dias depois, sempre vinculada ao status PRO do dono

### Unchanged Behavior (Regression Prevention)

3.1 WHEN o Wizard abre para um artista sem dados Chartmetric E sem marcador `cm_not_found` E sem `fetched_at` THEN o sistema SHALL CONTINUE TO disparar o enriquecimento pela primeira vez (first-time fetch)

3.2 WHEN o ProfileUnlock completa pagamento para um artista nunca enriquecido (sem `chartmetricProfile` ou com `fetched_at` > 24h) THEN o sistema SHALL CONTINUE TO disparar o enriquecimento profundo pós-pago

3.3 WHEN o `collect-metrics` roda para artistas elegíveis (snapshot >= 30 dias) com dono PRO ativo THEN o sistema SHALL CONTINUE TO coletar métricas normalmente usando a API do Chartmetric

3.4 WHEN os dados do Chartmetric estão stale (fetched_at > 24 horas) e o Wizard abre THEN o sistema SHALL CONTINUE TO disparar o enriquecimento para atualizar os dados

3.5 WHEN o Chartmetric retorna dados completos (com genres e similar) THEN o sistema SHALL CONTINUE TO persistir todos os campos normalmente no `chartmetricProfile`

3.6 WHEN o artista marcado como `cm_not_found` ultrapassa o período de retry (7 dias) THEN o sistema SHALL CONTINUE TO tentar resolver o cm_artist_id novamente (o artista pode ter sido adicionado à Chartmetric)

3.7 WHEN o usuário com PRO ativo tem artistas elegíveis para coleta mensal THEN o sistema SHALL CONTINUE TO executar a coleta automatizada no ciclo de 30 dias

---

## Bug Condition (Formal)

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type EnrichRequest { artistId, chartmetricProfile, triggerSource, userHasPro }
  OUTPUT: boolean
  
  // O bug ocorre quando o enriquecimento é disparado desnecessariamente:
  // - Artista não existe na CM e não foi marcado (re-tentativa infinita)
  // - Artista já enriquecido mas guard falha (genres/similar vazios com fetched_at recente)
  // - Dados frescos mas sem verificação de TTL
  // - Chamada concorrente duplicada
  // - Módulo subsequente re-busca dados já persistidos
  // - Chamada automatizada sem verificação PRO
  
  LET profile = X.chartmetricProfile
  LET hasNotFoundMarker = profile.cm_not_found = true AND daysSince(profile.cm_not_found_at) < 7
  LET isFresh = profile.fetched_at IS NOT NULL AND hoursSince(profile.fetched_at) < 24
  LET isBackendWithoutPro = X.triggerSource = "backend_automated" AND X.userHasPro = false
  
  RETURN hasNotFoundMarker OR isFresh OR isBackendWithoutPro
END FUNCTION
```

```pascal
// Property: Fix Checking — chamadas desnecessárias eliminadas
FOR ALL X WHERE isBugCondition(X) DO
  result ← artistEnrichChartmetric'(X)
  ASSERT result.apiCallsMade = 0
  ASSERT result = { ok: true, alreadyEnriched: true } 
      OR result = { ok: true, skipped: "not_found_cached" }
      OR result = { ok: true, skipped: "fresh_data" }
      OR result = { ok: false, skipped: "no_pro" }
END FOR
```

```pascal
// Property: Preservation Checking — primeiro enriquecimento e refresh continua funcionando
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT artistEnrichChartmetric(X) = artistEnrichChartmetric'(X)
END FOR
```

```pascal
// Property: Data Reuse — módulos subsequentes consomem dados do banco
FOR ALL X WHERE X.chartmetricProfile.fetched_at IS NOT NULL 
           AND hoursSince(X.chartmetricProfile.fetched_at) < 24 DO
  result ← moduloSubsequente'(X)
  ASSERT result.apiCallsMade = 0
  ASSERT result.dataSource = "cache" // dados vieram do content persistido
END FOR
```
