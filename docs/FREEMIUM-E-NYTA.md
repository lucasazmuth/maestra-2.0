# Maestra — Modelo Freemium + Nyta (Chat IA)

> Projeto do sistema de assinatura freemium e do assistente Nyta. Status: aprovado para execução em fases.

## 1. O modelo

| Funcionalidade | Grátis | Pro (R$ 49,90/mês) |
|---|---|---|
| Conta + login | ✔ | ✔ |
| Perfis de artista | **1** | Ilimitados |
| Painel (dashboard) | ✔ (sem exigir wizard) | ✔ |
| Catálogo | **até 10 faixas** cadastradas | Ilimitado |
| Agenda | ✔ livre | ✔ |
| Equipe | ✖ bloqueado | ✔ |
| Planejamento Estratégico (wizard + plano de ação) | ✖ bloqueado | ✔ |
| **Nyta** (chat IA com CRUD) | ✖ bloqueado | ✔ |

**Tese de conversão**: o usuário entra grátis, cria o perfil com dados reais do Spotify, usa catálogo e agenda — e os dois grandes ímãs (Planejamento Estratégico e Nyta) ficam **visíveis e desejáveis, mas bloqueados** com telas de upsell bonitas (estilo Spotify: mostra o valor, não esconde). O banner de rodapé (já implementado) mantém o lembrete.

**Assunções tomadas** (corrigir aqui se necessário):
- "10 faixas" = faixas cadastradas manualmente no catálogo; o catálogo importado do Spotify é read-only e não conta.
- Plano de Ação faz parte do "Planejamento" → Pro.
- Notificações, Perfil do artista e Settings: livres.
- Variante de conversão a considerar depois: liberar a etapa 1 do wizard (Identidade) grátis e travar da etapa 2 em diante — o usuário "prova" a experiência antes do paywall.

## 2. Arquitetura

### 2.1 Entitlements — fonte única de verdade
Novo hook `src/hooks/useEntitlements.ts`:

```ts
interface Entitlements {
  plan: 'free' | 'pro';
  maxArtists: number;        // 1 | Infinity
  maxCatalogTracks: number;  // 10 | Infinity
  team: boolean;
  planning: boolean;         // wizard + action-plan
  nyta: boolean;
}
```

- Deriva de `state.subscription`: `active` (ou `overdue` dentro do período de graça) → `pro`; resto → `free`.
- `PAYWALL_DISABLED` (env de dev, já existe em `constants/maestra.ts`) → tudo `pro`.
- `useCanCreateArtist` e `useSubscriptionGuard` passam a consumir este hook (deixam de ter regra própria).

### 2.2 Roteamento (App.tsx)
- **Remover** o `SubscriptionGuardWrapper` global: `/artists`, `/artists/:id` (dashboard), catálogo e agenda ficam livres.
- **`RequireOnboarding` deixa de bloquear o dashboard** — usuário free vai direto ao painel após criar o perfil. Os cards de planejamento do dashboard ganham estado vazio com CTA.
- Wizard, ActionPlan e Team: envelope `<RequireFeature feature='planning'|'team'>` que renderiza **`LockedFeature`** (tela de upsell) em vez de redirect.

### 2.3 Componentes de monetização
- **`LockedFeature`** (novo): hero com gradiente, ícone do módulo, 3 bullets de benefício, CTA "Assinar Maestra Pro" → `/assinatura`. Usado em Wizard/ActionPlan/Team para free.
- **`UpsellModal`** (novo): modal disparado em limites — 2º artista, 11ª faixa, FAB da Nyta no free.
- **`AnnouncementBanner`** (já existe): lembrete persistente no rodapé.
- Sidebar: módulos Pro ganham cadeado discreto para usuários free.

### 2.4 Limites free
- **Artistas**: `useCanCreateArtist` → free com 1 artista já criado bloqueia o botão e abre `UpsellModal`.
- **Catálogo**: contador "7/10 faixas" no header; criar a 11ª abre `UpsellModal`.
- **Hardening (fase 5)**: enforcement no Postgres (trigger/policy contando artists e catalog_items por user free) — o client-side é UX, não segurança.

## 3. Nyta — assistente IA com CRUD

A killer feature Pro. Chat que enxerga o perfil selecionado e executa ações reais.

### 3.1 Backend — edge function `nyta-chat`
- Mesma stack do `wizard-ai`: Groq `llama-3.3-70b-versatile` (custo ~0), agora com **tool calling** em loop agentic server-side (máx. 6 iterações por mensagem).
- **Segurança**: a function recebe o JWT do usuário e cria o client Supabase com esse token → **RLS garante** que a Nyta só lê/escreve o que o próprio usuário pode. Nenhuma service key envolvida no CRUD.
- **Tools (MVP)**:
  - `get_artist_overview` — resumo do content (identidade, objetivos, SWOT, estratégias, tasks) + stats Spotify
  - `create_task` / `update_task_status` — no plano de ação (strategies[].tasks)
  - `list_agenda_events` / `create_agenda_event` / `update_agenda_event` / `delete_agenda_event`
  - `list_catalog` / `create_catalog_item` / `update_catalog_item`
- Ações destrutivas (delete) exigem confirmação: a tool devolve `requires_confirmation` e a Nyta pergunta antes.
- **Fase 2 da Nyta**: tool `search_knowledge_base` usando a esteira de embeddings já deployada (`generate-embeddings`) — respostas com RAG sobre a base de planos estratégicos.

### 3.2 Persistência
Migration nova:
```sql
nyta_conversations (id, user_id, artist_id, title, created_at)
nyta_messages (id, conversation_id, role, content, tool_calls jsonb, created_at)
-- RLS: user_id = auth.uid() via join
```

### 3.3 UI
- **FAB da Nyta** (avatar próprio) visível em todas as páginas do artista; free vê com cadeado → `UpsellModal`.
- **Painel de chat**: Drawer à direita no desktop / fullscreen no mobile. Bolhas no design system (Encore). 
- **Action cards**: quando a Nyta executa CRUD, renderiza um card de resultado ("Tarefa criada — Gravar teaser, 24 jun") com link para o módulo.
- Primeira conversa: Nyta se apresenta e sugere 3 ações contextuais ao perfil.

## 4. Roadmap de execução

### Fase 1 — Fundação freemium
1. Criar `useEntitlements` + refatorar `useCanCreateArtist`/`useSubscriptionGuard` para consumi-lo
2. Reestruturar rotas: remover guard global; dashboard livre sem onboarding
3. Dashboard: estados vazios de planejamento com CTA Pro
4. Criar `LockedFeature` + `UpsellModal`
5. Limite de 1 artista no free

### Fase 2 — Gates por módulo
6. Catálogo: contador + limite de 10 faixas
7. Equipe: `LockedFeature`
8. Wizard + ActionPlan: `LockedFeature` com preview
9. Cadeados na sidebar

### Fase 3 — Pagamento end-to-end (backend Asaas já deployado hoje: asaas-create-customer/-create-subscription/-subscription-status/-cancel-subscription/-webhook)
10. Testar fluxo completo: assinar → PIX → webhook → status `active` → entitlements `pro`
11. QA dos 5 estados: none / pending / active / overdue (graça) / cancelled
12. Página /assinatura: refletir o modelo free vs pro (tabela comparativa)

### Fase 4 — Nyta MVP
13. Migration `nyta_conversations`/`nyta_messages` + RLS
14. Edge function `nyta-chat` (loop de tools, JWT do usuário, fonte versionada em `supabase/functions/`)
15. UI: FAB + drawer de chat + action cards
16. Gate Pro + onboarding da Nyta

### Fase 5 — Hardening e crescimento
17. Enforcement server-side dos limites free (trigger/policy)
18. RAG: tool `search_knowledge_base` (embeddings já existem)
19. Telemetria de conversão (viu lock → clicou → assinou)

## 5. Riscos e dependências
- **Asaas em sandbox vs produção**: validar API key/ambiente das functions deployadas hoje (v1, sem testes ainda).
- **Dashboard sem wizard**: páginas que assumem `content.strategies` etc. precisam de null-safety/empty states (varrer Dashboard e módulos).
- **Migração de usuários atuais**: artistas existentes com planejamento concluído continuam funcionando (são todos de contas que viram `free` até assinarem — planejamento deles fica read-only? **Decisão pendente**: sugerido ler-sim/editar-não no free).
- **Groq tool calling**: llama-3.3-70b suporta tools, mas validar qualidade; fallback: Claude Haiku via API se a taxa de erro de tools for alta.
