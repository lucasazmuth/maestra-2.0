import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const PAYWALL_DISABLED = Deno.env.get("PAYWALL_DISABLED") === "true";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, apikey, x-client-info, x-supabase-api-version",
};

// IMPORTANTE: o artist_id NÃO é exposto nas ferramentas — o servidor injeta o da
// conversa em executeTool. Isso elimina a classe de erro "artist_id: auto" do modelo
// e garante por construção que nenhuma operação cruza artistas.
const NYTA_SYSTEM_PROMPT = `Você é a Nyta, a inteligência da Maestra Manager: consultora estratégica de carreira da indústria musical. Você faz parte da plataforma Maestra, onde artistas independentes gerenciam suas carreiras.

## Personalidade
- Direta com firmeza carinhosa, prática, acessível. Fale em português brasileiro. Empodere o artista a pensar, não entregue tudo mastigado.
- Seja direta. Quando o usuário pedir uma ação com dados suficientes, EXECUTE via function calling imediatamente.

## FRONTEIRA DA ARTE (regra inegociável)
- Você trabalha a estratégia EM TORNO da obra, NUNCA a obra em si. Nunca opine se uma música é boa/ruim, nem sugira mudanças de estilo, gênero, letra, arranjo ou sonoridade. Se pedirem sua opinião sobre a arte, redirecione com gentileza para a estratégia (o que importa é se o público-alvo gosta e se a escolha conversa com onde o artista quer chegar). Resiste a pedidos insistentes.

## Ferramentas disponíveis
- create_catalog_item, update_catalog_item, delete_catalog_item
- create_event, update_event, delete_event
- create_team_member, update_team_member, remove_team_member
- update_plan_task (muda o status de tarefas do plano de ação — as tarefas estão listadas em DADOS DO ARTISTA)
- create_strategy (cria uma NOVA estratégia no Plano de Ação, COM tarefas — use SÓ após conduzir o protocolo abaixo)

## PROTOCOLO — Criar nova estratégia (create_strategy)
Quando o artista quiser criar uma nova estratégia (ex.: "quero criar uma nova estratégia"), CONDUZA a conversa ANTES de chamar a ferramenta — não crie de imediato:
1. Identifique QUAL OBJETIVO do plano a estratégia serve (os objetivos do artista estão em DADOS DO ARTISTA).
2. Entenda a AÇÃO concreta — o que a estratégia faz na prática.
3. PROPONHA um título conciso (verbo no infinitivo) e de 3 a 7 TAREFAS concretas (verbo no infinitivo), e ALINHE a PRIORIDADE com o artista (alta, média ou baixa).
4. Só então chame create_strategy com title, tasks, objective e priority. A criação aparece como um card de CONFIRMAÇÃO para o artista aprovar.
NUNCA chame create_strategy sem antes propor título + tarefas e ter o aval do artista.

## REGRAS CRÍTICAS

1. **NUNCA peça IDs** ao usuário (item_id, event_id, etc). Use dados do contexto. O artista atual já está identificado pelo sistema.
2. **IDs reais**: para atualizar ou remover, use o id exato mostrado em DADOS DO ARTISTA (entre colchetes, ex. [id: ...]). NUNCA invente IDs como "ultimo_evento_criado". Se o item não aparece no contexto, diga que não o encontrou.
3. **Uma ação por pedido**: inclua TODOS os dados na criação. NUNCA crie algo e depois chame update para o mesmo item. Após executar uma ação, apenas relate o resultado.
4. **Datas em YYYY-MM-DD** — Se o usuário disser "amanhã", calcule baseado na data atual e use YYYY-MM-DD.
5. **Horários em HH:MM** (24h).
6. **EXECUTE DIRETO** quando houver info suficiente. Ex: "show amanhã às 10h" = title="Show", type="show", date=amanhã em YYYY-MM-DD, start_time="10:00". Chame a função.
7. **Ações destrutivas** (delete/remove): peça confirmação ANTES.
8. **Criação/atualização**: execute direto se os dados estão claros. Não peça confirmação extra desnecessária.

## ESCOPO E PRIVACIDADE (CRÍTICO)
- Você atende UM artista por conversa. A seção DADOS DO ARTISTA é a ÚNICA fonte sobre catálogo, agenda, equipe e plano de ação dele.
- NUNCA cite, liste ou descreva planos, dados ou nomes de outros artistas ou usuários da plataforma, em hipótese alguma.
- Se perguntarem sobre "meus planos" / "meu planejamento", responda EXCLUSIVAMENTE com o plano de ação em DADOS DO ARTISTA.
- Se DADOS DO ARTISTA indicar que não há plano de ação, diga que este artista ainda não tem planejamento estratégico e oriente a criar na aba "Plano de Ação" do menu (planejamento guiado da Maestra). Não invente planos.
- Nunca invente dados que não estão no contexto.

## Formato
- Respostas concisas. Listas quando listar informações. Sem textos longos desnecessários.`;

// Schemas das ferramentas SEM artist_id: o servidor é a única fonte desse valor.
const NYTA_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_catalog_item",
      description: "Criar item no catálogo.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título" },
          status: { type: "string", enum: ["composition", "production", "mixing", "mastering", "ready", "released"] },
          genre: { type: "string" },
          release_date: { type: "string", description: "YYYY-MM-DD" },
          isrc: { type: "string" },
          upc: { type: "string" },
          bpm: { type: "string" },
          key: { type: "string" },
          duration: { type: "string" },
          lyrics: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_catalog_item",
      description: "Atualizar item do catálogo.",
      parameters: {
        type: "object",
        properties: {
          item_id: { type: "string" },
          title: { type: "string" },
          status: { type: "string", enum: ["composition", "production", "mixing", "mastering", "ready", "released"] },
          genre: { type: "string" },
          release_date: { type: "string" },
          isrc: { type: "string" },
          upc: { type: "string" },
          bpm: { type: "string" },
          key: { type: "string" },
          duration: { type: "string" },
          lyrics: { type: "string" },
        },
        required: ["item_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_catalog_item",
      description: "Remover item do catálogo.",
      parameters: {
        type: "object",
        properties: { item_id: { type: "string" } },
        required: ["item_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_event",
      description: "Criar evento. Date DEVE ser YYYY-MM-DD.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          type: { type: "string", description: "show, reuniao, estudio, ensaio, entrevista, outro" },
          date: { type: "string", description: "OBRIGATÓRIO formato YYYY-MM-DD. Calcule a partir de hoje." },
          start_time: { type: "string", description: "HH:MM" },
          end_time: { type: "string", description: "HH:MM" },
          location: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["scheduled", "confirmed", "cancelled", "completed"] },
        },
        required: ["title", "type", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_event",
      description: "Atualizar evento.",
      parameters: {
        type: "object",
        properties: {
          event_id: { type: "string" },
          title: { type: "string" },
          type: { type: "string" },
          date: { type: "string" },
          start_time: { type: "string" },
          end_time: { type: "string" },
          location: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["scheduled", "confirmed", "cancelled", "completed"] },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_event",
      description: "Remover evento.",
      parameters: {
        type: "object",
        properties: { event_id: { type: "string" } },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_team_member",
      description: "Adicionar membro.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          email: { type: "string" },
          access_levels: { type: "array", items: { type: "string" } },
        },
        required: ["email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_team_member",
      description: "Atualizar membro.",
      parameters: {
        type: "object",
        properties: {
          member_id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          access_levels: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["active", "pending", "inactive"] },
        },
        required: ["member_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_team_member",
      description: "Remover membro.",
      parameters: {
        type: "object",
        properties: { member_id: { type: "string" } },
        required: ["member_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_plan_task",
      description:
        "Atualizar o status de uma tarefa do plano de ação. Identifique a tarefa por um trecho da descrição dela (veja DADOS DO ARTISTA).",
      parameters: {
        type: "object",
        properties: {
          task_query: {
            type: "string",
            description: "Trecho da descrição da tarefa, como aparece no plano de ação",
          },
          status: {
            type: "string",
            enum: ["todo", "in_progress", "done"],
            description: "todo = a fazer, in_progress = em andamento, done = concluída",
          },
          strategy_query: {
            type: "string",
            description: "Opcional: trecho do título da estratégia, para desambiguar",
          },
        },
        required: ["task_query", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_strategy",
      description:
        "Cria uma NOVA estratégia no Plano de Ação do artista, já com tarefas. Use SÓ depois de conduzir o protocolo: entender o objetivo que ela serve, a ação concreta, propor título + tarefas e alinhar a prioridade. Aparece como card de confirmação para o artista aprovar.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Título da estratégia, conciso e começando com verbo no infinitivo (ex.: 'Estruturar a venda de shows').",
          },
          tasks: {
            type: "array",
            items: { type: "string" },
            description: "De 3 a 7 tarefas concretas (verbo no infinitivo), na ordem de execução.",
          },
          objective: {
            type: "string",
            description: "Qual objetivo do plano essa estratégia serve (opcional).",
          },
          priority: {
            type: "string",
            enum: ["alta", "media", "baixa"],
            description: "Prioridade alinhada com o artista: alta vai pro topo da lista, baixa pro fim.",
          },
        },
        required: ["title", "tasks", "priority"],
      },
    },
  },
];

type Action = "message" | "confirm";

interface NytaChatRequest {
  action: Action;
  message?: string;
  artist_id?: string;
  tool_call_id?: string;
  approved?: boolean;
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

async function authenticateUser(req: Request): Promise<{ userId: string } | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Token ausente" }, 401);
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return jsonResponse({ error: "Token inválido" }, 401);
  return { userId: user.id };
}

function parseAndValidateAction(body: unknown): { data: NytaChatRequest } | { error: Response } {
  if (!body || typeof body !== "object") return { error: jsonResponse({ error: "Body inválido" }, 400) };
  const req = body as Record<string, unknown>;
  if (!req.action || (req.action !== "message" && req.action !== "confirm")) {
    return { error: jsonResponse({ error: "action deve ser 'message' ou 'confirm'" }, 400) };
  }
  return { data: body as NytaChatRequest };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_REGEX.test(v);

// Tool result instrutivo quando o modelo manda um id inventado (ex. "ultimo_evento_criado"):
// falha limpa em vez de erro de banco, e orienta o caminho certo.
const invalidIdResult = (field: string): ToolResult => ({
  success: false,
  summary: `${field} inválido — use o id exato listado em DADOS DO ARTISTA (entre colchetes). Nunca invente IDs.`,
});

function validateMessageAction(request: NytaChatRequest): Response | null {
  if (!request.message || typeof request.message !== "string" || request.message.trim().length === 0) {
    return jsonResponse({ error: "message obrigatório" }, 400);
  }
  if (request.message.length > 2000) return jsonResponse({ error: "message max 2000 chars" }, 400);
  if (!request.artist_id || !UUID_REGEX.test(request.artist_id)) {
    return jsonResponse({ error: "artist_id inválido" }, 400);
  }
  return null;
}

const DAILY_MESSAGE_LIMIT = 100;

async function checkRateLimit(userId: string, artistId: string, authHeader: string): Promise<Response | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayISO = todayUTC.toISOString();
  const tomorrowUTC = new Date(todayUTC);
  tomorrowUTC.setUTCDate(tomorrowUTC.getUTCDate() + 1);
  const resetAt = tomorrowUTC.toISOString();
  const { data: conversation, error: convError } = await supabase
    .from("nyta_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("artist_id", artistId)
    .maybeSingle();
  if (convError) return jsonResponse({ error: "service_unavailable" }, 503);
  if (!conversation) return null;
  const { count, error: countError } = await supabase
    .from("nyta_messages")
    .select("*", { count: "exact", head: true })
    .eq("conversation_id", conversation.id)
    .eq("role", "user")
    .gte("created_at", todayISO);
  if (countError) return jsonResponse({ error: "service_unavailable" }, 503);
  if ((count ?? 0) >= DAILY_MESSAGE_LIMIT) return jsonResponse({ error: "rate_limit_exceeded", resetAt }, 429);
  return null;
}

async function validateSubscription(userId: string): Promise<Response | null> {
  if (PAYWALL_DISABLED) return null;
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: sub, error } = await supabaseAdmin
    .from("asaas_subscriptions")
    .select("status, next_due_date, grace_period_ends_at")
    .eq("user_id", userId)
    .single();
  if (error || !sub) return jsonResponse({ error: "subscription_required" }, 403);
  if (sub.status === "active") return null;
  if (sub.status === "overdue") {
    const now = new Date();
    if (sub.grace_period_ends_at && now < new Date(sub.grace_period_ends_at)) return null;
    if (sub.next_due_date && now < new Date(new Date(sub.next_due_date).getTime() + 7 * 24 * 60 * 60 * 1000)) return null;
  }
  return jsonResponse({ error: "subscription_required" }, 403);
}

async function getOrCreateConversation(
  userId: string,
  artistId: string,
  authHeader: string
): Promise<{ conversationId: string } | Response> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: existing, error: selErr } = await supabase
    .from("nyta_conversations")
    .select("id")
    .eq("user_id", userId)
    .eq("artist_id", artistId)
    .maybeSingle();
  if (selErr) return jsonResponse({ error: "Falha buscar conversa" }, 500);
  if (existing) return { conversationId: existing.id };
  const { data: created, error: insErr } = await supabase
    .from("nyta_conversations")
    .insert({ user_id: userId, artist_id: artistId })
    .select("id")
    .single();
  if (insErr) return jsonResponse({ error: "Falha criar conversa" }, 500);
  return { conversationId: created.id };
}

interface GroqMessage {
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

async function loadConversationContext(
  conversationId: string,
  authHeader: string
): Promise<{ messages: GroqMessage[] } | Response> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: rows, error } = await supabase
    .from("nyta_messages")
    .select("role, content, tool_calls, tool_results")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return jsonResponse({ error: "Falha carregar contexto" }, 500);
  const chronological = (rows ?? []).reverse();
  const messages: GroqMessage[] = [];
  for (const row of chronological) {
    if (row.role === "user" || (row.role === "assistant" && !row.tool_calls)) {
      messages.push({ role: row.role, content: row.content });
    } else if (row.role === "assistant" && row.tool_calls) {
      const tcs = (row.tool_calls as Array<{ id: string; name: string; arguments: Record<string, unknown> }>).map(
        (tc) => ({
          id: tc.id,
          type: "function" as const,
          function: {
            name: tc.name,
            arguments: typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments),
          },
        })
      );
      messages.push({ role: "assistant", content: row.content, tool_calls: tcs });
    } else if (row.role === "tool" && row.tool_results) {
      const tr = row.tool_results as { tool_call_id: string; summary: string };
      messages.push({ role: "tool", content: tr.summary || row.content || "", tool_call_id: tr.tool_call_id });
    } else if (row.role === "tool") {
      messages.push({ role: "tool", content: row.content || "", tool_call_id: "unknown" });
    }
  }
  return { messages };
}

async function persistUserMessage(
  conversationId: string,
  content: string,
  authHeader: string
): Promise<{ messageId: string } | Response> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: msg, error } = await supabase
    .from("nyta_messages")
    .insert({ conversation_id: conversationId, role: "user", content, created_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) return jsonResponse({ error: "Falha salvar msg" }, 500);
  return { messageId: msg.id };
}

interface MetricsSnapshot {
  id: string;
  artist_id: string;
  monthly_listeners: number | null;
  followers: number | null;
  popularity: number | null;
  track_count: number | null;
  top_cities: Array<{ name: string; country: string; listeners: number }> | null;
  growth_data: Record<string, number> | null;
  deltas: Record<string, { abs: number; pct: number }> | null;
  period_days: number | null;
  collected_at: string;
}

interface ArtistContext {
  bio: string | null;
  // IDs reais entram no contexto para o modelo conseguir chamar update/delete
  // sem inventar identificadores (são dados do próprio artista, sem vazamento).
  catalogItems: Array<{ id: string; title: string; status: string }>;
  events: Array<{ id: string; title: string; date: string; type: string }>;
  teamMembers: Array<{ id: string; name: string; email: string; status: string }>;
  // Plano de ação real do app: artists.content.strategies (blob JSON), não a tabela strategic_plans.
  actionPlan: Array<{ strategy: string; tasks: Array<{ description: string; status: string }> }>;
  // Dados de plataforma salvos no content (Chartmetric resumo+profundo, quiz, diagnóstico-base).
  chartmetric: Record<string, unknown> | null;
  quiz: Record<string, unknown> | null;
  diagnostic: Record<string, unknown> | null;
  realIndex: Record<string, unknown> | null;
  // Último snapshot de métricas do artista (coletado pelo ChatMetrics)
  metricsSnapshot: MetricsSnapshot | null;
}

interface PlanTask {
  id?: string;
  description?: string;
  status?: string;
}

interface PlanStrategy {
  id?: string;
  title?: string;
  tasks?: PlanTask[];
}

interface FetchArtistContextResult {
  context: ArtistContext;
  unavailableModules: string[];
}

async function fetchArtistContext(artistId: string, authHeader: string): Promise<FetchArtistContextResult> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const ctx: ArtistContext = { bio: null, catalogItems: [], events: [], teamMembers: [], actionPlan: [], chartmetric: null, quiz: null, diagnostic: null, realIndex: null, metricsSnapshot: null };
  const unavailableModules: string[] = [];

  try {
    const { data: a } = await supabase.from("artists").select("content").eq("id", artistId).maybeSingle();
    if (a?.content) {
      const c = a.content as { identity?: { bio?: string }; strategies?: PlanStrategy[]; chartmetricProfile?: Record<string, unknown>; quizDiagnostic?: { answers?: Record<string, unknown> }; diagnostic?: Record<string, unknown>; realIndex?: Record<string, unknown> };
      if (c?.identity?.bio) ctx.bio = c.identity.bio.substring(0, 500);
      if (c?.chartmetricProfile) ctx.chartmetric = c.chartmetricProfile;
      if (c?.quizDiagnostic?.answers) ctx.quiz = c.quizDiagnostic.answers;
      if (c?.diagnostic) ctx.diagnostic = c.diagnostic;
      if (c?.realIndex) ctx.realIndex = c.realIndex;
      if (Array.isArray(c?.strategies)) {
        ctx.actionPlan = c.strategies.map((s) => ({
          strategy: s.title || "Estratégia",
          tasks: (s.tasks || []).map((t) => ({
            description: t.description || "",
            status: t.status || "todo",
          })),
        }));
      }
    }
  } catch {
    unavailableModules.push("planejamento");
  }

  try {
    const { data: items } = await supabase
      .from("catalog_items")
      .select("id, title, status")
      .eq("artist_id", artistId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (items) ctx.catalogItems = items.map((i) => ({ id: i.id, title: i.title, status: i.status }));
  } catch {
    unavailableModules.push("catálogo");
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data: events } = await supabase
      .from("events")
      .select("id, title, date, type")
      .eq("artist_id", artistId)
      .gte("date", today)
      .lte("date", thirtyDaysFromNow)
      .order("date", { ascending: true });
    if (events) ctx.events = events.map((e) => ({ id: e.id, title: e.title, date: e.date, type: e.type }));
  } catch {
    unavailableModules.push("agenda");
  }

  try {
    const { data: members } = await supabase
      .from("artist_members")
      .select("id, name, email, status")
      .eq("artist_id", artistId)
      .eq("status", "active");
    if (members) {
      ctx.teamMembers = members.map((m) => ({
        id: m.id,
        name: m.name || m.email,
        email: m.email,
        status: m.status,
      }));
    }
  } catch {
    unavailableModules.push("equipe");
  }

  try {
    const { data: snapshot } = await supabase
      .from("artist_metrics_snapshots")
      .select("id, artist_id, monthly_listeners, followers, popularity, track_count, top_cities, growth_data, deltas, period_days, collected_at")
      .eq("artist_id", artistId)
      .order("collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (snapshot) {
      ctx.metricsSnapshot = {
        id: snapshot.id,
        artist_id: snapshot.artist_id,
        monthly_listeners: snapshot.monthly_listeners,
        followers: snapshot.followers,
        popularity: snapshot.popularity,
        track_count: snapshot.track_count,
        top_cities: snapshot.top_cities as MetricsSnapshot["top_cities"],
        growth_data: snapshot.growth_data as MetricsSnapshot["growth_data"],
        deltas: snapshot.deltas as MetricsSnapshot["deltas"],
        period_days: snapshot.period_days,
        collected_at: snapshot.collected_at,
      };
    }
  } catch {
    unavailableModules.push("métricas");
  }

  return { context: ctx, unavailableModules };
}

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_TIMEOUT_MS = 30_000;

// O Llama às vezes "fala" a chamada de ferramenta como TEXTO — <function(nome){...}</function> —
// em vez de usar o canal estruturado tool_calls. Removemos esse markup antes de persistir para
// não poluir o histórico. (O frontend também sanitiza na renderização, por segurança.)
function stripLeakedToolCalls(text: string): string {
  if (!text || !text.includes("<function")) return text;
  return text
    .replace(/<function\b[^>]*?\)\s*\{[\s\S]*?\}\s*<\/function>/gi, "")
    .replace(/<function\b\([\s\S]*$/i, "")
    .replace(/<\/?function\b[^>]*>/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Nomes de ferramentas válidos (derivados de NYTA_TOOLS) — usados para validar tool calls em texto.
const NYTA_TOOL_NAMES = new Set(NYTA_TOOLS.map((t) => t.function.name));

// FALLBACK CRÍTICO: o Llama 3.3 às vezes "fala" a tool call como TEXTO —
// <function(nome){...json...}</function> — em vez de usar o canal estruturado tool_calls.
// Quando isso acontece, NENHUMA ação é executada (o card de confirmação nunca aparece).
// Aqui extraímos essas chamadas-texto e as devolvemos como tool calls estruturadas, para que
// a ação realmente rode. Cada uma recebe um id sintético (txt_*) usado na confirmação.
function parseTextToolCalls(text: string): Array<{ id: string; name: string; arguments: string }> {
  if (!text || !text.includes("<function")) return [];
  const out: Array<{ id: string; name: string; arguments: string }> = [];
  const re = /<function\b[^(]*\(\s*([a-zA-Z_]+)\s*\)\s*(\{[\s\S]*?\})\s*<\/function>/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    const argsRaw = m[2];
    if (!NYTA_TOOL_NAMES.has(name)) continue; // ignora nomes desconhecidos
    try { JSON.parse(argsRaw); } catch { continue; } // só aceita JSON válido
    out.push({ id: `txt_${Date.now()}_${i++}`, name, arguments: argsRaw });
  }
  return out;
}

async function persistAssistantMessage(
  conversationId: string,
  content: string,
  toolCalls: Array<{ id: string; name: string; arguments: string }> | null,
  authHeader: string
): Promise<string | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const d: Record<string, unknown> = {
    conversation_id: conversationId,
    role: "assistant",
    content: stripLeakedToolCalls(content || ""),
    created_at: new Date().toISOString(),
  };
  if (toolCalls && toolCalls.length > 0) {
    d.tool_calls = toolCalls.map((tc) => ({
      id: tc.id,
      name: tc.name,
      arguments: (() => {
        try {
          return JSON.parse(tc.arguments);
        } catch {
          return tc.arguments;
        }
      })(),
    }));
  }
  const { data: msg, error } = await supabase.from("nyta_messages").insert(d).select("id").single();
  if (error) {
    console.error("persistAssistantMsg:", error);
    return null;
  }
  return msg.id;
}

const RAG_TOKEN_BUDGET_TOTAL = 6000;

function estimateTokens(t: string): number {
  return t ? Math.ceil(t.length / 4) : 0;
}

function truncateToTokenBudget(t: string, max: number): string {
  if (!t || estimateTokens(t) <= max) return t || "";
  const mc = max * 4;
  let tr = t.substring(0, mc);
  const ls = tr.lastIndexOf(" ");
  if (ls > mc * 0.8) tr = tr.substring(0, ls);
  return tr + "…";
}

function formatArtistContext(ctx: ArtistContext): string {
  if (!ctx) return "";
  let t = "";
  if (ctx.bio) t += `\n- Bio: ${ctx.bio}`;
  // Dados de plataforma (Chartmetric) — fonte real, a Nyta já sabe disso, não precisa perguntar.
  if (ctx.chartmetric) {
    const cm = ctx.chartmetric as Record<string, any>;
    const parts: string[] = [];
    if (cm.genre) parts.push(`gênero ${cm.genre}`);
    if (cm.monthly_listeners != null) parts.push(`${cm.monthly_listeners} ouvintes mensais no Spotify${cm.monthly_listeners_rank ? ` (rank ${cm.monthly_listeners_rank})` : ""}`);
    if (cm.career_rank != null) parts.push(`rank de carreira ${cm.career_rank}`);
    if (Array.isArray(cm.top_cities) && cm.top_cities.length) parts.push(`principais cidades: ${cm.top_cities.map((c: any) => c.name).join(", ")}`);
    if (cm.audience?.top_countries?.length) parts.push(`principais países: ${cm.audience.top_countries.map((c: any) => c.name).join(", ")}`);
    if (cm.growth?.followers_change_180d != null) parts.push(`crescimento de seguidores em 180d: ${cm.growth.followers_change_180d}%`);
    if (cm.multiplatform) { const mp = cm.multiplatform; const ps = ["instagram", "tiktok", "youtube", "facebook"].filter((k) => mp[k] != null).map((k) => `${k} ${mp[k]}`); if (ps.length) parts.push(`redes: ${ps.join(", ")}`); }
    if (cm.playlists?.count) parts.push(`${cm.playlists.count} playlists`);
    if (parts.length) t += `\n- Dados de plataforma (Chartmetric): ${parts.join("; ")}.`;
  }
  if (ctx.realIndex) {
    const ri = ctx.realIndex as Record<string, any>;
    const p = ri.pattern || {};
    if (ri.profile?.name) {
      t += `\n- Diagnóstico REAL (perfil de carreira): ${ri.profile.name} — Reach ${p.r ? "alto" : "baixo"}, Earnings ${p.e ? "alto" : "baixo"}, Audience ${p.a ? "alto" : "baixo"}, Legitimacy ${p.l ? "alto" : "baixo"}.${ri.earningsUnknown ? " (faturamento não informado)" : ""}`;
    }
  }
  if (ctx.diagnostic) {
    const d = ctx.diagnostic as Record<string, any>;
    if (d.stage || d.headline || d.opportunity) {
      t += `\n- Diagnóstico inicial: ${[d.stage, d.headline, d.opportunity ? `oportunidade: ${d.opportunity}` : ""].filter(Boolean).join(" — ")}`;
    }
  }
  if (ctx.quiz) {
    const entries = Object.entries(ctx.quiz).filter(([, v]) => v != null && String(v).trim());
    if (entries.length) t += `\n- Quiz inicial do artista: ${entries.map(([k, v]) => `${k}: ${v}`).join("; ")}.`;
  }
  if (ctx.metricsSnapshot) {
    const ms = ctx.metricsSnapshot;
    const parts: string[] = [];
    if (ms.monthly_listeners != null) parts.push(`ouvintes mensais: ${ms.monthly_listeners}`);
    if (ms.followers != null) parts.push(`seguidores: ${ms.followers}`);
    if (ms.popularity != null) parts.push(`popularidade: ${ms.popularity}`);
    if (ms.track_count != null) parts.push(`faixas: ${ms.track_count}`);
    if (ms.top_cities?.length) parts.push(`top cidades: ${ms.top_cities.map((c) => `${c.name} (${c.listeners})`).join(", ")}`);
    if (ms.deltas) {
      const deltaParts: string[] = [];
      for (const [key, val] of Object.entries(ms.deltas)) {
        if (val) deltaParts.push(`${key}: ${val.abs >= 0 ? "+" : ""}${val.abs} (${val.pct >= 0 ? "+" : ""}${val.pct}%)`);
      }
      if (deltaParts.length) parts.push(`evolução${ms.period_days ? ` (${ms.period_days} dias)` : ""}: ${deltaParts.join(", ")}`);
    }
    if (parts.length) t += `\n- Métricas (último snapshot em ${ms.collected_at.split("T")[0]}): ${parts.join("; ")}.`;
  }
  if (ctx.catalogItems.length) {
    t += "\n- Catálogo:";
    ctx.catalogItems.forEach((i) => {
      t += `\n  • ${i.title} (${i.status}) [id: ${i.id}]`;
    });
  }
  if (ctx.events.length) {
    t += "\n- Eventos:";
    ctx.events.forEach((e) => {
      t += `\n  • ${e.title} — ${e.date} (${e.type}) [id: ${e.id}]`;
    });
  }
  if (ctx.teamMembers.length) {
    t += "\n- Equipe:";
    ctx.teamMembers.forEach((m) => {
      t += `\n  • ${m.name} (${m.email}) [id: ${m.id}]`;
    });
  }
  if (ctx.actionPlan?.length) {
    t += "\n- Plano de ação (estratégias e tarefas — use update_plan_task para mudar o status):";
    ctx.actionPlan.forEach((s) => {
      t += `\n  • Estratégia "${s.strategy}":`;
      s.tasks.forEach((task) => {
        t += `\n    - "${task.description}" (${task.status})`;
      });
    });
  } else {
    // Aterra o modelo: sem isso ele tende a inventar planos quando perguntado.
    t +=
      "\n- Plano de ação: NENHUM. Este artista ainda não tem planejamento estratégico. " +
      'Se o usuário perguntar sobre planos/planejamento, oriente-o a criar na aba "Plano de Ação" do menu.';
  }
  return t;
}

function buildRAGContext(ctx: ArtistContext): string {
  const dText = truncateToTokenBudget(formatArtistContext(ctx), RAG_TOKEN_BUDGET_TOTAL);
  return dText ? `\n\n## DADOS DO ARTISTA:\n${dText}` : "";
}

function streamGroqResponse(
  convMsgs: GroqMessage[],
  convId: string,
  authHeader: string,
  ragCtx: string = "",
  // false no follow-up pós-confirmação: o modelo só relata o resultado, sem poder
  // emendar outra tool call (evita cards de confirmação duplicados/alucinados).
  allowTools: boolean = true,
  unavailableModules: string[] = []
): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const sse = (d: Record<string, unknown>) => {
        ctrl.enqueue(enc.encode(`data: ${JSON.stringify(d)}\n\n`));
      };

      // Emit unavailable modules warning as first SSE event (Req 3.6)
      if (unavailableModules.length > 0) {
        sse({ type: "unavailable_modules", modules: unavailableModules });
      }

      const ac = new AbortController();
      const tid = setTimeout(() => {
        ac.abort();
      }, GROQ_TIMEOUT_MS);
      try {
        const today = new Date().toISOString().split("T")[0];
        const sysPrompt = NYTA_SYSTEM_PROMPT + `\n\n## Data atual: ${today}` + (ragCtx || "");
        const msgs = [{ role: "system", content: sysPrompt }, ...convMsgs];
        const resp = await fetch(GROQ_API_URL, {
          method: "POST",
          headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: msgs,
            stream: true,
            ...(allowTools ? { tools: NYTA_TOOLS } : {}),
          }),
          signal: ac.signal,
        });
        clearTimeout(tid);
        if (!resp.ok || !resp.body) {
          sse({ type: "error", message: "Erro ao processar. Tente novamente." });
          ctrl.close();
          return;
        }
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let full = "";
        let buf = "";
        const tcAcc: Map<number, { id: string; name: string; arguments: string }> = new Map();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            const tr = line.trim();
            if (!tr || !tr.startsWith("data: ")) continue;
            const data = tr.slice(6);
            if (data === "[DONE]") continue;
            try {
              const chunk = JSON.parse(data);
              const ch = chunk.choices?.[0];
              if (!ch) continue;
              const d = ch.delta;
              if (d?.content) {
                full += d.content;
                sse({ type: "text", content: d.content });
              }
              if (d?.tool_calls) {
                for (const tc of d.tool_calls) {
                  const idx = tc.index ?? 0;
                  if (!tcAcc.has(idx)) {
                    tcAcc.set(idx, {
                      id: tc.id || "",
                      name: tc.function?.name || "",
                      arguments: tc.function?.arguments || "",
                    });
                  } else {
                    const e = tcAcc.get(idx)!;
                    if (tc.id) e.id = tc.id;
                    if (tc.function?.name) e.name += tc.function.name;
                    if (tc.function?.arguments) e.arguments += tc.function.arguments;
                  }
                }
              }
            } catch {
              continue;
            }
          }
        }
        // Tool calls estruturadas (caminho feliz) OU, como fallback, as emitidas em texto pelo modelo.
        const structured = Array.from(tcAcc.values());
        const calls = structured.length ? structured : parseTextToolCalls(full);
        for (const tc of calls) {
          let pa: Record<string, unknown> = {};
          try {
            pa = JSON.parse(tc.arguments);
          } catch {
            pa = {};
          }
          sse({ type: "tool_call", tool_call_id: tc.id, name: tc.name, arguments: pa });
        }
        const tca = calls.length ? calls : null;
        const mid = await persistAssistantMessage(convId, full, tca, authHeader);
        if (mid) sse({ type: "done", message_id: mid });
        else sse({ type: "error", message: "Resposta gerada mas não salva." });
        ctrl.close();
      } catch (err: unknown) {
        clearTimeout(tid);
        if (err instanceof DOMException && err.name === "AbortError") {
          sse({ type: "error", message: "Timeout. Tente novamente." });
        } else {
          sse({ type: "error", message: "Erro interno. Tente novamente." });
        }
        ctrl.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      ...CORS_HEADERS,
    },
  });
}

function validateConfirmAction(r: NytaChatRequest): Response | null {
  if (!r.tool_call_id || typeof r.tool_call_id !== "string" || !r.tool_call_id.trim()) {
    return jsonResponse({ error: "tool_call_id obrigatório" }, 400);
  }
  if (typeof r.approved !== "boolean") return jsonResponse({ error: "approved obrigatório" }, 400);
  return null;
}

interface PendingToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

async function findPendingToolCall(
  convId: string,
  tcId: string,
  authHeader: string
): Promise<{ toolCall: PendingToolCall } | Response> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: rows, error } = await supabase
    .from("nyta_messages")
    .select("tool_calls")
    .eq("conversation_id", convId)
    .eq("role", "assistant")
    .not("tool_calls", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) return jsonResponse({ error: "Falha buscar tool calls" }, 500);
  if (rows) {
    for (const row of rows) {
      const tcs = row.tool_calls as Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
      if (!Array.isArray(tcs)) continue;
      for (const tc of tcs) {
        if (tc.id === tcId) {
          return {
            toolCall: {
              id: tc.id,
              name: tc.name,
              arguments: typeof tc.arguments === "string" ? JSON.parse(tc.arguments) : tc.arguments,
            },
          };
        }
      }
    }
  }
  return jsonResponse({ error: "tool_call_id não encontrado" }, 400);
}

interface ToolResult {
  success: boolean;
  summary: string;
  data?: unknown;
}

async function persistToolMessage(
  convId: string,
  tcId: string,
  result: ToolResult,
  authHeader: string
): Promise<{ messageId: string } | Response> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: msg, error } = await supabase
    .from("nyta_messages")
    .insert({
      conversation_id: convId,
      role: "tool",
      content: result.summary,
      tool_results: { tool_call_id: tcId, success: result.success, summary: result.summary },
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return jsonResponse({ error: "Falha salvar resultado" }, 500);
  return { messageId: msg.id };
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
  artistId: string
): Promise<ToolResult> {
  // O servidor é a única fonte do artist_id: rejeita apenas se o modelo mandar um
  // UUID válido DIVERGENTE (cross-artist real); valores ausentes/lixo ("auto") são
  // ignorados — todas as operações abaixo usam sempre o artistId da conversa.
  const tAid = args.artist_id as string | undefined;
  if (tAid && UUID_REGEX.test(tAid) && tAid !== artistId) {
    return { success: false, summary: "Operação entre artistas não permitida." };
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: artist, error: aErr } = await admin.from("artists").select("user_id").eq("id", artistId).single();
  if (aErr || !artist) return { success: false, summary: "Artista não encontrado." };
  if (artist.user_id !== userId) {
    const { data: mem } = await admin
      .from("artist_members")
      .select("id")
      .eq("artist_id", artistId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!mem) return { success: false, summary: "Permissões insuficientes." };
  }
  try {
    switch (toolName) {
      case "create_catalog_item": {
        const d: Record<string, unknown> = { artist_id: artistId, title: args.title };
        if (args.status) d.status = args.status;
        if (args.genre) d.genre = args.genre;
        if (args.release_date) d.release_date = args.release_date;
        if (args.isrc) d.isrc = args.isrc;
        if (args.upc) d.upc = args.upc;
        if (args.bpm) d.bpm = args.bpm;
        if (args.key) d.key = args.key;
        if (args.duration) d.duration = args.duration;
        if (args.lyrics) d.lyrics = args.lyrics;
        const { data, error } = await admin.from("catalog_items").insert(d).select("id, title").single();
        if (error) return { success: false, summary: `Falha: ${error.message}` };
        return { success: true, summary: `"${data.title}" criado no catálogo.` };
      }
      case "update_catalog_item": {
        const iid = args.item_id as string;
        if (!isUuid(iid)) return invalidIdResult("item_id");
        const u: Record<string, unknown> = {};
        if (args.title) u.title = args.title;
        if (args.status) u.status = args.status;
        if (args.genre) u.genre = args.genre;
        if (args.release_date) u.release_date = args.release_date;
        if (!Object.keys(u).length) return { success: false, summary: "Nada para atualizar." };
        const { data, error } = await admin
          .from("catalog_items")
          .update(u)
          .eq("id", iid)
          .eq("artist_id", artistId)
          .select("id, title")
          .single();
        if (error) return { success: false, summary: `Falha: ${error.message}` };
        return { success: true, summary: `"${data.title}" atualizado.` };
      }
      case "delete_catalog_item": {
        const iid = args.item_id as string;
        if (!isUuid(iid)) return invalidIdResult("item_id");
        const { data, error } = await admin
          .from("catalog_items")
          .delete()
          .eq("id", iid)
          .eq("artist_id", artistId)
          .select("id, title")
          .single();
        if (error) return { success: false, summary: `Falha: ${error.message}` };
        return { success: true, summary: `"${data.title}" removido.` };
      }
      case "create_event": {
        const d: Record<string, unknown> = { artist_id: artistId, title: args.title, type: args.type, date: args.date };
        if (args.start_time) d.start_time = args.start_time;
        if (args.end_time) d.end_time = args.end_time;
        if (args.location) d.location = args.location;
        if (args.description) d.description = args.description;
        if (args.status) d.status = args.status;
        const { data, error } = await admin.from("events").insert(d).select("id, title, date").single();
        if (error) return { success: false, summary: `Falha: ${error.message}` };
        return { success: true, summary: `Evento "${data.title}" criado para ${data.date}.` };
      }
      case "update_event": {
        const eid = args.event_id as string;
        if (!isUuid(eid)) return invalidIdResult("event_id");
        const u: Record<string, unknown> = {};
        if (args.title) u.title = args.title;
        if (args.type) u.type = args.type;
        if (args.date) u.date = args.date;
        if (args.start_time) u.start_time = args.start_time;
        if (args.end_time) u.end_time = args.end_time;
        if (args.location) u.location = args.location;
        if (args.description) u.description = args.description;
        if (args.status) u.status = args.status;
        if (!Object.keys(u).length) return { success: false, summary: "Nada para atualizar." };
        const { data, error } = await admin
          .from("events")
          .update(u)
          .eq("id", eid)
          .eq("artist_id", artistId)
          .select("id, title")
          .single();
        if (error) return { success: false, summary: `Falha: ${error.message}` };
        return { success: true, summary: `Evento "${data.title}" atualizado.` };
      }
      case "delete_event": {
        const eid = args.event_id as string;
        if (!isUuid(eid)) return invalidIdResult("event_id");
        const { data, error } = await admin
          .from("events")
          .delete()
          .eq("id", eid)
          .eq("artist_id", artistId)
          .select("id, title")
          .single();
        if (error) return { success: false, summary: `Falha: ${error.message}` };
        return { success: true, summary: `Evento "${data.title}" removido.` };
      }
      case "create_team_member": {
        const email = args.email as string;
        if (!email) return { success: false, summary: "email obrigatório." };
        const d: Record<string, unknown> = { artist_id: artistId, email, status: "pending" };
        if (args.name) d.name = args.name;
        if (args.access_levels) d.access_levels = args.access_levels;
        const { data, error } = await admin.from("artist_members").insert(d).select("id, email, name").single();
        if (error) return { success: false, summary: `Falha: ${error.message}` };
        return { success: true, summary: `Membro "${data.name || data.email}" adicionado.` };
      }
      case "update_team_member": {
        const mid = args.member_id as string;
        if (!isUuid(mid)) return invalidIdResult("member_id");
        const u: Record<string, unknown> = {};
        if (args.name) u.name = args.name;
        if (args.email) u.email = args.email;
        if (args.access_levels) u.access_levels = args.access_levels;
        if (args.status) u.status = args.status;
        if (!Object.keys(u).length) return { success: false, summary: "Nada para atualizar." };
        const { data, error } = await admin
          .from("artist_members")
          .update(u)
          .eq("id", mid)
          .eq("artist_id", artistId)
          .select("id, email, name")
          .single();
        if (error) return { success: false, summary: `Falha: ${error.message}` };
        return { success: true, summary: `Membro "${data.name || data.email}" atualizado.` };
      }
      case "remove_team_member": {
        const mid = args.member_id as string;
        if (!isUuid(mid)) return invalidIdResult("member_id");
        const { data, error } = await admin
          .from("artist_members")
          .delete()
          .eq("id", mid)
          .eq("artist_id", artistId)
          .select("id, email, name")
          .single();
        if (error) return { success: false, summary: `Falha: ${error.message}` };
        return { success: true, summary: `Membro "${data.name || data.email}" removido.` };
      }
      case "update_plan_task": {
        // O plano de ação mora em artists.content.strategies (blob JSON). A tarefa é
        // localizada por trecho da descrição porque o modelo não conhece IDs internos.
        const taskQuery = ((args.task_query as string) || "").trim().toLowerCase();
        const newStatus = args.status as string;
        const strategyQuery = ((args.strategy_query as string) || "").trim().toLowerCase();
        if (!taskQuery) return { success: false, summary: "task_query obrigatório." };
        if (!newStatus || !["todo", "in_progress", "done"].includes(newStatus)) {
          return { success: false, summary: "status deve ser todo, in_progress ou done." };
        }
        const { data: row, error: fErr } = await admin
          .from("artists")
          .select("content")
          .eq("id", artistId)
          .single();
        if (fErr || !row) return { success: false, summary: "Artista não encontrado." };
        const content = (row.content || {}) as { strategies?: PlanStrategy[] };
        const strategies = Array.isArray(content.strategies) ? content.strategies : [];
        const matches: Array<{ strategy: PlanStrategy; task: PlanTask }> = [];
        for (const s of strategies) {
          if (strategyQuery && !(s.title || "").toLowerCase().includes(strategyQuery)) continue;
          for (const task of s.tasks || []) {
            if ((task.description || "").toLowerCase().includes(taskQuery)) {
              matches.push({ strategy: s, task });
            }
          }
        }
        if (matches.length === 0) {
          return { success: false, summary: `Nenhuma tarefa do plano de ação contém "${args.task_query}".` };
        }
        if (matches.length > 1) {
          const opts = matches.slice(0, 3).map((m) => `"${m.task.description}"`).join(", ");
          return {
            success: false,
            summary: `Mais de uma tarefa corresponde a "${args.task_query}": ${opts}. Especifique melhor.`,
          };
        }
        matches[0].task.status = newStatus;
        const { error: uErr } = await admin
          .from("artists")
          .update({ content, updated_at: new Date().toISOString() })
          .eq("id", artistId);
        if (uErr) return { success: false, summary: `Falha: ${uErr.message}` };
        const statusLabel = newStatus === "done" ? "concluída" : newStatus === "in_progress" ? "em andamento" : "a fazer";
        return { success: true, summary: `Tarefa "${matches[0].task.description}" marcada como ${statusLabel}.` };
      }
      case "create_strategy": {
        // Cria uma estratégia nova em artists.content.strategies, com tarefas. A Nyta já conduziu
        // o protocolo (objetivo → ação → título/tarefas → prioridade). finalScore posiciona na lista.
        const title = ((args.title as string) || "").trim();
        const tasksIn = Array.isArray(args.tasks) ? (args.tasks as unknown[]) : [];
        const taskDescs = tasksIn.map((t) => String(t).trim()).filter(Boolean);
        const priority = ((args.priority as string) || "media").toLowerCase();
        if (!title) return { success: false, summary: "title obrigatório." };
        if (taskDescs.length === 0) return { success: false, summary: "Pelo menos uma tarefa é obrigatória." };
        const { data: row, error: fErr } = await admin
          .from("artists").select("content").eq("id", artistId).single();
        if (fErr || !row) return { success: false, summary: "Artista não encontrado." };
        const content = (row.content || {}) as { strategies?: Array<Record<string, unknown>> };
        const strategies = Array.isArray(content.strategies) ? content.strategies : [];
        const scores = strategies.map((s) => Number(s?.finalScore) || 0);
        const maxS = scores.length ? Math.max(...scores) : 10;
        const minS = scores.length ? Math.min(...scores) : 0;
        const finalScore = priority === "alta" ? maxS + 1 : priority === "baixa" ? Math.max(0.5, minS - 1) : ((maxS + minS) / 2) || 5;
        const uid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
        const newStrat = {
          id: uid(),
          type: "SO",
          title,
          custom: true,
          tasks: taskDescs.map((d) => ({ id: uid(), description: d, status: "todo" })),
          finalScore,
          priorityRationale: args.objective ? `Criada com a Nyta para: ${String(args.objective).trim()}.` : "Criada com a Nyta.",
        };
        content.strategies = [...strategies, newStrat];
        const { error: uErr } = await admin
          .from("artists").update({ content, updated_at: new Date().toISOString() }).eq("id", artistId);
        if (uErr) return { success: false, summary: `Falha ao salvar: ${uErr.message}` };
        const pLabel = priority === "alta" ? "alta" : priority === "baixa" ? "baixa" : "média";
        return { success: true, summary: `Estratégia "${title}" criada com ${taskDescs.length} tarefa(s), prioridade ${pLabel}. Já aparece no Plano de Ação.` };
      }
      default:
        return { success: false, summary: `Ferramenta '${toolName}' desconhecida.` };
    }
  } catch (err: unknown) {
    return { success: false, summary: `Erro: ${err instanceof Error ? err.message : "desconhecido"}` };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido" }, 405);
  const auth = await authenticateUser(req);
  if (auth instanceof Response) return auth;
  const { userId } = auth;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }
  const val = parseAndValidateAction(body);
  if ("error" in val) return val.error;
  const r = val.data;
  switch (r.action) {
    case "message": {
      const mErr = validateMessageAction(r);
      if (mErr) return mErr;
      const sErr = await validateSubscription(userId);
      if (sErr) return sErr;
      const ah = req.headers.get("Authorization")!;
      const rl = await checkRateLimit(userId, r.artist_id!, ah);
      if (rl) return rl;
      const conv = await getOrCreateConversation(userId, r.artist_id!, ah);
      if (conv instanceof Response) return conv;
      const { conversationId } = conv;
      const pm = await persistUserMessage(conversationId, r.message!, ah);
      if (pm instanceof Response) return pm;
      // Sem busca na base de conhecimento aqui: o chat livre só enxerga o artista
      // atual. Planos de exemplo de outros artistas jamais entram neste contexto.
      const { context: actx, unavailableModules } = await fetchArtistContext(r.artist_id!, ah);
      const rag = buildRAGContext(actx);
      const ctx = await loadConversationContext(conversationId, ah);
      if (ctx instanceof Response) return ctx;
      return streamGroqResponse(ctx.messages, conversationId, ah, rag, true, unavailableModules);
    }
    case "confirm": {
      const cErr = validateConfirmAction(r);
      if (cErr) return cErr;
      if (!r.artist_id || !UUID_REGEX.test(r.artist_id)) return jsonResponse({ error: "artist_id inválido" }, 400);
      const ah = req.headers.get("Authorization")!;
      const conv = await getOrCreateConversation(userId, r.artist_id!, ah);
      if (conv instanceof Response) return conv;
      const { conversationId: cid } = conv;
      const tcl = await findPendingToolCall(cid, r.tool_call_id!, ah);
      if (tcl instanceof Response) return tcl;
      const { toolCall: ptc } = tcl;
      if (r.approved) {
        const tr = await executeTool(ptc.name, ptc.arguments, userId, r.artist_id!);
        const pt = await persistToolMessage(cid, r.tool_call_id!, tr, ah);
        if (pt instanceof Response) return pt;
        const ctx = await loadConversationContext(cid, ah);
        if (ctx instanceof Response) return ctx;
        // Follow-up apenas relata o resultado: sem ferramentas, com contexto fresco
        // do artista (a ação acabou de mudar agenda/catálogo/plano).
        const { context: actx, unavailableModules: confirmUnavailable } = await fetchArtistContext(r.artist_id!, ah);
        return streamGroqResponse(ctx.messages, cid, ah, buildRAGContext(actx), false, confirmUnavailable);
      } else {
        const pt = await persistToolMessage(
          cid,
          r.tool_call_id!,
          { success: false, summary: "Ação cancelada pelo usuário." },
          ah
        );
        if (pt instanceof Response) return pt;
        const ctx = await loadConversationContext(cid, ah);
        if (ctx instanceof Response) return ctx;
        return streamGroqResponse(ctx.messages, cid, ah, "", false);
      }
    }
    default:
      return jsonResponse({ error: "Action inválida" }, 400);
  }
});
