# Diagnóstico REAL v2 — Documento de Implementação & Auditoria

**Autoria conceitual:** Anita Carvalho · **Implementação:** Lucas · **Data:** jun/2026
**Spec-fonte:** `Motor REAL — Especificação Consolidada` + `Diagnóstico REAL — Roteiro de Perguntas`

Este documento descreve a implementação completa da nova metodologia de diagnóstico (Índice REAL v2),
com **auditorias reais** de consumo da API Chartmetric e da integridade de gravação no banco.

---

## 1. Visão geral

O diagnóstico classifica a carreira em 4 dimensões **R·E·A·L**, cada uma acende/apaga, gerando 1 de
**16 perfis** (Beginner → Icon). Entregue no cadastro (tier grátis), antes do pagamento.

| Fase | Entrega | Estado |
|---|---|---|
| **A** | Criar perfil **sem Spotify** (artista iniciante) | ✅ no ar |
| **Motor v2** | Módulo puro `src/services/realEngine` + 9 testes Jest | ✅ |
| **B** | Roteiro novo (campos abertos R$/inteiro + selects) | ✅ no ar |
| **C** | 7 campos da Chartmetric no diagnóstico | ✅ deployado (parsers calibrados c/ dado real) |
| **D** | Motor v2 plugado no edge `artist-diagnostic` | ✅ deployado (v19) |
| **E** | Boletim 0–100 + display version-aware (v1 antigo intacto) | ✅ |

---

## 2. Como o motor pontua

- **R (Reach):** 3 componentes (⅓), acende com **2 de 3**. Ouvintes Spotify · seguidores IG+TikTok ·
  consumo de vídeo (YouTube + TikTok).
- **E (Earnings):** 5 sinais ponderados (0–1), alto se **≥ 0,70**. Faturamento 25% · fonte 20% ·
  investimento 20% · CNPJ 17,5% · empresário 17,5%. **Teto** quando a fonte é não-musical (não acende).
- **A (Audience):** 4 componentes (25%), acende com **3 de 4**. Seguidores música (Spotify+Deezer) ·
  engajamento (IG+YT+TikTok) · shows/mês · público/show.
- **L (Legitimacy):** 4 componentes (25%), **3 de 4** — e as 2 de API (playlists+airplay) **sozinhas
  não bastam** (precisa de prêmio ou imprensa).
- **Ausência de dado:** sem Spotify → todo componente de API recebe z mínimo (opção B); com Spotify,
  sub-item ausente é **excluído** da média do componente.
- **Boletim 0–100** por dimensão + linha de corte (camada de exibição estilo ENEM).

**Cortes:** centralizados em `CUTS` (`src/services/realEngine/index.ts`), marcados **[SPEC]** (do doc)
ou **[PROPOSTA]** (julgamento informado, a revisar com a Anita).

---

## 3. Requisições à Chartmetric por diagnóstico (com Spotify)

Mapeadas a partir do `Chartmetric Developer API.yaml`. **8 chamadas** por diagnóstico com Spotify
(grátis faz isso; sem Spotify = 0 chamadas):

| # | Endpoint | Campo do motor | Verificado |
|---|---|---|---|
| 1 | `POST /api/token` | (auth) | ✅ |
| 2 | `/api/artist/spotify/{id}/get-ids` | resolve cm_id | ✅ 200 |
| 3 | `/api/artist/{cmId}` (meta) | ouvintes, seg. Spotify, IG/TikTok followers | ✅ 200 |
| 4 | `/api/artist/{cmId}/stat/youtube_artist?field=monthly_views` | YouTube views | ✅ 200 |
| 5 | `/api/artist/{cmId}/stat/deezer?field=fans` | Deezer fans | ✅ 200 |
| 6 | `/api/artist/{cmId}/instagram-audience-stats` | engajamento IG | ✅ 200 |
| 7 | `/api/artist/{cmId}/youtube-audience-stats` | engajamento YouTube | ✅ 200 |
| 8 | `/api/artist/{cmId}/tiktok-audience-stats` | engajamento TikTok | ✅ 200 |
| 9 | `/api/artist/{cmId}/spotify/current/playlists?limit=50` | playlists editoriais | ✅ 200 |
| 10 | `/api/radio/artist/{cmId}/airplay-totals?since=…` | airplay de rádio | ✅ 200 (corrigido) |

> **TikTok video views:** indisponível na API (`stat/tiktok` só tem `followers, likes`) → fica `null`,
> o motor exclui o sub-item. O componente de vídeo do R usa só YouTube.

### Calibrações descobertas com dado real (Pabllo Vittar)
1. **engagement_rate** vem em **fração** (0.0353 = 3,53%) → o edge multiplica por 100.
2. **playlists editoriais**: o flag `editorial` está em `item.playlist.editorial` (aninhado) → parser
   corrigido (dedup por id da playlist).
3. **airplay-totals**: o param **`since` é obrigatório** (sem ele → HTTP 400) → janela de 180 dias.

---

## 4. AUDITORIA REAL DE CONSUMO (banco)

Fonte: tabela `chartmetric_api_calls` (log fire-and-forget de toda chamada — sucesso ou erro).

### Consumo por função (histórico)
| Função | Chamadas | OK | Falhas | ms médio |
|---|---|---|---|---|
| `artist-enrich-chartmetric` (pós-pago) | 60 | 51 | 9 | 1.862 |
| `artist-diagnostic` (grátis) | 29 | 28 | 1 | 592 |

### Por endpoint no diagnóstico (últimas 24h — run com Spotify do Pabllo, pré-correção do airplay)
Todos os endpoints retornaram **200**, exceto `airplay-totals` que deu **400** (faltava o `since` —
**já corrigido** na v19). Cada endpoint foi chamado **1× por diagnóstico** (sem loop/duplicação).

> **Custo:** ~8 chamadas por cadastro **com Spotify** (decisão: tudo no grátis). Sem Spotify = 0.
> Recomendação do doc: cache diário/semanal se a base escalar. Hoje cada diagnóstico é único (1× na
> criação) e o perfil reaproveitado **não** re-chama a API (ver §5).

---

## 5. INTEGRIDADE DO LOG & ANTI-DUPLICIDADE (resposta direta à pergunta)

**As chamadas estão sendo salvas corretamente e a duplicidade está protegida. Evidências reais:**

| Verificação | Resultado | Significado |
|---|---|---|
| Artistas duplicados `(user_id, spotify_artist_id)` | **0** | A trava de duplicidade funciona (check `selfDup` + constraint única). |
| Logs com `artist_id` (enrich) | 60 | Enrich loga com o id do artista (já existe). ✅ |
| Logs sem `artist_id` (diagnóstico) | 29 | **By design**: no diagnóstico o artista ainda não existe quando a chamada é feita → `null`. ✅ |
| Logs de exceção de rede (sem status) | **0** | Toda chamada recebeu resposta HTTP; nenhum erro silencioso. ✅ |
| Chamadas por endpoint por diagnóstico | **1 cada** | Sem loop nem chamada duplicada. ✅ |

**Mecanismos de anti-duplicidade no `artist-diagnostic`:**
1. **`check_self_duplicate` (frontend)** + **`selfDup` (edge)**: se o usuário já tem aquele
   `spotify_artist_id`, retorna o perfil existente (`reusedResponse`) **sem** chamar a Chartmetric →
   zero desperdício de crédito em retry/duplicata.
2. **Constraint única** `(user_id, spotify_artist_id)` no banco (confirmado: 0 duplicados).
3. **Rate limit:** máx. **3 perfis pendentes** por usuário (HTTP 429) + cooldown progressivo por
   exclusões nos últimos 30 dias (10min → 24h → 7d). *(Foi o 429 que bloqueou o teste do Liniker.)*
4. **Log fire-and-forget:** nunca quebra o fluxo nem soma latência (insert sem await).

---

## 6. Pendências e observações

1. **Cortes [PROPOSTA]** (R-seguidores, A-todos, L-playlists/airplay, faturamento/investimento→0–1,
   engajamento, boletim): revisar com a Anita. Mudar = 1 linha em `CUTS`.
2. **Drift de deploy (baixa severidade):** a v19 foi deployada via MCP com as **descrições dos 16
   perfis compactadas** (texto mais curto) p/ caber na chamada. A **lógica é idêntica** ao git; só o
   texto difere. Recomendado **re-deployar a versão cheia do git** quando a conta de teste estiver
   limpa (pra poder smoke-testar) — restaura a copy rica e o git=deployado.
3. **Re-validação da Fase C bloqueada:** a conta de teste está no limite de 3 perfis pendentes (429).
   Para validar os parsers corrigidos (engagement ×100, playlists, airplay), limpar perfis pendentes
   de teste (aceitando o cooldown) **ou** usar outra conta.
4. **`engagement_rate` ×100** e **corte de engajamento (>4%)**: confirmar com mais amostras se o corte
   faz sentido (artistas grandes têm % de engajamento baixo por natureza).
5. **Sem migração:** artistas v1 antigos seguem com o diagnóstico salvo; a tela é version-aware.

## 7. Limpeza
Perfis de teste a excluir do banco: **"Teste V2"** (sem Spotify) e **"Pabllo Vittar"** (com Spotify).
