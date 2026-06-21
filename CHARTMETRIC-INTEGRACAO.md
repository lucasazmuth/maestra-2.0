# Integração Chartmetric — Plano técnico

> Documento de planejamento (sem código) para alinhar com sócios/equipe. Descreve **como** integrar a API da Chartmetric à Maestra para deixar o produto mais potente e a IA mais inteligente, usando **dados reais** dos perfis cadastrados.
> Prioridades definidas: **(1) IA mais inteligente (calibração/contexto)**, **(2) audiência no Dashboard**, **(3) gráfico de crescimento**. (Benchmarking vs. similares fica para depois.)

---

## 1. Contexto e objetivo

Hoje a Maestra depende só do **Spotify**, e de forma frágil: o perfil do artista (`SpotifyProfile` em `src/interfaces/maestra.ts`) tem apenas `followers`, `popularity`, `genres`, `track_count` — obtidos via um *hack* do token do embed (`src/services/spotifyArtist.ts`), porque a API pública do Spotify cortou esses campos. É pouco dado e instável.

A **Chartmetric** entrega dados ricos e confiáveis num só lugar e habilita exatamente os 3 usos priorizados. O objetivo é plugar esses dados onde a Maestra já consome (perfil do artista + contexto da IA + Dashboard).

---

## 2. O que a Chartmetric agrega

| Dado | Hoje (Spotify) | Com Chartmetric |
|------|----------------|-----------------|
| Ouvintes mensais | ❌ | ✅ monthly listeners |
| Métricas multi-plataforma | ❌ (só Spotify) | ✅ Spotify, YouTube, TikTok, Instagram… |
| Audiência / demografia | ❌ | ✅ top **países e cidades**, faixa etária, gênero |
| Série temporal (crescimento) | ❌ | ✅ evolução de seguidores/ouvintes no tempo |
| Rank / score de carreira | ❌ | ✅ posição no segmento |

---

## 3. Fundamentos da API (confirmado na doc oficial)

- **Base URL:** `https://api.chartmetric.com`
- **Autenticação:** `POST /api/token` com corpo `{ "refreshtoken": "..." }` → retorna um **Bearer token válido por 1h** (`expires_in: 3600`). Reusar o token; **não** gerar por requisição.
- **Header:** `Authorization: Bearer {token}`
- **Rate limit:** headers `X-RateLimit-Limit / -Remaining / -Reset` por resposta; tratar `429`. (Números exatos dependem do plano/tier — confirmar no acesso.)
- **Endpoints de artista** (paths finos a confirmar com o acesso — a `/reference` é renderizada por JS):
  - Resolver o `cm_artist_id` a partir do **Spotify ID** (mapa de IDs de plataforma) ou por busca.
  - `GET /api/artist/{id}` — metadados + estatísticas atuais + rank/score.
  - `GET /api/artist/{id}/stat/{plataforma}` — **série temporal** (seguidores/ouvintes ao longo do tempo) → crescimento.
  - Endpoints de **audiência** (`audience-stats` / `where-people-listen`) — cidades/países, demografia.

> ⚠️ **Bloqueador:** o acesso à API **ainda não foi aprovado** (é o que o e-mail de reconsideração resolve) e exige um **`refreshtoken`** emitido pela Chartmetric. Sem isso não é possível testar nem subir a integração.

---

## 4. Arquitetura (espelhando o padrão Spotify já existente)

```
Edge Function "chartmetric" (Supabase, servidor)   ← guarda CHARTMETRIC_REFRESH_TOKEN
        │  (troca refresh→Bearer, cacheia ~1h)
        ▼
  resolve cm_artist_id  →  métricas + audiência + séries temporais
        │  (normaliza)
        ▼
  artist.content.chartmetricProfile   ← NOVO campo (igual ao spotifyProfile)
        │
        ├─► refreshChartmetricProfile (thunk)  → relê o banco antes de gravar (sem clobber)
        │
        ├─► IA: chartmetricContext()/calibrationContext()  → injeta nos prompts
        │       (wizard-ai  E  nyta-chat)
        │
        └─► Dashboard: audiência (cidades/países) + gráfico de crescimento + ouvintes mensais
```

**Por que uma Edge Function (servidor), e não client-side como o Spotify:** o `refreshtoken` é credencial sensível e **não pode ir no bundle do React**. Fica no servidor via `Deno.env.get("CHARTMETRIC_REFRESH_TOKEN")`, igual a `GROQ_API_KEY` / `ASAAS_API_KEY` hoje (ver `supabase/SECRETS.md`).

**Reuso do padrão existente:** a mecânica espelha o `refreshSpotifyProfile` (`src/store/slices/artists.ts`), que já **relê o conteúdo mais recente do banco antes de gravar** (evita sobrescrever progresso) — vamos replicar exatamente isso.

---

## 5. Modelo de dados (novo `ChartmetricProfile`)

Novo campo em `ArtistContent` (`src/interfaces/maestra.ts`), preenchido pela Edge Function:

```ts
interface ChartmetricProfile {
  cm_artist_id: number;
  monthly_listeners?: number;
  followers_by_platform?: { spotify?: number; youtube?: number; tiktok?: number; instagram?: number };
  career_rank?: number;        // posição/score no segmento
  audience?: {
    top_countries?: { name: string; pct: number }[];
    top_cities?: { name: string; country: string; listeners?: number }[];
    age?: { range: string; pct: number }[];
    gender?: { male?: number; female?: number };
  };
  growth?: {                   // série temporal resumida (para o gráfico + IA)
    listeners_30d_pct?: number;
    points?: { date: string; value: number }[];   // ex.: ouvintes/seguidores ao longo do tempo
  };
  fetched_at: string;          // ISO — controla o cache (STALE_MS, igual ao Spotify)
}
```

---

## 6. Detalhe das 3 prioridades

### Prioridade 1 — IA mais inteligente (calibração/contexto) — **maior alavanca**
Onde plugar: `supabase/functions/wizard-ai/index.ts` (funções `spotifyContext()` e `calibrationContext()`) e `supabase/functions/nyta-chat/index.ts`.
- Hoje a `calibrationContext` calibra metas só com `followers`/`popularity` do Spotify. Vamos adicionar um `chartmetricContext()` que injeta: **ouvintes mensais**, **crescimento recente (%)**, **principais cidades/países** e **rank**.
- Ganhos concretos:
  - **Metas realistas** ancoradas em ouvintes mensais e momentum real (não chute).
  - **Objetivos/estratégias ancorados na audiência real**: "seus ouvintes estão em SP, BH e Lisboa" → shows/festivais certos; "+18%/mês no TikTok" → priorizar o canal.
  - Vale para o **wizard** (planejamento) e para a **Maestra IA** (assistente).

### Prioridade 2 — Audiência no Dashboard
Onde plugar: `src/pages/Dashboard/` (nova seção) + `DashboardOverview`.
- Mostrar ao artista: **top cidades/países** (lista ou mapa simples), **faixa etária/gênero**, **ouvintes mensais**.
- Fonte: `chartmetricProfile.audience` + `monthly_listeners`.

### Prioridade 3 — Gráfico de crescimento
Onde plugar: Dashboard (card de gráfico).
- Linha temporal de seguidores/ouvintes (`chartmetricProfile.growth.points`).
- Biblioteca de chart: avaliar uma leve (ou SVG próprio) para não pesar o bundle.

---

## 7. Plano de implementação (faseado)

| Fase | Entrega | Arquivos-chave |
|------|---------|----------------|
| **0 — Bloqueador** | Acesso à API + `refreshtoken` (e-mail de reconsideração) | — |
| **1 — Núcleo + IA** | Edge Function `chartmetric`; campo `chartmetricProfile`; `refreshChartmetricProfile`; `chartmetricContext()` nos 2 edge functions de IA | `supabase/functions/chartmetric/`, `src/interfaces/maestra.ts`, `src/store/slices/artists.ts`, `supabase/functions/wizard-ai/index.ts`, `supabase/functions/nyta-chat/index.ts`, `supabase/SECRETS.md` |
| **2 — Audiência no Dashboard** | Seção de audiência (cidades/países, demografia, ouvintes mensais) | `src/pages/Dashboard/*` |
| **3 — Gráfico de crescimento** | Card com série temporal | `src/pages/Dashboard/*` |

**Gatilho do refresh:** ao abrir o perfil (se houver `cm_artist_id` e o cache estiver velho) e via botão manual "Atualizar dados" — igual ao "Atualizar do Spotify" de hoje no Catálogo.

---

## 8. Dependências, conformidade e riscos

- **Acesso/credencial:** depende da aprovação da Chartmetric + `refreshtoken` (Fase 0). **Sem isso, não há teste real.**
- **Plano/custo:** a API é paga por tier; confirmar limite de chamadas e custo antes de escalar.
- **Rate limits:** cachear agressivamente (token 1h; `chartmetricProfile` com `STALE_MS` como o Spotify) e tratar `429`.
- **Conformidade (Termos):** dados consumidos **dentro do app**, com **atribuição à Chartmetric**; **sem revenda/redistribuição** de dados brutos.
- **Cobertura:** artistas muito pequenos podem não existir na Chartmetric → **fallback** para os dados do Spotify (o perfil atual continua funcionando).
- **Privacidade/secret:** `refreshtoken` só no servidor (Edge Function), nunca no front.

---

## 9. Resumo executivo (para sócios)
- A Chartmetric transforma a Maestra de "dados rasos do Spotify" para **inteligência real de carreira**: ouvintes mensais, **de onde são os fãs**, e **como a carreira cresce**.
- O maior salto é na **IA**: metas e estratégias deixam de ser genéricas e passam a se basear em **audiência e crescimento reais** do artista.
- A arquitetura **reaproveita o padrão Spotify** já existente (baixo risco, rápido de construir).
- **Pré-requisito:** aprovar o acesso à API (e-mail de reconsideração já redigido).

*Próximo passo recomendado: garantir o acesso (Fase 0); em paralelo, posso construir a Fase 1 já "gateada" pelo secret, pronta para ligar assim que o `refreshtoken` chegar.*
